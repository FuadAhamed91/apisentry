"""Shared pytest fixtures.

Tests are fully local and deterministic: no external network access is required.
Engine tests drive the mounted mock target in-process through an httpx ASGI
transport; API tests use FastAPI's TestClient (which runs the app lifespan).
"""

from __future__ import annotations

import httpx
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient

from app.api import history
from app.config import get_settings
from app.main import app
from app.mock_target.data_store import store

MOCK_BASE = "http://testserver/mock/api/v1"
VICTIM = {"Authorization": "Bearer token-victim-alice"}
ATTACKER = {"Authorization": "Bearer token-attacker-bob"}


@pytest.fixture(autouse=True)
def _reset_state():
    """Restore deterministic fixtures and clear history around every test."""
    store.reset()
    history.clear()
    yield
    store.reset()
    history.clear()


@pytest.fixture
def settings():
    return get_settings()


@pytest_asyncio.fixture
async def engine_client():
    """An httpx client that serves the whole app in-process (no sockets)."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver", follow_redirects=False
    ) as client:
        yield client


@pytest.fixture
def api_client():
    with TestClient(app) as client:
        yield client
