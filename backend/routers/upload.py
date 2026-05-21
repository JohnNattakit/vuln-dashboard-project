from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
import csv, io, json, os
from database import get_db
import models, schemas

router = APIRouter(prefix="/api/projects/{project_id}/upload", tags=["upload"])

TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "templates")

COLUMN_MAP = {
    "vulnerability": ["vulnerability", "vuln", "vulnerability name", "finding", "title", "name"],
    "risk_rating": ["risk rating", "risk", "severity", "risk_rating", "criticality"],
    "reference": ["reference", "ref", "cwe", "owasp", "references"],
    "affected": ["affected endpoint", "affected", "location", "endpoint", "url", "affected endpoint/location"],
    "observation": ["observation", "observation & implication", "description", "detail", "impact", "implication"],
    "recommendation": ["recommendation", "remediation", "fix", "mitigation", "solution"],
    "status": ["status", "state", "remediation status"],
    "date_found": ["date found", "date", "found date", "discovery date", "found"],
    "due_date": ["due date", "due", "deadline", "target date"],
    "remark": ["remark", "remarks", "note", "notes", "comment", "comments"],
    "cvss_score": ["cvss", "cvss score", "cvss_score", "score"],
    "cve_id": ["cve", "cve id", "cve_id", "cve number"],
}

SEVERITY_MAP = {
    "critical": "Critical", "crit": "Critical",
    "high": "High", "h": "High",
    "medium": "Medium", "med": "Medium", "m": "Medium",
    "low": "Low", "l": "Low",
    "information": "Information", "info": "Information", "informational": "Information",
}

STATUS_MAP = {
    "open": "Open",
    "in progress": "In Progress", "in-progress": "In Progress", "inprogress": "In Progress",
    "closed": "Closed", "fixed": "Closed", "resolved": "Closed", "done": "Closed",
}


def _next_no(project_id: int, db: Session) -> int:
    last = (
        db.query(models.Finding)
        .filter(models.Finding.project_id == project_id)
        .order_by(desc(models.Finding.no))
        .first()
    )
    return (last.no + 1) if last else 1


def _map_headers(headers: list[str]) -> dict:
    mapping = {}
    for i, h in enumerate(headers):
        clean = h.strip().lower()
        for field, aliases in COLUMN_MAP.items():
            if clean in aliases:
                mapping[field] = i
                break
    return mapping


def _parse_rows(rows: list[dict]) -> tuple[int, int, int, list[str]]:
    return rows


def _upsert_finding(project_id: int, project_code: str | None, row: dict, db: Session, existing_names: dict) -> str:
    vuln = row.get("vulnerability", "").strip()
    if not vuln:
        return "skip"

    severity = SEVERITY_MAP.get(row.get("risk_rating", "medium").strip().lower(), "Medium")
    status = STATUS_MAP.get(row.get("status", "open").strip().lower(), "Open")

    if vuln.lower() in existing_names:
        f = existing_names[vuln.lower()]
        f.risk_rating = severity
        f.reference = row.get("reference", f.reference)
        f.affected = row.get("affected", f.affected)
        f.observation = row.get("observation", f.observation)
        f.recommendation = row.get("recommendation", f.recommendation)
        f.status = status
        f.date_found = row.get("date_found", f.date_found)
        f.due_date = row.get("due_date", f.due_date)
        f.remark = row.get("remark", f.remark)
        f.cvss_score = row.get("cvss_score", f.cvss_score)
        f.cve_id = row.get("cve_id", f.cve_id)
        return "update"
    else:
        no = _next_no(project_id, db)
        finding_code = f"{project_code}_{no:02d}" if project_code else None
        f = models.Finding(
            project_id=project_id,
            no=no,
            finding_code=finding_code,
            vulnerability=vuln,
            risk_rating=severity,
            reference=row.get("reference", ""),
            affected=row.get("affected", ""),
            observation=row.get("observation", ""),
            recommendation=row.get("recommendation", ""),
            status=status,
            date_found=row.get("date_found", ""),
            due_date=row.get("due_date", ""),
            remark=row.get("remark", ""),
            cvss_score=row.get("cvss_score", ""),
            cve_id=row.get("cve_id", ""),
        )
        db.add(f)
        db.flush()
        existing_names[vuln.lower()] = f
        return "add"


