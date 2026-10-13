import { Field, Input, Select } from "@/components/ui";
import { date } from "@/lib/format";
import type { CustomField } from "@/lib/types";

export function CustomFieldInputs({
  fields,
  values = {},
}: {
  fields: CustomField[];
  values?: Record<string, unknown>;
}) {
  if (fields.length === 0) return null;
  return (
    <>
      {fields.map((f) => {
        const name = `cf_${f.key}`;
        const value = values[f.key] == null ? "" : String(values[f.key]);
        return (
          <Field key={f.id} label={f.label} htmlFor={name}>
            {f.type === "lista" ? (
              <Select id={name} name={name} defaultValue={value}>
                <option value="">—</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id={name}
                name={name}
                defaultValue={value}
                type={f.type === "numero" ? "number" : f.type === "data" ? "date" : "text"}
                step={f.type === "numero" ? "any" : undefined}
              />
            )}
          </Field>
        );
      })}
    </>
  );
}

export function CustomFieldValues({ fields, values }: { fields: CustomField[]; values: Record<string, unknown> }) {
  if (fields.length === 0) return null;
  return (
    <>
      {fields.map((f) => {
        const v = values?.[f.key];
        return (
          <div key={f.id}>
            <dt className="text-xs text-muted">{f.label}</dt>
            <dd className="mt-0.5 text-sm">
              {v == null || v === "" ? "—" : f.type === "data" ? date(String(v)) : String(v)}
            </dd>
          </div>
        );
      })}
    </>
  );
}
