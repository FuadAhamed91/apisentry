"""Bounded, in-memory scan history.

Retention is capped by ``settings.history_limit`` so the store cannot grow
unbounded. Newest first. This is intentionally ephemeral; there is no persistent
storage in the default installation.
"""

from __future__ import annotations

from collections import deque
from threading import Lock

from ..config import get_settings
from ..schemas.scan import ScanResult, ScanSummary

_store: deque[ScanResult] = deque(maxlen=get_settings().history_limit)
_lock = Lock()


def add(result: ScanResult) -> None:
    with _lock:
        _store.appendleft(result)


def summaries() -> list[ScanSummary]:
    with _lock:
        return [
            ScanSummary(
                scan_id=r.scan_id,
                scan_type=r.scan_type,
                vuln_class=r.vuln_class,
                title=r.title,
                endpoint=r.endpoint,
                status=r.status,
                severity=r.severity,
                confidence=r.confidence,
                started_at=r.started_at,
                duration_ms=r.duration_ms,
            )
            for r in _store
        ]


def get(scan_id: str) -> ScanResult | None:
    with _lock:
        for r in _store:
            if r.scan_id == scan_id:
                return r
    return None


def clear() -> None:
    with _lock:
        _store.clear()
