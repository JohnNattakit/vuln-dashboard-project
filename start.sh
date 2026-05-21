#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VulnTrack — start script for macOS / Linux
# Usage:  bash start.sh          (or  chmod +x start.sh && ./start.sh)
# ─────────────────────────────────────────────────────────────────────────────
set -e

# Change to the directory where this script lives
cd "$(dirname "$0")"

VENV_DIR=".venv"
PYTHON=""

# ── 1. Find Python 3 ─────────────────────────────────────────────────────────
for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
        VER=$("$cmd" -c "import sys; print(sys.version_info >= (3,10))" 2>/dev/null)
        if [ "$VER" = "True" ]; then
            PYTHON="$cmd"
            break
        fi
    fi
done

if [ -z "$PYTHON" ]; then
    echo "[VulnTrack] ERROR: Python 3.10+ not found."
    echo "  macOS  : brew install python"
    echo "  Ubuntu : sudo apt install python3"
    exit 1
fi

echo "[VulnTrack] Using $($PYTHON --version)"

# ── 2. Create venv if it doesn't exist ───────────────────────────────────────
if [ ! -d "$VENV_DIR" ]; then
    echo "[VulnTrack] Creating virtual environment at $VENV_DIR ..."
    "$PYTHON" -m venv "$VENV_DIR"
fi

# ── 3. Activate venv ─────────────────────────────────────────────────────────
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
echo "[VulnTrack] Virtual environment activated."

# ── 4. Install / upgrade dependencies ────────────────────────────────────────
echo "[VulnTrack] Installing dependencies..."
pip install --quiet --upgrade pip
pip install --quiet -r backend/requirements.txt
echo "[VulnTrack] Dependencies ready."

# ── 5. Generate templates (only if missing) ───────────────────────────────────
if [ ! -f "templates/finding_template.xlsx" ]; then
    echo "[VulnTrack] Generating finding templates..."
    python backend/create_templates.py
else
    echo "[VulnTrack] Templates already exist, skipping."
fi

# ── 6. Open browser (best-effort) ────────────────────────────────────────────
URL="http://localhost:8000"
echo "[VulnTrack] Starting server at $URL"
if command -v open &>/dev/null; then
    # macOS
    (sleep 2 && open "$URL") &
elif command -v xdg-open &>/dev/null; then
    # Linux with a desktop
    (sleep 2 && xdg-open "$URL") &
fi

# ── 7. Start uvicorn ─────────────────────────────────────────────────────────
cd backend
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
