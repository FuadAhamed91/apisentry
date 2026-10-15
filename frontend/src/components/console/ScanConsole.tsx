"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DownloadCloud, PlayCircle, RotateCcw, ShieldAlert, UserCog } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Checkbox, Field, Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useScanStore } from "@/store/ScanStore";
import type { ScanResult } from "@/types/scan";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

interface FormState {
  target_base_url: string;
  resource_id: string;
  victim_token: string;
  attacker_token: string;
  vuln_path: string;
  secure_path: string;
  mass_path: string;
  mode: "vulnerable" | "secure";
  external_authorized: boolean;
}

const EMPTY: FormState = {
  target_base_url: "",
  resource_id: "",
  victim_token: "",
  attacker_token: "",
  vuln_path: "/orders/{resource_id}",
  secure_path: "/secure/orders/{resource_id}",
  mass_path: "/users/profile",
  mode: "vulnerable",
  external_authorized: false,
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function ScanConsole() {
  const { preset, runBola, runMassAssign, runFullDemo, resetMock, running, backend } = useScanStore();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const prefilled = useRef(false);

  useEffect(() => {
    if (prefilled.current || !preset) return;
    prefilled.current = true;
    setForm((f) => ({
      ...f,
      target_base_url: preset.base_url,
      resource_id: preset.sample_order_id,
      victim_token: preset.victim_token ?? "",
      attacker_token: preset.attacker_token ?? "",
      vuln_path: preset.vulnerable_bola_path,
      secure_path: preset.secure_bola_path,
      mass_path: preset.mass_assign_path,
    }));
  }, [preset]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const host = hostOf(form.target_base_url);
  const isExternal = host !== null && !LOCAL_HOSTS.has(host);
  const busy = running !== null || backend !== "online";

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.target_base_url.trim()) e.target_base_url = "Target base URL is required.";
    else if (host === null) e.target_base_url = "Enter a valid http(s) URL.";
    return e;
  }, [form.target_base_url, host]);

  const toastResult = (r: ScanResult | null) => {
    if (!r) return;
    if (r.status === "VULNERABLE") toast(`${r.severity}: ${r.title}`, "error");
    else if (r.status === "PASS") toast(r.title, "success");
    else toast(`${r.status}: ${r.title}`, "info");
  };

  const guard = (): boolean => {
    if (Object.keys(errors).length > 0) {
      toast("Fix the highlighted fields before scanning.", "error");
      return false;
    }
    if (isExternal && !form.external_authorized) {
      toast("External target requires an explicit authorization confirmation.", "error");
      return false;
    }
    return true;
  };

  const onBola = async () => {
    if (!guard()) return;
    const r = await runBola(
      {
        target_base_url: form.target_base_url.trim(),
        resource_id: form.resource_id.trim(),
        victim_token: form.victim_token,
        attacker_token: form.attacker_token,
        endpoint_path: form.mode === "vulnerable" ? form.vuln_path : form.secure_path,
        mode: form.mode,
        external_authorized: form.external_authorized,
      },
      form.mode === "vulnerable" ? "BOLA scan (vulnerable)" : "BOLA scan (secure)",
    );
    toastResult(r);
  };

  const onMassAssign = async () => {
    if (!guard()) return;
    const r = await runMassAssign({
      target_base_url: form.target_base_url.trim(),
      test_token: form.attacker_token,
      profile_path: form.mass_path,
      probe_fields: { role: "admin", is_admin: true, tier: "enterprise" },
      external_authorized: form.external_authorized,
    });
    toastResult(r);
  };

  const onReset = async () => {
    await resetMock();
    toast("Mock target reset to initial fixtures.", "success");
  };

  return (
    <Card>
      <CardHeader
        title="Scan configuration"
        description="Defaults target the local mock lab. Tokens are sent in the request body, never the URL."
        icon={<ShieldAlert className="size-4" aria-hidden />}
        actions={
          preset ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<DownloadCloud className="size-3.5" aria-hidden />}
              onClick={() => {
                prefilled.current = false;
                setForm((f) => ({
                  ...f,
                  target_base_url: preset.base_url,
                  resource_id: preset.sample_order_id,
                  victim_token: preset.victim_token ?? "",
                  attacker_token: preset.attacker_token ?? "",
                  vuln_path: preset.vulnerable_bola_path,
                  secure_path: preset.secure_bola_path,
                  mass_path: preset.mass_assign_path,
                }));
                toast("Preset loaded from backend.", "info");
              }}
            >
              Load preset
            </Button>
          ) : null
        }
      />
      <CardContent className="space-y-5">
        {preset?.tokens_exposed ? (
          <div className="rounded-lg border border-amber/25 bg-amber/10 px-3 py-2 text-[11px] leading-relaxed text-amber-fg">
            The tokens below are static, development-only demo fixtures — not real credentials.
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Target base URL" htmlFor="f-base" required error={errors.target_base_url} className="sm:col-span-2">
            <Input
              id="f-base"
              mono
              value={form.target_base_url}
              onChange={(e) => set("target_base_url", e.target.value)}
              placeholder="http://127.0.0.1:8000/mock/api/v1"
              spellCheck={false}
            />
          </Field>

          <Field label="Resource ID" htmlFor="f-res">
            <Input
              id="f-res"
              mono
              value={form.resource_id}
              onChange={(e) => set("resource_id", e.target.value)}
              placeholder="ord-9921"
              spellCheck={false}
            />
          </Field>

          <Field label="BOLA endpoint" htmlFor="f-mode" hint="Which implementation the BOLA scan targets.">
            <Select id="f-mode" value={form.mode} onChange={(e) => set("mode", e.target.value as FormState["mode"])}>
              <option value="vulnerable">Vulnerable endpoint</option>
              <option value="secure">Secure (hardened) endpoint</option>
            </Select>
          </Field>

          <Field label="Victim token (owner)" htmlFor="f-victim">
            <Input
              id="f-victim"
              mono
              value={form.victim_token}
              onChange={(e) => set("victim_token", e.target.value)}
              placeholder="token-victim-alice"
              spellCheck={false}
            />
          </Field>

          <Field label="Attacker / test token" htmlFor="f-attacker" hint="Also used as the Mass Assignment test identity.">
            <Input
              id="f-attacker"
              mono
              value={form.attacker_token}
              onChange={(e) => set("attacker_token", e.target.value)}
              placeholder="token-attacker-bob"
              spellCheck={false}
            />
          </Field>

          <Field label={form.mode === "secure" ? "Secure BOLA path" : "Vulnerable BOLA path"} htmlFor="f-bpath">
            <Input
              id="f-bpath"
              mono
              value={form.mode === "secure" ? form.secure_path : form.vuln_path}
              onChange={(e) => set(form.mode === "secure" ? "secure_path" : "vuln_path", e.target.value)}
              spellCheck={false}
            />
          </Field>

          <Field label="Mass Assignment path" htmlFor="f-mpath">
            <Input
              id="f-mpath"
              mono
              value={form.mass_path}
              onChange={(e) => set("mass_path", e.target.value)}
              spellCheck={false}
            />
          </Field>
        </div>

        <div>
          <span className="text-xs font-medium text-fg">Mass Assignment probe fields</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone="crimson" icon={<UserCog className="size-3" aria-hidden />}>role = admin</Badge>
            <Badge tone="crimson">is_admin = true</Badge>
            <Badge tone="amber">tier = enterprise</Badge>
          </div>
        </div>

        {isExternal ? (
          <Checkbox
            id="f-ext"
            checked={form.external_authorized}
            onChange={(e) => set("external_authorized", e.target.checked)}
            label="I am authorized to test this external target"
            description="Required for non-local targets. External scans are SSRF-guarded and block private/loopback ranges."
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button
            variant="primary"
            onClick={onBola}
            loading={running?.startsWith("BOLA") ?? false}
            disabled={busy}
            icon={<ShieldAlert className="size-4" aria-hidden />}
          >
            Run BOLA scan
          </Button>
          <Button
            variant="secondary"
            onClick={onMassAssign}
            loading={running === "Mass Assignment scan"}
            disabled={busy}
            icon={<UserCog className="size-4" aria-hidden />}
          >
            Run Mass Assignment scan
          </Button>
          <Button
            variant="subtle"
            onClick={() => runFullDemo()}
            loading={running === "Full demo scan"}
            disabled={busy}
            icon={<PlayCircle className="size-4" aria-hidden />}
          >
            Run full demo
          </Button>
          <Button
            variant="ghost"
            onClick={onReset}
            disabled={running !== null || backend !== "online"}
            icon={<RotateCcw className="size-4" aria-hidden />}
            className="ml-auto"
          >
            Reset mock target
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
