import { CustomFieldInputs } from "@/components/custom-fields";
import { EntityPicker } from "@/components/entity-picker";
import { ActionForm, FormActions, SubmitButton } from "@/components/forms";
import { Field, Input, Select } from "@/components/ui";
import type { ActionState, CustomField, Member, Pipeline } from "@/lib/types";

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

export type DealFormValues = {
  title?: string;
  value?: number;
  stage_id?: string;
  entity?: { id: string; name: string; kind?: "empresa" | "pessoa" } | null;
  contact_id?: string | null;
  owner_id?: string | null;
  expected_close?: string | null;
  source?: string | null;
  custom?: Record<string, unknown>;
};

export const DEAL_SOURCES = ["Indicação", "Site", "Prospecção ativa", "Redes sociais", "Evento", "Anúncio", "Parceiro", "Outro"];

export function DealForm({
  action,
  orgId,
  pipelines,
  members,
  fields,
  currentUserId,
  values = {},
  valueLocked,
  openAfterCreate,
  submitLabel = "Salvar",
}: {
  action: Action;
  orgId: string;
  pipelines: Pipeline[];
  members: Member[];
  fields: CustomField[];
  currentUserId: string;
  values?: DealFormValues;
  valueLocked?: boolean;
  openAfterCreate?: boolean;
  submitLabel?: string;
}) {
  return (
    <ActionForm action={action} className="space-y-4">
      {openAfterCreate && <input type="hidden" name="open" value="1" />}
      <Field label="Título" htmlFor="title">
        <Input id="title" name="title" required maxLength={200} defaultValue={values.title} placeholder="Ex.: Licenças anuais – Acme" />
      </Field>
      <Field label="Empresa ou pessoa">
        <EntityPicker orgId={orgId} defaultValue={values.entity} defaultContactId={values.contact_id} withContact />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Valor (R$)"
          htmlFor="value"
          hint={valueLocked ? "Calculado a partir dos itens." : undefined}
        >
          <Input
            id="value"
            name="value"
            inputMode="decimal"
            disabled={valueLocked}
            defaultValue={values.value ? String(values.value).replace(".", ",") : ""}
            placeholder="0,00"
          />
        </Field>
        <Field label="Previsão de fechamento" htmlFor="expected_close">
          <Input id="expected_close" name="expected_close" type="date" defaultValue={values.expected_close ?? ""} />
        </Field>
        <Field label="Etapa" htmlFor="stage_id">
          <Select id="stage_id" name="stage_id" required defaultValue={values.stage_id}>
            {pipelines.map((p) => (
              <optgroup key={p.id} label={p.name}>
                {p.stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
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
        <Field label="Origem" htmlFor="source">
          <Select id="source" name="source" defaultValue={values.source ?? ""}>
            <option value="">—</option>
            {DEAL_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <CustomFieldInputs fields={fields} values={values.custom} />
      </div>
      <FormActions>
        <SubmitButton>{submitLabel}</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
