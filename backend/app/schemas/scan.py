"""Typed request/result models for the auditing engine and API.

These models are the single source of truth for what a "finding" is. The engine
produces them, the API serialises them, and the frontend mirrors them in
TypeScript. A finding always carries its evidence, a documented rationale for the
classification, and redacted response bodies.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# Controlled vocabularies
# --------------------------------------------------------------------------- #
class ScanStatus(str, Enum):
    """Outcome of a single assessment.

    A confirmed vulnerability is deliberately distinguished from a connection
    failure, a malformed response, or an inconclusive test. A 2xx response is
    never, by itself, treated as proof of a vulnerability.
    """

    VULNERABLE = "VULNERABLE"
    PASS = "PASS"
    INCONCLUSIVE = "INCONCLUSIVE"
    ERROR = "ERROR"


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFORMATIONAL = "INFORMATIONAL"


class Confidence(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ScanType(str, Enum):
    BOLA = "BOLA"
    MASS_ASSIGNMENT = "MASS_ASSIGNMENT"
    FULL_DEMO = "FULL_DEMO"


class VulnClass(str, Enum):
    BOLA = "BOLA"
    MASS_ASSIGNMENT = "MASS_ASSIGNMENT"


class DiffChangeType(str, Enum):
    ADDED = "added"
    REMOVED = "removed"
    CHANGED = "changed"
    TYPE_CHANGED = "type_changed"


# --------------------------------------------------------------------------- #
# Evidence primitives
# --------------------------------------------------------------------------- #
class DiffEntry(BaseModel):
    """A single structural difference between two JSON documents."""

    path: str = Field(description="JSON Pointer (RFC 6901) to the field.")
    change_type: DiffChangeType
    baseline_value: Any | None = None
    comparison_value: Any | None = None
    sensitive: bool = Field(
        default=False,
        description="Heuristic: the field name resembles sensitive data.",
    )
    classification: str | None = Field(
        default=None, description="e.g. owner_id, tenant_id, email, internal_notes."
    )
    security_relevant: bool = Field(
        default=False,
        description="True when this difference is material to the finding.",
    )


class RequestMeta(BaseModel):
    """Request context, scrubbed of credentials.

    Tokens are referenced by role (e.g. "victim"), never by value.
    """

    method: str
    url: str
    token_role: str | None = None
    body: Any | None = None


class ResponseMeta(BaseModel):
    """Captured response, with the body redacted and length-bounded."""

    status_code: int | None = None
    response_size: int | None = None
    content_type: str | None = None
    elapsed_ms: float | None = None
    json_parsed: bool = False
    body: Any | None = None
    truncated: bool = False
    note: str | None = None


class TestCase(BaseModel):
    name: str
    description: str
    request: RequestMeta
    response: ResponseMeta
    outcome: str


class DiffView(BaseModel):
    """Side-by-side comparison powering the Response Diff inspector."""

    left_label: str
    right_label: str
    left: ResponseMeta
    right: ResponseMeta
    entries: list[DiffEntry] = Field(default_factory=list)
    exposed_summary: list[str] = Field(default_factory=list)


class CodeSample(BaseModel):
    language: str
    label: str
    code: str


class Remediation(BaseModel):
    summary: str
    guidance: list[str] = Field(default_factory=list)
    code_samples: list[CodeSample] = Field(default_factory=list)
    references: list[str] = Field(default_factory=list)


class ProbeResult(BaseModel):
    """Result of probing one field in a Mass Assignment test."""

    field: str
    attempted_value: Any | None = None
    baseline_value: Any | None = None
    observed_value: Any | None = None  # value after read-back (persisted state)
    echoed_value: Any | None = None  # value echoed in the write response
    persisted_change: bool = False
    echoed_only: bool = False
    note: str | None = None


# --------------------------------------------------------------------------- #
# Finding (unified result for both scan types + history storage)
# --------------------------------------------------------------------------- #
class ScanResult(BaseModel):
    scan_id: str
    scan_type: ScanType
    vuln_class: VulnClass | None = None
    title: str
    target: str
    endpoint: str
    started_at: datetime = Field(default_factory=utcnow)
    finished_at: datetime = Field(default_factory=utcnow)
    duration_ms: float = 0.0

    status: ScanStatus
    severity: Severity
    confidence: Confidence
    rationale: str

    test_cases: list[TestCase] = Field(default_factory=list)
    diff_view: DiffView | None = None
    exposed_summary: list[str] = Field(default_factory=list)

    # Mass Assignment specifics (empty for BOLA scans).
    probes: list[ProbeResult] = Field(default_factory=list)
    verification_method: str | None = None
    restoration_status: str | None = None
    warnings: list[str] = Field(default_factory=list)

    # Narrative / knowledge-base fields for the Findings explorer.
    impact: str | None = None
    attack_preconditions: list[str] = Field(default_factory=list)
    reproduction: list[str] = Field(default_factory=list)
    remediation: Remediation | None = None
    owasp_refs: list[str] = Field(default_factory=list)

    error: str | None = None


class ScanSummary(BaseModel):
    """Compact view for history lists and dashboard metrics."""

    scan_id: str
    scan_type: ScanType
    vuln_class: VulnClass | None
    title: str
    endpoint: str
    status: ScanStatus
    severity: Severity
    confidence: Confidence
    started_at: datetime
    duration_ms: float


# --------------------------------------------------------------------------- #
# Requests
# --------------------------------------------------------------------------- #
class BolaScanRequest(BaseModel):
    target_base_url: str = Field(description="Base URL of the authorized target.")
    resource_id: str
    victim_token: str
    attacker_token: str
    endpoint_path: str = Field(
        default="/orders/{resource_id}",
        description="Path template; {resource_id} is substituted.",
    )
    mode: Literal["vulnerable", "secure"] = "vulnerable"
    external_authorized: bool = Field(
        default=False,
        description="Explicit confirmation that an external target is authorized.",
    )

    @field_validator("endpoint_path")
    @classmethod
    def _leading_slash(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("/"):
            v = "/" + v
        return v


class MassAssignRequest(BaseModel):
    target_base_url: str
    test_token: str = Field(description="Identity whose own profile is probed.")
    profile_path: str = "/users/profile"
    probe_fields: dict[str, Any] = Field(
        default_factory=lambda: {"role": "admin", "is_admin": True, "tier": "enterprise"}
    )
    safe_mode: bool = Field(
        default=False,
        description="When True, no mutation is performed; verification is reduced.",
    )
    external_authorized: bool = False

    @field_validator("profile_path")
    @classmethod
    def _leading_slash(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("/"):
            v = "/" + v
        return v

    @field_validator("probe_fields")
    @classmethod
    def _bounded(cls, v: dict[str, Any]) -> dict[str, Any]:
        if len(v) > 12:
            raise ValueError("probe_fields is limited to 12 attributes.")
        return v


class FullDemoRequest(BaseModel):
    """Runs the vulnerable BOLA, secure BOLA, and Mass Assignment tests in order."""

    external_authorized: bool = False


# --------------------------------------------------------------------------- #
# Misc API responses
# --------------------------------------------------------------------------- #
class DemoPreset(BaseModel):
    base_url: str
    victim_token: str | None = None
    attacker_token: str | None = None
    sample_order_id: str
    vulnerable_bola_path: str
    secure_bola_path: str
    mass_assign_path: str
    demo_mode: bool
    tokens_exposed: bool
    warning: str
    safety_notes: list[str] = Field(default_factory=list)


class Health(BaseModel):
    status: str
    name: str
    version: str
    demo_mode: bool
    timestamp: datetime = Field(default_factory=utcnow)


class ResetResult(BaseModel):
    status: str
    message: str
    reset_at: datetime = Field(default_factory=utcnow)
