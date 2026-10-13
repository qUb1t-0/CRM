import type { Metadata } from "next";
import { CheckSquare } from "lucide-react";
import { NewTaskButton, TaskList, type TaskRow } from "@/components/tasks";
import { Card, EmptyState, PageHeader, Segmented, Select } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";
import { getContext, getMembers } from "@/lib/session";
import { addDays, dayStart, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Tarefas" };

const FILTERS = [
  { key: "abertas", label: "Em aberto" },
  { key: "hoje", label: "Hoje" },
  { key: "atrasadas", label: "Atrasadas" },
  { key: "semana", label: "Próximos 7 dias" },
  { key: "concluidas", label: "Concluídas" },
];

export default async function TasksPage({ searchParams }: PageProps<"/tarefas">) {
  const sp = await searchParams;
  const filtro = typeof sp.filtro === "string" && FILTERS.some((f) => f.key === sp.filtro) ? sp.filtro : "abertas";
  const resp = typeof sp.resp === "string" ? sp.resp : "meus";

  const ctx = await getContext();
  const members = await getMembers();
  const today = todayISO();
  const now = new Date().toISOString();

  let query = ctx.supabase
    .from("tasks")
    .select("*, entity:entities(id, name), deal:deals(id, title)")
    .eq("org_id", ctx.org.id);

  if (resp === "meus") query = query.eq("assignee_id", ctx.user.id);
  else if (resp !== "todos") query = query.eq("assignee_id", resp);

  switch (filtro) {
    case "hoje":
      query = query.eq("done", false).gte("due_at", dayStart(today)).lt("due_at", dayStart(addDays(today, 1)));
      break;
    case "atrasadas":
      query = query.eq("done", false).lt("due_at", now);
      break;
    case "semana":
      query = query.eq("done", false).gte("due_at", dayStart(today)).lt("due_at", dayStart(addDays(today, 8)));
      break;
    case "concluidas":
      query = query.eq("done", true);
      break;
    default:
      query = query.eq("done", false);
  }

  query =
    filtro === "concluidas"
      ? query.order("done_at", { ascending: false })
      : query.order("due_at", { ascending: true, nullsFirst: false }).order("created_at");
  const { data: tasks } = await query.limit(300);

  const link = (patch: Record<string, string>) => {
    const s = new URLSearchParams({ filtro, resp, ...patch });
    return `/tarefas?${s}`;
  };

  return (
    <>
      <PageHeader
        title="Tarefas"
        description="Seus próximos passos com clientes e oportunidades."
        actions={<NewTaskButton members={members} currentUserId={ctx.user.id} size="md" variant="primary" autoOpen />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented label="Filtro" value={filtro} items={FILTERS.map((f) => ({ value: f.key, label: f.label, href: link({ filtro: f.key }) }))} />
        <FilterForm action="/tarefas" className="flex gap-2">
          <input type="hidden" name="filtro" value={filtro} />
          <Select name="resp" defaultValue={resp} className="w-auto" aria-label="Responsável">
            <option value="meus">Minhas tarefas</option>
            <option value="todos">Toda a equipe</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </FilterForm>
      </div>

      <Card>
        {tasks && tasks.length > 0 ? (
          <TaskList tasks={tasks as TaskRow[]} members={members} currentUserId={ctx.user.id} />
        ) : (
          <EmptyState icon={<CheckSquare className="size-8" />} title="Nenhuma tarefa por aqui">
            {filtro === "atrasadas" ? "Ótimo, nada atrasado." : "Crie uma tarefa para organizar seu próximo passo."}
          </EmptyState>
        )}
      </Card>
    </>
  );
}
