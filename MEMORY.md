# VulnTrack — Project Memory

> อ่านไฟล์นี้ก่อนทุกครั้งที่เริ่ม session ใหม่กับโปรเจ็คนี้

---

## What is this?

**VulnTrack** — Vulnerability Management Dashboard สำหรับ Pentest Team
- Web Application จริง (ไม่ใช่แค่ static HTML)
- พัฒนาต่อจาก prototype ที่อยู่ใน `../Vulnerability Management Dashboard Website/index.html`
- Owner: johnnattakit01@gmail.com

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python FastAPI + Uvicorn |
| Database | SQLite (file: `data/vulntrack.db`) |
| ORM | SQLAlchemy 2.0 |
| Frontend | Bootstrap 5.3.8 + Vanilla JS (no JS framework) |
| Charts | Chart.js 4.4.1 (CDN) |
| Excel support | openpyxl |

Bootstrap files (local, no CDN needed):
- `frontend/static/css/bootstrap.min.css`
- `frontend/static/js/bootstrap.bundle.min.js`
- Source: `bootstrap-main/` (v5.3.8)

---

## Project Structure

```
vuln-dashboard/
├── start.bat                        ← เปิด server (double-click)
├── MEMORY.md                        ← ไฟล์นี้
├── data/
│   └── vulntrack.db                 ← SQLite database
├── backend/
│   ├── main.py                      ← FastAPI app entry point
│   ├── database.py                  ← SQLAlchemy engine + session
│   ├── models.py                    ← ORM models (Project, Finding)
│   ├── schemas.py                   ← Pydantic request/response schemas
│   ├── create_templates.py          ← สร้าง Excel template (run once)
│   └── routers/
│       ├── projects.py              ← /api/projects CRUD + stats
│       ├── findings.py              ← /api/projects/{id}/findings CRUD + CSV export
│       └── upload.py                ← /api/projects/{id}/upload (CSV/XLSX/JSON import)
├── frontend/
│   ├── index.html                   ← SPA shell (3 views: Dashboard/Findings/Timeline)
│   └── static/
│       ├── css/app.css              ← Dark theme styles
│       └── js/app.js                ← All frontend logic + API calls
├── templates/
│   ├── finding_template.xlsx        ← Excel template (color-coded)
│   ├── finding_template.csv         ← CSV template
│   └── finding_template.json        ← JSON template
└── uploads/                         ← (reserved for future use)
```

---

## Database Schema

### Table: `projects`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | auto |
| name | STRING | required |
| client | STRING | |
| pentest_type | STRING | Web App / Mobile / Network / API / Cloud / Red Team |
| start_date | STRING | YYYY-MM-DD |
| end_date | STRING | YYYY-MM-DD |
| scope | TEXT | target URLs/IPs |
| description | TEXT | |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### Table: `findings`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | auto |
| project_id | INTEGER FK | → projects.id (cascade delete) |
| no | INTEGER | sequence number per project |
| vulnerability | STRING | required |
| risk_rating | STRING | Critical / High / Medium / Low / Information |
| status | STRING | Open / In Progress / Closed |
| reference | STRING | CWE-xxx / OWASP Axxx:2021 |
| cve_id | STRING | CVE-YYYY-XXXXX |
| cvss_score | STRING | 0.0–10.0 |
| affected | TEXT | multiline endpoints/locations |
| observation | TEXT | description + impact |
| recommendation | TEXT | remediation steps |
| remark | TEXT | |
| date_found | STRING | YYYY-MM-DD |
| due_date | STRING | YYYY-MM-DD |
| created_at | DATETIME | |
| updated_at | DATETIME | |

---

## API Endpoints

