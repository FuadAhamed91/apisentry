"""In-memory, deterministic fixtures for the mock target.

All values are synthetic demonstration data. The demo tokens are deliberately
static, insecure, development-only fixtures and must never be treated as real
authentication. A safe ``reset()`` restores the exact initial state so repeated
demos are reproducible.
"""

from __future__ import annotations

import copy
from typing import Any, Optional

Principal = dict[str, str]  # {"user_id": ..., "tenant_id": ...}

# Development-only bearer tokens -> principal. Static by design for the demo.
DEMO_TOKENS: dict[str, Principal] = {
    "token-victim-alice": {"user_id": "alice", "tenant_id": "tenant-a"},
    "token-attacker-bob": {"user_id": "bob", "tenant_id": "tenant-b"},
}

# Named fixture handles used by the demo preset and the demo orchestrator.
VICTIM_TOKEN = "token-victim-alice"
ATTACKER_TOKEN = "token-attacker-bob"
SAMPLE_ORDER_ID = "ord-9921"

# Canonical fixtures. Deep-copied on every reset so mutations never leak across
# demo runs.
_INITIAL_ORDERS: dict[str, dict[str, Any]] = {
    "ord-9921": {
        "id": "ord-9921",
        "tenant_id": "tenant-a",
        "owner_id": "alice",
        "product": "Enterprise Security Appliance",
        "amount": 2499.99,
        "currency": "AED",
        "status": "processing",
        "shipping_address": "Demo Address, Abu Dhabi",
        "internal_notes": "Priority customer - sample data only",
    },
    "ord-5512": {
        "id": "ord-5512",
        "tenant_id": "tenant-b",
        "owner_id": "bob",
        "product": "Standard Support Plan",
        "amount": 199.00,
        "currency": "AED",
        "status": "shipped",
        "shipping_address": "Demo Address, Dubai",
        "internal_notes": "Sample data only",
    },
}

_INITIAL_PROFILES: dict[str, dict[str, Any]] = {
    "alice": {
        "id": "alice",
        "tenant_id": "tenant-a",
        "display_name": "Alice Example",
        "email": "alice@tenant-a.example",
        "role": "user",
        "is_admin": False,
        "tier": "standard",
        "timezone": "Asia/Dubai",
    },
    "bob": {
        "id": "bob",
        "tenant_id": "tenant-b",
        "display_name": "Bob Example",
        "email": "bob@tenant-b.example",
        "role": "user",
        "is_admin": False,
        "tier": "standard",
        "timezone": "Asia/Dubai",
    },
}

# Identity fields that even the intentionally vulnerable endpoint refuses to
# mutate, so a caller can never re-tenant or impersonate another record. This
# keeps the mass-assignment lab contained to privilege fields on the caller's
# own profile (role / is_admin / tier).
IMMUTABLE_PROFILE_FIELDS: frozenset[str] = frozenset({"id", "tenant_id"})


class MockDataStore:
    def __init__(self) -> None:
        self.orders: dict[str, dict[str, Any]] = {}
        self.profiles: dict[str, dict[str, Any]] = {}
        self.reset()

    def reset(self) -> None:
        """Restore the exact initial fixture state (idempotent)."""
        self.orders = copy.deepcopy(_INITIAL_ORDERS)
        self.profiles = copy.deepcopy(_INITIAL_PROFILES)

    def principal_for_token(self, token: str) -> Optional[Principal]:
        principal = DEMO_TOKENS.get(token)
        return dict(principal) if principal else None

    def get_order(self, order_id: str) -> Optional[dict[str, Any]]:
        order = self.orders.get(order_id)
        return dict(order) if order is not None else None

    def get_profile(self, user_id: str) -> Optional[dict[str, Any]]:
        profile = self.profiles.get(user_id)
        return dict(profile) if profile is not None else None


# Process-wide singleton used by the mock routes and the demo/reset API.
store = MockDataStore()


def get_store() -> MockDataStore:
    return store
