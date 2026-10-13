import { cn } from "@/components/ui";

export function Progress({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-2 overflow-hidden rounded-full bg-surface-2", className)}
    >
      <div className={cn("h-full rounded-full", pct >= 100 ? "bg-ok" : "bg-brand")} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Barras horizontais simples para relatórios (sem biblioteca de gráficos). */
export function BarList({
  rows,
  format = (n) => String(n),
}: {
  rows: { label: string; value: number; hint?: string }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">Sem dados no período.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="tabular shrink-0 text-muted">
              {format(r.value)}
              {r.hint && <span className="ml-1.5 text-xs">{r.hint}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Colunas verticais (ex.: vendas por mês). */
export function ColumnChart({
  rows,
  format,
}: {
  rows: { label: string; value: number }[];
  format: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex h-48 items-end gap-2 sm:gap-3">
      {rows.map((r) => (
        <div key={r.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="tabular text-[11px] text-muted">{r.value > 0 ? format(r.value) : ""}</span>
          <div
            className="w-full max-w-12 rounded-t-md bg-brand/85 transition-[height]"
            style={{ height: `${Math.max(r.value > 0 ? 3 : 0, (r.value / max) * 100)}%` }}
            title={`${r.label}: ${format(r.value)}`}
          />
          <span className="text-[11px] text-muted">{r.label}</span>
        </div>
      ))}
    </div>
  );
}
