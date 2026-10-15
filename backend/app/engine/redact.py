"""Redaction of credential-like values from captured evidence.

We redact *credentials* (bearer tokens, passwords, secrets, API keys) wherever
they appear, but deliberately preserve business data such as owner ids and email
addresses, because demonstrating that such data crossed an authorization
boundary is the entire point of a finding. All redaction is applied before
evidence is stored or returned.
"""

from __future__ import annotations

import re
from typing import Any

REDACTED = "«redacted»"  # «redacted»

# Keys whose *values* are credential-like and must never be retained.
_SENSITIVE_KEY = re.compile(
    r"(authorization|bearer|token|secret|password|passwd|pwd|"
    r"api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|"
    r"session|cookie|credential|auth)",
    re.IGNORECASE,
)

# Bearer tokens embedded in free text (e.g. an echoed header).
_BEARER = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9\-._~+/]+=*")

_MAX_DEPTH = 30


def _is_sensitive_key(key: str) -> bool:
    return bool(_SENSITIVE_KEY.search(key))


def redact_text(text: str) -> str:
    return _BEARER.sub("Bearer " + REDACTED, text)


def redact(value: Any, _depth: int = 0) -> Any:
    """Return a deep copy of ``value`` with credential-like data masked."""
    if _depth > _MAX_DEPTH:
        return "«depth-limit»"
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for k, v in value.items():
            if isinstance(k, str) and _is_sensitive_key(k):
                out[k] = REDACTED
            else:
                out[k] = redact(v, _depth + 1)
        return out
    if isinstance(value, list):
        return [redact(v, _depth + 1) for v in value]
    if isinstance(value, str):
        return redact_text(value)
    return value
