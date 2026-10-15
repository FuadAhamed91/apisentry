"""Environment-driven configuration for APISentry.

All settings can be overridden via environment variables prefixed with
``APISENTRY_`` (e.g. ``APISENTRY_FRONTEND_ORIGIN``) or a local ``.env`` file.
No privileged credentials or secrets are stored here; the demo tokens are
development-only fixtures that live in the mock target module.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="APISENTRY_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Application identity -------------------------------------------------
    app_name: str = "APISentry"
    app_version: str = "0.1.0"

    # When True, the local demonstration surface is active: demo fixture tokens
    # may be returned by /api/demo/preset and the reset route is enabled.
    demo_mode: bool = True

    # --- CORS -----------------------------------------------------------------
    # Comma-separated list of allowed frontend origins. Restricted to local dev
    # by default; never use "*" so the browser cannot leak scan data cross-origin.
    frontend_origin: str = "http://localhost:3000,http://127.0.0.1:3000"

    # --- Mock target wiring ---------------------------------------------------
    # The base URL the engine uses to reach the mounted mock target. The backend
    # calls itself over loopback, so this must point at the backend's own bind
    # address + port (NOT a browser-only hostname). Overridable for custom ports.
    mock_base_url: str = "http://127.0.0.1:8000/mock/api/v1"

    # Hosts treated as the local security lab. Requests to these are permitted
    # without an external-authorization confirmation. External hosts are opt-in.
    local_allow_hosts: str = "127.0.0.1,localhost,::1,testserver"

    # --- External target policy (opt-in, SSRF-guarded) ------------------------
    allow_external_targets: bool = False

    # --- Transport safety limits ----------------------------------------------
    request_timeout_seconds: float = 10.0
    max_response_bytes: int = 1_000_000
    max_request_bytes: int = 65_536
    max_redirects: int = 0

    # --- Scan history retention (bounded, in-memory) --------------------------
    history_limit: int = 100

    @field_validator("local_allow_hosts", "frontend_origin")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origin.split(",") if o.strip()]

    @property
    def local_hosts(self) -> set[str]:
        return {h.strip().lower() for h in self.local_allow_hosts.split(",") if h.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
