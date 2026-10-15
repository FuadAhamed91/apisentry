"""HTTP probe helper used by the checkers.

Performs a single request through an injected ``httpx.AsyncClient`` and captures
a :class:`ResponseMeta` whose body is redacted and length-bounded. Transport and
timeout failures are surfaced as :class:`ProbeError` so a checker can classify
them as ERROR rather than mistaking them for an authorization outcome.
"""

from __future__ import annotations

import time
from typing import Any

import httpx

from ..config import Settings
from ..schemas.scan import ResponseMeta
from .redact import redact, redact_text

_MAX_TEXT_EVIDENCE = 4000


class ProbeError(Exception):
    """A transport/timeout failure that prevents a valid assessment."""


async def probe(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    token: str | None,
    token_role: str | None,
    settings: Settings,
    json_body: Any | None = None,
) -> tuple[ResponseMeta, Any]:
    headers: dict[str, str] = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    start = time.perf_counter()
    try:
        resp = await client.request(
            method,
            url,
            headers=headers,
            json=json_body,
            timeout=settings.request_timeout_seconds,
        )
    except httpx.TimeoutException as exc:
        raise ProbeError(
            f"Request timed out after {settings.request_timeout_seconds:g}s"
        ) from exc
    except httpx.HTTPError as exc:
        raise ProbeError(f"Transport error ({type(exc).__name__})") from exc

    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
    content = resp.content or b""
    size = len(content)
    ctype = resp.headers.get("content-type")

    parsed: Any = None
    json_parsed = False
    truncated = False
    note: str | None = None

    if resp.is_redirect:
        note = f"Redirect to {resp.headers.get('location', '?')} (not followed)"

    if size > settings.max_response_bytes:
        truncated = True
        suffix = f"Response exceeded {settings.max_response_bytes} bytes; body omitted"
        note = f"{note}; {suffix}" if note else suffix
        body_evidence: Any = None
    elif ctype and "json" in ctype.lower():
        try:
            parsed = resp.json()
            json_parsed = True
            body_evidence = redact(parsed)
        except ValueError:
            body_evidence = redact_text(resp.text[:_MAX_TEXT_EVIDENCE])
            truncated = len(resp.text) > _MAX_TEXT_EVIDENCE
            note = (f"{note}; " if note else "") + "Content-Type was JSON but body did not parse"
    else:
        text = resp.text
        truncated = len(text) > _MAX_TEXT_EVIDENCE
        body_evidence = redact_text(text[:_MAX_TEXT_EVIDENCE]) if text else None

    meta = ResponseMeta(
        status_code=resp.status_code,
        response_size=size,
        content_type=ctype,
        elapsed_ms=elapsed_ms,
        json_parsed=json_parsed,
        body=body_evidence,
        truncated=truncated,
        note=note,
    )
    return meta, parsed
