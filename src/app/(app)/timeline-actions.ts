"use server";

import { revalidatePath } from "next/cache";
import { getContext, getMembers } from "@/lib/session";
import { dbError, str } from "@/lib/forms";
import type { ActionState } from "@/lib/types";

/** Registra uma anotação (feedback). Menções com @ geram notificação para os usuários citados. */
export async function addNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org, user } = await getContext();
  const text = str(fd, "text");
  if (!text) return { error: "Escreva a mensagem." };

  // Menções: somente membros da base e somente se o nome ainda aparece no texto
  let mentions: string[] = [];
  try {
    const raw = JSON.parse(String(fd.get("mentions") ?? "[]"));
    if (Array.isArray(raw)) mentions = raw.filter((v): v is string => typeof v === "string");
  } catch {
    mentions = [];
  }
  const members = await getMembers();
  const validMentions = [...new Set(mentions)].filter((id) => {
    const m = members.find((x) => x.id === id);
    return m && text.includes(`@${m.name}`);
  });

  const { error } = await supabase.from("timeline_events").insert({
    org_id: org.id,
    entity_id: str(fd, "entity_id"),
    deal_id: str(fd, "deal_id"),
    actor_id: user.id,
    kind: "nota",
    payload: { text: text.slice(0, 5000), mentions: validMentions },
  });
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: validMentions.length
      ? `Mensagem enviada. ${validMentions.length === 1 ? "1 pessoa foi notificada" : `${validMentions.length} pessoas foram notificadas`}.`
      : "Mensagem registrada.",
  };
}

export async function deleteNote(id: string): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const { error } = await supabase.from("timeline_events").delete().eq("id", id).eq("org_id", org.id).eq("kind", "nota");
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: "Mensagem excluída." };
}

/** Marca notificações como lidas (todas ou uma específica). */
export async function markNotificationsRead(id?: string): Promise<ActionState> {
  const { supabase, user } = await getContext();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (id) q = q.eq("id", id);
  const { error } = await q;
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true };
}
