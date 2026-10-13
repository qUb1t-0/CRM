"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext, getCustomFields } from "@/lib/session";
import { dbError, decimal, readCustom, str } from "@/lib/forms";
import type { ActionState } from "@/lib/types";

function done(message: string): ActionState {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

/** Resolve o pipeline a partir da etapa escolhida (garante consistência). */
async function stageInfo(stageId: string | null) {
  if (!stageId) return null;
  const { supabase, org } = await getContext();
  const { data } = await supabase.from("stages").select("id, pipeline_id").eq("id", stageId).eq("org_id", org.id).single();
  return data;
}

export async function createDeal(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org, user } = await getContext();
  const title = str(fd, "title");
  if (!title) return { error: "Informe o título da oportunidade." };
  const stage = await stageInfo(str(fd, "stage_id"));
  if (!stage) return { error: "Escolha a etapa do funil." };

  const fields = await getCustomFields("oportunidade");
  const { data, error } = await supabase
    .from("deals")
    .insert({
      org_id: org.id,
      title,
      pipeline_id: stage.pipeline_id,
      stage_id: stage.id,
      entity_id: str(fd, "entity_id"),
      contact_id: str(fd, "contact_id"),
      value: decimal(fd, "value"),
      expected_close: str(fd, "expected_close"),
      source: str(fd, "source"),
      owner_id: str(fd, "owner_id") ?? user.id,
      created_by: user.id,
      custom: readCustom(fd, fields),
    })
    .select("id")
    .single();
  if (error) return { error: dbError(error)! };

  if (fd.get("open") === "1") redirect(`/oportunidades/${data.id}`);
  return done("Oportunidade criada.");
}

export async function updateDeal(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const title = str(fd, "title");
  if (!title) return { error: "Informe o título da oportunidade." };
  const stage = await stageInfo(str(fd, "stage_id"));
  if (!stage) return { error: "Escolha a etapa do funil." };

  const fields = await getCustomFields("oportunidade");
  const patch: Record<string, unknown> = {
    title,
    pipeline_id: stage.pipeline_id,
    stage_id: stage.id,
    entity_id: str(fd, "entity_id"),
    contact_id: str(fd, "contact_id"),
    expected_close: str(fd, "expected_close"),
    source: str(fd, "source"),
    owner_id: str(fd, "owner_id"),
    custom: readCustom(fd, fields),
  };
  // Quando há itens, o valor é calculado pelo banco a partir deles.
  const { count } = await supabase.from("deal_items").select("id", { count: "exact", head: true }).eq("deal_id", id);
  if (!count) patch.value = decimal(fd, "value");

  const { error } = await supabase.from("deals").update(patch).eq("id", id).eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  return done("Oportunidade atualizada.");
}

export async function moveDeal(id: string, stageId: string): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const stage = await stageInfo(stageId);
  if (!stage) return { error: "Etapa inválida." };
  const { error } = await supabase
    .from("deals")
    .update({ stage_id: stage.id, pipeline_id: stage.pipeline_id })
    .eq("id", id)
    .eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function winDeal(id: string): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const { error } = await supabase
    .from("deals")
    .update({ status: "ganha", closed_at: new Date().toISOString(), loss_reason_id: null, loss_note: null })
    .eq("id", id)
    .eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  return done("Parabéns! Oportunidade marcada como ganha.");
}

export async function loseDeal(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const reason = str(fd, "loss_reason_id");
  if (!reason) return { error: "Escolha o motivo da perda." };
  const { error } = await supabase
    .from("deals")
    .update({ status: "perdida", closed_at: new Date().toISOString(), loss_reason_id: reason, loss_note: str(fd, "loss_note") })
    .eq("id", id)
    .eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  return done("Oportunidade marcada como perdida.");
}

export async function reopenDeal(id: string): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const { error } = await supabase
    .from("deals")
    .update({ status: "aberta", closed_at: null, loss_reason_id: null, loss_note: null })
    .eq("id", id)
    .eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  return done("Oportunidade reaberta.");
}

export async function deleteDeal(id: string): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const { error } = await supabase.from("deals").delete().eq("id", id).eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  redirect("/oportunidades");
}

export async function addItem(dealId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const productId = str(fd, "product_id");
  let description = str(fd, "description");
  let unitPrice = decimal(fd, "unit_price", -1);

  if (productId) {
    const { data: product } = await supabase.from("products").select("name, price").eq("id", productId).eq("org_id", org.id).single();
    if (!product) return { error: "Produto não encontrado." };
    description ??= product.name;
    if (unitPrice < 0) unitPrice = Number(product.price);
  }
  if (!description) return { error: "Escolha um produto ou descreva o item." };
  if (unitPrice < 0) unitPrice = 0;

  const quantity = decimal(fd, "quantity", 1);
  const discount = decimal(fd, "discount_pct", 0);
  if (quantity <= 0) return { error: "A quantidade deve ser maior que zero." };
  if (discount < 0 || discount > 100) return { error: "O desconto deve estar entre 0 e 100%." };

  const { error } = await supabase.from("deal_items").insert({
    org_id: org.id,
    deal_id: dealId,
    product_id: productId,
    description,
    quantity,
    unit_price: unitPrice,
    discount_pct: discount,
  });
  if (error) return { error: dbError(error)! };
  return done("Item adicionado.");
}

export async function removeItem(id: string): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const { error } = await supabase.from("deal_items").delete().eq("id", id).eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  return done("Item removido.");
}
