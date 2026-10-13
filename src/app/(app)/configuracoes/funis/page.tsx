import type { Metadata } from "next";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, FormActions, Modal, SubmitButton } from "@/components/forms";
import { Card, CardHeader, Field, Input } from "@/components/ui";
import { getContext, getPipelines } from "@/lib/session";
import type { Stage } from "@/lib/types";
import { createPipeline, deletePipeline, deleteStage, moveStage, renamePipeline, saveStage } from "../actions";

export const metadata: Metadata = { title: "Funis e etapas" };

function StageForm({ pipelineId, stage }: { pipelineId: string; stage?: Stage }) {
  return (
    <ActionForm action={saveStage.bind(null, pipelineId, stage?.id ?? null)} className="space-y-4">
      <Field label="Nome da etapa" htmlFor="s-name">
        <Input id="s-name" name="name" required defaultValue={stage?.name} />
      </Field>
      <Field label="Probabilidade de fechamento (%)" htmlFor="s-prob" hint="Usada no valor ponderado do pipeline.">
        <Input id="s-prob" name="probability" type="number" min={0} max={100} defaultValue={stage?.probability ?? 50} />
      </Field>
      <FormActions>
        <SubmitButton>Salvar</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export default async function PipelinesPage() {
  const ctx = await getContext();
  const pipelines = await getPipelines();

  if (!ctx.isAdmin) {
    return <p className="text-sm text-muted">Somente administradores podem configurar os funis.</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {pipelines.map((p) => (
        <Card key={p.id}>
          <CardHeader
            title={p.name}
            action={
              <div className="flex gap-1">
                <Modal title="Renomear funil" triggerVariant="ghost" triggerSize="sm" trigger={<Pencil className="size-3.5" />}>
                  <ActionForm action={renamePipeline.bind(null, p.id)} className="space-y-4">
                    <Field label="Nome" htmlFor="p-name">
                      <Input id="p-name" name="name" defaultValue={p.name} required />
                    </Field>
                    <FormActions>
                      <SubmitButton>Salvar</SubmitButton>
                    </FormActions>
                  </ActionForm>
                </Modal>
                <ActionButton action={deletePipeline.bind(null, p.id)} confirm={`Excluir o funil ${p.name}?`} variant="ghost" title="Excluir funil">
                  <Trash2 className="size-3.5" />
                </ActionButton>
              </div>
            }
          />
          <ol className="divide-y divide-line">
            {p.stages.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="tabular w-6 text-xs text-muted">{i + 1}</span>
                <span className="flex-1 text-sm font-medium">{s.name}</span>
                <span className="tabular text-xs text-muted">{s.probability}%</span>
                <div className="flex">
                  <ActionButton action={moveStage.bind(null, s.id, "up")} variant="ghost" title="Mover para cima" className={i === 0 ? "invisible" : ""}>
                    <ArrowUp className="size-3.5" />
                  </ActionButton>
                  <ActionButton
                    action={moveStage.bind(null, s.id, "down")}
                    variant="ghost"
                    title="Mover para baixo"
                    className={i === p.stages.length - 1 ? "invisible" : ""}
                  >
                    <ArrowDown className="size-3.5" />
                  </ActionButton>
                  <Modal title="Editar etapa" triggerVariant="ghost" triggerSize="sm" trigger={<Pencil className="size-3.5" />}>
                    <StageForm pipelineId={p.id} stage={s} />
                  </Modal>
                  <ActionButton action={deleteStage.bind(null, s.id)} confirm={`Excluir a etapa ${s.name}?`} variant="ghost" title="Excluir etapa">
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                </div>
              </li>
            ))}
          </ol>
          <div className="border-t border-line px-4 py-3">
            <Modal title="Nova etapa" triggerSize="sm" trigger={<><Plus className="size-4" /> Etapa</>}>
              <StageForm pipelineId={p.id} />
            </Modal>
          </div>
        </Card>
      ))}

      <Card className="p-4">
        <ActionForm action={createPipeline} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Novo funil" htmlFor="new-pipe" className="flex-1">
            <Input id="new-pipe" name="name" placeholder="Ex.: Renovações" required />
          </Field>
          <SubmitButton>Criar funil</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
