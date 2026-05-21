# VulnTrack — Vulnerability Management Dashboard

A web-based vulnerability management dashboard for penetration testing teams. Track findings across multiple projects, import/export reports, and monitor remediation progress — all in one place.

---

## Features

- **Multi-project support** — manage multiple pentest engagements side by side
- **Custom Finding Code** — auto-generated IDs in format `PT26_0001_01` (Prefix + Year + Project Seq + Finding Seq)
- **Dashboard** — severity/status charts, high-priority list, remediation progress bars
- **Findings table** — search by code or name, filter by severity/status, sort, paginate
- **Timeline view** — Gantt-style chart of findings by date found → due date
- **Import** — upload findings from `.xlsx`, `.csv`, or `.json` (flexible column mapping)
- **Export** — download findings as CSV; download blank templates in all 3 formats
- **Delete All** — bulk-clear findings per project

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10+ · FastAPI · Uvicorn |
| Database | SQLite (file-based, zero config) |
| ORM | SQLAlchemy 2.0 |
| Frontend | Bootstrap 5.3.8 · Vanilla JS · Chart.js 4.4 |
| Excel | openpyxl |

---

## Quick Start

### Windows

```bat
start.bat
```

### macOS / Linux

```bash
bash start.sh
# or
chmod +x start.sh && ./start.sh
```

Both scripts will:
1. Detect Python 3.10+
2. Create a virtual environment at `.venv/` (first run only)
3. Install all dependencies inside the venv
4. Generate finding templates (first run only)
5. Open `http://localhost:8000` in your browser
6. Start the server

> **Ubuntu note:** if venv creation fails, run `sudo apt install python3-venv` first.

---

## Project Structure

```
vuln-dashboard/
├── start.bat                   ← Windows launcher
├── start.sh                    ← macOS / Linux launcher
├── data/
│   └── vulntrack.db            ← SQLite database (auto-created)
├── templates/
│   ├── finding_template.xlsx   ← Excel template (color-coded)
│   ├── finding_template.csv    ← CSV template
│   └── finding_template.json   ← JSON template
├── backend/
│   ├── main.py                 ← FastAPI app + static file serving
│   ├── database.py             ← SQLAlchemy engine, migrations, backfill
│   ├── models.py               ← ORM models (Project, Finding)
│   ├── schemas.py              ← Pydantic request/response schemas
│   ├── requirements.txt
│   ├── create_templates.py     ← Template generator (run once automatically)
│   └── routers/
│       ├── projects.py         ← /api/projects CRUD + stats
│       ├── findings.py         ← /api/projects/{id}/findings CRUD + export
│       └── upload.py           ← Import (CSV / XLSX / JSON) + template download
└── frontend/
    ├── index.html              ← Single-page app shell
    └── static/
        ├── css/
        │   ├── bootstrap.min.css
        │   └── app.css         ← Dark theme + custom styles
        └── js/
            ├── bootstrap.bundle.min.js
            └── app.js          ← All UI logic + API calls
```

---

## Finding Code Format

Every finding gets an auto-generated code when created:

```
{PREFIX}{YY}_{NNNN}_{FF}
```

| Part | Description | Example |
|---|---|---|
| `PREFIX` | Project type prefix (set per project) | `PT`, `VA`, `RA` |
| `YY` | 2-digit year from project Start Date | `26` = 2026 |
| `NNNN` | 4-digit project sequence (resets each year) | `0001`, `0002` |
| `FF` | 2-digit finding sequence within the project | `01`, `02` |

**Example:** `PT26_0001_03` = Pentest 2026, Project #1, Finding #3

---

## Importing Findings

Upload findings via the **Import** button (top-right toolbar). Supported formats: `.xlsx`, `.csv`, `.json`.

Column headers are matched **case-insensitively**. Accepted aliases:

| Field | Accepted Column Names |
|---|---|
| Vulnerability | vulnerability, vuln, finding, title, name |
| Risk Rating | risk rating, risk, severity, criticality |
| Reference | reference, ref, cwe, owasp |
| Affected Endpoint | affected endpoint, affected, location, endpoint, url |
| Observation | observation, observation & implication, description, impact |
| Recommendation | recommendation, remediation, fix, mitigation, solution |
| Status | status, state, remediation status |
| Date Found | date found, date, found date, discovery date |
| Due Date | due date, due, deadline, target date |
| CVE ID | cve, cve id |
| CVSS Score | cvss, cvss score |
| Remark | remark, note, comment |

**Severity aliases:** `critical` · `high` · `medium` / `med` · `low` · `information` / `info`

**Status aliases:** `open` · `in progress` · `closed` / `fixed` / `resolved` / `done`

**Upsert behavior:** if a finding with the same vulnerability name already exists, it will be **updated**. New names are **created** as new findings with auto-generated codes. The `Finding Code` column in the template is ignored on import — the system always generates its own codes.

---

## API Reference

The backend exposes a REST API. Interactive docs are available at `http://localhost:8000/docs`.

```
# Projects
GET    /api/projects                            list all projects
POST   /api/projects                            create project
GET    /api/projects/{id}                       get project
PUT    /api/projects/{id}                       update project
DELETE /api/projects/{id}                       delete project + all findings
GET    /api/projects/{id}/stats                 dashboard stats

# Findings
GET    /api/projects/{id}/findings              list (search / filter / sort / paginate)
POST   /api/projects/{id}/findings              create finding
GET    /api/projects/{id}/findings/{fid}        get finding
PUT    /api/projects/{id}/findings/{fid}        update finding
DELETE /api/projects/{id}/findings/{fid}        delete finding
DELETE /api/projects/{id}/findings/all          delete all findings in project
GET    /api/projects/{id}/findings/export/csv   export CSV

# Upload / Templates
POST   /api/projects/{id}/upload                import XLSX / CSV / JSON
GET    /api/projects/{id}/upload/template/xlsx  download Excel template
GET    /api/projects/{id}/upload/template/csv   download CSV template
GET    /api/projects/{id}/upload/template/json  download JSON template
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + N` | Add new finding (when inside a project) |
| `Esc` | Close modal |

---

## Backup & Restore

All data is stored in a single SQLite file:

```bash
# Backup
cp data/vulntrack.db data/vulntrack.db.bak

# Restore
cp data/vulntrack.db.bak data/vulntrack.db
```

To browse the database directly, use [DB Browser for SQLite](https://sqlitebrowser.org/).

---

## Requirements

- Python 3.10 or higher
- No other external services needed — SQLite is file-based and included with Python
