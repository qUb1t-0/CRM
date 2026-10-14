import { EntityPicker } from "@/components/entity-picker";
import { ActionForm, FormActions, SubmitButton } from "@/components/forms";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { toLocalInput } from "@/lib/format";
import type { ActionState, Member } from "@/lib/types";

export type Appt = {
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

/** Formulário de compromisso (Agenda e perfil do cliente). */
export function AppointmentForm({
  action,
  orgId,
  members,
  currentUserId,
  appt,
  defaultStart,
  fixedEntity,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  orgId: string;
  members: Member[];
  currentUserId: string;
  appt?: Appt;
  defaultStart?: string;
  /** Quando aberto a partir do perfil do cliente, já vem vinculado a ele. */
  fixedEntity?: { id: string; name: string; kind?: "empresa" | "pessoa" };
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
        <EntityPicker orgId={orgId} defaultValue={appt?.entity ?? fixedEntity} />
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
