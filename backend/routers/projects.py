from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, Integer, case
from typing import List
from datetime import datetime
from database import get_db
import models, schemas

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _year_from_date(date_str: str):
    """Returns (2-digit str, 4-digit str) from YYYY-MM-DD or today."""
    if date_str and len(date_str) >= 4:
        y4 = date_str[:4]
        return y4[2:], y4
    y = str(datetime.now().year)
    return y[2:], y


def _generate_project_code(prefix: str, start_date: str, db: Session, exclude_id: int = None) -> str:
    prefix = (prefix or "PT").upper().strip()[:10]
    y2, y4 = _year_from_date(start_date)
    # Count existing projects that already have a project_code in the same year
    q = db.query(models.Project).filter(
        models.Project.project_code.isnot(None),
        models.Project.start_date.like(f"{y4}%"),
    )
    if exclude_id:
        q = q.filter(models.Project.id != exclude_id)
    seq = q.count() + 1
    return f"{prefix}{y2}_{seq:04d}"


@router.get("", response_model=List[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(models.Project).order_by(models.Project.created_at.desc()).all()
    result = []
    for p in projects:
        counts = (
            db.query(
                func.count(models.Finding.id).label("total"),
                func.sum(case((models.Finding.status == "Open", 1), else_=0)).label("open"),
                func.sum(case((models.Finding.risk_rating == "Critical", 1), else_=0)).label("critical"),
                func.sum(case((models.Finding.risk_rating == "High", 1), else_=0)).label("high"),
            )
            .filter(models.Finding.project_id == p.id)
            .first()
        )
        out = schemas.ProjectOut.model_validate(p)
        out.findings_count = counts.total or 0
        out.open_count = counts.open or 0
        out.critical_count = counts.critical or 0
        out.high_count = counts.high or 0
        result.append(out)
    return result


@router.post("", response_model=schemas.ProjectOut, status_code=201)
def create_project(data: schemas.ProjectCreate, db: Session = Depends(get_db)):
    project = models.Project(**data.model_dump())
    project.project_code = _generate_project_code(data.prefix, data.start_date, db)
    db.add(project)
    db.commit()
    db.refresh(project)
    out = schemas.ProjectOut.model_validate(project)
    out.findings_count = 0
    out.open_count = 0
    out.critical_count = 0
    out.high_count = 0
    return out


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    out = schemas.ProjectOut.model_validate(project)
    out.findings_count = len(project.findings)
    out.open_count = sum(1 for f in project.findings if f.status == "Open")
    out.critical_count = sum(1 for f in project.findings if f.risk_rating == "Critical")
    out.high_count = sum(1 for f in project.findings if f.risk_rating == "High")
    return out


@router.put("/{project_id}", response_model=schemas.ProjectOut)
def update_project(project_id: int, data: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for k, v in data.model_dump().items():
        setattr(project, k, v)
    db.commit()
    db.refresh(project)
    out = schemas.ProjectOut.model_validate(project)
    out.findings_count = len(project.findings)
    out.open_count = sum(1 for f in project.findings if f.status == "Open")
    out.critical_count = sum(1 for f in project.findings if f.risk_rating == "Critical")
    out.high_count = sum(1 for f in project.findings if f.risk_rating == "High")
    return out


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()


@router.get("/{project_id}/stats", response_model=schemas.DashboardStats)
def get_stats(project_id: int, db: Session = Depends(get_db)):
    findings = db.query(models.Finding).filter(models.Finding.project_id == project_id).all()
    total = len(findings)
    closed = sum(1 for f in findings if f.status == "Closed")
    return schemas.DashboardStats(
        total=total,
        open=sum(1 for f in findings if f.status == "Open"),
        in_progress=sum(1 for f in findings if f.status == "In Progress"),
        closed=closed,
        critical=sum(1 for f in findings if f.risk_rating == "Critical"),
        high=sum(1 for f in findings if f.risk_rating == "High"),
        medium=sum(1 for f in findings if f.risk_rating == "Medium"),
        low=sum(1 for f in findings if f.risk_rating == "Low"),
        information=sum(1 for f in findings if f.risk_rating == "Information"),
        remediation_pct=round(closed / total * 100, 1) if total > 0 else 0.0,
    )
