import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardHeader, Field, Input } from "@/components/ui";
import { getContext, getLossReasons } from "@/lib/session";
import { createLossReason, deleteLossReason } from "../actions";

export const metadata: Metadata = { title: "Motivos de perda" };

export default async function LossReasonsPage() {
  const ctx = await getContext();
  const reasons = await getLossReasons();
  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader title="Motivos de perda" />
        <ul className="divide-y divide-line">
          {reasons.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              {r.name}
              {ctx.isAdmin && (
                <ActionButton action={deleteLossReason.bind(null, r.id)} confirm={`Excluir “${r.name}”?`} variant="ghost" title="Excluir">
                  <Trash2 className="size-3.5" />
                </ActionButton>
              )}
            </li>
          ))}
          {reasons.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nenhum motivo cadastrado.</li>}
        </ul>
      </Card>
      {ctx.isAdmin && (
        <Card className="p-4">
          <ActionForm action={createLossReason} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Novo motivo" htmlFor="reason" className="flex-1">
              <Input id="reason" name="name" required placeholder="Ex.: Projeto cancelado" />
            </Field>
            <SubmitButton>Adicionar</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
