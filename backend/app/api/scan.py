"""Scan API: run BOLA / Mass Assignment assessments and read history."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException

from ..config import Settings
from ..engine.bola_checker import run_bola_scan
from ..engine.mass_assign import run_mass_assign_scan
from ..schemas.scan import (
    BolaScanRequest,
    MassAssignRequest,
    ScanResult,
    ScanSummary,
)
from . import history
from .deps import get_http_client, get_settings_dep

router = APIRouter(prefix="/api/scan", tags=["scan"])


@router.post("/bola", response_model=ScanResult)
async def scan_bola(
    req: BolaScanRequest,
    client: httpx.AsyncClient = Depends(get_http_client),
    settings: Settings = Depends(get_settings_dep),
) -> ScanResult:
    result = await run_bola_scan(client, req, settings)
    history.add(result)
    return result


@router.post("/mass-assign", response_model=ScanResult)
async def scan_mass_assign(
    req: MassAssignRequest,
    client: httpx.AsyncClient = Depends(get_http_client),
    settings: Settings = Depends(get_settings_dep),
) -> ScanResult:
    result = await run_mass_assign_scan(client, req, settings)
    history.add(result)
    return result


@router.get("/history", response_model=list[ScanSummary])
async def scan_history() -> list[ScanSummary]:
    return history.summaries()


@router.get("/{scan_id}", response_model=ScanResult)
async def scan_detail(scan_id: str) -> ScanResult:
    result = history.get(scan_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return result
