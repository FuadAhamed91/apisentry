"""Deterministic authorization auditing engine.

Modules:
    redact        - strip credential-like values from evidence
    safety        - SSRF-safe target validation (local-by-default, external opt-in)
    diff_engine   - recursive structural JSON comparison + sensitivity tagging
    knowledge     - severity policy and remediation knowledge base
    transport     - HTTP probe helper that captures redacted response evidence
    bola_checker  - Broken Object Level Authorization assessment
    mass_assign   - Mass Assignment assessment
"""
