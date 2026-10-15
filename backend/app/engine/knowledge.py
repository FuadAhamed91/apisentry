"""Severity policy and remediation knowledge base.

Keeps the classification narrative (impact, preconditions, reproduction) and the
remediation code samples out of the checkers so the detection logic stays lean.
Severity is assigned by a transparent, deterministic policy and every finding
carries its rationale.
"""

from __future__ import annotations

from ..schemas.scan import CodeSample, Remediation, Severity

OWASP_BOLA = "API1:2023 Broken Object Level Authorization"
OWASP_MASS_ASSIGN = (
    "API3:2023 Broken Object Property Level Authorization "
    "(incorporates excessive data exposure and mass assignment)"
)

# Field names whose unauthorized change is a privilege escalation (-> Critical).
PRIVILEGE_FIELDS = frozenset(
    {"role", "roles", "is_admin", "admin", "is_superuser", "scopes", "permissions"}
)

# Fields a normal user must not be able to set on their own profile. Persisting
# any of these indicates Mass Assignment; the PRIVILEGE_FIELDS subset drives
# Critical severity, the rest are High. Ordinary editable fields (e.g.
# display_name, timezone) are deliberately NOT here, so persisting them is not a
# finding and we avoid a false positive.
SENSITIVE_ASSIGN_FIELDS = PRIVILEGE_FIELDS | frozenset(
    {"tier", "plan", "subscription", "verified", "email_verified", "balance", "credit", "quota", "limit"}
)


def bola_severity_for_resource(resource: object) -> Severity:
    """High by default; Critical when the leaked object contains both financial
    data and PII (a materially higher demonstrated impact)."""
    keys = set(resource) if isinstance(resource, dict) else set()
    financial = bool(keys & {"amount", "currency", "total", "price", "card_number", "iban"})
    pii = bool(
        keys
        & {
            "shipping_address",
            "billing_address",
            "address",
            "email",
            "phone",
            "internal_notes",
            "notes",
        }
    )
    if financial and pii:
        return Severity.CRITICAL
    return Severity.HIGH


def mass_assign_severity(changed_privilege_fields: set[str]) -> Severity:
    """Critical when an admin/role/privilege flag changed; otherwise High."""
    if changed_privilege_fields & PRIVILEGE_FIELDS:
        return Severity.CRITICAL
    return Severity.HIGH


def bola_remediation() -> Remediation:
    return Remediation(
        summary=(
            "Enforce object-level ownership on every request. Authentication "
            "proves who the caller is; it does not prove they may access this "
            "specific object. The ownership/tenant check must be part of the "
            "data lookup itself."
        ),
        guidance=[
            "Scope every object lookup by the authenticated principal "
            "(tenant_id and owner_id), not just by the object id.",
            "Return an identical 404 for 'not found' and 'not yours' so the "
            "response never discloses that another tenant's object exists.",
            "Never rely on the client to send the correct tenant/owner; derive "
            "it from the verified token on the server.",
            "Add automated cross-tenant tests (victim can read, attacker cannot) "
            "to your CI suite.",
        ],
        code_samples=[
            CodeSample(
                language="python",
                label="Ownership-scoped lookup (illustrative)",
                code=(
                    "from fastapi import Depends, HTTPException\n"
                    "from sqlalchemy.orm import Session\n\n\n"
                    "def get_order_for_user(order_id: str, principal, db: Session):\n"
                    "    # The ownership predicate is part of the query, so a\n"
                    "    # cross-tenant id simply returns nothing -> 404.\n"
                    "    order = (\n"
                    "        db.query(Order)\n"
                    "        .filter(\n"
                    "            Order.id == order_id,\n"
                    "            Order.tenant_id == principal.tenant_id,\n"
                    "            Order.owner_id == principal.sub,\n"
                    "        )\n"
                    "        .first()\n"
                    "    )\n"
                    "    if order is None:\n"
                    "        raise HTTPException(status_code=404, detail=\"Not found\")\n"
                    "    return order\n"
                ),
            ),
        ],
        references=[
            "OWASP API Security Top 10 (2023) - " + OWASP_BOLA,
            "https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/",
        ],
    )


