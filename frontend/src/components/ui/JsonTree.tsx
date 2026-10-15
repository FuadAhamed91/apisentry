import { cn } from "@/lib/utils";

export type MarkKind = "leaked" | "added" | "removed" | "changed";

const markClasses: Record<MarkKind, string> = {
  leaked: "bg-crimson/15 ring-1 ring-inset ring-crimson/30",
  removed: "bg-crimson/10",
  added: "bg-emerald/10",
  changed: "bg-amber/10",
};

function escapeSeg(k: string): string {
  return k.replace(/~/g, "~0").replace(/\//g, "~1");
}

function Val({ v }: { v: unknown }) {
  if (v === null) return <span className="tok-null">null</span>;
  if (typeof v === "string") return <span className="tok-string">{JSON.stringify(v)}</span>;
  if (typeof v === "number") return <span className="tok-number">{String(v)}</span>;
  if (typeof v === "boolean") return <span className="tok-boolean">{String(v)}</span>;
  return <span className="tok-punct">{String(v)}</span>;
}

interface NodeProps {
  k?: string;
  value: unknown;
  path: string;
  marks?: Record<string, MarkKind>;
  depth: number;
  isLast: boolean;
}

function KeyLabel({ k }: { k?: string }) {
  if (k === undefined) return null;
  return (
    <>
      <span className="tok-key">{JSON.stringify(k)}</span>
      <span className="tok-punct">: </span>
    </>
  );
}

function Node({ k, value, path, marks, depth, isLast }: NodeProps) {
  const mark = marks?.[path];
  const pad = { paddingLeft: `${depth * 14 + 12}px` };
  const rowCls = cn("rounded-sm", mark && markClasses[mark]);

  if (Array.isArray(value)) {
    return (
      <>
        <div style={pad} className={rowCls}>
          <KeyLabel k={k} />
          <span className="tok-punct">[</span>
        </div>
        {value.map((item, i) => (
          <Node key={i} value={item} path={`${path}/${i}`} marks={marks} depth={depth + 1} isLast={i === value.length - 1} />
        ))}
        <div style={pad} className="tok-punct">
          ]{isLast ? "" : ","}
        </div>
      </>
    );
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <>
        <div style={pad} className={rowCls}>
          <KeyLabel k={k} />
          <span className="tok-punct">{"{"}</span>
        </div>
        {entries.map(([ck, cv], i) => (
          <Node
            key={ck}
            k={ck}
            value={cv}
            path={`${path}/${escapeSeg(ck)}`}
            marks={marks}
            depth={depth + 1}
            isLast={i === entries.length - 1}
          />
        ))}
        <div style={pad} className="tok-punct">
          {"}"}
          {isLast ? "" : ","}
        </div>
      </>
    );
  }

  return (
    <div style={pad} className={rowCls}>
      <KeyLabel k={k} />
      <Val v={value} />
      {isLast ? null : <span className="tok-punct">,</span>}
    </div>
  );
}

export function JsonTree({
  data,
  marks,
  className,
}: {
  data: unknown;
  marks?: Record<string, MarkKind>;
  className?: string;
}) {
  return (
    <div className={cn("whitespace-pre-wrap break-words font-mono text-[12.5px] leading-[1.6]", className)}>
      <Node value={data} path="" marks={marks} depth={0} isLast />
    </div>
  );
}
