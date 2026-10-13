"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { dbError, str } from "@/lib/forms";
import type { ActionState } from "@/lib/types";

export async function addNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org, user } = await getContext();
  const text = str(fd, "text");
  if (!text) return { error: "Escreva a anotação." };
  const { error } = await supabase.from("timeline_events").insert({
    org_id: org.id,
    entity_id: str(fd, "entity_id"),
    deal_id: str(fd, "deal_id"),
    actor_id: user.id,
    kind: "nota",
    payload: { text: text.slice(0, 5000) },
  });
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: "Anotação registrada." };
}

export async function deleteNote(id: string): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const { error } = await supabase.from("timeline_events").delete().eq("id", id).eq("org_id", org.id).eq("kind", "nota");
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: "Anotação excluída." };
}
