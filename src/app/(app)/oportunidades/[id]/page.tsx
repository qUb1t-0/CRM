import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, FileText, Pencil, Plus, RotateCcw, Trash2, Trophy, UserRound, XCircle } from "lucide-react";
import { ActionButton, ActionForm, FormActions, Modal, SubmitButton } from "@/components/forms";
import { CustomFieldValues } from "@/components/custom-fields";
import { NewTaskButton, TaskList, type TaskRow } from "@/components/tasks";
import { Timeline, type TimelineEvent } from "@/components/timeline";
import { Badge, Card, CardHeader, EmptyState, Field, Input, Select, Table, Textarea, cn } from "@/components/ui";
import { getContext, getCustomFields, getLossReasons, getMembers, getPipelines } from "@/lib/session";
import { date, dateTime, money } from "@/lib/format";
import { addItem, deleteDeal, loseDeal, moveDeal, removeItem, reopenDeal, updateDeal, winDeal } from "../actions";
import { createProposal } from "../../propostas/actions";
import { DealForm } from "../deal-form";

export const metadata: Metadata = { title: "Oportunidade" };

const proposalTone = { rascunho: "neutral", enviada: "info", aceita: "ok", recusada: "danger" } as const;

export default async function DealPage({ params }: PageProps<"/oportunidades/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  const { supabase, org } = ctx;

  const { data: deal } = await supabase
    .from("deals")
    .select("*, entity:entities(id, name, kind), contact:contacts(id, name, email, phone, job_title), loss_reason:loss_reasons(name)")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!deal) notFound();

  const [pipelines, members, fields, lossReasons, itemsRes, proposalsRes, tasksRes, eventsRes, productsRes] = await Promise.all([
    getPipelines(),
    getMembers(),
    getCustomFields("oportunidade"),
    getLossReasons(),
    supabase.from("deal_items").select("*").eq("deal_id", id).order("created_at"),
    supabase.from("proposals").select("id, number, title, status, total, created_at").eq("deal_id", id).order("number", { ascending: false }),
    supabase.from("tasks").select("*").eq("deal_id", id).order("done").order("due_at", { nullsFirst: false }),
    supabase.from("timeline_events").select("*").eq("deal_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("products").select("id, name, price").eq("org_id", org.id).eq("active", true).order("name"),
  ]);

  const items = itemsRes.data ?? [];
  const pipeline = pipelines.find((p) => p.id === deal.pipeline_id);
  const stage = pipeline?.stages.find((s) => s.id === deal.stage_id);
  const entity = deal.entity as { id: string; name: string; kind: "empresa" | "pessoa" } | null;
  const contact = deal.contact as { id: string; name: string; email: string | null; phone: string | null; job_title: string | null } | null;
  const owner = members.find((m) => m.id === deal.owner_id);
  const isOpen = deal.status === "aberta";

  return (
    <>
      <Link href="/oportunidades" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Oportunidades
      </Link>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{deal.title}</h1>
            {deal.status === "ganha" && <Badge tone="ok">Ganha</Badge>}
            {deal.status === "perdida" && <Badge tone="danger">Perdida</Badge>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="tabular text-lg font-semibold text-fg">{money(deal.value)}</span>
            {entity && (
              <Link href={`/contatos/${entity.id}`} className="flex items-center gap-1 hover:text-brand">
                <Building2 className="size-4" /> {entity.name}
              </Link>
            )}
            {owner && (
              <span className="flex items-center gap-1">
                <UserRound className="size-4" /> {owner.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOpen ? (
            <>
              <ActionButton action={winDeal.bind(null, deal.id)} variant="primary" size="md">
                <Trophy className="size-4" /> Ganhar
              </ActionButton>
              <Modal title="Marcar como perdida" triggerVariant="danger" trigger={<><XCircle className="size-4" /> Perder</>}>
                <ActionForm action={loseDeal.bind(null, deal.id)} className="space-y-4">
                  <Field label="Motivo da perda" htmlFor="loss_reason_id">
                    <Select id="loss_reason_id" name="loss_reason_id" required defaultValue="">
                      <option value="" disabled>
                        Selecione…
                      </option>
                      {lossReasons.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Observação" htmlFor="loss_note">
                    <Textarea id="loss_note" name="loss_note" maxLength={2000} />
                  </Field>
                  <FormActions>
                    <SubmitButton variant="danger">Confirmar perda</SubmitButton>
                  </FormActions>
                </ActionForm>
              </Modal>
            </>
          ) : (
            <ActionButton action={reopenDeal.bind(null, deal.id)} size="md">
              <RotateCcw className="size-4" /> Reabrir
            </ActionButton>
          )}
          <Modal title="Editar oportunidade" wide trigger={<><Pencil className="size-4" /> Editar</>}>
            <DealForm
              action={updateDeal.bind(null, deal.id)}
              orgId={org.id}
              pipelines={pipelines}
              members={members}
              fields={fields}
              currentUserId={ctx.user.id}
              valueLocked={items.length > 0}
              values={{
                title: deal.title,
                value: Number(deal.value),
                stage_id: deal.stage_id,
                entity,
                contact_id: deal.contact_id,
                owner_id: deal.owner_id,
                expected_close: deal.expected_close,
                source: deal.source,
                custom: deal.custom,
              }}
            />
          </Modal>
          <ActionButton
            action={deleteDeal.bind(null, deal.id)}
            confirm="Excluir esta oportunidade? Itens, tarefas e propostas vinculadas também serão excluídos."
            variant="ghost"
            size="md"
            title="Excluir oportunidade"
          >
            <Trash2 className="size-4" />
          </ActionButton>
        </div>
      </div>

      {pipeline && (
        <div className="mb-6">
          <p className="mb-2 text-xs text-muted">{pipeline.name}</p>
          <ol className="flex overflow-x-auto rounded-lg border border-line bg-surface">
            {pipeline.stages.map((s, i) => {
              const reached = stage ? s.position <= stage.position : false;
              const current = s.id === deal.stage_id;
              return (
                <li key={s.id} className={cn("min-w-28 flex-1", i > 0 && "border-l border-line")}>
                  {isOpen && !current ? (
                    <ActionButton
                      action={moveDeal.bind(null, deal.id, s.id)}
                      variant="ghost"
                      className={cn("h-10 w-full rounded-none text-xs", reached && "bg-brand-soft/60 text-brand")}
                    >
                      {s.name}
                    </ActionButton>
                  ) : (
                    <span
                      aria-current={current ? "step" : undefined}
                      className={cn(
                        "flex h-10 items-center justify-center px-2 text-xs font-medium whitespace-nowrap",
                        current ? "bg-brand text-brand-fg" : reached ? "bg-brand-soft/60 text-brand" : "text-muted",
                      )}
                    >
                      {s.name}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {deal.status === "perdida" && (
        <div className="mb-6 rounded-lg border border-line bg-danger-soft px-4 py-3 text-sm text-danger">
          Perdida em {dateTime(deal.closed_at)} · Motivo: {(deal.loss_reason as { name: string } | null)?.name ?? "não informado"}
          {deal.loss_note && <p className="mt-1 text-fg">{deal.loss_note}</p>}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Produtos e serviços"
              action={
                <Modal title="Adicionar item" triggerSize="sm" trigger={<><Plus className="size-4" /> Item</>}>
                  <ActionForm action={addItem.bind(null, deal.id)} className="space-y-4">
                    <Field label="Produto do catálogo" htmlFor="product_id" hint="Ou deixe em branco e descreva o item abaixo.">
                      <Select id="product_id" name="product_id" defaultValue="">
                        <option value="">—</option>
                        {(productsRes.data ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {money(p.price)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Descrição" htmlFor="description">
                      <Input id="description" name="description" maxLength={300} />
                    </Field>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Quantidade" htmlFor="quantity">
                        <Input id="quantity" name="quantity" inputMode="decimal" defaultValue="1" required />
                      </Field>
                      <Field label="Preço unit." htmlFor="unit_price">
                        <Input id="unit_price" name="unit_price" inputMode="decimal" placeholder="do catálogo" />
                      </Field>
                      <Field label="Desconto %" htmlFor="discount_pct">
                        <Input id="discount_pct" name="discount_pct" inputMode="decimal" defaultValue="0" />
                      </Field>
                    </div>
                    <FormActions>
                      <SubmitButton>Adicionar</SubmitButton>
                    </FormActions>
                  </ActionForm>
                </Modal>
              }
            />
            {items.length === 0 ? (
              <EmptyState title="Nenhum item">Adicione produtos para calcular o valor automaticamente e gerar propostas.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right!">Qtd.</th>
                    <th className="text-right!">Unitário</th>
                    <th className="text-right!">Desc.</th>
                    <th className="text-right!">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.description}</td>
                      <td className="tabular text-right">{Number(i.quantity).toLocaleString("pt-BR")}</td>
                      <td className="tabular text-right">{money(i.unit_price)}</td>
                      <td className="tabular text-right">{Number(i.discount_pct)}%</td>
                      <td className="tabular text-right font-medium">
                        {money(Number(i.quantity) * Number(i.unit_price) * (1 - Number(i.discount_pct) / 100))}
                      </td>
                      <td>
                        <ActionButton action={removeItem.bind(null, i.id)} variant="ghost" title="Remover item">
                          <Trash2 className="size-3.5" />
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} className="text-right text-muted">
                      Total
                    </td>
                    <td className="tabular text-right font-semibold">{money(deal.value)}</td>
                    <td />
                  </tr>
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Propostas"
              action={
                <Modal title="Gerar proposta" triggerSize="sm" trigger={<><FileText className="size-4" /> Gerar proposta</>}>
                  <ActionForm action={createProposal.bind(null, deal.id)} className="space-y-4">
                    <p className="text-sm text-muted">
                      A proposta usa os itens atuais da oportunidade ({items.length || "valor total"}). Alterações posteriores
                      nos itens não mudam propostas já geradas.
                    </p>
                    <Field label="Título" htmlFor="p-title">
                      <Input id="p-title" name="title" defaultValue={`Proposta – ${deal.title}`} maxLength={200} />
                    </Field>
                    <Field label="Válida até" htmlFor="valid_until">
                      <Input id="valid_until" name="valid_until" type="date" />
                    </Field>
                    <Field label="Condições e observações" htmlFor="notes">
                      <Textarea id="notes" name="notes" rows={4} placeholder="Forma de pagamento, prazo de entrega…" />
                    </Field>
                    <FormActions>
                      <SubmitButton>Gerar</SubmitButton>
                    </FormActions>
                  </ActionForm>
                </Modal>
              }
            />
            {(proposalsRes.data ?? []).length === 0 ? (
              <EmptyState title="Nenhuma proposta gerada" />
            ) : (
              <ul className="divide-y divide-line">
                {proposalsRes.data!.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <Link href={`/propostas/${p.id}`} className="min-w-0 hover:text-brand">
                      <p className="truncate text-sm font-medium">
                        Nº {p.number} · {p.title}
                      </p>
                      <p className="text-xs text-muted">{date(p.created_at)}</p>
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="tabular text-sm">{money(p.total)}</span>
                      <Badge tone={proposalTone[p.status as keyof typeof proposalTone]}>{p.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Tarefas"
              action={<NewTaskButton members={members} currentUserId={ctx.user.id} dealId={deal.id} entityId={deal.entity_id} />}
            />
            {(tasksRes.data ?? []).length === 0 ? (
              <EmptyState title="Nenhuma tarefa">Planeje o próximo passo desta oportunidade.</EmptyState>
            ) : (
              <TaskList tasks={tasksRes.data as TaskRow[]} members={members} currentUserId={ctx.user.id} showContext={false} />
            )}
          </Card>

          <Card>
            <CardHeader title="Histórico" />
            <div className="p-4">
              <Timeline
                events={(eventsRes.data ?? []) as TimelineEvent[]}
                members={members}
                currentUserId={ctx.user.id}
                noteTarget={{ dealId: deal.id, entityId: deal.entity_id }}
              />
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Detalhes" />
            <dl className="grid grid-cols-2 gap-4 p-4">
              <div>
                <dt className="text-xs text-muted">Etapa</dt>
                <dd className="mt-0.5 text-sm">{stage?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Probabilidade</dt>
                <dd className="tabular mt-0.5 text-sm">{stage?.probability ?? 0}%</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Previsão</dt>
                <dd className="tabular mt-0.5 text-sm">{date(deal.expected_close)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Origem</dt>
                <dd className="mt-0.5 text-sm">{deal.source ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Criada em</dt>
                <dd className="tabular mt-0.5 text-sm">{date(deal.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Fechamento</dt>
                <dd className="tabular mt-0.5 text-sm">{date(deal.closed_at)}</dd>
              </div>
              <CustomFieldValues fields={fields} values={deal.custom} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Contato" />
            {contact ? (
              <div className="space-y-1 p-4 text-sm">
                <p className="font-medium">{contact.name}</p>
                {contact.job_title && <p className="text-muted">{contact.job_title}</p>}
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="block text-brand hover:underline">
                    {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="block text-muted hover:text-fg">
                    {contact.phone}
                  </a>
                )}
              </div>
            ) : (
              <p className="p-4 text-sm text-muted">Nenhum contato vinculado.</p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
