from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc
from typing import List, Optional
import io, csv
from database import get_db
import models, schemas

router = APIRouter(prefix="/api/projects/{project_id}/findings", tags=["findings"])

SEV_ORDER = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Information": 4}


def _get_project(project_id: int, db: Session):
    p = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


def _next_no(project_id: int, db: Session) -> int:
    last = (
        db.query(models.Finding)
        .filter(models.Finding.project_id == project_id)
        .order_by(desc(models.Finding.no))
        .first()
    )
    return (last.no + 1) if last else 1


# ── Literal routes first (must be before /{finding_id}) ──────────────────────

@router.get("", response_model=List[schemas.FindingOut])
def list_findings(
    project_id: int,
    search: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: Optional[str] = "no",
    sort_dir: Optional[str] = "asc",
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    _get_project(project_id, db)
    q = db.query(models.Finding).filter(models.Finding.project_id == project_id)

    if search:
        term = f"%{search}%"
        q = q.filter(
            models.Finding.finding_code.ilike(term)
            | models.Finding.vulnerability.ilike(term)
            | models.Finding.reference.ilike(term)
            | models.Finding.affected.ilike(term)
            | models.Finding.observation.ilike(term)
        )
    if severity:
        q = q.filter(models.Finding.risk_rating == severity)
    if status:
        q = q.filter(models.Finding.status == status)

    sort_col_map = {
        "no": models.Finding.no,
        "vulnerability": models.Finding.vulnerability,
        "risk_rating": models.Finding.risk_rating,
        "status": models.Finding.status,
        "date_found": models.Finding.date_found,
    }
    col = sort_col_map.get(sort_by, models.Finding.no)
    q = q.order_by(asc(col) if sort_dir == "asc" else desc(col))
    return q.offset(skip).limit(limit).all()


@router.post("", response_model=schemas.FindingOut, status_code=201)
def create_finding(project_id: int, data: schemas.FindingCreate, db: Session = Depends(get_db)):
    project = _get_project(project_id, db)
    no = _next_no(project_id, db)
    finding_code = f"{project.project_code}_{no:02d}" if project.project_code else None
    finding = models.Finding(
        project_id=project_id,
        no=no,
        finding_code=finding_code,
        **data.model_dump(),
    )
    db.add(finding)
    db.commit()
    db.refresh(finding)
    return finding


@router.get("/export/csv")
def export_csv(project_id: int, db: Session = Depends(get_db)):
    project = _get_project(project_id, db)
    findings = (
        db.query(models.Finding)
        .filter(models.Finding.project_id == project_id)
        .order_by(models.Finding.no)
        .all()
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "No", "Vulnerability", "Risk Rating", "CVE ID", "CVSS Score",
        "Reference", "Affected Endpoint", "Observation & Implication",
        "Recommendation", "Status", "Date Found", "Due Date", "Remark"
    ])
    for f in findings:
        writer.writerow([
            f.no, f.vulnerability, f.risk_rating, f.cve_id, f.cvss_score,
            f.reference, f.affected, f.observation,
            f.recommendation, f.status, f.date_found, f.due_date, f.remark
        ])
    output.seek(0)
    filename = f"{project.name.replace(' ', '_')}_findings.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/all", status_code=200)
def delete_all_findings(project_id: int, db: Session = Depends(get_db)):
    _get_project(project_id, db)
    deleted = db.query(models.Finding).filter(models.Finding.project_id == project_id).delete()
    db.commit()
    return {"deleted": deleted}


# ── Parameterized routes last ─────────────────────────────────────────────────

@router.get("/{finding_id}", response_model=schemas.FindingOut)
def get_finding(project_id: int, finding_id: int, db: Session = Depends(get_db)):
    finding = (
        db.query(models.Finding)
        .filter(models.Finding.id == finding_id, models.Finding.project_id == project_id)
        .first()
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    return finding


@router.put("/{finding_id}", response_model=schemas.FindingOut)
def update_finding(project_id: int, finding_id: int, data: schemas.FindingUpdate, db: Session = Depends(get_db)):
    finding = (
        db.query(models.Finding)
        .filter(models.Finding.id == finding_id, models.Finding.project_id == project_id)
        .first()
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    for k, v in data.model_dump().items():
        setattr(finding, k, v)
    db.commit()
    db.refresh(finding)
    return finding


@router.delete("/{finding_id}", status_code=204)
def delete_finding(project_id: int, finding_id: int, db: Session = Depends(get_db)):
    finding = (
        db.query(models.Finding)
        .filter(models.Finding.id == finding_id, models.Finding.project_id == project_id)
        .first()
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    db.delete(finding)
    db.commit()
