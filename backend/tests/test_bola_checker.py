"""BOLA checker behavior (Phase 3 acceptance criteria)."""

from __future__ import annotations

import httpx
import pytest

from app.config import get_settings
from app.engine.bola_checker import run_bola_scan
from app.schemas.scan import BolaScanRequest, Confidence, ScanStatus, Severity
from tests.conftest import MOCK_BASE

VICTIM_TOKEN = "token-victim-alice"
ATTACKER_TOKEN = "token-attacker-bob"


def _req(path: str, mode: str, resource_id: str = "ord-9921") -> BolaScanRequest:
    return BolaScanRequest(
        target_base_url=MOCK_BASE,
        resource_id=resource_id,
        victim_token=VICTIM_TOKEN,
        attacker_token=ATTACKER_TOKEN,
        endpoint_path=path,
        mode=mode,
    )


async def test_vulnerable_endpoint_confirms_bola(engine_client):
    res = await run_bola_scan(engine_client, _req("/orders/{resource_id}", "vulnerable"), get_settings())
    assert res.status == ScanStatus.VULNERABLE
    assert res.severity in (Severity.HIGH, Severity.CRITICAL)
    assert res.confidence == Confidence.HIGH
    assert any("owner_id" in e for e in res.exposed_summary)
    assert res.diff_view is not None
    assert res.remediation is not None and res.owasp_refs


async def test_secure_endpoint_passes(engine_client):
    res = await run_bola_scan(engine_client, _req("/secure/orders/{resource_id}", "secure"), get_settings())
    assert res.status == ScanStatus.PASS
    assert res.exposed_summary == []
    # The denial response must not contain protected order data.
    right_body = res.diff_view.right.body
    assert not (isinstance(right_body, dict) and right_body.get("owner_id"))


async def test_inconclusive_when_baseline_missing(engine_client):
    res = await run_bola_scan(engine_client, _req("/orders/{resource_id}", "vulnerable", "ord-0000"), get_settings())
    assert res.status == ScanStatus.INCONCLUSIVE


async def test_external_target_blocked_by_policy(engine_client):
    req = BolaScanRequest(
        target_base_url="http://example.com/api",
        resource_id="ord-9921",
        victim_token="a",
        attacker_token="b",
    )
    res = await run_bola_scan(engine_client, req, get_settings())
    assert res.status == ScanStatus.ERROR
    assert "external" in res.rationale.lower()


async def test_no_token_leaks_in_evidence(engine_client):
    res = await run_bola_scan(engine_client, _req("/orders/{resource_id}", "vulnerable"), get_settings())
    blob = res.model_dump_json()
    assert VICTIM_TOKEN not in blob
    assert ATTACKER_TOKEN not in blob


class _TimeoutTransport(httpx.AsyncBaseTransport):
    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("simulated timeout")


async def test_transport_error_is_error_status():
    async with httpx.AsyncClient(transport=_TimeoutTransport()) as client:
        req = BolaScanRequest(
            target_base_url="http://127.0.0.1/mock/api/v1",
            resource_id="ord-9921",
            victim_token="a",
            attacker_token="b",
        )
        res = await run_bola_scan(client, req, get_settings())
    assert res.status == ScanStatus.ERROR
    assert "timed out" in res.rationale.lower() or "transport" in res.rationale.lower()