async def _process_csv(content: bytes, project_id: int, project_code: str | None, db: Session) -> schemas.ImportResult:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return schemas.ImportResult(added=0, updated=0, skipped=0, errors=["Empty file"])

    headers = rows[0]
    mapping = _map_headers(headers)

    if "vulnerability" not in mapping:
        return schemas.ImportResult(added=0, updated=0, skipped=0, errors=["Column 'Vulnerability' not found in CSV headers"])

    existing = {f.vulnerability.lower(): f for f in db.query(models.Finding).filter(models.Finding.project_id == project_id).all()}
    added = updated = skipped = 0
    errors = []

    for i, row in enumerate(rows[1:], start=2):
        if not any(row):
            continue
        try:
            mapped = {field: row[idx].strip() if idx < len(row) else "" for field, idx in mapping.items()}
            result = _upsert_finding(project_id, project_code, mapped, db, existing)
            if result == "add":
                added += 1
            elif result == "update":
                updated += 1
            else:
                skipped += 1
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
            skipped += 1

    db.commit()
    return schemas.ImportResult(added=added, updated=updated, skipped=skipped, errors=errors)


async def _process_xlsx(content: bytes, project_id: int, project_code: str | None, db: Session) -> schemas.ImportResult:
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    if not rows:
        return schemas.ImportResult(added=0, updated=0, skipped=0, errors=["Empty file"])

    headers = [str(c).strip() if c else "" for c in rows[0]]
    mapping = _map_headers(headers)

    if "vulnerability" not in mapping:
        return schemas.ImportResult(added=0, updated=0, skipped=0, errors=["Column 'Vulnerability' not found in headers"])

    existing = {f.vulnerability.lower(): f for f in db.query(models.Finding).filter(models.Finding.project_id == project_id).all()}
    added = updated = skipped = 0
    errors = []

    for i, row in enumerate(rows[1:], start=2):
        row = [str(c).strip() if c is not None else "" for c in row]
        if not any(row):
            continue
        try:
            mapped = {field: row[idx] if idx < len(row) else "" for field, idx in mapping.items()}
            result = _upsert_finding(project_id, project_code, mapped, db, existing)
            if result == "add":
                added += 1
            elif result == "update":
                updated += 1
            else:
                skipped += 1
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
            skipped += 1

    db.commit()
    return schemas.ImportResult(added=added, updated=updated, skipped=skipped, errors=errors)


async def _process_json(content: bytes, project_id: int, project_code: str | None, db: Session) -> schemas.ImportResult:
    try:
        data = json.loads(content.decode("utf-8"))
    except Exception as e:
        return schemas.ImportResult(added=0, updated=0, skipped=0, errors=[f"Invalid JSON: {e}"])

    if not isinstance(data, list):
        data = [data]

    existing = {f.vulnerability.lower(): f for f in db.query(models.Finding).filter(models.Finding.project_id == project_id).all()}
    added = updated = skipped = 0
    errors = []

    for i, item in enumerate(data, start=1):
        try:
            mapped = {}
            for field, aliases in COLUMN_MAP.items():
                for alias in aliases:
                    for key in item:
                        if key.strip().lower() == alias:
                            mapped[field] = str(item[key]).strip() if item[key] is not None else ""
                            break
                    if field in mapped:
                        break
            result = _upsert_finding(project_id, project_code, mapped, db, existing)
            if result == "add":
                added += 1
            elif result == "update":
                updated += 1
            else:
                skipped += 1
        except Exception as e:
            errors.append(f"Item {i}: {str(e)}")
            skipped += 1

    db.commit()
    return schemas.ImportResult(added=added, updated=updated, skipped=skipped, errors=errors)


@router.post("", response_model=schemas.ImportResult)
async def upload_findings(project_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    p = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    filename = file.filename.lower()
    project_code = p.project_code  # pass to upsert so finding_code gets set

    if filename.endswith(".csv"):
        return await _process_csv(content, project_id, project_code, db)
    elif filename.endswith(".xlsx") or filename.endswith(".xls"):
        return await _process_xlsx(content, project_id, project_code, db)
    elif filename.endswith(".json"):
        return await _process_json(content, project_id, project_code, db)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use .csv, .xlsx, or .json")


@router.get("/template/{fmt}")
def download_template(project_id: int, fmt: str):
    fmt = fmt.lower()
    if fmt not in ("csv", "xlsx", "json"):
        raise HTTPException(status_code=400, detail="Format must be csv, xlsx, or json")
    path = os.path.join(TEMPLATE_DIR, f"finding_template.{fmt}")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Template not found")
    media = {"csv": "text/csv", "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "json": "application/json"}
    return FileResponse(path, media_type=media[fmt], filename=f"finding_template.{fmt}")
