"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import { ApiError, api } from "@/lib/api";
import { timeTag, uid } from "@/lib/utils";
import type { BolaScanRequest, DemoPreset, Health, MassAssignRequest, ScanResult } from "@/types/scan";

export type LogTag = "INFO" | "REQUEST" | "PASS" | "VULNERABLE" | "WARNING" | "ERROR";
export interface LogEntry {
  id: string;
  ts: string;
  tag: LogTag;
  message: string;
}

export type BackendStatus = "checking" | "online" | "offline";

interface State {
  backend: BackendStatus;
  health: Health | null;
  preset: DemoPreset | null;
  scans: ScanResult[]; // newest first
  logs: LogEntry[]; // oldest first
  running: string | null; // label of the in-flight operation, or null
  selectedScanId: string | null;
  error: string | null;
}

const initialState: State = {
  backend: "checking",
  health: null,
  preset: null,
  scans: [],
  logs: [],
  running: null,
  selectedScanId: null,
  error: null,
};

type Action =
  | { type: "BACKEND"; status: BackendStatus; health?: Health | null }
  | { type: "PRESET"; preset: DemoPreset | null }
  | { type: "SET_SCANS"; scans: ScanResult[] }
  | { type: "PREPEND_SCAN"; scan: ScanResult }
  | { type: "LOGS"; entries: Omit<LogEntry, "id" | "ts">[] }
  | { type: "CLEAR_LOGS" }
  | { type: "RUNNING"; running: string | null }
  | { type: "SELECT"; id: string | null }
  | { type: "ERROR"; error: string | null };

const LOG_LIMIT = 300;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "BACKEND":
      return { ...state, backend: action.status, health: action.health ?? state.health };
    case "PRESET":
      return { ...state, preset: action.preset };
    case "SET_SCANS":
      return { ...state, scans: action.scans };
    case "PREPEND_SCAN":
      return { ...state, scans: [action.scan, ...state.scans] };
    case "LOGS": {
      const stamped = action.entries.map((e) => ({ ...e, id: uid("log"), ts: timeTag() }));
      return { ...state, logs: [...state.logs, ...stamped].slice(-LOG_LIMIT) };
    }
    case "CLEAR_LOGS":
      return { ...state, logs: [] };
    case "RUNNING":
      return { ...state, running: action.running };
    case "SELECT":
      return { ...state, selectedScanId: action.id };
    case "ERROR":
      return { ...state, error: action.error };
    default:
      return state;
  }
}

function shortUrl(url: string): string {
  const i = url.indexOf("/mock/");
  return i >= 0 ? url.slice(i) : url;
}

/** Derive terminal log lines from a completed, real scan result. */
function logsForResult(r: ScanResult): Omit<LogEntry, "id" | "ts">[] {
  const lines: Omit<LogEntry, "id" | "ts">[] = [];
  for (const tc of r.test_cases) {
    const code = tc.response.status_code;
    const role = tc.request.token_role ?? "no-auth";
    lines.push({
      tag: "REQUEST",
      message: `${tc.request.method} ${shortUrl(tc.request.url)}  [${role}]  ->  HTTP ${code ?? "ERR"}`,
    });
  }
  const tag: LogTag =
    r.status === "VULNERABLE"
      ? "VULNERABLE"
      : r.status === "PASS"
        ? "PASS"
        : r.status === "ERROR"
          ? "ERROR"
          : "WARNING";
  lines.push({ tag, message: `${r.status}: ${r.title}` });
  for (const w of r.warnings ?? []) lines.push({ tag: "WARNING", message: w });
  return lines;
}

interface StoreValue extends State {
  init: () => void;
  refreshBackend: () => Promise<void>;
  runBola: (payload: Partial<BolaScanRequest>, label?: string) => Promise<ScanResult | null>;
  runMassAssign: (payload: Partial<MassAssignRequest>, label?: string) => Promise<ScanResult | null>;
  runFullDemo: () => Promise<void>;
  resetMock: () => Promise<void>;
  clearLogs: () => void;
  selectScan: (id: string | null) => void;
}

const ScanContext = createContext<StoreValue | null>(null);

