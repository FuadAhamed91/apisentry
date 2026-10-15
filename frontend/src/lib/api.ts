/**
 * Centralized, typed API client for the APISentry backend.
 * - Single configured base URL (NEXT_PUBLIC_API_BASE_URL).
 * - Per-request timeout via AbortController.
 * - Normalizes non-2xx responses and transport failures into ApiError.
 * - Never exposes internal stack traces to the UI.
 */

import type {
  BolaScanRequest,
  DemoPreset,
  Health,
  MassAssignRequest,
  ScanResult,
  ScanSummary,
} from "@/types/scan";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, timeoutMs = 15000, signal } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      signal: controller.signal,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      const detail = extractDetail(data) ?? `Request failed (HTTP ${res.status})`;
      throw new ApiError(detail, res.status);
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("Request timed out. The backend may be busy or unreachable.", 0);
    }
    throw new ApiError("Cannot reach the APISentry backend. Is it running?", 0);
  } finally {
    clearTimeout(timer);
  }
}

function extractDetail(data: unknown): string | null {
  if (!data || typeof data !== "object") return typeof data === "string" ? data : null;
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string; loc?: unknown[] } | undefined;
    if (first?.msg) {
      const loc = Array.isArray(first.loc) ? first.loc.slice(1).join(".") : "";
      return loc ? `${loc}: ${first.msg}` : first.msg;
    }
  }
  return null;
}

export const api = {
  health: (signal?: AbortSignal) => request<Health>("/health", { timeoutMs: 5000, signal }),
  preset: (signal?: AbortSignal) => request<DemoPreset>("/api/demo/preset", { signal }),
  reset: () => request<{ status: string; message: string }>("/api/demo/reset", { method: "POST" }),
  history: (signal?: AbortSignal) => request<ScanSummary[]>("/api/scan/history", { signal }),
  scan: (id: string, signal?: AbortSignal) => request<ScanResult>(`/api/scan/${id}`, { signal }),
  bola: (payload: Partial<BolaScanRequest>, signal?: AbortSignal) =>
    request<ScanResult>("/api/scan/bola", { method: "POST", body: payload, timeoutMs: 20000, signal }),
  massAssign: (payload: Partial<MassAssignRequest>, signal?: AbortSignal) =>
    request<ScanResult>("/api/scan/mass-assign", {
      method: "POST",
      body: payload,
      timeoutMs: 20000,
      signal,
    }),
  fullDemo: (signal?: AbortSignal) =>
    request<ScanResult[]>("/api/demo/run", { method: "POST", timeoutMs: 30000, signal }),
};
