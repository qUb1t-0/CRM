import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { getContext, getCustomFields } from "@/lib/session";
import type { CustomField } from "@/lib/types";
import { createCustomField, deleteCustomField } from "../actions";

export const metadata: Metadata = { title: "Campos personalizados" };

const typeLabel = { texto: "Texto", numero: "Número", data: "Data", lista: "Lista" };

function FieldList({ title, fields, isAdmin }: { title: string; fields: CustomField[]; isAdmin: boolean }) {
  return (
    <Card>
      <CardHeader title={title} />
      <ul className="divide-y divide-line">
        {fields.map((f) => (
          <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="flex-1">
              {f.label}
              {f.type === "lista" && <span className="block text-xs text-muted">{f.options.join(", ")}</span>}
            </span>
            <Badge>{typeLabel[f.type]}</Badge>
            {isAdmin && (
              <ActionButton
                action={deleteCustomField.bind(null, f.id)}
                confirm={`Excluir o campo “${f.label}”? Os valores já preenchidos deixam de aparecer.`}
                variant="ghost"
                title="Excluir"
              >
                <Trash2 className="size-3.5" />
              </ActionButton>
            )}
          </li>
        ))}
        {fields.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nenhum campo.</li>}
      </ul>
    </Card>
  );
}

export default async function CustomFieldsPage() {
  const ctx = await getContext();
  const [entityFields, dealFields] = await Promise.all([getCustomFields("entidade"), getCustomFields("oportunidade")]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <FieldList title="Empresas e pessoas" fields={entityFields} isAdmin={ctx.isAdmin} />
        <FieldList title="Oportunidades" fields={dealFields} isAdmin={ctx.isAdmin} />
      </div>
      {ctx.isAdmin && (
        <Card className="self-start">
          <CardHeader title="Novo campo" />
          <ActionForm action={createCustomField} className="space-y-4 p-4">
            <Field label="Aplicar em" htmlFor="cf-entity">
              <Select id="cf-entity" name="entity" defaultValue="entidade">
                <option value="entidade">Empresas e pessoas</option>
                <option value="oportunidade">Oportunidades</option>
              </Select>
            </Field>
            <Field label="Nome do campo" htmlFor="cf-label">
              <Input id="cf-label" name="label" required placeholder="Ex.: Número de funcionários" />
            </Field>
            <Field label="Tipo" htmlFor="cf-type">
              <Select id="cf-type" name="type" defaultValue="texto">
                <option value="texto">Texto</option>
                <option value="numero">Número</option>
                <option value="data">Data</option>
                <option value="lista">Lista de opções</option>
              </Select>
            </Field>
            <Field label="Opções (para lista)" htmlFor="cf-options" hint="Uma por linha ou separadas por vírgula.">
              <Textarea id="cf-options" name="options" rows={3} />
            </Field>
            <SubmitButton>Criar campo</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
