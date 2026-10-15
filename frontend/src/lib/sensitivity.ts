/**
 * Client-side mirror of the backend's sensitive-field heuristic, used only to
 * visually mark fields that crossed an authorization boundary. Detection and
 * classification of a finding is always done by the backend engine.
 */

import type { MarkKind } from "@/components/ui/JsonTree";

const SENSITIVE_FIELDS = new Set([
  "tenant_id",
  "owner_id",
  "user_id",
  "account_id",
  "customer_id",
  "email",
  "phone",
  "address",
  "shipping_address",
  "billing_address",
  "internal_notes",
  "notes",
  "role",
  "roles",
  "is_admin",
  "admin",
  "is_superuser",
  "tier",
  "scopes",
  "permissions",
  "ssn",
  "national_id",
  "iban",
  "card_number",
  "credit_card",
]);

const SENSITIVE_SUBSTRINGS = [
  "email",
  "address",
  "note",
  "owner",
  "tenant",
  "admin",
  "role",
  "account",
  "phone",
  "secret",
  "privilege",
];

function isSensitive(key: string): boolean {
  const k = key.toLowerCase();
  if (SENSITIVE_FIELDS.has(k)) return true;
  return SENSITIVE_SUBSTRINGS.some((s) => k.includes(s));
}

function esc(k: string): string {
  return k.replace(/~/g, "~0").replace(/\//g, "~1");
}

export function sensitiveLeakedMarks(
  obj: unknown,
  path = "",
  out: Record<string, MarkKind> = {},
): Record<string, MarkKind> {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => sensitiveLeakedMarks(v, `${path}/${i}`, out));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const childPath = `${path}/${esc(k)}`;
      if (isSensitive(k) && (v === null || typeof v !== "object")) {
        out[childPath] = "leaked";
      }
      sensitiveLeakedMarks(v, childPath, out);
    }
  }
  return out;
}
