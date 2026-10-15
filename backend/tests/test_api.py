"""End-to-end API contract tests (Phase 5)."""

from __future__ import annotations

MOCK = "http://127.0.0.1:8000/mock/api/v1"


def _bola_body(path: str, mode: str) -> dict:
    return {
        "target_base_url": MOCK,
        "resource_id": "ord-9921",
        "victim_token": "token-victim-alice",
        "attacker_token": "token-attacker-bob",
        "endpoint_path": path,
        "mode": mode,
    }


def test_health(api_client):
    r = api_client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["name"] == "APISentry"


def test_demo_preset(api_client):
    r = api_client.get("/api/demo/preset")
    assert r.status_code == 200
    body = r.json()
    assert body["sample_order_id"] == "ord-9921"
    assert body["victim_token"] == "token-victim-alice"
    assert body["vulnerable_bola_path"] == "/orders/{resource_id}"
    assert body["secure_bola_path"] == "/secure/orders/{resource_id}"
    assert body["tokens_exposed"] is True


def test_scan_bola_vulnerable(api_client):
    r = api_client.post("/api/scan/bola", json=_bola_body("/orders/{resource_id}", "vulnerable"))
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "VULNERABLE"
    assert body["severity"] in ("HIGH", "CRITICAL")
    assert body["diff_view"] is not None


def test_scan_bola_secure_passes(api_client):
    r = api_client.post("/api/scan/bola", json=_bola_body("/secure/orders/{resource_id}", "secure"))
    assert r.status_code == 200
    assert r.json()["status"] == "PASS"


def test_scan_mass_assign(api_client):
    r = api_client.post(
        "/api/scan/mass-assign",
        json={
            "target_base_url": MOCK,
            "test_token": "token-attacker-bob",
            "profile_path": "/users/profile",
            "probe_fields": {"role": "admin", "is_admin": True, "tier": "enterprise"},
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "VULNERABLE"
    assert body["severity"] == "CRITICAL"
    assert body["restoration_status"] in ("restored", "incomplete")


def test_full_demo_run_and_history(api_client):
    r = api_client.post("/api/demo/run")
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 3
    statuses = [x["status"] for x in results]
    assert "VULNERABLE" in statuses and "PASS" in statuses

    hist = api_client.get("/api/scan/history").json()
    assert len(hist) >= 3
    # Detail fetch round-trips.
    scan_id = hist[0]["scan_id"]
    detail = api_client.get(f"/api/scan/{scan_id}")
    assert detail.status_code == 200 and detail.json()["scan_id"] == scan_id


def test_validation_error_is_422(api_client):
    r = api_client.post("/api/scan/bola", json={"resource_id": "x"})
    assert r.status_code == 422


def test_external_target_rejected(api_client):
    r = api_client.post(
        "/api/scan/bola",
        json={
            "target_base_url": "http://169.254.169.254/latest/meta-data",
            "resource_id": "x",
            "victim_token": "a",
            "attacker_token": "b",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ERROR"
    assert "external" in body["rationale"].lower()


def test_scan_detail_not_found(api_client):
    assert api_client.get("/api/scan/does-not-exist").status_code == 404


def test_no_tokens_leaked_in_scan_response(api_client):
    r = api_client.post("/api/scan/bola", json=_bola_body("/orders/{resource_id}", "vulnerable"))
    assert "token-victim-alice" not in r.text
    assert "token-attacker-bob" not in r.text