def mass_assign_remediation() -> Remediation:
    return Remediation(
        summary=(
            "Bind request input to an explicit allow-list DTO and assign fields "
            "one by one. Validation and authorization solve different problems: a "
            "strict DTO stops unknown/privileged fields from being bound, while a "
            "separate authorization check governs who may change sensitive state."
        ),
        guidance=[
            "Define an input model that permits only user-editable fields and "
            "forbids extras (Pydantic: model_config = ConfigDict(extra='forbid')).",
            "Assign allowed fields explicitly; never merge the raw request body "
            "into a persistent model.",
            "Gate privileged fields (role, is_admin, tier) behind a dedicated, "
            "separately authorized administrative path.",
            "Add tests asserting that privileged fields in a profile update are "
            "ignored or rejected.",
        ],
        code_samples=[
            CodeSample(
                language="python",
                label="Allow-list DTO (illustrative)",
                code=(
                    "from pydantic import BaseModel, ConfigDict, Field\n\n\n"
                    "class ProfileUpdate(BaseModel):\n"
                    "    model_config = ConfigDict(extra=\"forbid\")\n\n"
                    "    display_name: str | None = Field(default=None, max_length=100)\n"
                    "    timezone: str | None = Field(default=None, max_length=64)\n"
                ),
            ),
            CodeSample(
                language="python",
                label="Explicit field assignment (illustrative)",
                code=(
                    "def update_profile(dto: ProfileUpdate, profile):\n"
                    "    # Only known, user-editable fields are copied across.\n"
                    "    if dto.display_name is not None:\n"
                    "        profile.display_name = dto.display_name\n"
                    "    if dto.timezone is not None:\n"
                    "        profile.timezone = dto.timezone\n"
                    "    # role / is_admin / tier are intentionally NOT settable here.\n"
                    "    return profile\n"
                ),
            ),
        ],
        references=[
            "OWASP API Security Top 10 (2023) - " + OWASP_MASS_ASSIGN,
            "https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/",
        ],
    )


# Narrative blocks for the Findings explorer -------------------------------- #
def bola_narrative(vulnerable: bool) -> dict:
    if vulnerable:
        return {
            "impact": (
                "An authenticated user from one tenant can read another tenant's "
                "order, exposing financial amounts, shipping details, and internal "
                "notes. At scale this enables enumeration of all objects."
            ),
            "attack_preconditions": [
                "Any valid authenticated account (no special privileges).",
                "Knowledge or guessability of a target object id.",
            ],
            "reproduction": [
                "Authenticate as the victim and GET the order to establish the baseline.",
                "Authenticate as an unrelated attacker account.",
                "Request the victim's order id with the attacker's token.",
                "Observe that the attacker receives the victim's protected order.",
            ],
        }
    return {
        "impact": (
            "No cross-tenant exposure observed: the endpoint enforced object-level "
            "authorization and denied the attacker without leaking resource data."
        ),
        "attack_preconditions": [
            "Any valid authenticated account.",
            "Knowledge of a target object id.",
        ],
        "reproduction": [
            "Authenticate as the owner and GET the order (succeeds).",
            "Authenticate as an unrelated account and request the same id.",
            "Observe a denial with no protected order data in the response.",
        ],
    }


def mass_assign_narrative(vulnerable: bool) -> dict:
    if vulnerable:
        return {
            "impact": (
                "A normal user can escalate their own privileges by including "
                "administrative fields (e.g. role, is_admin, tier) in a routine "
                "profile update, because the endpoint binds arbitrary input."
            ),
            "attack_preconditions": [
                "A valid authenticated account that can update its own profile.",
                "A profile-update endpoint that merges unvalidated request fields.",
            ],
            "reproduction": [
                "Read the baseline profile to capture current privilege fields.",
                "Send a profile update containing a privileged field (e.g. is_admin=true).",
                "Read the profile back and confirm the privileged field persisted.",
            ],
        }
    return {
        "impact": (
            "The endpoint did not persist privileged fields supplied in a profile "
            "update, indicating an allow-list / explicit-assignment pattern."
        ),
        "attack_preconditions": [
            "A valid authenticated account that can update its own profile.",
        ],
        "reproduction": [
            "Read the baseline profile.",
            "Attempt to set a privileged field via the update endpoint.",
            "Read back and confirm the privileged field did not change.",
        ],
    }
