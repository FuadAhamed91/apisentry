"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import { cn, uid } from "@/lib/utils";

type Variant = "success" | "error" | "info";
interface ToastItem {
  id: string;
  variant: Variant;
  message: string;
}

const ToastContext = createContext<(message: string, variant?: Variant) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const config: Record<Variant, { icon: ReactNode; cls: string }> = {
  success: { icon: <CheckCircle2 className="size-4 text-emerald-soft" aria-hidden />, cls: "border-emerald/25" },
  error: { icon: <AlertCircle className="size-4 text-crimson-soft" aria-hidden />, cls: "border-crimson/25" },
  info: { icon: <Info className="size-4 text-indigo-soft" aria-hidden />, cls: "border-indigo/25" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => setItems((p) => p.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (message: string, variant: Variant = "info") => {
      const id = uid("toast");
      setItems((p) => [...p, { id, variant, message }]);
      setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[1000] flex w-[min(92vw,22rem)] flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-surface-2 px-3 py-2.5 text-sm text-fg shadow-pop animate-slide-up",
              config[t.variant].cls,
            )}
          >
            {config[t.variant].icon}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="cursor-pointer text-muted-2 transition-colors hover:text-fg"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
