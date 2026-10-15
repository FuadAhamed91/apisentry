"""Demo API: preset configuration, one-click full demo run, and reset.

The reset and full-demo routes are restricted to the local demonstration
configuration (``demo_mode``). Demo fixture tokens are only disclosed when
``demo_mode`` is active.
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException

from ..config import Settings
from ..engine.bola_checker import run_bola_scan
from ..engine.mass_assign import run_mass_assign_scan
from ..mock_target.data_store import (
    ATTACKER_TOKEN,
    SAMPLE_ORDER_ID,
    VICTIM_TOKEN,
    store,
)
from ..schemas.scan import (
    BolaScanRequest,
    DemoPreset,
    MassAssignRequest,
    ResetResult,
    ScanResult,
)
from . import history
from .deps import get_http_client, get_settings_dep

router = APIRouter(prefix="/api/demo", tags=["demo"])

_VULN_BOLA_PATH = "/orders/{resource_id}"
_SECURE_BOLA_PATH = "/secure/orders/{resource_id}"
_MASS_ASSIGN_PATH = "/users/profile"

_SAFETY_NOTES = [
    "All targets are local, in-memory, synthetic mock endpoints.",
    "Demo tokens are development-only fixtures, not real authentication.",
    "External targets are opt-in and SSRF-guarded; loopback/private ranges are blocked for external scans.",
    "The reset route restores deterministic fixtures and is demo-only.",
]


@router.get("/preset", response_model=DemoPreset)
async def demo_preset(settings: Settings = Depends(get_settings_dep)) -> DemoPreset:
    expose = settings.demo_mode
    return DemoPreset(
        base_url=settings.mock_base_url,
        victim_token=VICTIM_TOKEN if expose else None,
        attacker_token=ATTACKER_TOKEN if expose else None,
        sample_order_id=SAMPLE_ORDER_ID,
        vulnerable_bola_path=_VULN_BOLA_PATH,
        secure_bola_path=_SECURE_BOLA_PATH,
        mass_assign_path=_MASS_ASSIGN_PATH,
        demo_mode=settings.demo_mode,
        tokens_exposed=expose,
        warning=(
            "These tokens are static, insecure, development-only fixtures. "
            "Never treat them as production credentials."
        ),
        safety_notes=_SAFETY_NOTES,
    )


@router.post("/reset", response_model=ResetResult)
async def demo_reset(settings: Settings = Depends(get_settings_dep)) -> ResetResult:
    if not settings.demo_mode:
        raise HTTPException(status_code=403, detail="Reset is only available in demo mode")
    store.reset()
    history.clear()
    return ResetResult(status="ok", message="Mock target restored to initial fixtures")


@router.post("/run", response_model=list[ScanResult])
async def demo_run(
    client: httpx.AsyncClient = Depends(get_http_client),
    settings: Settings = Depends(get_settings_dep),
) -> list[ScanResult]:
    """Run the full preloaded demo: vulnerable BOLA, secure BOLA, Mass Assignment."""
    if not settings.demo_mode:
        raise HTTPException(status_code=403, detail="Demo run is only available in demo mode")

    # Deterministic starting point.
    store.reset()
    base = settings.mock_base_url

    results: list[ScanResult] = []
    results.append(
        await run_bola_scan(
            client,
            BolaScanRequest(
                target_base_url=base,
                resource_id=SAMPLE_ORDER_ID,
                victim_token=VICTIM_TOKEN,
                attacker_token=ATTACKER_TOKEN,
                endpoint_path=_VULN_BOLA_PATH,
                mode="vulnerable",
            ),
            settings,
        )
    )
    results.append(
        await run_bola_scan(
            client,
            BolaScanRequest(
                target_base_url=base,
                resource_id=SAMPLE_ORDER_ID,
                victim_token=VICTIM_TOKEN,
                attacker_token=ATTACKER_TOKEN,
                endpoint_path=_SECURE_BOLA_PATH,
                mode="secure",
            ),
            settings,
        )
    )
    results.append(
        await run_mass_assign_scan(
            client,
            MassAssignRequest(
                target_base_url=base,
                test_token=ATTACKER_TOKEN,
                profile_path=_MASS_ASSIGN_PATH,
                probe_fields={"role": "admin", "is_admin": True, "tier": "enterprise"},
            ),
            settings,
        )
    )

    for r in results:
        history.add(r)
    return results
