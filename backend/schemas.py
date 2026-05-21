from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ProjectBase(BaseModel):
    name: str
    client: Optional[str] = ""
    scope: Optional[str] = ""
    pentest_type: Optional[str] = ""
    prefix: Optional[str] = "PT"
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    description: Optional[str] = ""


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(ProjectBase):
    pass


class ProjectOut(ProjectBase):
    id: int
    project_code: Optional[str] = None
    created_at: Optional[datetime] = None
    findings_count: Optional[int] = 0
    open_count: Optional[int] = 0
    critical_count: Optional[int] = 0
    high_count: Optional[int] = 0

    class Config:
        from_attributes = True


class FindingBase(BaseModel):
    vulnerability: str
    risk_rating: str = "Medium"
    reference: Optional[str] = ""
    affected: Optional[str] = ""
    observation: Optional[str] = ""
    recommendation: Optional[str] = ""
    status: str = "Open"
    date_found: Optional[str] = ""
    due_date: Optional[str] = ""
    remark: Optional[str] = ""
    cvss_score: Optional[str] = ""
    cve_id: Optional[str] = ""


class FindingCreate(FindingBase):
    pass


class FindingUpdate(FindingBase):
    pass


class FindingOut(FindingBase):
    id: int
    project_id: int
    no: int
    finding_code: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    added: int
    updated: int
    skipped: int
    errors: List[str] = []


class DashboardStats(BaseModel):
    total: int
    open: int
    in_progress: int
    closed: int
    critical: int
    high: int
    medium: int
    low: int
    information: int
    remediation_pct: float
