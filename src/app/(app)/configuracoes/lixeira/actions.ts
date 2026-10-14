"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import type { ActionState } from "@/lib/types";

const TRASH_TABLES = ["entities", "deals", "proposals", "products", "tasks"] as const;
type TrashTable = (typeof TRASH_TABLES)[number];

function valid(table: string): table is TrashTable {
  return (TRASH_TABLES as readonly string[]).includes(table);
}

export async function restoreItem(table: string, id: string): Promise<ActionState> {
  if (!valid(table)) return { error: "Tipo inválido." };
  const { supabase } = await getContext();
  const { error } = await supabase.rpc("trash_restore", { p_table: table, p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Item recuperado." };
}

export async function purgeItem(table: string, id: string): Promise<ActionState> {
  if (!valid(table)) return { error: "Tipo inválido." };
  const { supabase, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Apenas administradores podem excluir definitivamente." };
  const { error } = await supabase.rpc("trash_purge", { p_table: table, p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Item excluído definitivamente." };
}

export async function emptyTrash(): Promise<ActionState> {
  const { supabase, org, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Apenas administradores podem esvaziar a lixeira." };
  const { data, error } = await supabase.rpc("trash_empty", { p_org: org.id });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: `Lixeira esvaziada (${data ?? 0} itens excluídos definitivamente).` };
}
