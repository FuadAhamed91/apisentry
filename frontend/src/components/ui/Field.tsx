import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-xs font-medium text-fg">
        {label}
        {required ? <span className="text-crimson-soft">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-crimson-fg" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] leading-relaxed text-muted-2">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg " +
  "placeholder:text-muted-2 transition-colors duration-150 " +
  "focus:border-indigo/50 focus:bg-surface-3 focus:outline-none " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export function Input({ className, mono, ...rest }: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input className={cn(inputBase, mono && "font-mono text-[13px]", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(inputBase, "cursor-pointer appearance-none pr-9", className)} {...rest}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </div>
  );
}

export function Checkbox({
  label,
  description,
  id,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: string }) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-2.5", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 cursor-pointer accent-indigo"
        {...rest}
      />
      <span className="text-xs leading-relaxed">
        <span className="font-medium text-fg">{label}</span>
        {description ? <span className="mt-0.5 block text-muted-2">{description}</span> : null}
      </span>
    </label>
  );
}
