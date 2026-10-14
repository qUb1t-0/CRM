import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CustomField, Member, Pipeline, Role } from "@/lib/types";

export const ORG_COOKIE = "crm_org";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Contexto da requisição autenticada: usuário, organização ativa ("base") e papel.
 * Faz o papel do APP_CONFIG do sistema original, sem expor tokens ao navegador.
 */
export const getContext = cache(async () => {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("role, org:organizations(id, name)")
    .eq("user_id", user.id)
    .order("created_at");

  const orgs = (memberships ?? [])
    .filter((m) => m.org)
    .map((m) => {
      const org = m.org as unknown as { id: string; name: string };
      return { id: org.id, name: org.name, role: m.role as Role };
    });

  if (orgs.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const wanted = cookieStore.get(ORG_COOKIE)?.value;
  const active = orgs.find((o) => o.id === wanted) ?? orgs[0];

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_url, job_title, phone, birth_date, bio")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    profile: {
      name: profile?.full_name || user.email || "Usuário",
      email: user.email ?? "",
      avatarUrl: (profile?.avatar_url as string | null) ?? null,
      jobTitle: (profile?.job_title as string | null) ?? null,
      phone: (profile?.phone as string | null) ?? null,
      birthDate: (profile?.birth_date as string | null) ?? null,
      bio: (profile?.bio as string | null) ?? null,
      // E-mail novo aguardando confirmação (troca de e-mail)
      pendingEmail: user.new_email ?? null,
    },
    org: { id: active.id, name: active.name },
    role: active.role,
    isAdmin: active.role === "admin",
    orgs,
  };
});

export type Context = Awaited<ReturnType<typeof getContext>>;

export const getMembers = cache(async (): Promise<Member[]> => {
  const { supabase, org } = await getContext();
  const { data: rows } = await supabase.from("memberships").select("user_id, role").eq("org_id", org.id);
  const ids = (rows ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, avatar_url, job_title").in("id", ids);
  return (rows ?? [])
    .map((r) => {
      const p = profiles?.find((x) => x.id === r.user_id);
      return {
        id: r.user_id as string,
        name: p?.full_name || p?.email || "Usuário",
        avatarUrl: (p?.avatar_url as string | null) ?? null,
        jobTitle: (p?.job_title as string | null) ?? null,
        email: p?.email ?? null,
        role: r.role as Role,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
});

export const OWNER_FILTER_COOKIE = "crm_resp";

/**
 * Filtro global por responsável (somente administradores).
 * Retorna os IDs dos usuários selecionados, ou null quando não há filtro (todos).
 * O cookie guarda "<org_id>:<id1>,<id2>"; IDs de quem não é membro da base são descartados.
 */
export const getOwnerFilter = cache(async (): Promise<string[] | null> => {
  const { org, isAdmin } = await getContext();
  if (!isAdmin) return null;
  const raw = (await cookies()).get(OWNER_FILTER_COOKIE)?.value;
  if (!raw) return null;
  const [orgId, list] = raw.split(":");
  if (orgId !== org.id || !list) return null;
  const memberIds = new Set((await getMembers()).map((m) => m.id));
  const ids = list.split(",").filter((id) => memberIds.has(id));
  return ids.length > 0 && ids.length < memberIds.size ? ids : null;
});

/** Monta o filtro PostgREST "coluna_a in (...) ou coluna_b in (...)". */
export function ownedByFilter(columns: string[], ids: string[]) {
  const list = ids.join(",");
  return columns.map((c) => `${c}.in.(${list})`).join(",");
}

/**
 * Junta vários grupos "OU" num único filtro para .or(): (g1) E (g2) E ...
 * Necessário porque duas chamadas .or() na mesma consulta não são combinadas de forma confiável.
 */
export function combineOr(groups: string[]) {
  const valid = groups.filter(Boolean);
  if (valid.length <= 1) return valid[0] ?? "";
  return `and(${valid.map((g) => `or(${g})`).join(",")})`;
}

export const getPipelines = cache(async (): Promise<Pipeline[]> => {
  const { supabase, org } = await getContext();
  const { data } = await supabase
    .from("pipelines")
    .select("id, name, position, stages(id, pipeline_id, name, position, probability)")
    .eq("org_id", org.id)
    .order("position")
    .order("created_at");
  return (data ?? []).map((p) => ({
    ...p,
    stages: [...(p.stages ?? [])].sort((a, b) => a.position - b.position),
  }));
});

export const getCustomFields = cache(async (entity: CustomField["entity"]): Promise<CustomField[]> => {
  const { supabase, org } = await getContext();
  const { data } = await supabase
    .from("custom_fields")
    .select("id, entity, key, label, type, options, position")
    .eq("org_id", org.id)
    .eq("entity", entity)
    .order("position")
    .order("created_at");
  return (data ?? []) as CustomField[];
});

export const getLossReasons = cache(async () => {
  const { supabase, org } = await getContext();
  const { data } = await supabase.from("loss_reasons").select("id, name").eq("org_id", org.id).order("name");
  return data ?? [];
});
