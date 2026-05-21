@echo off
:: ─────────────────────────────────────────────────────────────────────────────
:: VulnTrack — start script for Windows
:: ─────────────────────────────────────────────────────────────────────────────
cd /d "%~dp0"

set VENV_DIR=.venv

:: ── 1. Check Python ──────────────────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo [VulnTrack] ERROR: Python not found. Please install Python 3.10+
    pause & exit /b 1
)
echo [VulnTrack] Using:
python --version

:: ── 2. Create venv if it doesn't exist ──────────────────────────────────────
if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo [VulnTrack] Creating virtual environment at %VENV_DIR% ...
    python -m venv %VENV_DIR%
)

:: ── 3. Activate venv ─────────────────────────────────────────────────────────
call %VENV_DIR%\Scripts\activate.bat
echo [VulnTrack] Virtual environment activated.

:: ── 4. Install / upgrade dependencies ───────────────────────────────────────
echo [VulnTrack] Installing dependencies...
python -m pip install --quiet --upgrade pip
pip install --quiet -r backend\requirements.txt
echo [VulnTrack] Dependencies ready.

:: ── 5. Generate templates (only if missing) ──────────────────────────────────
if not exist "templates\finding_template.xlsx" (
    echo [VulnTrack] Generating finding templates...
    python backend\create_templates.py
) else (
    echo [VulnTrack] Templates already exist, skipping.
)

:: ── 6. Open browser & start server ───────────────────────────────────────────
echo [VulnTrack] Starting server at http://localhost:8000
start "" http://localhost:8000
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
