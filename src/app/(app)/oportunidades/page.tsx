import Link from "next/link";
import type { Metadata } from "next";
import { Download, Kanban as KanbanIcon, List, Plus } from "lucide-react";
import { Modal } from "@/components/forms";
import { Badge, Card, EmptyState, LinkButton, Pagination, SearchField, Segmented, Select, Table } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";
import { getContext, getCustomFields, getMembers, getPipelines } from "@/lib/session";
import { sanitizeSearch } from "@/lib/forms";
import { date, money } from "@/lib/format";
import { createDeal } from "./actions";
import { DealForm } from "./deal-form";
import { Kanban, type KanbanDeal } from "./kanban";

export const metadata: Metadata = { title: "Oportunidades" };

const PER_PAGE = 50;
const statusTone = { aberta: "info", ganha: "ok", perdida: "danger" } as const;

export default async function DealsPage({ searchParams }: PageProps<"/oportunidades">) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const ctx = await getContext();
  const [pipelines, members, fields] = await Promise.all([getPipelines(), getMembers(), getCustomFields("oportunidade")]);

  const view = one("view") === "lista" ? "lista" : "kanban";
  const pipeline = pipelines.find((p) => p.id === one("funil")) ?? pipelines[0];
  const resp = one("resp") ?? "todos";
  const status = one("status") ?? "aberta";
  const q = sanitizeSearch(one("q"));
  const page = Math.max(1, Number(one("p")) || 1);

  const params = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { view, funil: pipeline?.id, resp, status, q: q || undefined, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && next.set(k, v));
    return `/oportunidades?${next.toString()}`;
  };

  let query = ctx.supabase
    .from("deals")
    .select("id, title, value, status, stage_id, owner_id, expected_close, created_at, entity:entities(id, name), stage:stages(name)", {
      count: view === "lista" ? "exact" : undefined,
    })
    .eq("org_id", ctx.org.id);

  if (pipeline) query = query.eq("pipeline_id", pipeline.id);
  if (resp === "meus") query = query.eq("owner_id", ctx.user.id);
  else if (resp !== "todos") query = query.eq("owner_id", resp);
  if (q) query = query.ilike("title", `%${q}%`);

  if (view === "kanban") {
    query = query.eq("status", "aberta").order("updated_at", { ascending: false }).limit(1000);
  } else {
    if (status !== "todas") query = query.eq("status", status);
    query = query.order("created_at", { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  }

  const { data: deals, count } = await query;
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name ?? "—";

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Oportunidades</h1>
          <p className="mt-1 text-sm text-muted">Acompanhe e mova seus negócios pelo funil.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href={`/api/exportar/oportunidades`} prefetch={false} variant="ghost" title="Exportar CSV">
            <Download className="size-4" /> Exportar
          </LinkButton>
          {pipeline ? (
            <Modal
              title="Nova oportunidade"
              autoOpenParam="novo"
              triggerVariant="primary"
              wide
              trigger={
                <>
                  <Plus className="size-4" /> Nova oportunidade
                </>
              }
            >
              <DealForm
                action={createDeal}
                orgId={ctx.org.id}
                pipelines={pipelines}
                members={members}
                fields={fields}
                currentUserId={ctx.user.id}
                values={{ stage_id: pipeline.stages[0]?.id }}
                submitLabel="Criar oportunidade"
              />
            </Modal>
          ) : null}
        </div>
      </div>

      <FilterForm className="mb-4 flex flex-wrap items-center gap-2" action="/oportunidades">
        <input type="hidden" name="view" value={view} />
        <Segmented
          label="Visualização"
          value={view}
          items={[
            { value: "kanban", label: <><KanbanIcon className="size-4" /> Funil</>, href: params({ view: "kanban", p: undefined }) },
            { value: "lista", label: <><List className="size-4" /> Lista</>, href: params({ view: "lista", p: undefined }) },
          ]}
        />
        {pipelines.length > 1 && (
          <Select name="funil" defaultValue={pipeline?.id} className="w-auto" aria-label="Funil">
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
        <Select name="resp" defaultValue={resp} className="w-auto" aria-label="Responsável">
          <option value="todos">Todos os responsáveis</option>
          <option value="meus">Minhas oportunidades</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        {view === "lista" && (
          <Select name="status" defaultValue={status} className="w-auto" aria-label="Situação">
            <option value="aberta">Em aberto</option>
            <option value="ganha">Ganhas</option>
            <option value="perdida">Perdidas</option>
            <option value="todas">Todas</option>
          </Select>
        )}
        <SearchField defaultValue={q} placeholder="Filtrar por título…" />
      </FilterForm>

      {!pipeline ? (
        <Card>
          <EmptyState title="Nenhum funil configurado">
            Crie um funil em <Link href="/configuracoes/funis" className="text-brand underline">Configurações › Funis</Link>.
          </EmptyState>
        </Card>
      ) : view === "kanban" ? (
        <Kanban orgId={ctx.org.id} stages={pipeline.stages} deals={(deals ?? []) as unknown as KanbanDeal[]} members={members} />
      ) : (
        <Card>
          {deals && deals.length > 0 ? (
            <>
              <Table>
                <thead>
                  <tr>
                    <th>Oportunidade</th>
                    <th>Empresa / pessoa</th>
                    <th>Etapa</th>
                    <th className="text-right!">Valor</th>
                    <th>Previsão</th>
                    <th>Responsável</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d) => {
                    const entity = d.entity as unknown as { id: string; name: string } | null;
                    const stage = d.stage as unknown as { name: string } | null;
                    return (
                      <tr key={d.id}>
                        <td>
                          <Link href={`/oportunidades/${d.id}`} className="font-medium hover:text-brand">
                            {d.title}
                          </Link>
                        </td>
                        <td className="text-muted">
                          {entity ? (
                            <Link href={`/contatos/${entity.id}`} className="hover:text-brand">
                              {entity.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-muted">{stage?.name}</td>
                        <td className="tabular text-right">{money(d.value)}</td>
                        <td className="tabular text-muted">{date(d.expected_close)}</td>
                        <td className="text-muted">{memberName(d.owner_id)}</td>
                        <td>
                          <Badge tone={statusTone[d.status as keyof typeof statusTone]}>
                            {d.status === "aberta" ? "Em aberto" : d.status === "ganha" ? "Ganha" : "Perdida"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <Pagination page={page} total={count ?? 0} perPage={PER_PAGE} href={(p) => params({ p: String(p) })} />
            </>
          ) : (
            <EmptyState title="Nenhuma oportunidade encontrada">Ajuste os filtros ou crie uma nova oportunidade.</EmptyState>
          )}
        </Card>
      )}
    </>
  );
}
