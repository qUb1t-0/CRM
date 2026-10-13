"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { dbError, str } from "@/lib/forms";
import type { ActionState } from "@/lib/types";

const ok = (message: string): ActionState => {
  revalidatePath("/", "layout");
  return { ok: true, message };
};

const DENIED: ActionState = { error: "Apenas administradores podem alterar as configurações." };

async function admin() {
  const ctx = await getContext();
  return ctx.isAdmin ? ctx : null;
}

// ---------- Geral ----------
export async function updateOrganization(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org } = ctx;
  const name = str(fd, "name");
  if (!name || name.length < 2) return { error: "Informe o nome da empresa." };
  const { error } = await supabase.from("organizations").update({ name }).eq("id", org.id);
  return error ? { error: dbError(error)! } : ok("Empresa atualizada.");
}

export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await getContext();
  const name = str(fd, "full_name");
  if (!name) return { error: "Informe seu nome." };
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
  return error ? { error: dbError(error)! } : ok("Perfil atualizado.");
}

// ---------- Usuários ----------
export async function inviteMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org, user } = ctx;
  const email = str(fd, "email")?.toLowerCase();
  const role = str(fd, "role") === "admin" ? "admin" : "membro";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Informe um e-mail válido." };
  const { error } = await supabase.from("invites").upsert(
    { org_id: org.id, email, role, invited_by: user.id, accepted_at: null },
    { onConflict: "org_id,email" },
  );
  return error ? { error: dbError(error)! } : ok(`Convite registrado para ${email}.`);
}

export async function revokeInvite(id: string): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org } = ctx;
  const { error } = await supabase.from("invites").delete().eq("id", id).eq("org_id", org.id);
  return error ? { error: dbError(error)! } : ok("Convite cancelado.");
}

export async function setMemberRole(userId: string, role: string): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org, user } = ctx;
  if (userId === user.id) return { error: "Você não pode alterar o próprio papel." };
  const { error } = await supabase
    .from("memberships")
    .update({ role: role === "admin" ? "admin" : "membro" })
    .eq("org_id", org.id)
    .eq("user_id", userId);
  return error ? { error: dbError(error)! } : ok("Papel atualizado.");
}

export async function removeMember(userId: string): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org, user } = ctx;
  if (userId === user.id) return { error: "Você não pode remover a si mesmo." };
  const { error } = await supabase.from("memberships").delete().eq("org_id", org.id).eq("user_id", userId);
  return error ? { error: dbError(error)! } : ok("Membro removido da base.");
}

// ---------- Funis e etapas ----------
export async function createPipeline(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org } = ctx;
  const name = str(fd, "name");
  if (!name) return { error: "Informe o nome do funil." };
  const { count } = await supabase.from("pipelines").select("id", { count: "exact", head: true }).eq("org_id", org.id);
  const { data, error } = await supabase.from("pipelines").insert({ org_id: org.id, name, position: count ?? 0 }).select("id").single();
  if (error) return { error: dbError(error)! };
  const defaults = ["Prospecção", "Qualificação", "Proposta", "Negociação"];
  await supabase
    .from("stages")
    .insert(defaults.map((n, i) => ({ org_id: org.id, pipeline_id: data.id, name: n, position: i, probability: [10, 30, 60, 85][i] })));
  return ok("Funil criado.");
}

export async function renamePipeline(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org } = ctx;
  const name = str(fd, "name");
  if (!name) return { error: "Informe o nome." };
  const { error } = await supabase.from("pipelines").update({ name }).eq("id", id).eq("org_id", org.id);
  return error ? { error: dbError(error)! } : ok("Funil renomeado.");
}

export async function deletePipeline(id: string): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org } = ctx;
  const { count } = await supabase.from("deals").select("id", { count: "exact", head: true }).eq("pipeline_id", id);
  if (count) return { error: `Este funil tem ${count} oportunidade(s). Mova-as antes de excluir.` };
  const { count: total } = await supabase.from("pipelines").select("id", { count: "exact", head: true }).eq("org_id", org.id);
  if ((total ?? 0) <= 1) return { error: "É preciso manter pelo menos um funil." };
  const { error } = await supabase.from("pipelines").delete().eq("id", id).eq("org_id", org.id);
  return error ? { error: dbError(error)! } : ok("Funil excluído.");
}

