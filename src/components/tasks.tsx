import Link from "next/link";
import { Building2, Kanban, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, FormActions, Modal, SubmitButton } from "@/components/forms";
import { Badge, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { TaskCheckbox } from "@/components/task-checkbox";
import { dateTime, isPast, toLocalInput } from "@/lib/format";
import type { ActionState, Member } from "@/lib/types";
import { createTask, deleteTask, updateTask } from "@/app/(app)/tarefas/actions";

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: "baixa" | "media" | "alta";
  done: boolean;
  assignee_id: string | null;
  entity_id: string | null;
  deal_id: string | null;
  entity?: { id: string; name: string } | null;
  deal?: { id: string; title: string } | null;
};

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

export function TaskForm({
  action,
  members,
  currentUserId,
  task,
  entityId,
  dealId,
  submitLabel = "Salvar",
}: {
  action: Action;
  members: Member[];
  currentUserId: string;
  task?: TaskRow;
  entityId?: string | null;
  dealId?: string | null;
  submitLabel?: string;
}) {
  return (
    <ActionForm action={action} className="space-y-4">
      <input type="hidden" name="entity_id" value={task?.entity_id ?? entityId ?? ""} />
      <input type="hidden" name="deal_id" value={task?.deal_id ?? dealId ?? ""} />
      <Field label="Título" htmlFor="task-title">
        <Input id="task-title" name="title" required maxLength={200} defaultValue={task?.title} placeholder="Ex.: Ligar para confirmar reunião" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Prazo" htmlFor="task-due" className="sm:col-span-1">
          <Input id="task-due" name="due_at" type="datetime-local" defaultValue={toLocalInput(task?.due_at)} />
        </Field>
        <Field label="Prioridade" htmlFor="task-priority">
          <Select id="task-priority" name="priority" defaultValue={task?.priority ?? "media"}>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </Select>
        </Field>
        <Field label="Responsável" htmlFor="task-assignee">
          <Select id="task-assignee" name="assignee_id" defaultValue={task?.assignee_id ?? currentUserId}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Descrição" htmlFor="task-desc">
        <Textarea id="task-desc" name="description" defaultValue={task?.description ?? ""} maxLength={5000} />
      </Field>
      <FormActions>
        <SubmitButton>{submitLabel}</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export function NewTaskButton({
  size = "sm",
  variant = "secondary",
  autoOpen,
  ...props
}: {
  members: Member[];
  currentUserId: string;
  entityId?: string | null;
  dealId?: string | null;
  size?: "sm" | "md";
  variant?: "primary" | "secondary";
  autoOpen?: boolean;
}) {
  return (
    <Modal
      title="Nova tarefa"
      autoOpenParam={autoOpen ? "novo" : undefined}
      trigger={
        <>
          <Plus className="size-4" /> Nova tarefa
        </>
      }
      triggerSize={size}
      triggerVariant={variant}
    >
      <TaskForm action={createTask} {...props} submitLabel="Criar tarefa" />
    </Modal>
  );
}

const priorityTone = { alta: "danger", media: "brand", baixa: "neutral" } as const;
const priorityLabel = { alta: "Alta", media: "Média", baixa: "Baixa" };

export function TaskList({
  tasks,
  members,
  currentUserId,
  showContext = true,
}: {
  tasks: TaskRow[];
  members: Member[];
  currentUserId: string;
  showContext?: boolean;
}) {

  const name = (id: string | null) => members.find((m) => m.id === id)?.name ?? "—";

  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => {
        const late = !t.done && isPast(t.due_at);
        return (
          <li key={t.id} className={cn("group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2/50", t.done && "opacity-70")}>
            <TaskCheckbox id={t.id} done={t.done} />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", t.done && "text-muted line-through")}>{t.title}</p>
              {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{t.description}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                {t.due_at && <span className={cn("tabular", late && "font-medium text-danger")}>{late ? "Atrasada · " : ""}{dateTime(t.due_at)}</span>}
                <Badge tone={priorityTone[t.priority]}>{priorityLabel[t.priority]}</Badge>
                <span>{name(t.assignee_id)}</span>
                {showContext && t.deal && (
                  <Link href={`/oportunidades/${t.deal.id}`} className="flex items-center gap-1 hover:text-brand">
                    <Kanban className="size-3" /> {t.deal.title}
                  </Link>
                )}
                {showContext && t.entity && (
                  <Link href={`/contatos/${t.entity.id}`} className="flex items-center gap-1 hover:text-brand">
                    <Building2 className="size-3" /> {t.entity.name}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <Modal title="Editar tarefa" triggerLabel="Editar tarefa" trigger={<Pencil className="size-3.5" />} triggerVariant="ghost" triggerSize="sm">
                <TaskForm action={updateTask.bind(null, t.id)} members={members} currentUserId={currentUserId} task={t} />
              </Modal>
              <ActionButton action={deleteTask.bind(null, t.id)} confirm="Mover esta tarefa para a lixeira? Você pode recuperá-la em Configurações › Lixeira por até 60 dias." confirmLabel="Mover para a lixeira" variant="ghost" title="Excluir tarefa">
                <Trash2 className="size-3.5" />
              </ActionButton>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
