import { CustomFieldInputs } from "@/components/custom-fields";
import { ActionForm, FormActions, SubmitButton } from "@/components/forms";
import { EntityFields } from "@/components/entity-fields";
import { Field, Select, Textarea } from "@/components/ui";
import type { ActionState, CustomField, Member } from "@/lib/types";

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

export type EntityValues = {
  kind?: "empresa" | "pessoa";
  name?: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  segment?: string | null;
  notes?: string | null;
  owner_id?: string | null;
  custom?: Record<string, unknown>;
};

export function EntityForm({
  action,
  members,
  fields,
  currentUserId,
  values = {},
  submitLabel = "Salvar",
  ownerLocked = false,
}: {
  action: Action;
  members: Member[];
  fields: CustomField[];
  currentUserId: string;
  values?: EntityValues;
  submitLabel?: string;
  /** Bloqueia o campo Responsável (usuários que não são administradores, na edição). */
  ownerLocked?: boolean;
}) {
  return (
    <ActionForm action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <EntityFields values={values} />
        <Field
          label="Responsável"
          htmlFor="owner_id"
          hint={ownerLocked ? "Somente administradores podem alterar o responsável." : undefined}
        >
          <Select id="owner_id" name="owner_id" defaultValue={values.owner_id ?? currentUserId} disabled={ownerLocked}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <CustomFieldInputs fields={fields} values={values.custom} />
        <Field label="Observações" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" defaultValue={values.notes ?? ""} maxLength={5000} />
        </Field>
      </div>
      <FormActions>
        <SubmitButton>{submitLabel}</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