export function ScanStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const didInit = useRef(false);
  const seq = useRef(0);

  const log = useCallback((entries: Omit<LogEntry, "id" | "ts">[]) => dispatch({ type: "LOGS", entries }), []);

  const refreshBackend = useCallback(async () => {
    dispatch({ type: "BACKEND", status: "checking" });
    try {
      const health = await api.health();
      dispatch({ type: "BACKEND", status: "online", health });
    } catch {
      dispatch({ type: "BACKEND", status: "offline", health: null });
    }
  }, []);

  const hydrateHistory = useCallback(async () => {
    try {
      const summaries = await api.history();
      const recent = summaries.slice(0, 25);
      const details = await Promise.all(
        recent.map((s) => api.scan(s.scan_id).catch(() => null)),
      );
      dispatch({ type: "SET_SCANS", scans: details.filter((d): d is ScanResult => d !== null) });
    } catch {
      /* non-fatal: dashboard just shows an empty state */
    }
  }, []);

  const init = useCallback(() => {
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      await refreshBackend();
      try {
        const preset = await api.preset();
        dispatch({ type: "PRESET", preset });
      } catch {
        /* preset optional */
      }
      await hydrateHistory();
    })();
  }, [refreshBackend, hydrateHistory]);

  const runScan = useCallback(
    async (
      label: string,
      initLine: string,
      fn: () => Promise<ScanResult>,
    ): Promise<ScanResult | null> => {
      if (state.running) return null;
      const ticket = ++seq.current;
      dispatch({ type: "RUNNING", running: label });
      dispatch({ type: "ERROR", error: null });
      log([{ tag: "INFO", message: initLine }]);
      try {
        const result = await fn();
        if (ticket !== seq.current) return null; // a newer run superseded this one
        dispatch({ type: "PREPEND_SCAN", scan: result });
        dispatch({ type: "SELECT", id: result.scan_id });
        log(logsForResult(result));
        return result;
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Unexpected error";
        dispatch({ type: "ERROR", error: msg });
        log([{ tag: "ERROR", message: msg }]);
        return null;
      } finally {
        if (ticket === seq.current) dispatch({ type: "RUNNING", running: null });
      }
    },
    [state.running, log],
  );

  const runBola = useCallback(
    (payload: Partial<BolaScanRequest>, label = "BOLA scan") =>
      runScan(label, "Initializing BOLA authorization test", () => api.bola(payload)),
    [runScan],
  );

  const runMassAssign = useCallback(
    (payload: Partial<MassAssignRequest>, label = "Mass Assignment scan") =>
      runScan(label, "Initializing Mass Assignment test", () => api.massAssign(payload)),
    [runScan],
  );

  const resetMock = useCallback(async () => {
    try {
      await api.reset();
      log([{ tag: "INFO", message: "Mock target reset to initial fixtures" }]);
      dispatch({ type: "SET_SCANS", scans: [] });
      dispatch({ type: "SELECT", id: null });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Reset failed";
      dispatch({ type: "ERROR", error: msg });
      log([{ tag: "ERROR", message: msg }]);
    }
  }, [log]);

  const runFullDemo = useCallback(async () => {
    if (state.running) return;
    const preset = state.preset;
    if (!preset || !preset.victim_token || !preset.attacker_token) {
      dispatch({ type: "ERROR", error: "Demo preset is unavailable (backend offline or demo mode disabled)." });
      return;
    }
    const ticket = ++seq.current;
    dispatch({ type: "RUNNING", running: "Full demo scan" });
    dispatch({ type: "ERROR", error: null });
    dispatch({ type: "CLEAR_LOGS" });
    dispatch({ type: "SET_SCANS", scans: [] });
    log([{ tag: "INFO", message: "Resetting mock target for a deterministic demo run" }]);

    try {
      await api.reset();
      const steps: { line: string; run: () => Promise<ScanResult> }[] = [
        {
          line: "Testing deliberately vulnerable endpoint for BOLA",
          run: () =>
            api.bola({
              target_base_url: preset.base_url,
              resource_id: preset.sample_order_id,
              victim_token: preset.victim_token!,
              attacker_token: preset.attacker_token!,
              endpoint_path: preset.vulnerable_bola_path,
              mode: "vulnerable",
            }),
        },
        {
          line: "Verifying hardened endpoint enforces authorization",
          run: () =>
            api.bola({
              target_base_url: preset.base_url,
              resource_id: preset.sample_order_id,
              victim_token: preset.victim_token!,
              attacker_token: preset.attacker_token!,
              endpoint_path: preset.secure_bola_path,
              mode: "secure",
            }),
        },
        {
          line: "Probing profile endpoint for Mass Assignment",
          run: () =>
            api.massAssign({
              target_base_url: preset.base_url,
              test_token: preset.attacker_token!,
              profile_path: preset.mass_assign_path,
              probe_fields: { role: "admin", is_admin: true, tier: "enterprise" },
            }),
        },
      ];

      for (const step of steps) {
        if (ticket !== seq.current) return;
        log([{ tag: "INFO", message: step.line }]);
        const result = await step.run();
        if (ticket !== seq.current) return;
        dispatch({ type: "PREPEND_SCAN", scan: result });
        dispatch({ type: "SELECT", id: result.scan_id });
        log(logsForResult(result));
      }
      log([{ tag: "INFO", message: "Demo scan complete" }]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Demo run failed";
      dispatch({ type: "ERROR", error: msg });
      log([{ tag: "ERROR", message: msg }]);
    } finally {
      if (ticket === seq.current) dispatch({ type: "RUNNING", running: null });
    }
  }, [state.running, state.preset, log]);

  const clearLogs = useCallback(() => dispatch({ type: "CLEAR_LOGS" }), []);
  const selectScan = useCallback((id: string | null) => dispatch({ type: "SELECT", id }), []);

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      init,
      refreshBackend,
      runBola,
      runMassAssign,
      runFullDemo,
      resetMock,
      clearLogs,
      selectScan,
    }),
    [state, init, refreshBackend, runBola, runMassAssign, runFullDemo, resetMock, clearLogs, selectScan],
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScanStore(): StoreValue {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScanStore must be used within ScanStoreProvider");
  return ctx;
}

/** Auto-run initialization once the provider is mounted. */
export function useStoreInit() {
  const { init } = useScanStore();
  useEffect(() => init(), [init]);
}
