"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { dbError, str } from "@/lib/forms";
import { fromLocalInput } from "@/lib/format";
import type { ActionState } from "@/lib/types";

const PRIORITIES = ["baixa", "media", "alta"];

function readTask(fd: FormData) {
  const priority = str(fd, "priority") ?? "media";
  return {
    title: str(fd, "title"),
    description: str(fd, "description"),
    due_at: fromLocalInput(fd.get("due_at")),
    priority: PRIORITIES.includes(priority) ? priority : "media",
    assignee_id: str(fd, "assignee_id"),
    entity_id: str(fd, "entity_id"),
    deal_id: str(fd, "deal_id"),
  };
}

export async function createTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org, user } = await getContext();
  const task = readTask(fd);
  if (!task.title) return { error: "Informe o título da tarefa." };
  const { error } = await supabase.from("tasks").insert({
    ...task,
    assignee_id: task.assignee_id ?? user.id,
    org_id: org.id,
    created_by: user.id,
  });
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: "Tarefa criada." };
}

export async function updateTask(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const task = readTask(fd);
  if (!task.title) return { error: "Informe o título da tarefa." };
  const { error } = await supabase.from("tasks").update(task).eq("id", id).eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: "Tarefa atualizada." };
}

export async function toggleTask(id: string, done: boolean): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const { error } = await supabase.from("tasks").update({ done }).eq("id", id).eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: done ? "Tarefa concluída." : "Tarefa reaberta." };
}

export async function deleteTask(id: string): Promise<ActionState> {
  const { supabase } = await getContext();
  // Exclusão reversível: vai para a lixeira (Configurações › Lixeira) por 60 dias
  const { error } = await supabase.rpc("trash_move", { p_table: "tasks", p_id: id });
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: "Tarefa movida para a lixeira." };
}
