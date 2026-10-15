"""Mass Assignment checker behavior (Phase 3 acceptance criteria)."""

from __future__ import annotations

from app.config import get_settings
from app.engine.mass_assign import run_mass_assign_scan
from app.schemas.scan import Confidence, MassAssignRequest, ScanStatus, Severity
from tests.conftest import MOCK_BASE

TEST_TOKEN = "token-attacker-bob"


def _req(**kwargs) -> MassAssignRequest:
    base = dict(target_base_url=MOCK_BASE, test_token=TEST_TOKEN, profile_path="/users/profile")
    base.update(kwargs)
    return MassAssignRequest(**base)


async def test_confirms_privilege_escalation(engine_client):
    req = _req(probe_fields={"role": "admin", "is_admin": True, "tier": "enterprise"})
    res = await run_mass_assign_scan(engine_client, req, get_settings())
    assert res.status == ScanStatus.VULNERABLE
    assert res.severity == Severity.CRITICAL  # role / is_admin escalation
    assert res.confidence == Confidence.HIGH
    assert res.verification_method.startswith("read-back")
    changed = {p.field for p in res.probes if p.persisted_change}
    assert {"role", "is_admin", "tier"} <= changed


async def test_restores_baseline_after_probing(engine_client):
    req = _req(probe_fields={"is_admin": True})
    res = await run_mass_assign_scan(engine_client, req, get_settings())
    assert res.restoration_status == "restored"
    # Independent read-back confirms the privilege was rolled back.
    r = await engine_client.get(
        f"{MOCK_BASE}/users/profile", headers={"Authorization": f"Bearer {TEST_TOKEN}"}
    )
    assert r.json()["is_admin"] is False


async def test_safe_mode_is_inconclusive_and_mutates_nothing(engine_client):
    req = _req(safe_mode=True, probe_fields={"is_admin": True})
    res = await run_mass_assign_scan(engine_client, req, get_settings())
    assert res.status == ScanStatus.INCONCLUSIVE
    assert "safe mode" in res.verification_method.lower()
    r = await engine_client.get(
        f"{MOCK_BASE}/users/profile", headers={"Authorization": f"Bearer {TEST_TOKEN}"}
    )
    assert r.json()["is_admin"] is False


async def test_editable_field_is_not_a_finding(engine_client):
    # display_name is a legitimately user-editable field. Persisting it must NOT
    # be reported as a vulnerability (false-positive prevention).
    req = _req(probe_fields={"display_name": "Renamed Demo User"})
    res = await run_mass_assign_scan(engine_client, req, get_settings())
    assert res.status == ScanStatus.PASS
    assert res.severity == Severity.INFORMATIONAL


async def test_tier_only_is_high_not_critical(engine_client):
    # tier is unauthorized for self-service (-> finding) but not a hard privilege
    # escalation like is_admin/role, so severity is High, not Critical.
    req = _req(probe_fields={"tier": "enterprise"})
    res = await run_mass_assign_scan(engine_client, req, get_settings())
    assert res.status == ScanStatus.VULNERABLE
    assert res.severity == Severity.HIGH
