"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { dbError, decimal, str } from "@/lib/forms";
import type { ActionState } from "@/lib/types";

export async function saveProduct(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const product = {
    name: str(fd, "name"),
    code: str(fd, "code"),
    price: decimal(fd, "price"),
    active: fd.get("active") !== null || !id,
  };
  if (!product.name) return { error: "Informe o nome do produto." };
  if (product.price < 0) return { error: "O preço não pode ser negativo." };
  const { error } = id
    ? await supabase.from("products").update(product).eq("id", id).eq("org_id", org.id)
    : await supabase.from("products").insert({ ...product, org_id: org.id });
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: id ? "Produto atualizado." : "Produto criado." };
}

export async function deleteProduct(id: string): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const { error } = await supabase.from("products").delete().eq("id", id).eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: "Produto excluído." };
}
