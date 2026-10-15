"""Mock target HTTP routes mounted under /mock/api/v1.

This module holds the deliberately vulnerable endpoints AND their hardened
counterparts, side by side, so the engine can demonstrably tell them apart.
Every intentionally insecure branch is marked with an INTENTIONALLY VULNERABLE
comment. Nothing here is production code.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from ..config import get_settings
from .data_store import IMMUTABLE_PROFILE_FIELDS, Principal, store

router = APIRouter()


# --------------------------------------------------------------------------- #
# Authentication (shared by every mock endpoint)
# --------------------------------------------------------------------------- #
def require_principal(authorization: str | None = Header(default=None)) -> Principal:
    """Resolve a demo bearer token to a principal, or raise 401.

    This is authentication only. Whether authentication is *sufficient* is the
    very question the BOLA endpoints below answer differently.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    principal = store.principal_for_token(token)
    if principal is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or unknown token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return principal


# --------------------------------------------------------------------------- #
# 2.2 Vulnerable BOLA endpoint (OWASP API1:2023)
# --------------------------------------------------------------------------- #
@router.get("/orders/{order_id}", tags=["mock:vulnerable"])
def vulnerable_get_order(order_id: str, principal: Principal = Depends(require_principal)):
    order = store.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    # INTENTIONALLY VULNERABLE (BOLA / IDOR):
    # The caller is authenticated, but ownership is never verified. ANY valid
    # demo user can read ANY existing order by guessing its id.
    return order


# --------------------------------------------------------------------------- #
# 2.3 Secure order endpoint (hardened counterpart)
# --------------------------------------------------------------------------- #
@router.get("/secure/orders/{order_id}", tags=["mock:secure"])
def secure_get_order(order_id: str, principal: Principal = Depends(require_principal)):
    order = store.get_order(order_id)
    # Enforce ownership AND tenant isolation on every request. Cross-tenant and
    # non-owned requests get an identical 404 so the response does not disclose
    # whether the resource exists for another tenant.
    if (
        order is None
        or order["tenant_id"] != principal["tenant_id"]
        or order["owner_id"] != principal["user_id"]
    ):
        raise HTTPException(status_code=404, detail="Order not found")
    return order


# --------------------------------------------------------------------------- #
# 2.4 Vulnerable Mass Assignment endpoint (OWASP API3:2023)
# --------------------------------------------------------------------------- #
@router.get("/users/profile", tags=["mock:vulnerable"])
def get_own_profile(principal: Principal = Depends(require_principal)):
    """Read back the authenticated user's own persisted profile."""
    profile = store.get_profile(principal["user_id"])
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.put("/users/profile", tags=["mock:vulnerable"])
async def vulnerable_update_profile(
    request: Request, principal: Principal = Depends(require_principal)
):
    settings = get_settings()

    raw = await request.body()
    if len(raw) > settings.max_request_bytes:
        raise HTTPException(status_code=413, detail="Request body too large")
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Malformed JSON body")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Body must be a JSON object")

    profile = store.profiles.get(principal["user_id"])
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    # INTENTIONALLY VULNERABLE (Mass Assignment):
    # Caller-supplied fields are merged straight into the user's own record with
    # no allow-list, so privileged fields (role, is_admin, tier) can be set by
    # the user themselves. Identity fields stay immutable so the lab can never
    # mutate an unrelated tenant's record.
    for key, value in payload.items():
        if key in IMMUTABLE_PROFILE_FIELDS:
            continue
        profile[key] = value

    return dict(profile)


# --------------------------------------------------------------------------- #
# 2.5 Reset (demo-only, deterministic)
# --------------------------------------------------------------------------- #
@router.post("/admin/reset", tags=["mock:admin"])
def reset_mock_target():
    settings = get_settings()
    if not settings.demo_mode:
        raise HTTPException(status_code=403, detail="Reset is only available in demo mode")
    store.reset()
    return {"status": "ok", "message": "Mock target restored to initial fixtures"}
