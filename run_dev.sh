#!/usr/bin/env bash
#
# APISentry unified development runner.
# Starts the FastAPI backend and the Next.js frontend together.
#
#   ./run_dev.sh
#
# Prefers `uv` for the Python environment when available (recommended,
# especially on Windows where the Microsoft Store Python breaks venvs under
# redirected paths), and falls back to the standard `venv` module otherwise.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
BACKEND_PORT="${APISENTRY_BACKEND_PORT:-8000}"
FRONTEND_PORT="${APISENTRY_FRONTEND_PORT:-3000}"

info() { printf '\033[0;36m[apisentry]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[apisentry] ERROR:\033[0m %s\n' "$*" >&2; }

# --- Resolve the venv interpreter path per OS ------------------------------
case "$(uname -s 2>/dev/null || echo unknown)" in
  MINGW* | MSYS* | CYGWIN* | Windows_NT) VENV_PY="$BACKEND/.venv/Scripts/python.exe" ;;
  *) VENV_PY="$BACKEND/.venv/bin/python" ;;
esac

# --- Check required runtimes -----------------------------------------------
command -v node >/dev/null 2>&1 || { err "Node.js 18+ is required (not found)."; exit 1; }
command -v npm >/dev/null 2>&1 || { err "npm is required (not found)."; exit 1; }

PYBASE=""
if command -v python3 >/dev/null 2>&1; then PYBASE="python3"; elif command -v python >/dev/null 2>&1; then PYBASE="python"; fi
if [ -z "$PYBASE" ] && ! command -v uv >/dev/null 2>&1; then
  err "Python 3.10+ (or uv) is required (not found)."
  exit 1
fi

# --- Backend environment + dependencies (installed only when created) -------
NEED_BACKEND_INSTALL=0
if [ ! -x "$VENV_PY" ]; then
  info "Creating backend virtual environment…"
  if command -v uv >/dev/null 2>&1; then
    (cd "$BACKEND" && uv venv .venv)
  else
    (cd "$BACKEND" && "$PYBASE" -m venv .venv)
  fi
  NEED_BACKEND_INSTALL=1
fi

if [ "$NEED_BACKEND_INSTALL" -eq 1 ]; then
  info "Installing backend dependencies…"
  if command -v uv >/dev/null 2>&1; then
    (cd "$BACKEND" && uv pip install -r requirements.txt)
  else
    "$VENV_PY" -m pip install --upgrade pip >/dev/null
    "$VENV_PY" -m pip install -r "$BACKEND/requirements.txt"
  fi
else
  info "Backend environment present — skipping install."
fi

# --- Frontend dependencies (installed only when missing) --------------------
if [ ! -d "$FRONTEND/node_modules" ]; then
  info "Installing frontend dependencies…"
  (cd "$FRONTEND" && npm install --no-fund --no-audit)
else
  info "Frontend dependencies present — skipping install."
fi

# --- Seed backend .env from example (never overwrite an existing one) -------
if [ ! -f "$BACKEND/.env" ] && [ -f "$ROOT/.env.example" ]; then
  cp "$ROOT/.env.example" "$BACKEND/.env"
  info "Created backend/.env from .env.example"
fi

# --- Launch both servers; clean up children on exit -------------------------
PIDS=()
cleanup() {
  info "Shutting down…"
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

info "Starting backend  → http://127.0.0.1:${BACKEND_PORT}  (API docs: /docs)"
(cd "$BACKEND" && "$VENV_PY" -m uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT") &
PIDS+=($!)

info "Starting frontend → http://127.0.0.1:${FRONTEND_PORT}"
(cd "$FRONTEND" && npm run dev -- --port "$FRONTEND_PORT" --hostname 127.0.0.1) &
PIDS+=($!)

info "APISentry is starting. Press Ctrl+C to stop both servers."
wait
