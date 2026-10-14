import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileText,
  Globe,
  IdCard,
  Lock,
  Mail,
  MapPin,
  MessageSquareText,
  Pencil,
  Phone,
  Plus,
  Tag,
  Trash2,
  UserCog,
  UserPen,
  Users,
} from "lucide-react";
import { ActionButton, ActionForm, FormActions, Modal, SubmitButton } from "@/components/forms";
import { AppointmentForm } from "@/components/appointment-form";
import { CustomFieldValues } from "@/components/custom-fields";
import { EntityFeed, type FeedEvent } from "@/components/entity-feed";
import { OwnerPicker } from "@/components/owner-picker";
import { EntityPhoto } from "@/components/entity-photo";
import { NewTaskButton, TaskList, type TaskRow } from "@/components/tasks";
import { Avatar, Badge, Card, EmptyState, Field, Input, cn } from "@/components/ui";
import { getContext, getCustomFields, getMembers, getPipelines } from "@/lib/session";
import { SALES_LOCKED } from "@/lib/features";
import { dateTime, documentMask, money, date } from "@/lib/format";
import { onlyDigits } from "@/lib/br";
import { dealStatusLabel, dealStatusTone, proposalTone } from "@/lib/labels";
import { deleteContact, deleteEntity, saveContact, updateEntity } from "../actions";
import { EntityForm } from "../entity-form";
import { createDeal } from "../../oportunidades/actions";
import { DealForm } from "../../oportunidades/deal-form";
import { createAppointment, deleteAppointment } from "../../agenda/actions";

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

/** Linha de informação do painel lateral (ícone, rótulo e valor). */
function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <span className="mt-0.5 text-muted [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{label}</p>
        <div className="mt-0.5 text-sm font-medium break-words">{children}</div>
      </div>
    </div>
  );
}

function LockedTab({ name }: { name: string }) {
  return (
    <EmptyState icon={<Lock />} title={`${name} bloqueado por enquanto`}>
      A seção Vendas ainda não foi liberada. Quando for, as {name.toLowerCase()} deste cliente aparecerão aqui.
    </EmptyState>
  );
}

