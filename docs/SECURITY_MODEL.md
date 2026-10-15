# APISentry Security Model

APISentry is a **local, self-contained authorization auditing lab**. It ships a
deliberately vulnerable mock API, a hardened counterpart, and a deterministic
engine that tells them apart with evidence. This document describes the security
model of both the **mock lab** (the thing being tested) and **APISentry itself**
(the thing doing the testing).

---

## 1. The mock lab (synthetic, in-memory)

Everything the default demo touches is synthetic and lives in process memory.
There is no database, no external service, and no real customer data.

### Tenants and identities

| Role     | User  | Tenant     | Demo token (dev-only)   | Owns        |
| -------- | ----- | ---------- | ----------------------- | ----------- |
| Victim   | alice | `tenant-a` | `token-victim-alice`    | `ord-9921`  |
| Attacker | bob   | `tenant-b` | `token-attacker-bob`    | `ord-5512`  |

Both are ordinary, non-privileged users.

### Demo credentials

The demo tokens are **static, insecure, development-only fixtures**. They are:

- clearly labeled as development-only throughout the UI and API;
- only disclosed by `GET /api/demo/preset` when `APISENTRY_DEMO_MODE=true`;
- never to be treated as production authentication of any kind.

### Mock endpoints (mounted under `/mock/api/v1`)

| Endpoint                          | Posture        | Behavior                                                                 |
| --------------------------------- | -------------- | ------------------------------------------------------------------------ |
| `GET /orders/{id}`                | **Vulnerable** | Authenticates the caller, then returns the order **without** an ownership check (BOLA / IDOR). |
| `GET /secure/orders/{id}`         | **Hardened**   | Enforces tenant + owner scoping; returns an identical `404` for "not found" and "not yours". |
| `GET /users/profile`              | Support        | Returns the caller's own persisted profile (used for read-back).         |
| `PUT /users/profile`              | **Vulnerable** | Merges arbitrary request fields into the caller's own profile (Mass Assignment), except immutable identity fields. |
| `POST /admin/reset`               | Demo-only      | Restores deterministic fixtures (gated by `demo_mode`).                  |

All intentionally insecure code is isolated in `backend/app/mock_target/` and
annotated with `INTENTIONALLY VULNERABLE` comments. It is never imported by the
production-facing API or the engine.

### What the hardened endpoint demonstrates

```python
# The ownership predicate is part of the lookup, so a cross-tenant id
# simply resolves to nothing -> identical 404 (no existence disclosure).
if order is None or order["tenant_id"] != principal["tenant_id"] \
        or order["owner_id"] != principal["user_id"]:
    raise HTTPException(status_code=404, detail="Order not found")
```

---

## 2. APISentry's own security posture

Because the platform sends HTTP requests, it enforces an explicit target safety
boundary and protects the evidence it stores.

### 2.1 Target safety boundary (SSRF defense)

Implemented in `backend/app/engine/safety.py`:

- **Local by default.** Requests to the designated lab hosts
  (`127.0.0.1`, `localhost`, `::1`) are allowed without extra confirmation.
- **External is opt-in.** Any other host requires **both**
  `APISENTRY_ALLOW_EXTERNAL_TARGETS=true` **and** an explicit per-scan
  `external_authorized` confirmation.
- **IP-level validation.** For external targets, every **resolved IP address**
  is checked (not just the hostname string). Loopback, private, link-local,
  multicast, reserved, unspecified, and cloud-metadata (`169.254.169.254`)
  destinations are blocked.
- **No redirect following.** The HTTP client uses `follow_redirects=False`; a
  redirect `Location` would be re-validated against the same policy before any
  follow.
- **Method restriction.** The engine issues only the `GET`/`PUT` requests its
  checks require.
- **Timeouts and size limits.** Every request has a timeout; response bodies are
  length-bounded (`max_response_bytes`) and request bodies are capped
  (`max_request_bytes`).
- **No credential forwarding across origins.** Tokens are sent only to the
  explicitly configured target; they are never attached to a different origin.

> DNS-rebinding note: validation resolves and checks IPs at request time. A fully
> hardened deployment would additionally pin the resolved address for the
> connection. This is documented as a residual limitation for the local lab.

### 2.2 Evidence redaction

Implemented in `backend/app/engine/redact.py`:

- Credential-like values (bearer tokens, passwords, secrets, API keys, cookies,
  session identifiers) are masked wherever they appear, including inside nested
  objects and free-text.
- Request metadata references tokens **by role** (`victim`, `attacker`,
  `test-identity`) and **never stores the token value**.
- Business data (owner ids, emails, addresses) is deliberately preserved in
  evidence, because demonstrating that such data crossed an authorization
  boundary is the whole point of a finding.

### 2.3 Other controls

- **CORS** is restricted to the configured frontend origin(s); `"*"` is never
  used, and credentials are not allowed.
- **Destructive routes** (`/api/demo/reset`, `/mock/.../admin/reset`) are gated
  by `demo_mode`.
- **Error responses** are consistent and never leak stack traces to clients.
- **Scan history** is bounded in memory (`history_limit`); it cannot grow
  without limit.
- **No false positives by design.** The engine prefers `INCONCLUSIVE` over an
  unverified claim: a `2xx` alone is never treated as proof, Mass Assignment is
  only `VULNERABLE` after a read-back confirms persistence, and BOLA is only
  `VULNERABLE` when the attacker independently receives the victim's protected
  object.

---

## 3. Residual limitations

- The engine does not pin resolved IPs for the connection lifetime (DNS-rebinding
  hardening is noted above).
- Authentication is limited to static bearer tokens; OAuth/session flows are not
  modeled.
- Scan history and fixtures are in-memory only and reset on restart.
- The local lab intentionally keeps the vulnerable endpoints reachable; it is for
  education and must not be exposed publicly.
