import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { ActionForm, FormActions, Modal, SubmitButton } from "@/components/forms";
import { Progress } from "@/components/progress";
import { Avatar, Card, CardHeader, EmptyState, Field, Input, LinkButton, PageHeader } from "@/components/ui";
import { getContext, getMembers } from "@/lib/session";
import { dayStart, money, monthLabel, monthStartISO } from "@/lib/format";
import { saveGoals } from "./actions";

export const metadata: Metadata = { title: "Metas" };

type OwnerRow = { owner_id: string | null; won_value: number; won_count: number };

export default async function GoalsPage({ searchParams }: PageProps<"/metas">) {
  const sp = await searchParams;
  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? `${sp.mes}-01` : monthStartISO();
  const next = monthStartISO(1, month);
  const ctx = await getContext();
  const members = await getMembers();

  const [{ data: goals }, { data: deals }] = await Promise.all([
    ctx.supabase.from("goals").select("user_id, target").eq("org_id", ctx.org.id).eq("month", month),
    ctx.supabase
      .from("deals")
      .select("owner_id, value")
      .eq("org_id", ctx.org.id)
      .eq("status", "ganha")
      .gte("closed_at", dayStart(month))
      .lt("closed_at", dayStart(next))
      .limit(5000),
  ]);

  const won = new Map<string | null, OwnerRow>();
  for (const d of deals ?? []) {
    const row = won.get(d.owner_id) ?? { owner_id: d.owner_id, won_value: 0, won_count: 0 };
    row.won_value += Number(d.value);
    row.won_count += 1;
    won.set(d.owner_id, row);
  }
  const teamWon = [...won.values()].reduce((a, r) => a + r.won_value, 0);
  const teamGoal = Number(goals?.find((g) => g.user_id === null)?.target ?? 0);
  const goalOf = (id: string) => Number(goals?.find((g) => g.user_id === id)?.target ?? 0);

  const monthParam = (iso: string) => iso.slice(0, 7);

  return (
    <>
      <PageHeader
        title="Metas"
        description="Acompanhe o realizado em vendas ganhas contra a meta do mês."
        actions={
          <>
            <div className="flex items-center gap-1">
              <LinkButton href={`/metas?mes=${monthParam(monthStartISO(-1, month))}`} variant="ghost" size="sm" aria-label="Mês anterior">
                <ChevronLeft className="size-4" />
              </LinkButton>
              <span className="min-w-32 text-center text-sm font-medium">{monthLabel(month, true)}</span>
              <LinkButton href={`/metas?mes=${monthParam(next)}`} variant="ghost" size="sm" aria-label="Próximo mês">
                <ChevronRight className="size-4" />
              </LinkButton>
            </div>
            {ctx.isAdmin && (
              <Modal title={`Metas de ${monthLabel(month, true)}`} triggerVariant="primary" trigger="Definir metas">
                <ActionForm action={saveGoals.bind(null, month)} className="space-y-4">
                  <Field label="Meta da equipe (R$)" htmlFor="goal_equipe">
                    <Input id="goal_equipe" name="goal_equipe" inputMode="decimal" defaultValue={teamGoal ? String(teamGoal).replace(".", ",") : ""} />
                  </Field>
                  <div className="space-y-3 border-t border-line pt-4">
                    {members.map((m) => (
                      <Field key={m.id} label={m.name} htmlFor={`goal_${m.id}`}>
                        <Input
                          id={`goal_${m.id}`}
                          name={`goal_${m.id}`}
                          inputMode="decimal"
                          defaultValue={goalOf(m.id) ? String(goalOf(m.id)).replace(".", ",") : ""}
                          placeholder="Sem meta"
                        />
                      </Field>
                    ))}
                  </div>
                  <FormActions>
                    <SubmitButton>Salvar metas</SubmitButton>
                  </FormActions>
                </ActionForm>
              </Modal>
            )}
          </>
        }
      />

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Equipe</p>
            <p className="tabular mt-1 text-3xl font-semibold tracking-tight">{money(teamWon)}</p>
            <p className="tabular mt-1 text-sm text-muted">{teamGoal ? `de ${money(teamGoal)}` : "Meta da equipe não definida"}</p>
          </div>
          {teamGoal > 0 && <p className="tabular text-2xl font-semibold text-brand">{Math.round((teamWon / teamGoal) * 100)}%</p>}
        </div>
        {teamGoal > 0 && <Progress value={teamWon} max={teamGoal} className="mt-4 h-3" />}
      </Card>

      <Card>
        <CardHeader title="Por vendedor" />
        {members.length === 0 ? (
          <EmptyState icon={<Target className="size-8" />} title="Sem membros" />
        ) : (
          <ul className="divide-y divide-line">
            {members.map((m) => {
              const row = won.get(m.id);
              const goal = goalOf(m.id);
              const value = row?.won_value ?? 0;
              return (
                <li key={m.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-48 items-center gap-3">
                    <Avatar name={m.name} />
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted">{row?.won_count ?? 0} vendas ganhas</p>
                    </div>
                  </div>
                  <div className="flex-1">
                    {goal > 0 ? <Progress value={value} max={goal} /> : <p className="text-xs text-muted">Sem meta definida</p>}
                  </div>
                  <p className="tabular min-w-48 text-sm sm:text-right">
                    <span className="font-semibold">{money(value)}</span>
                    {goal > 0 && <span className="text-muted"> / {money(goal)} · {Math.round((value / goal) * 100)}%</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