export async function saveStage(pipelineId: string, stageId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org } = ctx;
  const name = str(fd, "name");
  const probability = Math.min(100, Math.max(0, Math.round(Number(str(fd, "probability") ?? 0)) || 0));
  if (!name) return { error: "Informe o nome da etapa." };
  if (stageId) {
    const { error } = await supabase.from("stages").update({ name, probability }).eq("id", stageId).eq("org_id", org.id);
    return error ? { error: dbError(error)! } : ok("Etapa atualizada.");
  }
  const { data: last } = await supabase
    .from("stages")
    .select("position")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("stages")
    .insert({ org_id: org.id, pipeline_id: pipelineId, name, probability, position: (last?.position ?? -1) + 1 });
  return error ? { error: dbError(error)! } : ok("Etapa criada.");
}

export async function moveStage(stageId: string, direction: "up" | "down"): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org } = ctx;
  const { data: stage } = await supabase.from("stages").select("id, pipeline_id, position").eq("id", stageId).eq("org_id", org.id).single();
  if (!stage) return { error: "Etapa não encontrada." };
  const { data: stages } = await supabase.from("stages").select("id, position").eq("pipeline_id", stage.pipeline_id).order("position");
  const list = stages ?? [];
  const i = list.findIndex((s) => s.id === stageId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return null;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((s, idx) => supabase.from("stages").update({ position: idx }).eq("id", s.id)));
  revalidatePath("/", "layout");
  return null;
}

export async function deleteStage(stageId: string): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org } = ctx;
  const { count } = await supabase.from("deals").select("id", { count: "exact", head: true }).eq("stage_id", stageId);
  if (count) return { error: `Esta etapa tem ${count} oportunidade(s). Mova-as antes de excluir.` };
  const { data: stage } = await supabase.from("stages").select("pipeline_id").eq("id", stageId).single();
  const { count: siblings } = await supabase.from("stages").select("id", { count: "exact", head: true }).eq("pipeline_id", stage?.pipeline_id);
  if ((siblings ?? 0) <= 1) return { error: "O funil precisa de pelo menos uma etapa." };
  const { error } = await supabase.from("stages").delete().eq("id", stageId).eq("org_id", org.id);
  return error ? { error: dbError(error)! } : ok("Etapa excluída.");
}

// ---------- Motivos de perda ----------
export async function createLossReason(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org } = ctx;
  const name = str(fd, "name");
  if (!name) return { error: "Informe o motivo." };
  const { error } = await supabase.from("loss_reasons").insert({ org_id: org.id, name });
  return error ? { error: dbError(error)! } : ok("Motivo criado.");
}

export async function deleteLossReason(id: string): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org } = ctx;
  const { error } = await supabase.from("loss_reasons").delete().eq("id", id).eq("org_id", org.id);
  return error ? { error: dbError(error)! } : ok("Motivo excluído.");
}

// ---------- Campos personalizados ----------
export async function createCustomField(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org } = ctx;
  const label = str(fd, "label");
  const entity = str(fd, "entity") === "oportunidade" ? "oportunidade" : "entidade";
  const type = ["texto", "numero", "data", "lista"].includes(str(fd, "type") ?? "") ? str(fd, "type")! : "texto";
  if (!label) return { error: "Informe o nome do campo." };
  const key = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  if (!key) return { error: "Nome inválido." };
  const options =
    type === "lista"
      ? (str(fd, "options") ?? "")
          .split(/[\n,;]/)
          .map((o) => o.trim())
          .filter(Boolean)
          .slice(0, 50)
      : [];
  if (type === "lista" && options.length === 0) return { error: "Informe as opções da lista." };
  const { count } = await supabase.from("custom_fields").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("entity", entity);
  const { error } = await supabase.from("custom_fields").insert({ org_id: org.id, entity, key, label, type, options, position: count ?? 0 });
  return error ? { error: dbError(error)! } : ok("Campo criado.");
}

export async function deleteCustomField(id: string): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return DENIED;
  const { supabase, org } = ctx;
  const { error } = await supabase.from("custom_fields").delete().eq("id", id).eq("org_id", org.id);
  return error ? { error: dbError(error)! } : ok("Campo excluído.");
}
