"""Recursive JSON diff + redaction correctness."""

from __future__ import annotations

from app.engine.diff_engine import classify_field, diff_json, exposed_sensitive_summary
from app.engine.redact import REDACTED, redact, redact_text
from app.schemas.scan import DiffChangeType


def test_changed_primitive():
    d = diff_json({"a": 1}, {"a": 2})
    assert len(d) == 1
    assert d[0].change_type == DiffChangeType.CHANGED
    assert d[0].path == "/a"
    assert d[0].baseline_value == 1 and d[0].comparison_value == 2


def test_added_and_removed_keys():
    added = diff_json({"a": 1}, {"a": 1, "b": 2})
    assert any(e.change_type == DiffChangeType.ADDED and e.path == "/b" for e in added)
    removed = diff_json({"a": 1, "b": 2}, {"a": 1})
    assert any(e.change_type == DiffChangeType.REMOVED and e.path == "/b" for e in removed)


def test_type_change():
    d = diff_json({"a": "1"}, {"a": 1})
    assert d[0].change_type == DiffChangeType.TYPE_CHANGED


def test_null_handling():
    assert diff_json({"a": None}, {"a": None}) == []
    d = diff_json({"a": None}, {"a": "x"})
    assert d[0].change_type == DiffChangeType.CHANGED


def test_nested_objects_and_arrays():
    base = {"u": {"id": 1, "tags": ["a", "b"]}}
    comp = {"u": {"id": 2, "tags": ["a", "c", "d"]}}
    paths = {e.path for e in diff_json(base, comp)}
    assert "/u/id" in paths
    assert "/u/tags/1" in paths  # b -> c
    assert "/u/tags/2" in paths  # added element


def test_identical_is_empty():
    assert diff_json({"a": 1, "b": [1, 2]}, {"a": 1, "b": [1, 2]}) == []


def test_bool_vs_int_is_type_change():
    d = diff_json({"a": True}, {"a": 1})
    assert d[0].change_type == DiffChangeType.TYPE_CHANGED


def test_sensitivity_classification():
    assert classify_field("owner_id") == ("owner_id", True)
    assert classify_field("tenant_id")[1] is True
    assert classify_field("product")[1] is False
    d = diff_json({"owner_id": "alice"}, {"owner_id": "bob"})
    assert d[0].sensitive and d[0].security_relevant


def test_exposed_summary_only_sensitive():
    summary = exposed_sensitive_summary(
        {"owner_id": "alice", "email": "a@b.c", "product": "widget"}
    )
    joined = " ".join(summary)
    assert "owner_id" in joined and "email" in joined
    assert "product" not in joined


def test_redact_masks_credentials_keeps_business_data():
    out = redact(
        {
            "authorization": "Bearer abc123",
            "password": "hunter2",
            "email": "a@b.c",
            "owner_id": "alice",
            "inner": {"api_key": "k-xyz", "city": "Abu Dhabi"},
        }
    )
    assert out["authorization"] == REDACTED
    assert out["password"] == REDACTED
    assert out["inner"]["api_key"] == REDACTED
    # Business data is intentionally preserved so exposure can be demonstrated.
    assert out["email"] == "a@b.c"
    assert out["owner_id"] == "alice"
    assert out["inner"]["city"] == "Abu Dhabi"


def test_redact_text_strips_bearer():
    assert redact_text("Authorization: Bearer abc.def-123") == f"Authorization: Bearer {REDACTED}"
