"""APISentry backend package.

APISentry is a local, self-contained API authorization auditing lab. It ships a
deliberately vulnerable mock target *and* a hardened counterpart, then runs a
deterministic engine that tells them apart with real, evidence-backed findings.

The intentionally insecure code lives exclusively under ``app.mock_target`` and is
clearly isolated from the production-facing application and engine modules.
"""

__version__ = "0.1.0"
