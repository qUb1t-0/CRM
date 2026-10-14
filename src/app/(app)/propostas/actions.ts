"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { dbError, str } from "@/lib/forms";
import type { ActionState } from "@/lib/types";

const STATUSES = ["rascunho", "enviada", "aceita", "recusada"] as const;

/** Gera uma proposta a partir dos itens atuais da oportunidade (snapshot). */
export async function createProposal(dealId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org, user } = await getContext();
  const { data: deal } = await supabase
    .from("deals")
    .select("id, title, value, deal_items(description, quantity, unit_price, discount_pct)")
    .eq("id", dealId)
    .eq("org_id", org.id)
    .single();
  if (!deal) return { error: "Oportunidade não encontrada." };

  type Item = { description: string; quantity: number; unit_price: number; discount_pct: number };
  let items = ((deal.deal_items ?? []) as Item[]).map((i) => ({
    description: i.description,
    quantity: Number(i.quantity),
    unit_price: Number(i.unit_price),
    discount_pct: Number(i.discount_pct),
    total: Math.round(Number(i.quantity) * Number(i.unit_price) * (1 - Number(i.discount_pct) / 100) * 100) / 100,
  }));
  if (items.length === 0) {
    items = [{ description: deal.title, quantity: 1, unit_price: Number(deal.value), discount_pct: 0, total: Number(deal.value) }];
  }
  const total = items.reduce((acc, i) => acc + i.total, 0);

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      org_id: org.id,
      deal_id: dealId,
      number: 0, // definido pelo trigger
      title: str(fd, "title") ?? `Proposta – ${deal.title}`,
      valid_until: str(fd, "valid_until"),
      notes: str(fd, "notes"),
      items,
      total,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  redirect(`/propostas/${data.id}`);
}

export async function setProposalStatus(id: string, status: string): Promise<ActionState> {
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return { error: "Situação inválida." };
  const { supabase, org } = await getContext();
  const { error } = await supabase.from("proposals").update({ status }).eq("id", id).eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: "Situação da proposta atualizada." };
}

export async function deleteProposal(id: string): Promise<ActionState> {
  const { supabase } = await getContext();
  // Exclusão reversível: vai para a lixeira (Configurações › Lixeira) por 60 dias
  const { error } = await supabase.rpc("trash_move", { p_table: "proposals", p_id: id });
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  redirect("/propostas");
}
