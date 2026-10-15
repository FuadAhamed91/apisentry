"""Mock target behavior (Phase 2 acceptance criteria)."""

from __future__ import annotations

from tests.conftest import ATTACKER, VICTIM

ORDERS = "/mock/api/v1/orders"
SECURE = "/mock/api/v1/secure/orders"
PROFILE = "/mock/api/v1/users/profile"


def test_alice_reads_own_order(api_client):
    r = api_client.get(f"{ORDERS}/ord-9921", headers=VICTIM)
    assert r.status_code == 200
    assert r.json()["owner_id"] == "alice"


def test_vulnerable_bola_bob_reads_alice_order(api_client):
    # The deliberately vulnerable endpoint leaks across tenants.
    r = api_client.get(f"{ORDERS}/ord-9921", headers=ATTACKER)
    assert r.status_code == 200
    assert r.json()["owner_id"] == "alice"


def test_secure_denies_cross_tenant_without_leak(api_client):
    r = api_client.get(f"{SECURE}/ord-9921", headers=ATTACKER)
    assert r.status_code == 404
    assert "owner_id" not in r.json()
    assert "internal_notes" not in r.json()


def test_secure_allows_owner(api_client):
    r = api_client.get(f"{SECURE}/ord-9921", headers=VICTIM)
    assert r.status_code == 200
    assert r.json()["id"] == "ord-9921"


def test_missing_credentials_401(api_client):
    assert api_client.get(f"{ORDERS}/ord-9921").status_code == 401


def test_invalid_token_401(api_client):
    r = api_client.get(f"{ORDERS}/ord-9921", headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401


def test_unknown_order_404(api_client):
    assert api_client.get(f"{ORDERS}/ord-0000", headers=VICTIM).status_code == 404


def test_mass_assign_persists_privileged_fields(api_client):
    r = api_client.put(PROFILE, headers=ATTACKER, json={"is_admin": True, "role": "admin"})
    assert r.status_code == 200
    body = r.json()
    assert body["is_admin"] is True and body["role"] == "admin"
    # Confirm persistence via an independent read-back.
    r2 = api_client.get(PROFILE, headers=ATTACKER)
    assert r2.json()["is_admin"] is True


def test_mass_assign_cannot_change_identity(api_client):
    r = api_client.put(PROFILE, headers=ATTACKER, json={"tenant_id": "tenant-a", "id": "alice"})
    body = r.json()
    assert body["tenant_id"] == "tenant-b" and body["id"] == "bob"


def test_malformed_json_400(api_client):
    r = api_client.put(PROFILE, headers=ATTACKER, content="{ not valid json")
    assert r.status_code == 400


def test_non_object_body_400(api_client):
    r = api_client.put(PROFILE, headers=ATTACKER, json=[1, 2, 3])
    assert r.status_code == 400


def test_oversized_body_413(api_client):
    r = api_client.put(PROFILE, headers=ATTACKER, json={"display_name": "x" * 70000})
    assert r.status_code == 413


def test_reset_restores_fixtures(api_client):
    api_client.put(PROFILE, headers=ATTACKER, json={"is_admin": True})
    assert api_client.get(PROFILE, headers=ATTACKER).json()["is_admin"] is True
    r = api_client.post("/api/demo/reset")
    assert r.status_code == 200
    assert api_client.get(PROFILE, headers=ATTACKER).json()["is_admin"] is False
