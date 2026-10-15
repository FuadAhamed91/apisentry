# APISentry

**Enterprise-grade API authorization auditing lab.** APISentry detects broken
authorization in REST APIs — **Broken Object Level Authorization (BOLA / IDOR)**
and **Mass Assignment** — and shows the difference between a vulnerable and a
hardened implementation with real, evidence-backed findings.

It ships a **bundled, deliberately vulnerable mock target** (plus a hardened
counterpart), a deterministic auditing engine that makes real HTTP requests, and
a polished security-operations dashboard. Everything runs locally with no
database, cloud credentials, or external services.

> APISentry is for application-security engineers, backend developers, and
> educators who want a reproducible, hands-on way to see authorization flaws
> detected and remediated. It implements **selected** OWASP API Security Top 10
> (2023) checks — it is not a complete security assessment.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Demo workflow](#demo-workflow)
- [Sample outputs](#sample-outputs)
- [API reference](#api-reference)
- [OWASP mapping](#owasp-mapping)
- [Security model](#security-model)
- [Testing & verification](#testing--verification)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Limitations & future work](#limitations--future-work)

---

## Features

- **BOLA / IDOR testing** — establishes a victim-context baseline, replays the
  identical request with an unrelated attacker context, and confirms cross-tenant
  exposure only when the attacker independently receives the victim's protected
  object.
- **Mass Assignment testing** — probes administrative fields (`role`, `is_admin`,
  `tier`) one at a time and **verifies persistence with a read-back**, cleanly
  distinguishing an echoed response from an actual privilege change. Restores
  state afterward and warns if restoration fails.
- **Structural JSON diffing** — a recursive diff engine (nested objects, arrays,
  added/removed/changed keys, type changes, nulls) with JSON-Pointer paths and a
  best-effort sensitivity classification.
- **Evidence-backed findings** — every finding carries its request sequence,
  captured (redacted) responses, a documented classification rationale, severity,
  confidence, impact, reproduction steps, and remediation.
- **Side-by-side response diff inspector** — syntax-highlighted dual-pane JSON
  with field-level highlighting of leaked / added / removed / changed data.
- **SSRF-guarded external targets** — local mock by default; external targets are
  opt-in and block loopback/private/link-local/metadata destinations by resolved
  IP.
- **One-click demo** — loads the preloaded target and runs the full demo (both
  BOLA endpoints + Mass Assignment) against the bundled mock.
- **Polished, accessible dark UI** — responsive dashboard, animated terminal log
  driven by real scan events, findings explorer, and context-sensitive
  remediation with copy-ready code.

---

## Architecture

```
+-----------------------------+
| Next.js / React Frontend    |
| Dashboard / Diff / Findings |
+--------------+--------------+
               |
               | HTTP JSON API  (NEXT_PUBLIC_API_BASE_URL)
               v
+-----------------------------+
| FastAPI Application         |
| Scan API / Demo API         |
+--------------+--------------+
               |
               v
+-----------------------------+
| Security Analysis Engine    |
| BOLA / Mass Assignment      |
| JSON Diff / Evidence        |
+--------------+--------------+
               |
               v
+-----------------------------+
| HTTPX Target Adapter        |  (SSRF-validated; local = in-process ASGI)
+--------------+--------------+
               |
               v
+-----------------------------+
| Local Mock Target           |
| Vulnerable / Secure Routes  |
+-----------------------------+
```

The engine reaches the bundled mock through an in-process ASGI transport, so the
local lab needs no self-port wiring and behaves identically under tests and a
live server. External targets (opt-in) use a real, SSRF-validated transport.

---

## Technology stack

**Backend** — Python 3.10+, FastAPI, Uvicorn, HTTPX, Pydantic v2,
pydantic-settings; pytest + pytest-asyncio for tests.

**Frontend** — Next.js 14 (App Router), React 18, TypeScript (strict), Tailwind
CSS, lucide-react, clsx, tailwind-merge.

---

## Prerequisites

- **Python 3.10+** (verified on 3.12). `uv` is recommended for environment
  management — strongly so on Windows (see [Troubleshooting](#troubleshooting)).
- **Node.js 18+** and **npm** (verified on Node 24 / npm 11).

---

## Quick start

### Option A — unified runner (macOS / Linux / Git Bash)

```bash
cd apisentry
./run_dev.sh
```

It checks runtimes, creates the backend environment (via `uv` if present, else
`venv`), installs dependencies the first time, starts both servers, prints their
URLs, and cleans up child processes on exit.

- Frontend: **http://127.0.0.1:3000**
- Backend: **http://127.0.0.1:8000** (interactive API docs at **/docs**)

### Option B — manual start

**Backend** (recommended, using `uv`):

```bash
cd backend
uv venv --python 3.12 .venv
uv pip install -r requirements.txt
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000   # Windows
# .venv/bin/python   -m uvicorn app.main:app --host 127.0.0.1 --port 8000   # macOS/Linux
```

Backend with the standard `venv` module (macOS/Linux):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (in a second terminal):

```bash
cd frontend
npm install
npm run dev
```

Then open **http://127.0.0.1:3000**. The frontend defaults to a backend at
`http://127.0.0.1:8000`; override by creating `frontend/.env.local` with
`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`.

---

## Demo workflow

1. Open the dashboard. If no scans have run, you'll see an empty state with a
   **Load preloaded target & run demo** button.
2. Click it (or go to **Scan Console → Run full demo**). APISentry will:
   - reset the mock target for determinism,
   - run the **vulnerable** BOLA check (expected: **VULNERABLE**),
   - run the **secure** BOLA check (expected: **PASS**),
   - run the **Mass Assignment** check (expected: **VULNERABLE**, read-back
     verified, state restored).
3. Watch real activity stream in the **terminal log**.
4. Review the **Overview** metrics (all derived from real scan data).
5. Open **Findings** for evidence, impact, reproduction, and OWASP mapping.
6. Open **Response Diff** to compare the baseline and comparison responses with
   field-level highlighting. For the confirmed BOLA, the two responses are
   *identical* — the attacker received the victim's protected object — and the
   leaked fields are listed explicitly.
7. Open **Remediation** for context-sensitive, copy-ready secure patterns.

The **Scan Console** also lets you run individual scans, switch the BOLA endpoint
between vulnerable and secure, and reset the mock target.

---

## Sample outputs

> Representative output from an actual full-demo run (your scan ids and timings
> will differ). These mirror the behavior asserted by the automated tests.

Full demo (`POST /api/demo/run`):

```
[VULNERABLE] sev=CRITICAL conf=HIGH  Broken Object Level Authorization confirmed
[PASS]       sev=INFORMATIONAL conf=HIGH  Authorization enforced (no cross-tenant exposure)
[VULNERABLE] sev=CRITICAL conf=HIGH  Mass Assignment confirmed (unauthorized fields persisted)
```

Confirmed BOLA — the attacker (Tenant B) receives Tenant A's order verbatim:

```
Victim (Tenant A) baseline   HTTP 200   { "id": "ord-9921", "owner_id": "alice", "tenant_id": "tenant-a", ... }
Attacker (Tenant B) replay   HTTP 200   { "id": "ord-9921", "owner_id": "alice", "tenant_id": "tenant-a", ... }

0 structural differences  → identical response is itself the evidence of exposure
Exposed: tenant_id='tenant-a', owner_id='alice', shipping_address=..., internal_notes=...
```

Confirmed Mass Assignment — privileged fields persist on read-back:

```
FIELD      BASELINE     ATTEMPTED      OBSERVED       RESULT
role       "user"       "admin"        "admin"        persisted
is_admin   false        true           true           persisted
tier       "standard"   "enterprise"   "enterprise"   persisted

Verification: read-back (GET after PUT)   Restoration: restored
```

---

## API reference

Base URL: `http://127.0.0.1:8000`. Full interactive docs at `/docs`.

| Method & path             | Purpose                                                        |
| ------------------------- | -------------------------------------------------------------- |
| `GET /health`             | Backend health + version + demo-mode flag.                     |
| `GET /api/demo/preset`    | Preloaded local target config (tokens only when `demo_mode`).  |
| `POST /api/scan/bola`     | Run a BOLA assessment (vulnerable or secure endpoint).         |
| `POST /api/scan/mass-assign` | Run a Mass Assignment assessment.                           |
| `POST /api/demo/run`      | Reset + run the full demo (3 scans); returns all results.      |
| `POST /api/demo/reset`    | Restore the mock target to initial fixtures (demo-only).       |
| `GET /api/scan/history`   | Bounded scan history (summaries, newest first).                |
| `GET /api/scan/{scan_id}` | Full stored result for one scan.                               |

Mock target (for reference), mounted under `/mock/api/v1`:
`GET /orders/{id}` (vulnerable), `GET /secure/orders/{id}` (hardened),
`GET`/`PUT /users/profile`, `POST /admin/reset`.

**`POST /api/scan/bola`** — request:

```json
{
  "target_base_url": "http://127.0.0.1:8000/mock/api/v1",
  "resource_id": "ord-9921",
  "victim_token": "token-victim-alice",
  "attacker_token": "token-attacker-bob",
  "endpoint_path": "/orders/{resource_id}",
  "mode": "vulnerable",
  "external_authorized": false
}
```

Response (abridged `ScanResult`):

```json
{
  "scan_id": "bola-…",
  "status": "VULNERABLE",
  "severity": "CRITICAL",
  "confidence": "HIGH",
  "rationale": "The attacker context … received resource 'ord-9921' owned by … the victim …",
  "test_cases": [ /* victim baseline, attacker replay */ ],
  "diff_view": { "left": {…}, "right": {…}, "entries": [], "exposed_summary": ["owner_id = 'alice'", …] },
  "remediation": { "summary": "…", "code_samples": [ … ] },
  "owasp_refs": ["API1:2023 Broken Object Level Authorization"]
}
```

**`POST /api/scan/mass-assign`** — request:

```json
{
  "target_base_url": "http://127.0.0.1:8000/mock/api/v1",
  "test_token": "token-attacker-bob",
  "profile_path": "/users/profile",
  "probe_fields": { "role": "admin", "is_admin": true, "tier": "enterprise" },
  "safe_mode": false,
  "external_authorized": false
}
```

Response adds `probes[]`, `verification_method`, and `restoration_status` to the
`ScanResult` shape above.

Status vocabulary: `VULNERABLE` · `PASS` · `INCONCLUSIVE` · `ERROR`.
Severity: `CRITICAL` · `HIGH` · `MEDIUM` · `LOW` · `INFORMATIONAL`.

---

## OWASP mapping

APISentry implements selected checks from the **OWASP API Security Top 10
(2023)** — not full coverage:

- **BOLA** → **API1:2023 Broken Object Level Authorization**.
- **Mass Assignment** → **API3:2023 Broken Object Property Level Authorization**,
  which consolidates the former *excessive data exposure* and *mass assignment*
  concerns.

These are two focused checks. A complete assessment would cover the remaining
categories (authentication, resource consumption, function-level authorization,
SSRF, and more).

---

## Security model

See [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md) for the full model. In
brief:

- The mock lab is synthetic and in-memory; demo tokens are **development-only
  fixtures**, exposed only in `demo_mode`.
- The intentionally vulnerable code is isolated in `backend/app/mock_target/`.
- External scans are opt-in and **SSRF-guarded** (resolved-IP validation; blocks
  loopback/private/link-local/multicast/metadata; no redirect following; request
  timeouts and response-size limits; no cross-origin credential forwarding).
- Evidence is **redacted** of credentials; business data is preserved to
  demonstrate exposure. Tokens are referenced by role, never stored.
- CORS is restricted to the configured origin; destructive routes are demo-gated;
  errors never leak stack traces; scan history is bounded.
- The engine **prefers `INCONCLUSIVE` over a false positive**: a `2xx` alone is
  never proof, and Mass Assignment requires read-back-verified persistence.

---

## Testing & verification

**Backend** (pytest, fully local — no internet required):

```bash
cd backend
.venv/Scripts/python -m pytest        # Windows
# .venv/bin/python   -m pytest        # macOS/Linux
```

The suite (52 tests) covers the mock target behavior, the BOLA checker (confirmed
/ pass / inconclusive / transport error / no token leakage), the Mass Assignment
checker (confirmed / safe-mode / restoration / false-positive prevention), the
recursive diff engine, redaction, SSRF target validation, and the full API
contract.

**Frontend**:

```bash
cd frontend
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # next lint
npm run build       # production build
```

All three pass. The application was additionally smoke-tested end to end in a
browser: the dashboard renders real metrics, the full demo runs, the vulnerable
BOLA endpoint is flagged, the secure endpoint passes, Mass Assignment is flagged
only after read-back verification, the diff inspector renders real response data,
and the browser console reports no errors.

---

## Project structure

```
apisentry/
├── backend/
│   ├── app/
│   │   ├── main.py            # app factory, CORS, in-process mock transport
│   │   ├── config.py          # environment-driven settings
│   │   ├── schemas/scan.py    # typed request/result contracts
│   │   ├── mock_target/       # ISOLATED deliberately-vulnerable + secure routes
│   │   ├── engine/            # bola_checker, mass_assign, diff_engine, safety, redact, knowledge
│   │   └── api/               # scan / demo routes, bounded history
│   ├── tests/                 # pytest suite (52 tests)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/               # App Router pages (overview, console, findings, diff, …)
│       ├── components/        # ui primitives, layout, feature components
│       ├── store/             # ScanStore (client state)
│       ├── lib/               # typed API client, utils, sensitivity
│       └── types/             # TS mirror of the backend contract
├── docs/SECURITY_MODEL.md
├── .env.example
├── run_dev.sh
└── README.md
```

---

## Troubleshooting

- **Windows + Microsoft Store Python** — the Store build of Python sandboxes
  `AppData`, which breaks `python -m venv` (the venv interpreter lands in a
  redirected path the shell can't see) and makes project files invisible to the
  interpreter. **Use `uv`** (`uv venv --python 3.12 .venv` then
  `uv pip install -r requirements.txt`), or install Python from python.org. The
  provided `run_dev.sh` prefers `uv` automatically.
- **Port already in use** — change ports via `APISENTRY_BACKEND_PORT` /
  `APISENTRY_FRONTEND_PORT` (runner), or pass `--port` to uvicorn / `npm run dev`.
  If you change the backend port, update `APISENTRY_MOCK_BASE_URL` and
  `NEXT_PUBLIC_API_BASE_URL` to match.
- **Backend unreachable / CORS errors** — ensure the backend is running and that
  `APISENTRY_FRONTEND_ORIGIN` includes your frontend origin. The dashboard shows a
  clear "Backend unreachable" banner with a retry when it can't connect.
- **Frontend build fails on fonts** — `next/font` fetches Inter / JetBrains Mono
  at build time; ensure network access for the build, or the build will report
  the font error.

---

## Limitations & future work

- **Authentication schemes** — only static bearer tokens today; OAuth2 / session
  / API-key flows and authenticated session management are future work.
- **Coverage** — two OWASP checks (API1, API3); function-level authorization
  (API5), unrestricted resource consumption (API4), and SSRF (API7) are natural
  next additions.
- **Spec-driven scanning** — importing an OpenAPI/Swagger spec to auto-derive
  object endpoints and an authorization matrix.
- **Persistence & exports** — scan history is in-memory and bounded; durable
  storage and report exports (JSON/PDF) are future work.
- **DNS-rebinding hardening** — pin the resolved IP for the connection lifetime on
  external scans.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
