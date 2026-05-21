from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "..", "data", "vulntrack.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        conn.execute(text("PRAGMA foreign_keys=ON"))
        # Safe column migrations — skip if already exists
        migrations = [
            ("projects", "prefix",       "VARCHAR(10) DEFAULT 'PT'"),
            ("projects", "project_code", "VARCHAR(20)"),
            ("findings", "finding_code", "VARCHAR(30)"),
        ]
        for table, col, typedef in migrations:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {typedef}"))
                conn.commit()
            except Exception:
                pass  # Column already exists — skip

        # ── Backfill project_code for projects that don't have one ──────────
        no_code_projects = conn.execute(
            text("SELECT id, prefix, start_date FROM projects WHERE project_code IS NULL OR project_code = '' ORDER BY id")
        ).fetchall()
        for proj_id, prefix, start_date in no_code_projects:
            prefix = (prefix or "PT").upper().strip()[:10]
            y4 = (start_date[:4] if start_date and len(start_date) >= 4 else str(__import__('datetime').datetime.now().year))
            y2 = y4[2:]
            # Count projects that already have a code in the same year (excluding current)
            count = conn.execute(
                text("SELECT COUNT(*) FROM projects WHERE project_code IS NOT NULL AND project_code != '' AND start_date LIKE :y"),
                {"y": f"{y4}%"}
            ).scalar()
            seq = count + 1
            proj_code = f"{prefix}{y2}_{seq:04d}"
            conn.execute(
                text("UPDATE projects SET project_code = :code WHERE id = :id"),
                {"code": proj_code, "id": proj_id}
            )
        conn.commit()

        # ── Backfill finding_code for existing findings that don't have one ──
        projects = conn.execute(
            text("SELECT id, project_code FROM projects WHERE project_code IS NOT NULL AND project_code != ''")
        ).fetchall()
        for proj_id, proj_code in projects:
            findings = conn.execute(
                text("SELECT id, no FROM findings WHERE project_id = :pid AND (finding_code IS NULL OR finding_code = '') ORDER BY no"),
                {"pid": proj_id}
            ).fetchall()
            for f_id, f_no in findings:
                code = f"{proj_code}_{f_no:02d}"
                conn.execute(
                    text("UPDATE findings SET finding_code = :code WHERE id = :id"),
                    {"code": code, "id": f_id}
                )
        conn.commit()
