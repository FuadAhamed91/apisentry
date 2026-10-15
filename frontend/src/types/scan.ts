/**
 * TypeScript mirror of the backend scan contract (app/schemas/scan.py).
 * Kept in lockstep with the Pydantic models.
 */

export type ScanStatus = "VULNERABLE" | "PASS" | "INCONCLUSIVE" | "ERROR";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type ScanTypeName = "BOLA" | "MASS_ASSIGNMENT" | "FULL_DEMO";
export type VulnClass = "BOLA" | "MASS_ASSIGNMENT";
export type DiffChangeType = "added" | "removed" | "changed" | "type_changed";

export interface DiffEntry {
  path: string;
  change_type: DiffChangeType;
  baseline_value: unknown;
  comparison_value: unknown;
  sensitive: boolean;
  classification: string | null;
  security_relevant: boolean;
}

export interface RequestMeta {
  method: string;
  url: string;
  token_role: string | null;
  body?: unknown;
}

export interface ResponseMeta {
  status_code: number | null;
  response_size: number | null;
  content_type: string | null;
  elapsed_ms: number | null;
  json_parsed: boolean;
  body: unknown;
  truncated: boolean;
  note: string | null;
}

export interface TestCase {
  name: string;
  description: string;
  request: RequestMeta;
  response: ResponseMeta;
  outcome: string;
}

export interface DiffView {
  left_label: string;
  right_label: string;
  left: ResponseMeta;
  right: ResponseMeta;
  entries: DiffEntry[];
  exposed_summary: string[];
}

export interface CodeSample {
  language: string;
  label: string;
  code: string;
}

export interface Remediation {
  summary: string;
  guidance: string[];
  code_samples: CodeSample[];
  references: string[];
}

export interface ProbeResult {
  field: string;
  attempted_value: unknown;
  baseline_value: unknown;
  observed_value: unknown;
  echoed_value: unknown;
  persisted_change: boolean;
  echoed_only: boolean;
  note: string | null;
}

export interface ScanResult {
  scan_id: string;
  scan_type: ScanTypeName;
  vuln_class: VulnClass | null;
  title: string;
  target: string;
  endpoint: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  status: ScanStatus;
  severity: Severity;
  confidence: Confidence;
  rationale: string;
  test_cases: TestCase[];
  diff_view: DiffView | null;
  exposed_summary: string[];
  probes: ProbeResult[];
  verification_method: string | null;
  restoration_status: string | null;
  warnings: string[];
  impact: string | null;
  attack_preconditions: string[];
  reproduction: string[];
  remediation: Remediation | null;
  owasp_refs: string[];
  error: string | null;
}

export interface ScanSummary {
  scan_id: string;
  scan_type: ScanTypeName;
  vuln_class: VulnClass | null;
  title: string;
  endpoint: string;
  status: ScanStatus;
  severity: Severity;
  confidence: Confidence;
  started_at: string;
  duration_ms: number;
}

export interface DemoPreset {
  base_url: string;
  victim_token: string | null;
  attacker_token: string | null;
  sample_order_id: string;
  vulnerable_bola_path: string;
  secure_bola_path: string;
  mass_assign_path: string;
  demo_mode: boolean;
  tokens_exposed: boolean;
  warning: string;
  safety_notes: string[];
}

export interface Health {
  status: string;
  name: string;
  version: string;
  demo_mode: boolean;
  timestamp: string;
}

export interface BolaScanRequest {
  target_base_url: string;
  resource_id: string;
  victim_token: string;
  attacker_token: string;
  endpoint_path: string;
  mode: "vulnerable" | "secure";
  external_authorized: boolean;
}

export interface MassAssignRequest {
  target_base_url: string;
  test_token: string;
  profile_path: string;
  probe_fields: Record<string, unknown>;
  safe_mode: boolean;
  external_authorized: boolean;
}
