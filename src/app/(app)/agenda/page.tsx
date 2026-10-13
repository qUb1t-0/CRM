import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { EntityPicker } from "@/components/entity-picker";
import { ActionButton, ActionForm, FormActions, Modal, SubmitButton } from "@/components/forms";
import { Card, CardHeader, EmptyState, Field, Input, LinkButton, PageHeader, Select, Textarea, cn } from "@/components/ui";
import { getContext, getMembers } from "@/lib/session";
import { addDays, dayStart, monthLabel, monthStartISO, time, toLocalInput, todayISO, zonedParts } from "@/lib/format";
import type { ActionState, Member } from "@/lib/types";
import { createAppointment, deleteAppointment, updateAppointment } from "./actions";

export const metadata: Metadata = { title: "Agenda" };

type Appt = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  owner_id: string | null;
  entity_id: string | null;
  entity: { id: string; name: string; kind: "empresa" | "pessoa" } | null;
};

function AppointmentForm({
  action,
  orgId,
  members,
  currentUserId,
  appt,
  defaultStart,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  orgId: string;
  members: Member[];
  currentUserId: string;
  appt?: Appt;
  defaultStart?: string;
}) {
  return (
    <ActionForm action={action} className="space-y-4">
      <Field label="Título" htmlFor="a-title">
        <Input id="a-title" name="title" required defaultValue={appt?.title} placeholder="Ex.: Reunião de apresentação" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Início" htmlFor="a-start">
          <Input id="a-start" name="starts_at" type="datetime-local" required defaultValue={appt ? toLocalInput(appt.starts_at) : defaultStart} />
        </Field>
        <Field label="Término" htmlFor="a-end" hint="Padrão: 1 hora após o início.">
          <Input id="a-end" name="ends_at" type="datetime-local" defaultValue={toLocalInput(appt?.ends_at)} />
        </Field>
        <Field label="Local ou link" htmlFor="a-loc">
          <Input id="a-loc" name="location" defaultValue={appt?.location ?? ""} />
        </Field>
        <Field label="Responsável" htmlFor="a-owner">
          <Select id="a-owner" name="owner_id" defaultValue={appt?.owner_id ?? currentUserId}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Empresa ou pessoa">
        <EntityPicker orgId={orgId} defaultValue={appt?.entity} />
      </Field>
      <Field label="Descrição" htmlFor="a-desc">
        <Textarea id="a-desc" name="description" defaultValue={appt?.description ?? ""} />
      </Field>
      <FormActions>
        <SubmitButton>Salvar</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const sp = await searchParams;
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? `${sp.mes}-01` : monthStartISO();
  const resp = typeof sp.resp === "string" ? sp.resp : "todos";
  const ctx = await getContext();
  const members = await getMembers();

  // Grade do mês: começa no domingo da primeira semana
  const firstWeekday = new Date(`${mes}T12:00:00Z`).getUTCDay();
  const gridStart = addDays(mes, -firstWeekday);
  const nextMonth = monthStartISO(1, mes);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  let query = ctx.supabase
    .from("appointments")
    .select("*, entity:entities(id, name, kind)")
    .eq("org_id", ctx.org.id)
    .gte("starts_at", dayStart(gridStart))
    .lt("starts_at", dayStart(addDays(gridStart, 42)))
    .order("starts_at");
  if (resp === "meus") query = query.eq("owner_id", ctx.user.id);
  const { data } = await query;
  const appts = (data ?? []) as Appt[];

  const byDay = new Map<string, Appt[]>();
  for (const a of appts) {
    const p = zonedParts(new Date(a.starts_at));
    const key = `${p.year}-${p.month}-${p.day}`;
    byDay.set(key, [...(byDay.get(key) ?? []), a]);
  }
  const today = todayISO();
  const selected = typeof sp.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : today;
  const dayAppts = byDay.get(selected) ?? [];
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name ?? "—";
  const nav = (m: string, dia?: string) => `/agenda?mes=${m.slice(0, 7)}&resp=${resp}${dia ? `&dia=${dia}` : ""}`;

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Reuniões, visitas e compromissos da equipe."
        actions={
          <Modal title="Novo compromisso" triggerVariant="primary" wide trigger={<><Plus className="size-4" /> Novo compromisso</>}>
            <AppointmentForm
              action={createAppointment}
              orgId={ctx.org.id}
              members={members}
              currentUserId={ctx.user.id}
              defaultStart={`${selected}T09:00`}
            />
          </Modal>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-1">
              <LinkButton href={nav(monthStartISO(-1, mes))} variant="ghost" size="sm" aria-label="Mês anterior">
                <ChevronLeft className="size-4" />
              </LinkButton>
              <h2 className="min-w-36 text-center text-sm font-semibold">{monthLabel(mes, true)}</h2>
              <LinkButton href={nav(nextMonth)} variant="ghost" size="sm" aria-label="Próximo mês">
                <ChevronRight className="size-4" />
              </LinkButton>
            </div>
            <div className="flex items-center gap-2">
              <LinkButton href={nav(monthStartISO(), today)} size="sm">
                Hoje
              </LinkButton>
              <div className="inline-flex rounded-md border border-line p-0.5 text-[13px]">
                {[
                  ["todos", "Equipe"],
                  ["meus", "Meus"],
                ].map(([key, label]) => (
                  <Link
                    key={key}
                    href={`/agenda?mes=${mes.slice(0, 7)}&resp=${key}&dia=${selected}`}
                    className={cn("rounded px-2 py-1", resp === key ? "bg-surface-2 font-medium" : "text-muted")}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-line text-center text-xs text-muted">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const items = byDay.get(d) ?? [];
              const inMonth = d.slice(0, 7) === mes.slice(0, 7);
              return (
                <Link
                  key={d}
                  href={nav(mes, d)}
                  className={cn(
                    "min-h-20 border-line p-1.5 text-left transition-colors hover:bg-surface-2/70 sm:min-h-24",
                    i % 7 !== 0 && "border-l",
                    i >= 7 && "border-t",
                    !inMonth && "bg-surface-2/40 text-muted",
                    d === selected && "ring-2 ring-brand ring-inset",
                  )}
                >
                  <span
                    className={cn(
                      "tabular inline-flex size-6 items-center justify-center rounded-full text-xs",
                      d === today && "bg-brand font-semibold text-brand-fg",
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  <div className="mt-1 hidden space-y-0.5 sm:block">
                    {items.slice(0, 3).map((a) => (
                      <p key={a.id} className="truncate rounded bg-brand-soft px-1 py-0.5 text-[11px] text-brand">
                        {time(a.starts_at)} {a.title}
                      </p>
                    ))}
                    {items.length > 3 && <p className="px-1 text-[11px] text-muted">+{items.length - 3}</p>}
                  </div>
                  {items.length > 0 && <span className="mt-1 block size-1.5 rounded-full bg-brand sm:hidden" />}
                </Link>
              );
            })}
          </div>
        </Card>

        <Card className="self-start">
          <CardHeader title={new Date(`${selected}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} />
          {dayAppts.length === 0 ? (
            <EmptyState title="Nenhum compromisso neste dia" />
          ) : (
            <ul className="divide-y divide-line">
              {dayAppts.map((a) => (
                <li key={a.id} className="group px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="tabular text-xs font-medium text-brand">
                        {time(a.starts_at)} – {time(a.ends_at)}
                      </p>
                      <p className="mt-0.5 text-sm font-medium">{a.title}</p>
                      {a.entity && (
                        <Link href={`/contatos/${a.entity.id}`} className="text-xs text-muted hover:text-brand">
                          {a.entity.name}
                        </Link>
                      )}
                      {a.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                          <MapPin className="size-3" /> {a.location}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-muted">{memberName(a.owner_id)}</p>
                    </div>
                    <div className="flex shrink-0">
                      <Modal title="Editar compromisso" wide triggerVariant="ghost" triggerSize="sm" trigger={<Pencil className="size-3.5" />}>
                        <AppointmentForm
                          action={updateAppointment.bind(null, a.id)}
                          orgId={ctx.org.id}
                          members={members}
                          currentUserId={ctx.user.id}
                          appt={a}
                        />
                      </Modal>
                      <ActionButton action={deleteAppointment.bind(null, a.id)} confirm="Excluir este compromisso?" variant="ghost" title="Excluir">
                        <Trash2 className="size-3.5" />
                      </ActionButton>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
