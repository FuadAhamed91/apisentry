"""SSRF-safe target validation."""

from __future__ import annotations

import pytest

from app.config import Settings
from app.engine.safety import TargetValidationError, validate_target


def _resolver_to(ip: str):
    def _resolver(host, port, type=None, **kw):
        return [(0, 0, 0, "", (ip, port or 0))]

    return _resolver


def test_local_host_always_allowed():
    # No external authorization needed for the designated local lab.
    validate_target("http://127.0.0.1:8000/mock/api/v1", settings=Settings(), external_authorized=False)
    validate_target("http://localhost:8000/mock", settings=Settings(), external_authorized=False)


def test_external_disabled_by_default():
    with pytest.raises(TargetValidationError):
        validate_target("http://example.com", settings=Settings(), external_authorized=True)


def test_external_requires_authorization_confirmation():
    s = Settings(allow_external_targets=True)
    with pytest.raises(TargetValidationError):
        validate_target("http://example.com", settings=s, external_authorized=False)


def test_external_private_ip_blocked():
    s = Settings(allow_external_targets=True)
    with pytest.raises(TargetValidationError):
        validate_target(
            "http://internal.example.com",
            settings=s,
            external_authorized=True,
            resolver=_resolver_to("10.0.0.5"),
        )


def test_external_metadata_ip_blocked():
    s = Settings(allow_external_targets=True)
    with pytest.raises(TargetValidationError):
        validate_target(
            "http://metadata.example.com",
            settings=s,
            external_authorized=True,
            resolver=_resolver_to("169.254.169.254"),
        )


def test_external_public_ip_allowed():
    s = Settings(allow_external_targets=True)
    # Should not raise.
    validate_target(
        "http://example.com",
        settings=s,
        external_authorized=True,
        resolver=_resolver_to("93.184.216.34"),
    )


def test_non_http_scheme_rejected():
    with pytest.raises(TargetValidationError):
        validate_target("ftp://example.com", settings=Settings(), external_authorized=True)
