"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { dbError, str } from "@/lib/forms";
import { fromLocalInput } from "@/lib/format";
import type { ActionState } from "@/lib/types";

function read(fd: FormData) {
  return {
    title: str(fd, "title"),
    description: str(fd, "description"),
    location: str(fd, "location"),
    starts_at: fromLocalInput(fd.get("starts_at")),
    ends_at: fromLocalInput(fd.get("ends_at")),
    owner_id: str(fd, "owner_id"),
    entity_id: str(fd, "entity_id"),
  };
}

function validate(a: ReturnType<typeof read>) {
  if (!a.title) return "Informe o título.";
  if (!a.starts_at) return "Informe o início.";
  if (!a.ends_at) a.ends_at = new Date(new Date(a.starts_at).getTime() + 60 * 60 * 1000).toISOString();
  if (a.ends_at < a.starts_at) return "O término deve ser depois do início.";
  return null;
}

export async function createAppointment(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org, user } = await getContext();
  const a = read(fd);
  const err = validate(a);
  if (err) return { error: err };
  const { error } = await supabase.from("appointments").insert({ ...a, owner_id: a.owner_id ?? user.id, org_id: org.id, created_by: user.id });
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: "Compromisso agendado." };
}

export async function updateAppointment(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const a = read(fd);
  const err = validate(a);
  if (err) return { error: err };
  const { error } = await supabase.from("appointments").update(a).eq("id", id).eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: "Compromisso atualizado." };
}

export async function deleteAppointment(id: string): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const { error } = await supabase.from("appointments").delete().eq("id", id).eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: "Compromisso excluído." };
}
