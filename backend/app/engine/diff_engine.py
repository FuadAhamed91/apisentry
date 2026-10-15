"""Recursive, structural JSON diff with sensitivity tagging.

Produces a list of :class:`DiffEntry` describing how a comparison document
differs from a baseline, using JSON Pointer (RFC 6901) field paths. Supports
nested objects and arrays, added/removed/changed keys, type changes, and nulls.
Each entry is tagged with a best-effort sensitivity classification; the engine
does not assume every differing field is sensitive.
"""

from __future__ import annotations

from typing import Any

from ..schemas.scan import DiffChangeType, DiffEntry

_MISSING = object()

# Exact field names that are treated as sensitive / security-relevant.
_SENSITIVE_FIELDS = {
    "tenant_id",
    "owner_id",
    "user_id",
    "account_id",
    "customer_id",
    "email",
    "phone",
    "address",
    "shipping_address",
    "billing_address",
    "internal_notes",
    "notes",
    "role",
    "roles",
    "is_admin",
    "admin",
    "is_superuser",
    "tier",
    "scopes",
    "permissions",
    "ssn",
    "national_id",
    "iban",
    "card_number",
    "credit_card",
}

# Substrings that mark a field as sensitive even with a prefixed/suffixed name.
_SENSITIVE_SUBSTRINGS = (
    "email",
    "address",
    "token",
    "secret",
    "password",
    "ssn",
    "card",
    "iban",
    "note",
    "owner",
    "tenant",
    "admin",
    "role",
    "account",
    "phone",
    "credential",
    "privilege",
)


def _escape(token: str) -> str:
    """Escape a path segment per RFC 6901."""
    return token.replace("~", "~0").replace("/", "~1")


def classify_field(name: str) -> tuple[str | None, bool]:
    """Return ``(classification, is_sensitive)`` for a field name."""
    key = name.lower()
    if key in _SENSITIVE_FIELDS:
        return key, True
    for sub in _SENSITIVE_SUBSTRINGS:
        if sub in key:
            return key, True
    return None, False


def _leaf_name(path: str) -> str:
    if not path:
        return ""
    return path.rsplit("/", 1)[-1].replace("~1", "/").replace("~0", "~")


def _make_entry(
    path: str, change: DiffChangeType, baseline: Any, comparison: Any
) -> DiffEntry:
    classification, sensitive = classify_field(_leaf_name(path))
    return DiffEntry(
        path=path or "/",
        change_type=change,
        baseline_value=baseline if baseline is not _MISSING else None,
        comparison_value=comparison if comparison is not _MISSING else None,
        sensitive=sensitive,
        classification=classification,
        security_relevant=sensitive,
    )


def _both_numbers(a: Any, b: Any) -> bool:
    return (
        isinstance(a, (int, float))
        and not isinstance(a, bool)
        and isinstance(b, (int, float))
        and not isinstance(b, bool)
    )


def _walk(path: str, base: Any, comp: Any, out: list[DiffEntry]) -> None:
    base_present = base is not _MISSING
    comp_present = comp is not _MISSING

    if base_present and not comp_present:
        out.append(_make_entry(path, DiffChangeType.REMOVED, base, _MISSING))
        return
    if comp_present and not base_present:
        out.append(_make_entry(path, DiffChangeType.ADDED, _MISSING, comp))
        return

    # Both present.
    if base is None or comp is None:
        if base is None and comp is None:
            return
        out.append(_make_entry(path, DiffChangeType.CHANGED, base, comp))
        return

    if _both_numbers(base, comp):
        if base != comp:
            out.append(_make_entry(path, DiffChangeType.CHANGED, base, comp))
        return

    if type(base) is not type(comp):
        out.append(_make_entry(path, DiffChangeType.TYPE_CHANGED, base, comp))
        return

    if isinstance(base, dict):
        for key in sorted(set(base) | set(comp), key=str):
            _walk(
                f"{path}/{_escape(str(key))}",
                base.get(key, _MISSING),
                comp.get(key, _MISSING),
                out,
            )
        return

    if isinstance(base, list):
        for i in range(max(len(base), len(comp))):
            b = base[i] if i < len(base) else _MISSING
            c = comp[i] if i < len(comp) else _MISSING
            _walk(f"{path}/{i}", b, c, out)
        return

    if base != comp:
        out.append(_make_entry(path, DiffChangeType.CHANGED, base, comp))


def diff_json(baseline: Any, comparison: Any) -> list[DiffEntry]:
    """Compute structural differences between two JSON-compatible documents."""
    out: list[DiffEntry] = []
    _walk("", baseline, comparison, out)
    return out


def iter_sensitive_fields(obj: Any, path: str = "") -> list[tuple[str, str, Any]]:
    """Yield ``(path, classification, value)`` for sensitive leaf fields in a doc."""
    results: list[tuple[str, str, Any]] = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            child = f"{path}/{_escape(str(key))}"
            classification, sensitive = classify_field(str(key))
            if sensitive and not isinstance(value, (dict, list)):
                results.append((child, classification or str(key), value))
            results.extend(iter_sensitive_fields(value, child))
    elif isinstance(obj, list):
        for i, value in enumerate(obj):
            results.extend(iter_sensitive_fields(value, f"{path}/{i}"))
    return results


def exposed_sensitive_summary(obj: Any, limit: int = 12) -> list[str]:
    """Human-readable summary of sensitive fields present in a document."""
    out: list[str] = []
    for _path, classification, value in iter_sensitive_fields(obj):
        out.append(f"{classification} = {value!r}")
        if len(out) >= limit:
            break
    return out
