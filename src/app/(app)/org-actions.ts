"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext, getMembers, ORG_COOKIE, OWNER_FILTER_COOKIE } from "@/lib/session";
import type { ActionState } from "@/lib/types";

export async function switchOrg(orgId: string) {
  const ctx = await getContext();
  if (!ctx.orgs.some((o) => o.id === orgId)) return;
  const store = await cookies();
  store.set(ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  store.delete(OWNER_FILTER_COOKIE);
  redirect("/");
}

/** Define o filtro global por responsável (somente administradores). Lista vazia ou todos = sem filtro. */
export async function setOwnerFilter(ids: string[]): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx.isAdmin) return { error: "Apenas administradores podem filtrar por responsável." };
  const members = await getMembers();
  const valid = [...new Set(ids)].filter((id) => members.some((m) => m.id === id));
  const store = await cookies();

  if (valid.length === 0 || valid.length === members.length) {
    store.delete(OWNER_FILTER_COOKIE);
  } else {
    store.set(OWNER_FILTER_COOKIE, `${ctx.org.id}:${valid.join(",")}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  revalidatePath("/", "layout");
  const message =
    valid.length === 0 || valid.length === members.length
      ? "Exibindo dados de todos os usuários."
      : valid.length === 1
        ? `Exibindo dados de ${members.find((m) => m.id === valid[0])?.name}.`
        : `Exibindo dados de ${valid.length} usuários.`;
  return { ok: true, message };
}
