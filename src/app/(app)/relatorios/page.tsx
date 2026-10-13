import Link from "next/link";
import type { Metadata } from "next";
import { BarList, ColumnChart } from "@/components/progress";
import { Avatar, Card, CardHeader, PageHeader, Stat, Table, cn } from "@/components/ui";
import { getContext, getMembers } from "@/lib/session";
import { dayStart, money, moneyCompact, monthLabel, monthStartISO } from "@/lib/format";

export const metadata: Metadata = { title: "Relatórios" };

const PERIODS = [
  { key: "3", label: "3 meses" },
  { key: "6", label: "6 meses" },
  { key: "12", label: "12 meses" },
];

type Report = {
  by_month: { month: string; won_count: number; won_value: number; lost_count: number }[];
  by_stage: { id: string; name: string; pipeline: string; pipeline_id: string; count: number; value: number; probability: number }[];
  by_owner: { owner_id: string | null; won_count: number; won_value: number; lost_count: number; open_count: number; open_value: number }[];
  by_loss_reason: { name: string; count: number }[];
  by_source: { name: string; count: number; won: number }[];
};

export default async function ReportsPage({ searchParams }: PageProps<"/relatorios">) {
  const sp = await searchParams;
  const months = PERIODS.some((p) => p.key === sp.periodo) ? Number(sp.periodo) : 6;
  const since = monthStartISO(-(months - 1));
  const ctx = await getContext();
  const members = await getMembers();

  const { data, error } = await ctx.supabase.rpc("deals_report", { p_org: ctx.org.id, p_since: dayStart(since) });
  const report = (data ?? { by_month: [], by_stage: [], by_owner: [], by_loss_reason: [], by_source: [] }) as Report;

  const monthRows = Array.from({ length: months }, (_, i) => {
    const m = monthStartISO(i, since);
    const row = report.by_month.find((r) => r.month.slice(0, 7) === m.slice(0, 7));
    return { month: m, won_value: Number(row?.won_value ?? 0), won_count: row?.won_count ?? 0, lost_count: row?.lost_count ?? 0 };
  });
  const wonCount = monthRows.reduce((a, r) => a + r.won_count, 0);
  const lostCount = monthRows.reduce((a, r) => a + r.lost_count, 0);
  const wonValue = monthRows.reduce((a, r) => a + r.won_value, 0);
  const winRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : null;
  const avgTicket = wonCount > 0 ? wonValue / wonCount : 0;
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name ?? "Sem responsável";
  const pipelines = [...new Set(report.by_stage.map((s) => s.pipeline))];

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Desempenho comercial: vendas, funil, perdas e equipe."
        actions={
          <nav className="inline-flex rounded-md border border-line bg-surface p-0.5" aria-label="Período">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/relatorios?periodo=${p.key}`}
                className={cn("rounded px-2.5 py-1.5 text-sm", String(months) === p.key ? "bg-surface-2 font-medium" : "text-muted hover:text-fg")}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        }
      />

      {error && <p className="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">Erro ao carregar relatório: {error.message}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Vendas ganhas" value={moneyCompact(wonValue)} hint={`${wonCount} negócios`} />
        <Stat label="Ticket médio" value={moneyCompact(avgTicket)} />
        <Stat label="Taxa de conversão" value={winRate === null ? "—" : `${winRate}%`} hint="ganhas ÷ (ganhas + perdidas)" />
        <Stat label="Perdidas" value={lostCount} tone={lostCount > 0 ? "danger" : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader title="Vendas ganhas por mês" />
          <div className="p-4">
            <ColumnChart rows={monthRows.map((r) => ({ label: monthLabel(r.month), value: r.won_value }))} format={moneyCompact} />
          </div>
        </Card>

        {pipelines.map((p) => (
          <Card key={p}>
            <CardHeader title={`Funil atual · ${p}`} />
            <div className="p-4">
              <BarList
                rows={report.by_stage
                  .filter((s) => s.pipeline === p)
                  .map((s) => ({ label: s.name, value: Number(s.value), hint: `(${s.count})` }))}
                format={money}
              />
            </div>
          </Card>
        ))}

        <Card>
          <CardHeader title="Motivos de perda" />
          <div className="p-4">
            <BarList rows={report.by_loss_reason.map((r) => ({ label: r.name, value: Number(r.count) }))} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Origem das oportunidades" />
          <div className="p-4">
            <BarList
              rows={report.by_source.map((r) => ({
                label: r.name,
                value: Number(r.count),
                hint: r.count > 0 ? `· ${Math.round((r.won / r.count) * 100)}% ganhas` : undefined,
              }))}
            />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Desempenho por vendedor" />
          <Table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th className="text-right!">Ganhas</th>
                <th className="text-right!">Valor ganho</th>
                <th className="text-right!">Perdidas</th>
                <th className="text-right!">Conversão</th>
                <th className="text-right!">Em aberto</th>
                <th className="text-right!">Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {report.by_owner
                .sort((a, b) => Number(b.won_value) - Number(a.won_value))
                .map((r) => {
                  const rate = r.won_count + r.lost_count > 0 ? Math.round((r.won_count / (r.won_count + r.lost_count)) * 100) : null;
                  return (
                    <tr key={r.owner_id ?? "none"}>
                      <td>
                        <span className="flex items-center gap-2">
                          <Avatar size="sm" name={memberName(r.owner_id)} />
                          {memberName(r.owner_id)}
                        </span>
                      </td>
                      <td className="tabular text-right">{r.won_count}</td>
                      <td className="tabular text-right font-medium">{money(r.won_value)}</td>
                      <td className="tabular text-right">{r.lost_count}</td>
                      <td className="tabular text-right">{rate === null ? "—" : `${rate}%`}</td>
                      <td className="tabular text-right">{r.open_count}</td>
                      <td className="tabular text-right">{money(r.open_value)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </Table>
          {report.by_owner.length === 0 && <p className="p-6 text-center text-sm text-muted">Sem dados.</p>}
        </Card>
      </div>
    </>
  );
}
