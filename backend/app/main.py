"""APISentry FastAPI application factory.

Wires together:
    * the production-facing API (health, demo, scan),
    * the isolated mock target mounted under /mock/api/v1,
    * a shared httpx client whose requests to local lab hosts are served
      in-process via an ASGI transport (no self-port dependency), while external
      hosts (opt-in) use a real, SSRF-guarded transport.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.demo import router as demo_router
from .api.scan import router as scan_router
from .config import get_settings
from .mock_target.routes import router as mock_router
from .schemas.scan import Health

DESCRIPTION = (
    "APISentry is a local, self-contained API authorization auditing lab. It "
    "ships a deliberately vulnerable mock target alongside a hardened counterpart "
    "and a deterministic engine that tells them apart with evidence-backed "
    "findings (BOLA / IDOR and Mass Assignment)."
)


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Serve local lab hosts in-process; external hosts use the default
        # (real) transport, which is SSRF-validated before every request.
        asgi = httpx.ASGITransport(app=app)
        # Bracket IPv6 literals (e.g. ::1) so the mount URL pattern is valid.
        mounts = {
            f"all://{('[' + host + ']') if ':' in host else host}": asgi
            for host in settings.local_hosts
        }
        app.state.http_client = httpx.AsyncClient(
            mounts=mounts,
            follow_redirects=False,
            timeout=settings.request_timeout_seconds,
        )
        try:
            yield
        finally:
            await app.state.http_client.aclose()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=DESCRIPTION,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # Production-facing API.
    app.include_router(scan_router)
    app.include_router(demo_router)

    # Isolated, deliberately vulnerable mock target.
    app.include_router(mock_router, prefix="/mock/api/v1")

    @app.get("/health", response_model=Health, tags=["meta"])
    async def health() -> Health:
        return Health(
            status="ok",
            name=settings.app_name,
            version=settings.app_version,
            demo_mode=settings.demo_mode,
        )

    @app.get("/", tags=["meta"])
    async def root() -> dict:
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/health",
        }

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        # Consistent, non-leaky error response (no stack traces to the client).
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    return app


app = create_app()
