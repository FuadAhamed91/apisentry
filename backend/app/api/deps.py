"""Shared FastAPI dependencies."""

from __future__ import annotations

import httpx
from fastapi import Request

from ..config import Settings, get_settings


def get_http_client(request: Request) -> httpx.AsyncClient:
    """The shared async client. Requests to local lab hosts are served in-process
    via an ASGI transport; external hosts (opt-in) use a real transport."""
    return request.app.state.http_client


def get_settings_dep() -> Settings:
    return get_settings()