const TABS = [
  { key: "feedback", label: "Feedbacks", icon: MessageSquareText },
  { key: "pessoas", label: "Pessoas de contato", icon: Users },
  { key: "oportunidades", label: "Oportunidades", icon: CircleDollarSign },
  { key: "tarefas", label: "Tarefas", icon: CheckSquare },
  { key: "compromissos", label: "Compromissos", icon: CalendarDays },
  { key: "propostas", label: "Propostas", icon: ClipboardList },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function EntityPage({ params, searchParams }: PageProps<"/contatos/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === sp.aba) ? (sp.aba as TabKey) : "feedback";
  const ctx = await getContext();
  const { supabase, org } = ctx;

  const { data: entity } = await supabase.from("entities").select("*").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!entity) notFound();

  const [members, fields, dealFields, pipelines, contactsRes, dealsRes, tasksRes, eventsRes, apptRes, propRes] = await Promise.all([
    getMembers(),
    getCustomFields("entidade"),
    getCustomFields("oportunidade"),
    getPipelines(),
    supabase.from("contacts").select("id, name, job_title, email, phone").eq("entity_id", id).order("name"),
    SALES_LOCKED
      ? Promise.resolve({ data: [] as { id: string; title: string; value: number; status: string; owner_id: string | null; expected_close: string | null; stage: unknown }[] })
      : supabase.from("deals").select("id, title, value, status, owner_id, expected_close, stage:stages(name)").eq("entity_id", id).order("created_at", { ascending: false }),
    supabase.from("tasks").select("*, deal:deals(id, title)").eq("entity_id", id).order("done").order("due_at", { nullsFirst: false }),
    supabase.from("timeline_events").select("id, kind, payload, actor_id, created_at").eq("entity_id", id).order("created_at", { ascending: false }).limit(300),
    supabase.from("appointments").select("id, title, starts_at, ends_at, location, owner_id").eq("entity_id", id).order("starts_at", { ascending: false }).limit(100),
    SALES_LOCKED
      ? Promise.resolve({ data: [] as { id: string; number: number; title: string; status: string; total: number; created_at: string; created_by: string | null; deal: unknown }[] })
      : supabase
          .from("proposals")
          .select("id, number, title, status, total, created_at, created_by, deal:deals!inner(id, title, entity_id)")
          .eq("org_id", org.id)
          .eq("deal.entity_id", id)
          .order("number", { ascending: false }),
  ]);

  const contacts = (contactsRes.data ?? []) as Contact[];
  const deals = dealsRes.data ?? [];
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const appts = apptRes.data ?? [];
  const proposals = propRes.data ?? [];
  // O feed mostra do mais antigo para o mais recente (estilo chat)
  const events = ((eventsRes.data ?? []) as FeedEvent[]).slice().reverse();
  const people = members.map((m) => ({ id: m.id, name: m.name, email: m.email, avatarUrl: m.avatarUrl ?? null }));
  const avatarOf = (uid: string | null) => members.find((m) => m.id === uid)?.avatarUrl ?? null;
  const nameOf = (uid: string | null) => members.find((m) => m.id === uid)?.name ?? "—";
  const isPerson = entity.kind === "pessoa";
  const phoneDigits = onlyDigits(entity.phone);
  const now = Date.parse(new Date().toISOString());

  const counts: Record<TabKey, number | null> = {
    feedback: events.length,
    pessoas: contacts.length,
    oportunidades: SALES_LOCKED ? null : deals.length,
    tarefas: tasks.filter((t) => !t.done).length,
    compromissos: appts.length,
    propostas: SALES_LOCKED ? null : proposals.length,
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link href="/contatos" className="inline-flex items-center gap-1 text-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Contatos
        </Link>
        <span className="text-muted">/</span>
        <span className="truncate font-medium">{entity.name}</span>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[340px_1fr]">
        {/* ---------- Painel do cliente ---------- */}
        <Card className="lg:sticky lg:top-20">
          <div className="flex flex-col items-center border-b border-line px-5 pt-6 pb-5 text-center">
            <EntityPhoto orgId={org.id} entityId={entity.id} name={entity.name} kind={entity.kind} url={entity.avatar_url ?? null} />
            <h1 className="mt-3 text-lg leading-snug font-semibold text-balance">{entity.name}</h1>
            <Badge className="mt-2 tracking-wide uppercase">{isPerson ? "Pessoa física" : "Empresa"}</Badge>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Modal title="Editar cadastro" wide triggerLabel="Editar cadastro" triggerSize="sm" trigger={<Pencil className="size-4" />}>
                <EntityForm
                  action={updateEntity.bind(null, entity.id)}
                  members={members}
                  fields={fields}
                  currentUserId={ctx.user.id}
                  values={entity}
                  ownerLocked={!ctx.isAdmin}
                />
              </Modal>
              <NewTaskButton members={members} currentUserId={ctx.user.id} entityId={entity.id} />
              <Modal title="Novo compromisso" wide triggerLabel="Agendar compromisso" triggerSize="sm" trigger={<CalendarPlus className="size-4" />}>
                <AppointmentForm
                  action={createAppointment}
                  orgId={org.id}
                  members={members}
                  currentUserId={ctx.user.id}
                  fixedEntity={{ id: entity.id, name: entity.name, kind: entity.kind }}
                />
              </Modal>
              <ActionButton
                action={deleteEntity.bind(null, entity.id)}
                confirm="Mover este cadastro para a lixeira? Ele some das listas, mas pode ser recuperado (com todos os vínculos) em Configurações › Lixeira por até 60 dias."
                confirmLabel="Mover para a lixeira"
                variant="ghost"
                size="sm"
                title="Mover para a lixeira"
              >
                <Trash2 className="size-4" />
              </ActionButton>
            </div>
          </div>

          <div className="divide-y divide-line px-5">
            <InfoRow icon={<UserCog />} label={ctx.isAdmin ? "Responsável · clique para alterar" : "Responsável"}>
              <OwnerPicker
                entityId={entity.id}
                ownerId={entity.owner_id}
                currentUserId={ctx.user.id}
                canEdit={ctx.isAdmin}
                openTasks={tasks.filter((t) => !t.done && t.assignee_id === entity.owner_id).length}
                people={members.map((m) => ({ id: m.id, name: m.name, email: m.email, avatarUrl: m.avatarUrl ?? null, jobTitle: m.jobTitle ?? null }))}
              />
            </InfoRow>
            <InfoRow icon={<UserPen />} label="Autor">
              <span className="inline-flex items-center gap-2">
                <Avatar size="sm" name={nameOf(entity.created_by)} src={avatarOf(entity.created_by)} /> {nameOf(entity.created_by)}
              </span>
            </InfoRow>
            <InfoRow icon={<Mail />} label="E-mail">
              {entity.email ? (
                <a href={`mailto:${entity.email}`} className="text-brand hover:underline">
                  {entity.email}
                </a>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow icon={<Phone />} label="Telefone">
              {entity.phone ? (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <a href={`tel:+55${phoneDigits}`} className="text-brand hover:underline">
                    {entity.phone}
                  </a>
                  {phoneDigits.length >= 10 && (
                    <a
                      href={`https://wa.me/55${phoneDigits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok hover:brightness-95"
                    >
                      WhatsApp
                    </a>
                  )}
                </span>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow icon={<IdCard />} label={isPerson ? "CPF" : "CNPJ"}>
              <span className="tabular">{documentMask(entity.document)}</span>
            </InfoRow>
            <InfoRow icon={<MapPin />} label="Localização">
              {[entity.city, entity.state].filter(Boolean).join(" / ") || "—"}
            </InfoRow>
            <InfoRow icon={<Tag />} label="Segmento">
              {entity.segment ?? "—"}
            </InfoRow>
            {entity.website && (
              <InfoRow icon={<Globe />} label="Site">
                <a
                  href={/^https?:\/\//.test(entity.website) ? entity.website : `https://${entity.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:underline"
                >
                  {entity.website}
                </a>
              </InfoRow>
            )}
            <InfoRow icon={<Clock />} label="Criado em · Atualizado em">
              <span className="tabular text-[13px] font-normal">
                {dateTime(entity.created_at)} · {dateTime(entity.updated_at)}
              </span>
            </InfoRow>
            {fields.length > 0 && (
              <dl className="grid grid-cols-2 gap-3 py-3">
                <CustomFieldValues fields={fields} values={entity.custom} />
              </dl>
            )}
            {entity.notes && (
              <div className="py-3">
                <p className="text-xs text-muted">Observações</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{entity.notes}</p>
              </div>
            )}
          </div>
        </Card>

        {/* ---------- Abas ---------- */}
        <Card className="min-w-0 overflow-hidden">
          <nav className="flex overflow-x-auto border-b border-line px-2" aria-label="Seções do cliente">
            {TABS.map(({ key, label, icon: TabIcon }) => {
              const active = tab === key;
              const locked = SALES_LOCKED && (key === "oportunidades" || key === "propostas");
              const count = counts[key];
              return (
                <Link
                  key={key}
                  href={`/contatos/${entity.id}${key === "feedback" ? "" : `?aba=${key}`}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  title={label}
                  className={cn(
                    "relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm transition-colors",
                    active ? "font-medium text-brand" : "text-muted hover:text-fg",
                  )}
                >
                  <TabIcon className="size-[18px]" />
                  <span className={cn(!active && "hidden xl:inline")}>{label}</span>
                  {locked ? (
                    <Lock className="size-3" />
                  ) : (
                    count !== null &&
                    count > 0 && (
                      <span className={cn("tabular rounded-full px-1.5 text-[11px] leading-4", active ? "bg-brand text-brand-fg" : "bg-surface-2 text-muted")}>
                        {count}
                      </span>
                    )
                  )}
                  {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" aria-hidden />}
                </Link>
              );
            })}
          </nav>

          {tab === "feedback" && <EntityFeed events={events} people={people} currentUserId={ctx.user.id} entityId={entity.id} />}

          {tab === "pessoas" && (
            <div>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-sm font-semibold">Pessoas de contato</h2>
                <Modal title="Nova pessoa de contato" triggerSize="sm" trigger={<><Plus className="size-4" /> Adicionar</>}>
                  <ContactForm entityId={entity.id} />
                </Modal>
              </div>
              {contacts.length === 0 ? (
                <EmptyState icon={<Users />} title="Nenhuma pessoa de contato">
                  Cadastre quem você fala nesta {isPerson ? "conta" : "empresa"}.
                </EmptyState>
              ) : (
                <ul className="divide-y divide-line">
                  {contacts.map((c) => (
                    <li key={c.id} className="group flex items-center gap-3 px-4 py-3">
                      <Avatar name={c.name} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="truncate text-xs text-muted">
                          {[c.job_title, c.email, c.phone].filter(Boolean).join(" · ") || "Sem dados de contato"}
                        </p>
                      </div>
                      <div className="flex shrink-0">
                        <Modal title="Editar pessoa de contato" triggerLabel="Editar" triggerVariant="ghost" triggerSize="sm" trigger={<Pencil className="size-3.5" />}>
                          <ContactForm entityId={entity.id} contact={c} />
                        </Modal>
                        <ActionButton action={deleteContact.bind(null, c.id)} confirm={`Remover ${c.name}?`} variant="ghost" title="Remover">
                          <Trash2 className="size-3.5" />
                        </ActionButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "oportunidades" &&
            (SALES_LOCKED ? (
              <LockedTab name="Oportunidades" />
            ) : (
              <div>
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <h2 className="text-sm font-semibold">Oportunidades</h2>
                  {pipelines.length > 0 && (
                    <Modal title="Nova oportunidade" wide triggerSize="sm" trigger={<><Plus className="size-4" /> Nova</>}>
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
                </div>
                {deals.length === 0 ? (
                  <EmptyState icon={<CircleDollarSign />} title="Nenhuma oportunidade" />
                ) : (
                  <ul className="divide-y divide-line">
                    {deals.map((d) => (
                      <li key={d.id}>
                        <Link href={`/oportunidades/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2/60">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{d.title}</p>
                            <p className="text-xs text-muted">
                              {(d.stage as { name: string } | null)?.name} · {nameOf(d.owner_id)}
                              {d.expected_close && ` · previsão ${date(d.expected_close)}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="tabular text-sm">{money(d.value)}</span>
                            <Badge tone={dealStatusTone[d.status as keyof typeof dealStatusTone]}>{dealStatusLabel[d.status as keyof typeof dealStatusLabel]}</Badge>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

          {tab === "tarefas" && (
            <div>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-sm font-semibold">Tarefas</h2>
                <NewTaskButton members={members} currentUserId={ctx.user.id} entityId={entity.id} />
              </div>
              {tasks.length === 0 ? (
                <EmptyState icon={<CheckSquare />} title="Nenhuma tarefa">
                  Planeje o próximo passo com este cliente.
                </EmptyState>
              ) : (
                <TaskList tasks={tasks} members={members} currentUserId={ctx.user.id} />
              )}
            </div>
          )}

          {tab === "compromissos" && (
            <div>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-sm font-semibold">Compromissos</h2>
                <Modal title="Novo compromisso" wide triggerSize="sm" trigger={<><Plus className="size-4" /> Agendar</>}>
                  <AppointmentForm
                    action={createAppointment}
                    orgId={org.id}
                    members={members}
                    currentUserId={ctx.user.id}
                    fixedEntity={{ id: entity.id, name: entity.name, kind: entity.kind }}
                  />
                </Modal>
              </div>
              {appts.length === 0 ? (
                <EmptyState icon={<CalendarDays />} title="Nenhum compromisso" />
              ) : (
                <ul className="divide-y divide-line">
                  {appts.map((a) => {
                    const past = Date.parse(a.ends_at) < now;
                    return (
                      <li key={a.id} className={cn("flex items-center gap-3 px-4 py-3", past && "opacity-60")}>
                        <span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-soft text-brand">
                          <CalendarDays className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-muted">
                            {dateTime(a.starts_at)} · {nameOf(a.owner_id)}
                            {a.location && ` · ${a.location}`}
                          </p>
                        </div>
                        {past && <Badge>Realizado</Badge>}
                        <ActionButton action={deleteAppointment.bind(null, a.id)} confirm="Excluir este compromisso?" variant="ghost" title="Excluir compromisso">
                          <Trash2 className="size-3.5" />
                        </ActionButton>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === "propostas" &&
            (SALES_LOCKED ? (
              <LockedTab name="Propostas" />
            ) : (
              <div>
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <h2 className="text-sm font-semibold">Propostas</h2>
                  <span className="text-xs text-muted">Gere propostas a partir de uma oportunidade</span>
                </div>
                {proposals.length === 0 ? (
                  <EmptyState icon={<FileText />} title="Nenhuma proposta" />
                ) : (
                  <ul className="divide-y divide-line">
                    {proposals.map((p) => (
                      <li key={p.id}>
                        <Link href={`/propostas/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2/60">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              Nº {p.number} · {p.title}
                            </p>
                            <p className="text-xs text-muted">
                              {(p.deal as { title: string } | null)?.title} · gerada por {nameOf(p.created_by)} em {date(p.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="tabular text-sm">{money(p.total)}</span>
                            <Badge tone={proposalTone[p.status as keyof typeof proposalTone]} className="capitalize">
                              {p.status}
                            </Badge>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
        </Card>
      </div>
    </>
  );
}
