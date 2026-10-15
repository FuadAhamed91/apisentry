"""Mass Assignment checker.

Probes an authorized profile-update endpoint with administrative attributes one
field at a time, then reads the profile back to verify whether the change
*persisted* (as opposed to being merely echoed in the write response). The
original state is restored afterwards; if restoration fails, an explicit warning
is emitted. A finding is only VULNERABLE when a privileged field is demonstrably
persisted via read-back.
"""

from __future__ import annotations

import uuid

import httpx

from ..config import Settings
from ..schemas.scan import (
    Confidence,
    DiffView,
    ProbeResult,
    RequestMeta,
    ScanResult,
    ScanStatus,
    ScanType,
    Severity,
    TestCase,
    VulnClass,
    utcnow,
)
from .diff_engine import diff_json
from .knowledge import (
    OWASP_MASS_ASSIGN,
    PRIVILEGE_FIELDS,
    SENSITIVE_ASSIGN_FIELDS,
    mass_assign_narrative,
    mass_assign_remediation,
    mass_assign_severity,
)
from .safety import TargetValidationError, validate_target
from .transport import ProbeError, probe


def _new_id() -> str:
    return "mass-" + uuid.uuid4().hex[:10]


async def run_mass_assign_scan(client: httpx.AsyncClient, req, settings: Settings) -> ScanResult:
    """Execute a Mass Assignment assessment. ``req`` is a MassAssignRequest."""
    scan_id = _new_id()
    started = utcnow()
    url = req.target_base_url.rstrip("/") + req.profile_path

    def finalize(**kwargs) -> ScanResult:
        finished = utcnow()
        kwargs.setdefault("owasp_refs", [OWASP_MASS_ASSIGN])
        return ScanResult(
            scan_id=scan_id,
            scan_type=ScanType.MASS_ASSIGNMENT,
            vuln_class=VulnClass.MASS_ASSIGNMENT,
            target=req.target_base_url,
            endpoint=f"PUT {req.profile_path}",
            started_at=started,
            finished_at=finished,
            duration_ms=round((finished - started).total_seconds() * 1000, 2),
            **kwargs,
        )

    # --- Target safety boundary ---------------------------------------------
    try:
        validate_target(
            req.target_base_url,
            settings=settings,
            external_authorized=req.external_authorized,
        )
    except TargetValidationError as exc:
        return finalize(
            title="Mass Assignment scan blocked by target policy",
            status=ScanStatus.ERROR,
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.HIGH,
            rationale=f"Target validation failed: {exc}",
            error=str(exc),
        )

    test_cases: list[TestCase] = []

    # --- Step 1: baseline profile -------------------------------------------
    try:
        base_meta, base_profile = await probe(
            client, "GET", url,
            token=req.test_token, token_role="test-identity", settings=settings,
        )
    except ProbeError as exc:
        return finalize(
            title="Mass Assignment scan could not read a baseline profile",
            status=ScanStatus.ERROR,
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.HIGH,
            rationale=f"Baseline read failed: {exc}",
            error=str(exc),
        )
    test_cases.append(
        TestCase(
            name="Baseline profile",
            description="Read the authenticated identity's own profile.",
            request=RequestMeta(method="GET", url=url, token_role="test-identity"),
            response=base_meta,
            outcome=f"HTTP {base_meta.status_code}",
        )
    )

    if not (base_meta.status_code == 200 and isinstance(base_profile, dict)):
        return finalize(
            title="Mass Assignment test inconclusive (no baseline profile)",
            status=ScanStatus.INCONCLUSIVE,
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.MEDIUM,
            rationale=(
                f"Could not read a baseline profile (HTTP {base_meta.status_code}); "
                "privilege changes cannot be verified."
            ),
            test_cases=test_cases,
            remediation=mass_assign_remediation(),
        )

    # --- Safe mode: no mutation ---------------------------------------------
    if req.safe_mode:
        return finalize(
            title="Mass Assignment test ran in safe mode (no mutation)",
            status=ScanStatus.INCONCLUSIVE,
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.LOW,
            rationale=(
                "Safe mode was enabled, so no write was performed. Persisted "
                "privilege changes cannot be confirmed without a read-back after a "
                "write; re-run with safe mode off against an authorized test "
                "identity to verify."
            ),
            verification_method="none (safe mode)",
            test_cases=test_cases,
            remediation=mass_assign_remediation(),
            warnings=["Safe mode reduces verification capability; result is inconclusive."],
        )

    warnings: list[str] = []

    # --- Step 2: control write (confirms the write path actually persists) ---
    marker = f"apisentry-marker-{uuid.uuid4().hex[:6]}"
    control_persisted = False
    try:
        cw_meta, _ = await probe(
            client, "PUT", url,
            token=req.test_token, token_role="test-identity", settings=settings,
            json_body={"display_name": marker},
        )
        cr_meta, cr_profile = await probe(
            client, "GET", url,
            token=req.test_token, token_role="test-identity", settings=settings,
        )
        control_persisted = isinstance(cr_profile, dict) and cr_profile.get("display_name") == marker
        test_cases.append(
            TestCase(
                name="Control write (display_name marker)",
                description="Write a harmless marker and read it back to confirm the write path persists.",
                request=RequestMeta(method="PUT", url=url, token_role="test-identity",
                                    body={"display_name": marker}),
                response=cr_meta,
                outcome="persisted" if control_persisted else "not persisted",
            )
        )
    except ProbeError as exc:
        warnings.append(f"Control write failed: {exc}")

    if not control_persisted:
        warnings.append(
            "Control marker did not persist; read-back verification may be unreliable."
        )

    # --- Step 3: probe privileged fields one at a time ----------------------
    probes: list[ProbeResult] = []
    changed_fields: set[str] = set()

    for field, value in req.probe_fields.items():
        baseline_value = base_profile.get(field)
        try:
            put_meta, put_json = await probe(
                client, "PUT", url,
                token=req.test_token, token_role="test-identity", settings=settings,
                json_body={field: value},
            )
            read_meta, read_json = await probe(
                client, "GET", url,
                token=req.test_token, token_role="test-identity", settings=settings,
            )
        except ProbeError as exc:
            probes.append(
                ProbeResult(field=field, attempted_value=value, baseline_value=baseline_value,
                            note=f"probe failed: {exc}")
            )
            warnings.append(f"Probe for {field!r} failed: {exc}")
            continue

        echoed = put_json.get(field) if isinstance(put_json, dict) else None
        observed = read_json.get(field) if isinstance(read_json, dict) else None
        persisted = observed == value and observed != baseline_value
        echoed_only = (echoed == value) and not persisted

        probes.append(
            ProbeResult(
                field=field,
                attempted_value=value,
                baseline_value=baseline_value,
                observed_value=observed,
                echoed_value=echoed,
                persisted_change=persisted,
                echoed_only=echoed_only,
                note=(
                    "persisted via read-back" if persisted
                    else "echoed in response only (not persisted)" if echoed_only
                    else "not changed"
                ),
            )
        )
        test_cases.append(
            TestCase(
                name=f"Probe {field}",
                description=f"Attempt to set '{field}' then read the profile back.",
                request=RequestMeta(method="PUT", url=url, token_role="test-identity",
                                    body={field: value}),
                response=read_meta,
                outcome="persisted" if persisted else ("echoed-only" if echoed_only else "ignored"),
            )
        )
        if persisted:
            changed_fields.add(field)

    # --- Step 4: capture fully-mutated state for the diff view --------------
    mutated_meta = base_meta
    mutated_profile = dict(base_profile)
    try:
        mutated_meta, m_json = await probe(
            client, "GET", url,
            token=req.test_token, token_role="test-identity", settings=settings,
        )
        if isinstance(m_json, dict):
            mutated_profile = m_json
    except ProbeError as exc:
        warnings.append(f"Could not capture mutated state: {exc}")

    # --- Step 5: restoration ------------------------------------------------
    restoration_status = "not attempted"
    restore_payload = {k: base_profile.get(k) for k in req.probe_fields if k in base_profile}
    if control_persisted:
        restore_payload["display_name"] = base_profile.get("display_name")
    if restore_payload:
        try:
            await probe(
                client, "PUT", url,
                token=req.test_token, token_role="test-identity", settings=settings,
                json_body=restore_payload,
            )
            _, verify_profile = await probe(
                client, "GET", url,
                token=req.test_token, token_role="test-identity", settings=settings,
            )
            restored_ok = isinstance(verify_profile, dict) and all(
                verify_profile.get(k) == base_profile.get(k) for k in restore_payload
            )
            restoration_status = "restored" if restored_ok else "incomplete"
            if not restored_ok:
                warnings.append(
                    "Restoration incomplete; run POST /api/demo/reset to restore fixtures."
                )
        except ProbeError as exc:
            restoration_status = "failed"
            warnings.append(
                f"Restoration failed ({exc}); run POST /api/demo/reset to restore fixtures."
            )

    # --- Classification ------------------------------------------------------
    changed_sensitive = changed_fields & SENSITIVE_ASSIGN_FIELDS
    changed_privilege = changed_fields & PRIVILEGE_FIELDS
    verification_method = "read-back (GET after PUT)"

    diff_view = DiffView(
        left_label="Baseline profile",
        right_label="After probes (pre-restore)",
        left=base_meta,
        right=mutated_meta,
        entries=diff_json(base_profile, mutated_profile),
        exposed_summary=[
            f"{f}: {base_profile.get(f)!r} -> {req.probe_fields.get(f)!r}"
            for f in sorted(changed_sensitive)
        ],
    )

    common = dict(
        test_cases=test_cases,
        probes=probes,
        diff_view=diff_view,
        verification_method=verification_method,
        restoration_status=restoration_status,
        warnings=warnings,
        remediation=mass_assign_remediation(),
        owasp_refs=[OWASP_MASS_ASSIGN],
        exposed_summary=diff_view.exposed_summary,
    )

    if changed_sensitive:
        severity = mass_assign_severity(changed_privilege)
        narrative = mass_assign_narrative(vulnerable=True)
        return finalize(
            title="Mass Assignment confirmed (unauthorized fields persisted)",
            status=ScanStatus.VULNERABLE,
            severity=severity,
            confidence=Confidence.HIGH,
            rationale=(
                "A profile update persisted caller-supplied field(s) "
                f"{sorted(changed_sensitive)} that a normal user must not be able to "
                "set, confirmed by reading the profile back. This is a verified state "
                "change, not merely an echoed response."
            ),
            impact=narrative["impact"],
            attack_preconditions=narrative["attack_preconditions"],
            reproduction=narrative["reproduction"],
            **common,
        )

    if changed_fields:
        # Fields persisted, but all are ordinary user-editable fields -> not a
        # finding (and not a false positive).
        return finalize(
            title="Profile update persisted only user-editable fields",
            status=ScanStatus.PASS,
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.HIGH if control_persisted else Confidence.LOW,
            rationale=(
                f"Probed field(s) {sorted(changed_fields)} persisted, but none are "
                "privileged or otherwise unauthorized for self-service updates, so no "
                "mass-assignment exposure is indicated."
            ),
            **common,
        )

    echoed_only_fields = [p.field for p in probes if p.echoed_only]
    if echoed_only_fields:
        narrative = mass_assign_narrative(vulnerable=False)
        return finalize(
            title="Profile update echoed but did not persist privileged fields",
            status=ScanStatus.PASS,
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.MEDIUM,
            rationale=(
                f"Fields {echoed_only_fields} were echoed in the write response but did "
                "NOT persist on read-back, so no privilege change occurred. Distinguishing "
                "echo from persistence prevents a false positive."
            ),
            impact=narrative["impact"],
            attack_preconditions=narrative["attack_preconditions"],
            reproduction=narrative["reproduction"],
            **common,
        )

    narrative = mass_assign_narrative(vulnerable=False)
    return finalize(
        title="Mass Assignment not observed (privileged fields ignored)",
        status=ScanStatus.PASS,
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.HIGH if control_persisted else Confidence.LOW,
        rationale=(
            "No probed privileged field persisted on read-back. "
            + (
                "The control marker persisted, so the write path works and the endpoint "
                "appears to ignore/reject privileged fields."
                if control_persisted
                else "The control marker did not persist, so verification is weak; treat "
                "this result with low confidence."
            )
        ),
        impact=narrative["impact"],
        attack_preconditions=narrative["attack_preconditions"],
        reproduction=narrative["reproduction"],
        **common,
    )
