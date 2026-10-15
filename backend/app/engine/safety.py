"""SSRF-safe target validation.

Policy:
    * Local mock / lab hosts are allowed by default (the normal demo path).
    * Any other host is an *external* target and is opt-in: it requires both
      ``allow_external_targets`` to be enabled and an explicit per-scan
      authorization confirmation.
    * For external targets, every resolved IP address is checked. Loopback,
      private, link-local, multicast, reserved, unspecified, and cloud-metadata
      destinations are blocked. Hostnames are never trusted on their own.
"""

from __future__ import annotations

import ipaddress
import socket
from typing import Callable
from urllib.parse import urlparse

from ..config import Settings

# Known cloud metadata endpoints (IMDS). 169.254.169.254 is also link-local, but
# we name it explicitly for clarity and defence in depth.
_METADATA_HOSTS = {"169.254.169.254", "fd00:ec2::254", "metadata.google.internal"}

Resolver = Callable[..., list]


class TargetValidationError(Exception):
    """Raised when a target is not permitted by policy."""


def _assert_public_ip(raw: str) -> None:
    ip = ipaddress.ip_address(raw)
    if (
        ip.is_loopback
        or ip.is_private
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        raise TargetValidationError(f"Blocked non-public address: {ip}")
    if str(ip) in _METADATA_HOSTS:
        raise TargetValidationError("Blocked cloud metadata endpoint")


def _resolve_ips(host: str, port: int | None, resolver: Resolver) -> list[str]:
    try:
        infos = resolver(host, port or 0, type=socket.SOCK_STREAM)
    except OSError as exc:  # DNS failure, etc.
        raise TargetValidationError(f"DNS resolution failed for {host!r}: {exc}") from exc
    ips = sorted({info[4][0] for info in infos})
    if not ips:
        raise TargetValidationError(f"No addresses resolved for host {host!r}")
    return ips


def validate_target(
    url: str,
    *,
    settings: Settings,
    external_authorized: bool = False,
    resolver: Resolver = socket.getaddrinfo,
) -> None:
    """Validate a target URL, raising ``TargetValidationError`` if disallowed."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise TargetValidationError("Only http and https targets are supported")
    host = parsed.hostname
    if not host:
        raise TargetValidationError("Target URL is missing a host")

    # Designated local lab host: allowed without external authorization.
    if host.lower() in settings.local_hosts:
        return

    # Everything else is an external target.
    if not settings.allow_external_targets:
        raise TargetValidationError(
            "External targets are disabled. Local mock endpoints only. "
            "Set APISENTRY_ALLOW_EXTERNAL_TARGETS=true to opt in."
        )
    if not external_authorized:
        raise TargetValidationError(
            "External target requires an explicit authorization confirmation."
        )

    for ip in _resolve_ips(host, parsed.port, resolver):
        _assert_public_ip(ip)


def validate_redirect_location(
    location: str,
    *,
    settings: Settings,
    external_authorized: bool,
    resolver: Resolver = socket.getaddrinfo,
) -> None:
    """Re-validate a redirect target so we never follow one to a blocked host."""
    validate_target(
        location,
        settings=settings,
        external_authorized=external_authorized,
        resolver=resolver,
    )
