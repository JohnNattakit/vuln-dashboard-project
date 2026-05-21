from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class SeverityEnum(str, enum.Enum):
    critical = "Critical"
    high = "High"
    medium = "Medium"
    low = "Low"
    information = "Information"


class StatusEnum(str, enum.Enum):
    open = "Open"
    in_progress = "In Progress"
    closed = "Closed"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    client = Column(String(200), default="")
    scope = Column(Text, default="")
    pentest_type = Column(String(100), default="")
    prefix = Column(String(10), default="PT")
    project_code = Column(String(20), nullable=True)
    start_date = Column(String(20), default="")
    end_date = Column(String(20), default="")
    description = Column(Text, default="")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    findings = relationship("Finding", back_populates="project", cascade="all, delete-orphan")


class Finding(Base):
    __tablename__ = "findings"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    no = Column(Integer, nullable=False)
    vulnerability = Column(String(300), nullable=False)
    risk_rating = Column(String(20), nullable=False, default="Medium")
    reference = Column(String(200), default="")
    affected = Column(Text, default="")
    observation = Column(Text, default="")
    recommendation = Column(Text, default="")
    status = Column(String(20), nullable=False, default="Open")
    date_found = Column(String(20), default="")
    due_date = Column(String(20), default="")
    remark = Column(Text, default="")
    cvss_score = Column(String(10), default="")
    cve_id = Column(String(50), default="")
    finding_code = Column(String(30), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="findings")
