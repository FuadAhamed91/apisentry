"""Broken Object Level Authorization (BOLA / IDOR) checker.

Establishes a victim-context baseline, replays the identical request with an
unrelated attacker context, and compares the results. A finding is only reported
VULNERABLE when the attacker independently receives the victim's protected
object (matching id + owner/tenant of the victim). A 2xx alone is never
sufficient proof.
"""

from __future__ import annotations

import uuid

import httpx

from ..config import Settings
from ..schemas.scan import (
    Confidence,
    DiffView,
    RequestMeta,
    ScanResult,
    ScanStatus,
    ScanType,
    Severity,
    TestCase,
    VulnClass,
    utcnow,
)
from .diff_engine import diff_json, exposed_sensitive_summary
from .knowledge import OWASP_BOLA, bola_narrative, bola_remediation, bola_severity_for_resource
from .safety import TargetValidationError, validate_target
from .transport import ProbeError, probe


def _new_id() -> str:
    return "bola-" + uuid.uuid4().hex[:10]


def _display_url(req_base: str, path: str) -> str:
    return req_base.rstrip("/") + path


async def run_bola_scan(client: httpx.AsyncClient, req, settings: Settings) -> ScanResult:
    """Execute a BOLA assessment. ``req`` is a BolaScanRequest."""
    scan_id = _new_id()
    started = utcnow()
    path = req.endpoint_path.replace("{resource_id}", req.resource_id)
    full_url = _display_url(req.target_base_url, path)
    secure_mode = req.mode == "secure"

    def finalize(**kwargs) -> ScanResult:
        finished = utcnow()
        kwargs.setdefault("owasp_refs", [OWASP_BOLA])
        return ScanResult(
            scan_id=scan_id,
            scan_type=ScanType.BOLA,
            vuln_class=VulnClass.BOLA,
            target=req.target_base_url,
            endpoint=f"GET {path}",
            started_at=started,
            finished_at=finished,
            duration_ms=round((finished - started).total_seconds() * 1000, 2),
            **kwargs,
        )

    # --- Target safety boundary ---------------------------------------------
    try:
        validate_target(
            req.target_base_url,
            settings=settings,
            external_authorized=req.external_authorized,
        )
    except TargetValidationError as exc:
        return finalize(
            title="BOLA scan blocked by target policy",
            status=ScanStatus.ERROR,
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.HIGH,
            rationale=f"Target validation failed: {exc}",
            error=str(exc),
        )

    test_cases: list[TestCase] = []

    # --- Step 1: victim baseline --------------------------------------------
    try:
        base_meta, base_json = await probe(
            client, "GET", full_url,
            token=req.victim_token, token_role="victim", settings=settings,
        )
    except ProbeError as exc:
        return finalize(
            title="BOLA scan could not establish a baseline",
            status=ScanStatus.ERROR,
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.HIGH,
            rationale=f"Baseline request failed: {exc}",
            error=str(exc),
        )
    test_cases.append(
        TestCase(
            name="Victim baseline",
            description="Retrieve the resource using the owner's (Tenant A) token.",
            request=RequestMeta(method="GET", url=full_url, token_role="victim"),
            response=base_meta,
            outcome=f"HTTP {base_meta.status_code}",
        )
    )

    baseline_ok = (
        base_meta.status_code == 200
        and isinstance(base_json, dict)
        and base_json.get("id") == req.resource_id
    )

    # --- Step 2: attacker replay --------------------------------------------
    try:
        atk_meta, atk_json = await probe(
            client, "GET", full_url,
            token=req.attacker_token, token_role="attacker", settings=settings,
        )
    except ProbeError as exc:
        return finalize(
            title="BOLA scan failed during attacker replay",
            status=ScanStatus.ERROR,
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.HIGH,
            rationale=f"Attacker replay failed: {exc}",
            test_cases=test_cases,
            error=str(exc),
        )
    test_cases.append(
        TestCase(
            name="Attacker replay",
            description="Replay the identical request using an unrelated (Tenant B) token.",
            request=RequestMeta(method="GET", url=full_url, token_role="attacker"),
            response=atk_meta,
            outcome=f"HTTP {atk_meta.status_code}",
        )
    )

    # --- Analysis ------------------------------------------------------------
    entries = diff_json(
        base_json if isinstance(base_json, (dict, list)) else {},
        atk_json if isinstance(atk_json, (dict, list)) else {},
    )

    attacker_got_resource = (
        atk_meta.status_code == 200
        and isinstance(atk_json, dict)
        and atk_json.get("id") == req.resource_id
    )
    belongs_to_victim = (
        attacker_got_resource
        and isinstance(base_json, dict)
        and atk_json.get("owner_id") == base_json.get("owner_id")
        and atk_json.get("tenant_id") == base_json.get("tenant_id")
    )

    exposed = exposed_sensitive_summary(atk_json) if belongs_to_victim else []
    diff_view = DiffView(
        left_label="Victim (Tenant A) baseline",
        right_label="Attacker (Tenant B) replay",
        left=base_meta,
        right=atk_meta,
        entries=entries,
        exposed_summary=exposed,
    )

    common = dict(
        test_cases=test_cases,
        diff_view=diff_view,
        exposed_summary=exposed,
        remediation=bola_remediation(),
        owasp_refs=[OWASP_BOLA],
    )

    if not baseline_ok:
        narrative = bola_narrative(vulnerable=False)
        return finalize(
            title="BOLA test inconclusive (no valid baseline)",
            status=ScanStatus.INCONCLUSIVE,
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.MEDIUM,
            rationale=(
                "The victim baseline did not return the expected protected resource "
                f"(HTTP {base_meta.status_code}), so authorization behavior cannot be "
                "established. Verify the token and resource id."
            ),
            attack_preconditions=narrative["attack_preconditions"],
            **common,
        )

    if belongs_to_victim:
        severity = bola_severity_for_resource(atk_json)
        narrative = bola_narrative(vulnerable=True)
        return finalize(
            title="Broken Object Level Authorization confirmed",
            status=ScanStatus.VULNERABLE,
            severity=severity,
            confidence=Confidence.HIGH,
            rationale=(
                f"The attacker context (HTTP {atk_meta.status_code}) independently "
                f"received resource '{req.resource_id}' owned by "
                f"owner_id={atk_json.get('owner_id')!r} / "
                f"tenant_id={atk_json.get('tenant_id')!r}, which matches the victim "
                "baseline rather than the attacker's own principal. Identical "
                "protected fields crossed the authorization boundary."
            ),
            impact=narrative["impact"],
            attack_preconditions=narrative["attack_preconditions"],
            reproduction=narrative["reproduction"],
            **common,
        )

    # Attacker denied, or got a 2xx that is NOT the victim's protected resource.
    denied = atk_meta.status_code in (401, 403, 404)
    if denied:
        narrative = bola_narrative(vulnerable=False)
        return finalize(
            title="Authorization enforced (no cross-tenant exposure)",
            status=ScanStatus.PASS,
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.HIGH,
            rationale=(
                f"The victim baseline succeeded, and the attacker context was denied "
                f"(HTTP {atk_meta.status_code}) with no protected order data in the "
                "response. Object-level authorization is enforced."
            ),
            impact=narrative["impact"],
            attack_preconditions=narrative["attack_preconditions"],
            reproduction=narrative["reproduction"],
            **common,
        )

    return finalize(
        title="BOLA test inconclusive (unexpected attacker response)",
        status=ScanStatus.INCONCLUSIVE,
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.MEDIUM,
        rationale=(
            f"The attacker context returned HTTP {atk_meta.status_code} but the body "
            "was not the victim's protected resource (no matching id/owner/tenant). "
            "This is not confirmed BOLA; manual review is recommended."
        ),
        **common,
    )
