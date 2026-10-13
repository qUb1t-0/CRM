"use server";

import { revalidatePath } from "next/cache";
import { getContext, getMembers } from "@/lib/session";
import { dbError, decimal, str } from "@/lib/forms";
import type { ActionState } from "@/lib/types";

export async function saveGoals(month: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Apenas administradores definem metas." };
  if (!/^\d{4}-\d{2}-01$/.test(month)) return { error: "Mês inválido." };

  const memberIds = new Set((await getMembers()).map((m) => m.id));
  const entries: { user_id: string | null; target: number }[] = [];
  for (const [key] of fd.entries()) {
    if (!key.startsWith("goal_")) continue;
    const userId = key.slice(5);
    if (str(fd, key) === null) continue;
    if (userId !== "equipe" && !memberIds.has(userId)) continue;
    entries.push({ user_id: userId === "equipe" ? null : userId, target: decimal(fd, key) });
  }

  // Substitui as metas do mês (o índice único usa coalesce, então apagar e inserir é o caminho simples)
  const { error: delError } = await supabase.from("goals").delete().eq("org_id", org.id).eq("month", month);
  if (delError) return { error: dbError(delError)! };
  if (entries.length > 0) {
    const { error } = await supabase.from("goals").insert(entries.map((e) => ({ ...e, org_id: org.id, month })));
    if (error) return { error: dbError(error)! };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Metas salvas." };
}
