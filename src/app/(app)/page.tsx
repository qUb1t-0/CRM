import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { BarList } from "@/components/progress";
import { Progress } from "@/components/progress";
import { NewTaskButton, TaskList, type TaskRow } from "@/components/tasks";
import { Timeline, type TimelineEvent } from "@/components/timeline";
import { Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { getContext, getMembers, getPipelines } from "@/lib/session";
import { addDays, dayStart, money, moneyCompact, monthStartISO, time, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Início" };

type Stats = {
  open_count: number;
  open_value: number;
  weighted_value: number;
  won_month_count: number;
  won_month_value: number;
  lost_month_count: number;
  tasks_overdue: number;
  tasks_today: number;
};

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const scope = sp.visao === "equipe" ? "equipe" : "meu";
  const ctx = await getContext();
  const { supabase, org, user } = ctx;
  const userFilter = scope === "meu" ? user.id : null;
  const today = todayISO();
  const month = monthStartISO();

  const [members, pipelines, statsRes, tasksRes, eventsRes, apptRes, stageRes, goalRes] = await Promise.all([
    getMembers(),
    getPipelines(),
    supabase.rpc("dashboard_stats", { p_org: org.id, p_user: userFilter }),
    (() => {
      let q = supabase
        .from("tasks")
        .select("*, entity:entities(id, name), deal:deals(id, title)")
        .eq("org_id", org.id)
        .eq("done", false)
        .lt("due_at", dayStart(addDays(today, 1)))
        .order("due_at")
        .limit(8);
      if (userFilter) q = q.eq("assignee_id", userFilter);
      return q;
    })(),
    supabase.from("timeline_events").select("*").eq("org_id", org.id).order("created_at", { ascending: false }).limit(12),
    (() => {
      let q = supabase
        .from("appointments")
        .select("id, title, starts_at, location, entity:entities(id, name)")
        .eq("org_id", org.id)
        .gte("starts_at", dayStart(today))
        .lt("starts_at", dayStart(addDays(today, 1)))
        .order("starts_at");
      if (userFilter) q = q.eq("owner_id", userFilter);
      return q;
    })(),
    (() => {
      let q = supabase.from("deals").select("stage_id, value").eq("org_id", org.id).eq("status", "aberta").limit(5000);
      if (userFilter) q = q.eq("owner_id", userFilter);
      return q;
    })(),
    (() => {
      const q = supabase.from("goals").select("target").eq("org_id", org.id).eq("month", month);
      return (userFilter ? q.eq("user_id", userFilter) : q.is("user_id", null)).maybeSingle();
    })(),
  ]);

  const stats = (statsRes.data ?? {}) as Partial<Stats>;
  const goal = Number(goalRes.data?.target ?? 0);

  const pipeline = pipelines[0];
  const funnel = (pipeline?.stages ?? []).map((s) => {
    const deals = (stageRes.data ?? []).filter((d) => d.stage_id === s.id);
    return { label: s.name, value: deals.reduce((a, d) => a + Number(d.value), 0), hint: `(${deals.length})` };
  });

  const firstName = ctx.profile.name.split(" ")[0];
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={scope === "meu" ? "Seus números e o que precisa de atenção hoje." : `Visão geral da equipe ${org.name}.`}
        actions={
          <nav className="inline-flex rounded-md border border-line bg-surface p-0.5 text-sm" aria-label="Visão">
            <Link href="/?visao=meu" className={scope === "meu" ? "rounded bg-surface-2 px-2.5 py-1.5 font-medium" : "px-2.5 py-1.5 text-muted"}>
              Meus números
            </Link>
            <Link href="/?visao=equipe" className={scope === "equipe" ? "rounded bg-surface-2 px-2.5 py-1.5 font-medium" : "px-2.5 py-1.5 text-muted"}>
              Equipe
            </Link>
          </nav>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pipeline em aberto" value={moneyCompact(stats.open_value)} hint={`${stats.open_count ?? 0} oportunidades · ponderado ${moneyCompact(stats.weighted_value)}`} />
        <Stat label="Ganho no mês" value={moneyCompact(stats.won_month_value)} hint={`${stats.won_month_count ?? 0} negócios`} tone="ok" />
        <Stat label="Perdidas no mês" value={stats.lost_month_count ?? 0} />
        <Stat
          label="Tarefas"
          value={stats.tasks_today ?? 0}
          hint={stats.tasks_overdue ? <span className="text-danger">{stats.tasks_overdue} atrasadas</span> : "para hoje, nada atrasado"}
        />
      </div>

      {goal > 0 && (
        <Card className="mb-6 p-4">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="font-medium">Meta do mês {scope === "meu" ? "(sua)" : "(equipe)"}</span>
            <span className="tabular text-muted">
              {money(stats.won_month_value)} de {money(goal)} · {Math.round((Number(stats.won_month_value ?? 0) / goal) * 100)}%
            </span>
          </div>
          <Progress value={Number(stats.won_month_value ?? 0)} max={goal} />
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Tarefas de hoje e atrasadas"
              action={<NewTaskButton members={members} currentUserId={user.id} />}
            />
            {(tasksRes.data ?? []).length === 0 ? (
              <EmptyState title="Tudo em dia">Nenhuma tarefa para hoje.</EmptyState>
            ) : (
              <TaskList tasks={tasksRes.data as TaskRow[]} members={members} currentUserId={user.id} />
            )}
            <div className="border-t border-line px-4 py-2.5">
              <Link href="/tarefas" className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
                Ver todas as tarefas <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </Card>

          {pipeline && (
            <Card>
              <CardHeader
                title={`Funil · ${pipeline.name}`}
                action={
                  <Link href="/oportunidades" className="text-sm text-brand hover:underline">
                    Abrir funil
                  </Link>
                }
              />
              <div className="p-4">
                <BarList rows={funnel} format={money} />
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Agenda de hoje" action={<Link href="/agenda" className="text-sm text-brand hover:underline">Agenda</Link>} />
            {(apptRes.data ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted">Nenhum compromisso hoje.</p>
            ) : (
              <ul className="divide-y divide-line">
                {apptRes.data!.map((a) => {
                  const entity = a.entity as unknown as { id: string; name: string } | null;
                  return (
                    <li key={a.id} className="flex gap-3 px-4 py-3 text-sm">
                      <span className="tabular w-12 shrink-0 font-medium text-brand">{time(a.starts_at)}</span>
                      <div className="min-w-0">
                        <p className="font-medium">{a.title}</p>
                        {entity && <p className="truncate text-xs text-muted">{entity.name}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Atividade recente" />
            <div className="p-4">
              <Timeline events={(eventsRes.data ?? []) as TimelineEvent[]} members={members} currentUserId={user.id} showLinks />
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