```
GET    /api/projects                              ← list all projects
POST   /api/projects                              ← create project
GET    /api/projects/{id}                         ← get project detail
PUT    /api/projects/{id}                         ← update project
DELETE /api/projects/{id}                         ← delete project + all findings
GET    /api/projects/{id}/stats                   ← dashboard stats

GET    /api/projects/{id}/findings                ← list findings (search/filter/sort/page)
POST   /api/projects/{id}/findings                ← create finding
GET    /api/projects/{id}/findings/{fid}          ← get finding detail
PUT    /api/projects/{id}/findings/{fid}          ← update finding
DELETE /api/projects/{id}/findings/{fid}          ← delete finding
GET    /api/projects/{id}/findings/export/csv     ← download CSV

POST   /api/projects/{id}/upload                  ← import CSV / XLSX / JSON
GET    /api/projects/{id}/upload/template/{fmt}   ← download template (csv/xlsx/json)
```

Auto API docs: `http://localhost:8000/docs`

---

## Frontend Views

1. **Projects Page** — landing page, card grid ของทุก project
2. **Dashboard View** — stat cards, doughnut chart (severity), bar chart (status), high priority list, remediation progress bars
3. **Findings View** — searchable/filterable/sortable table + pagination (15/page)
4. **Timeline View** — Gantt-style horizontal bars by date_found → due_date

### Keyboard shortcuts
- `Ctrl+N` — Add new finding (เมื่ออยู่ใน project)
- `Esc` — ปิด modal

---

## Import Column Mapping

Upload router รองรับ column headers แบบ case-insensitive และ aliases:

| Field | Accepted headers |
|---|---|
| vulnerability | vulnerability, vuln, finding, title, name |
| risk_rating | risk rating, risk, severity, criticality |
| reference | reference, ref, cwe, owasp |
| affected | affected endpoint, affected, location, endpoint, url |
| observation | observation, observation & implication, description, impact |
| recommendation | recommendation, remediation, fix, mitigation, solution |
| status | status, state, remediation status |
| date_found | date found, date, found date, discovery date |
| due_date | due date, due, deadline, target date |
| remark | remark, note, comment |
| cvss_score | cvss, cvss score |
| cve_id | cve, cve id |

Severity aliases: `critical/high/medium/med/low/information/info/informational`
Status aliases: `open / in progress / closed / fixed / resolved / done`

---

## Known Issues Fixed

| Issue | Fix |
|---|---|
| `TypeError: QueryableAttribute.__init__()` ใน `list_projects` | เปลี่ยนจาก `func.cast(..., Finding.id.__class__)` เป็น `case((condition, 1), else_=0)` ใน `routers/projects.py` |
| ทั้งสองหน้า (Projects + Dashboard) แสดงซ้อนกัน | Bootstrap `d-flex` มี `!important` ทำให้ override `.page { display:none }` — แก้โดยเพิ่ม `!important` ใน `.page` และ `.view` ใน `app.css` |

## Bootstrap + Custom CSS Rule

> เวลาใช้ Bootstrap utility class เช่น `d-flex`, `d-none`, `d-block` ร่วมกับ custom CSS ที่ต้องการ toggle display —  
> **ต้องใส่ `!important` ใน custom class ด้วยเสมอ** เพราะ Bootstrap utility ใช้ `!important` ทั้งหมด

---

## How to Run

```bat
# วิธีที่ 1 — double-click
start.bat

# วิธีที่ 2 — manual
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

เปิด browser: `http://localhost:8000`

---

## Ideas / Backlog (สิ่งที่อยากพัฒนาต่อ)

- [ ] PDF report export (per project)
- [ ] User authentication / login
- [ ] ส่ง email notification เมื่อ due date ใกล้ถึง
- [ ] Duplicate finding detection ตอน manual add
- [ ] Screenshot/evidence attachment per finding
- [ ] CVSS calculator ใน modal
- [ ] Dark/light theme toggle
- [ ] Bulk status update (select multiple findings)
- [ ] Finding templates library (pre-filled common vulns)
- [ ] API key สำหรับ integrate กับ tools อื่น (Burp, Nessus)

---

## Notes

- SQLite file backup: แค่ copy `data/vulntrack.db` ไปเก็บ
- เปิดดู DB ด้วย: [DB Browser for SQLite](https://sqlitebrowser.org/)
- Prototype เดิมอยู่ที่: `../Vulnerability Management Dashboard Website/index.html`
- Dependencies: `backend/requirements.txt`
