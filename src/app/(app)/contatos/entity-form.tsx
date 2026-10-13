import { CustomFieldInputs } from "@/components/custom-fields";
import { ActionForm, FormActions, SubmitButton } from "@/components/forms";
import { Field, Input, Select, Textarea } from "@/components/ui";
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
}: {
  action: Action;
  members: Member[];
  fields: CustomField[];
  currentUserId: string;
  values?: EntityValues;
  submitLabel?: string;
}) {
  return (
    <ActionForm action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue={values.kind ?? "empresa"}>
            <option value="empresa">Empresa</option>
            <option value="pessoa">Pessoa</option>
          </Select>
        </Field>
        <Field label="CNPJ / CPF" htmlFor="document" hint="Aceita CNPJ alfanumérico.">
          <Input id="document" name="document" defaultValue={values.document ?? ""} maxLength={20} />
        </Field>
        <Field label="Nome / razão social" htmlFor="name" className="sm:col-span-2">
          <Input id="name" name="name" required maxLength={200} defaultValue={values.name} />
        </Field>
        <Field label="E-mail" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={values.email ?? ""} />
        </Field>
        <Field label="Telefone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={values.phone ?? ""} />
        </Field>
        <Field label="Site" htmlFor="website">
          <Input id="website" name="website" defaultValue={values.website ?? ""} placeholder="www.exemplo.com.br" />
        </Field>
        <Field label="Segmento" htmlFor="segment">
          <Input id="segment" name="segment" defaultValue={values.segment ?? ""} placeholder="Ex.: Varejo" />
        </Field>
        <Field label="Cidade" htmlFor="city">
          <Input id="city" name="city" defaultValue={values.city ?? ""} />
        </Field>
        <Field label="UF" htmlFor="state">
          <Input id="state" name="state" maxLength={2} defaultValue={values.state ?? ""} className="uppercase" />
        </Field>
        <Field label="Responsável" htmlFor="owner_id">
          <Select id="owner_id" name="owner_id" defaultValue={values.owner_id ?? currentUserId}>
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
