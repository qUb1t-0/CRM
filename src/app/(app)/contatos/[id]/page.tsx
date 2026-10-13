import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Globe, Mail, MapPin, Pencil, Phone, Plus, Trash2, User } from "lucide-react";
import { ActionButton, ActionForm, FormActions, Modal, SubmitButton } from "@/components/forms";
import { CustomFieldValues } from "@/components/custom-fields";
import { NewTaskButton, TaskList, type TaskRow } from "@/components/tasks";
import { Timeline, type TimelineEvent } from "@/components/timeline";
import { Badge, Card, CardHeader, EmptyState, Field, Input } from "@/components/ui";
import { getContext, getCustomFields, getMembers, getPipelines } from "@/lib/session";
import { dateTime, documentMask, money } from "@/lib/format";
import { deleteContact, deleteEntity, saveContact, updateEntity } from "../actions";
import { EntityForm } from "../entity-form";
import { createDeal } from "../../oportunidades/actions";
import { DealForm } from "../../oportunidades/deal-form";

export const metadata: Metadata = { title: "Contato" };

type Contact = { id: string; name: string; job_title: string | null; email: string | null; phone: string | null };

function ContactForm({ entityId, contact }: { entityId: string; contact?: Contact }) {
  return (
    <ActionForm action={saveContact.bind(null, entityId, contact?.id ?? null)} className="space-y-4">
      <Field label="Nome" htmlFor="c-name">
        <Input id="c-name" name="name" required defaultValue={contact?.name} />
      </Field>
      <Field label="Cargo" htmlFor="c-job">
        <Input id="c-job" name="job_title" defaultValue={contact?.job_title ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-mail" htmlFor="c-email">
          <Input id="c-email" name="email" type="email" defaultValue={contact?.email ?? ""} />
        </Field>
        <Field label="Telefone" htmlFor="c-phone">
          <Input id="c-phone" name="phone" type="tel" defaultValue={contact?.phone ?? ""} />
        </Field>
      </div>
      <FormActions>
        <SubmitButton>{contact ? "Salvar" : "Adicionar"}</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

const statusTone = { aberta: "info", ganha: "ok", perdida: "danger" } as const;

export default async function EntityPage({ params }: PageProps<"/contatos/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  const { supabase, org } = ctx;

  const { data: entity } = await supabase.from("entities").select("*").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!entity) notFound();

  const [members, fields, dealFields, pipelines, contactsRes, dealsRes, tasksRes, eventsRes, apptRes] = await Promise.all([
    getMembers(),
    getCustomFields("entidade"),
    getCustomFields("oportunidade"),
    getPipelines(),
    supabase.from("contacts").select("id, name, job_title, email, phone").eq("entity_id", id).order("name"),
    supabase.from("deals").select("id, title, value, status, stage:stages(name)").eq("entity_id", id).order("created_at", { ascending: false }),
    supabase.from("tasks").select("*, deal:deals(id, title)").eq("entity_id", id).order("done").order("due_at", { nullsFirst: false }),
    supabase.from("timeline_events").select("*").eq("entity_id", id).order("created_at", { ascending: false }).limit(100),
    supabase
      .from("appointments")
      .select("id, title, starts_at, location")
      .eq("entity_id", id)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(5),
  ]);

  const contacts = (contactsRes.data ?? []) as Contact[];
  const owner = members.find((m) => m.id === entity.owner_id);
  const Icon = entity.kind === "pessoa" ? User : Building2;

  return (
    <>
      <Link href="/contatos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Contatos
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Icon className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{entity.name}</h1>
            <p className="mt-0.5 text-sm text-muted">
              {entity.kind === "pessoa" ? "Pessoa" : "Empresa"}
              {entity.document && ` · ${documentMask(entity.document)}`}
              {owner && ` · Responsável: ${owner.name}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {pipelines.length > 0 && (
            <Modal title="Nova oportunidade" wide triggerVariant="primary" trigger={<><Plus className="size-4" /> Oportunidade</>}>
              <DealForm
                action={createDeal}
                orgId={org.id}
                pipelines={pipelines}
                members={members}
                fields={dealFields}
                currentUserId={ctx.user.id}
                values={{ entity: { id: entity.id, name: entity.name, kind: entity.kind }, stage_id: pipelines[0].stages[0]?.id }}
                openAfterCreate
                submitLabel="Criar oportunidade"
              />
            </Modal>
          )}
          <Modal title="Editar cadastro" wide trigger={<><Pencil className="size-4" /> Editar</>}>
            <EntityForm action={updateEntity.bind(null, entity.id)} members={members} fields={fields} currentUserId={ctx.user.id} values={entity} />
          </Modal>
          <ActionButton
            action={deleteEntity.bind(null, entity.id)}
            confirm="Excluir este cadastro? Contatos, tarefas e o histórico vinculados também serão excluídos."
            variant="ghost"
            size="md"
            title="Excluir cadastro"
          >
            <Trash2 className="size-4" />
          </ActionButton>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Informações" />
            <div className="space-y-2.5 p-4 text-sm">
              {entity.email && (
                <a href={`mailto:${entity.email}`} className="flex items-center gap-2 text-brand hover:underline">
                  <Mail className="size-4 text-muted" /> {entity.email}
                </a>
              )}
              {entity.phone && (
                <a href={`tel:${entity.phone}`} className="flex items-center gap-2 hover:text-brand">
                  <Phone className="size-4 text-muted" /> {entity.phone}
                </a>
              )}
              {entity.website && (
                <a
                  href={/^https?:\/\//.test(entity.website) ? entity.website : `https://${entity.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-brand"
                >
                  <Globe className="size-4 text-muted" /> {entity.website}
                </a>
              )}
              {(entity.city || entity.state) && (
                <p className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted" /> {[entity.city, entity.state].filter(Boolean).join(" / ")}
                </p>
              )}
              {entity.segment && <Badge>{entity.segment}</Badge>}
              {!entity.email && !entity.phone && !entity.website && !entity.city && (
                <p className="text-muted">Sem dados de contato.</p>
              )}
            </div>
            {fields.length > 0 && (
              <dl className="grid grid-cols-2 gap-4 border-t border-line p-4">
                <CustomFieldValues fields={fields} values={entity.custom} />
              </dl>
            )}
            {entity.notes && <p className="border-t border-line p-4 text-sm whitespace-pre-wrap text-muted">{entity.notes}</p>}
          </Card>

          <Card>
            <CardHeader
              title={`Pessoas de contato (${contacts.length})`}
              action={
                <Modal title="Novo contato" triggerSize="sm" trigger={<Plus className="size-4" />}>
                  <ContactForm entityId={entity.id} />
                </Modal>
              }
            />
            {contacts.length === 0 ? (
              <p className="p-4 text-sm text-muted">Nenhuma pessoa de contato.</p>
            ) : (
              <ul className="divide-y divide-line">
                {contacts.map((c) => (
                  <li key={c.id} className="group flex items-start justify-between gap-2 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{c.name}</p>
                      {c.job_title && <p className="text-xs text-muted">{c.job_title}</p>}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="block truncate text-xs text-brand hover:underline">
                          {c.email}
                        </a>
                      )}
                      {c.phone && <p className="text-xs text-muted">{c.phone}</p>}
                    </div>
                    <div className="flex shrink-0">
                      <Modal title="Editar contato" triggerVariant="ghost" triggerSize="sm" trigger={<Pencil className="size-3.5" />}>
                        <ContactForm entityId={entity.id} contact={c} />
                      </Modal>
                      <ActionButton action={deleteContact.bind(null, c.id)} confirm={`Remover ${c.name}?`} variant="ghost" title="Remover contato">
                        <Trash2 className="size-3.5" />
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {(apptRes.data ?? []).length > 0 && (
            <Card>
              <CardHeader title="Próximos compromissos" action={<Link href="/agenda" className="text-xs text-brand hover:underline">Agenda</Link>} />
              <ul className="divide-y divide-line">
                {apptRes.data!.map((a) => (
                  <li key={a.id} className="px-4 py-2.5 text-sm">
                    <p className="font-medium">{a.title}</p>
                    <p className="tabular text-xs text-muted">
                      {dateTime(a.starts_at)}
                      {a.location && ` · ${a.location}`}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Oportunidades" />
            {(dealsRes.data ?? []).length === 0 ? (
              <EmptyState title="Nenhuma oportunidade" />
            ) : (
              <ul className="divide-y divide-line">
                {dealsRes.data!.map((d) => (
                  <li key={d.id}>
                    <Link href={`/oportunidades/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2/60">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.title}</p>
                        <p className="text-xs text-muted">{(d.stage as unknown as { name: string } | null)?.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular text-sm">{money(d.value)}</span>
                        <Badge tone={statusTone[d.status as keyof typeof statusTone]}>
                          {d.status === "aberta" ? "Em aberto" : d.status === "ganha" ? "Ganha" : "Perdida"}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Tarefas" action={<NewTaskButton members={members} currentUserId={ctx.user.id} entityId={entity.id} />} />
            {(tasksRes.data ?? []).length === 0 ? (
              <EmptyState title="Nenhuma tarefa" />
            ) : (
              <TaskList tasks={tasksRes.data as TaskRow[]} members={members} currentUserId={ctx.user.id} />
            )}
          </Card>

          <Card>
            <CardHeader title="Histórico" />
            <div className="p-4">
              <Timeline
                events={(eventsRes.data ?? []) as TimelineEvent[]}
                members={members}
                currentUserId={ctx.user.id}
                showLinks
                noteTarget={{ entityId: entity.id }}
              />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
