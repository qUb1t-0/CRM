"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext, getCustomFields, getMembers } from "@/lib/session";
import { dbError, readCustom, str } from "@/lib/forms";
import type { ActionState } from "@/lib/types";
import { EMAIL_RE, PHONE_RE, UF_SIGLAS, isValidCNPJ, isValidCPF, maskPhone, onlyDigits } from "@/lib/br";
import { SUPABASE_URL } from "@/lib/supabase/env";

async function readEntity(fd: FormData) {
  const fields = await getCustomFields("entidade");
  const kind = str(fd, "kind") === "pessoa" ? "pessoa" : "empresa";
  const phoneDigits = onlyDigits(str(fd, "phone"));
  return {
    kind,
    name: str(fd, "name"),
    document: onlyDigits(str(fd, "document")) || null,
    email: str(fd, "email")?.toLowerCase() ?? null,
    // Telefone salvo já formatado: (00) 0 0000-0000
    phone: phoneDigits ? maskPhone(phoneDigits) : null,
    website: str(fd, "website"),
    city: str(fd, "city"),
    state: str(fd, "state")?.toUpperCase() ?? null,
    segment: str(fd, "segment"),
    notes: str(fd, "notes"),
    owner_id: str(fd, "owner_id"),
    custom: readCustom(fd, fields),
  };
}

/** Mesmas regras do formulário, repetidas no servidor (não dá para contornar pelo navegador). */
function validateEntity(e: Awaited<ReturnType<typeof readEntity>>): string | null {
  if (!e.name) return "Informe o nome.";
  if (e.document) {
    if (e.kind === "pessoa") {
      if (e.document.length !== 11) return "O CPF deve ter 11 dígitos numéricos.";
      if (!isValidCPF(e.document)) return "CPF inválido. Confira os números.";
    } else {
      if (e.document.length !== 14) return "O CNPJ deve ter 14 dígitos numéricos.";
      if (!isValidCNPJ(e.document)) return "CNPJ inválido. Confira os números.";
    }
  }
  if (e.email && !EMAIL_RE.test(e.email)) return "Informe um e-mail válido, com @.";
  if (e.phone && !PHONE_RE.test(e.phone)) return "Informe o telefone completo no formato (00) 0 0000-0000.";
  if (e.state && !UF_SIGLAS.has(e.state)) return "UF inválida.";
  if (e.city && !e.state) return "Selecione a UF antes da cidade.";
  return null;
}

export async function createEntity(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org, user } = await getContext();
  const entity = await readEntity(fd);
  const invalid = validateEntity(entity);
  if (invalid) return { error: invalid };
  const { data, error } = await supabase
    .from("entities")
    .insert({ ...entity, owner_id: entity.owner_id ?? user.id, org_id: org.id, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  redirect(`/contatos/${data.id}`);
}

export async function updateEntity(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org, isAdmin } = await getContext();
  const entity = await readEntity(fd);
  const invalid = validateEntity(entity);
  if (invalid) return { error: invalid };
  // Somente administradores trocam o responsável; para os demais o campo é ignorado
  const patch: Partial<typeof entity> = { ...entity };
  if (!isAdmin || !patch.owner_id) delete patch.owner_id;
  const { error } = await supabase.from("entities").update(patch).eq("id", id).eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: "Cadastro atualizado." };
}

/**
 * Transfere a responsabilidade pelo cliente (somente administradores).
 * O novo responsável é notificado pelo banco; opcionalmente leva junto as tarefas em aberto.
 */
export async function transferEntityOwner(entityId: string, ownerId: string, withTasks: boolean): Promise<ActionState> {
  const { supabase, org, isAdmin, user } = await getContext();
  if (!isAdmin) return { error: "Apenas administradores podem alterar o responsável." };
  const members = await getMembers();
  const target = members.find((m) => m.id === ownerId);
  if (!target) return { error: "Usuário inválido." };

  const { data: current } = await supabase.from("entities").select("owner_id, name").eq("id", entityId).eq("org_id", org.id).single();
  if (!current) return { error: "Cliente não encontrado." };
  if (current.owner_id === ownerId) return { ok: true, message: `${target.name} já é o responsável.` };

  const { error } = await supabase.from("entities").update({ owner_id: ownerId }).eq("id", entityId).eq("org_id", org.id);
  if (error) return { error: error.message };

  let moved = 0;
  if (withTasks) {
    let q = supabase.from("tasks").update({ assignee_id: ownerId }, { count: "exact" }).eq("org_id", org.id).eq("entity_id", entityId).eq("done", false);
    // Só move as tarefas que estavam com o responsável anterior
    q = current.owner_id ? q.eq("assignee_id", current.owner_id) : q.is("assignee_id", null);
    const { count } = await q;
    moved = count ?? 0;
  }

  revalidatePath("/", "layout");
  const notified = ownerId === user.id ? "" : ` ${target.name.split(" ")[0]} foi notificado(a).`;
  const tasksMsg = moved ? ` ${moved} ${moved === 1 ? "tarefa em aberto foi transferida" : "tarefas em aberto foram transferidas"}.` : "";
  return { ok: true, message: `Responsável alterado para ${target.name}.${tasksMsg}${notified}` };
}

export async function deleteEntity(id: string): Promise<ActionState> {
  const { supabase } = await getContext();
  // Exclusão reversível: vai para a lixeira (Configurações › Lixeira) por 60 dias
  const { error } = await supabase.rpc("trash_move", { p_table: "entities", p_id: id });
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  redirect("/contatos");
}

export async function saveContact(entityId: string, contactId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const contact = {
    name: str(fd, "name"),
    job_title: str(fd, "job_title"),
    email: str(fd, "email")?.toLowerCase() ?? null,
    phone: str(fd, "phone"),
  };
  if (!contact.name) return { error: "Informe o nome do contato." };
  const { error } = contactId
    ? await supabase.from("contacts").update(contact).eq("id", contactId).eq("org_id", org.id)
    : await supabase.from("contacts").insert({ ...contact, entity_id: entityId, org_id: org.id });
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: contactId ? "Contato atualizado." : "Contato adicionado." };
}

export async function deleteContact(id: string): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const { error } = await supabase.from("contacts").delete().eq("id", id).eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: "Contato removido." };
}

/** Importação de CSV (separador ; ou ,). Colunas: nome, tipo, documento, email, telefone, cidade, estado, segmento, site. */
export async function importEntities(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org, user } = await getContext();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione um arquivo CSV." };
  if (file.size > 2 * 1024 * 1024) return { error: "O arquivo deve ter no máximo 2 MB." };

  const text = (await file.text()).replace(/^﻿/, "");
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "O arquivo não tem linhas de dados." };

  const header = rows[0].map((h) =>
    h
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toLowerCase(),
  );
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const idx = {
    name: col("nome", "name", "razao social", "empresa"),
    kind: col("tipo", "kind"),
    document: col("documento", "cnpj", "cpf", "cnpj/cpf"),
    email: col("email", "e-mail"),
    phone: col("telefone", "phone", "celular"),
    city: col("cidade", "city"),
    state: col("estado", "uf", "state"),
    segment: col("segmento", "segment", "setor"),
    website: col("site", "website"),
  };
  if (idx.name < 0) return { error: "A primeira linha precisa ter uma coluna \"nome\"." };

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() || null : null);
  const records = rows
    .slice(1, 2001)
    .filter((r) => get(r, idx.name))
    .map((r) => ({
      org_id: org.id,
      owner_id: user.id,
      created_by: user.id,
      name: get(r, idx.name)!.slice(0, 200),
      kind: /pessoa|pf|fisica/i.test(get(r, idx.kind) ?? "") ? "pessoa" : "empresa",
      document: get(r, idx.document)?.replace(/[^0-9A-Za-z]/g, "").toUpperCase() || null,
      email: get(r, idx.email)?.toLowerCase() ?? null,
      phone: get(r, idx.phone),
      city: get(r, idx.city),
      state: get(r, idx.state)?.toUpperCase().slice(0, 2) ?? null,
      segment: get(r, idx.segment),
      website: get(r, idx.website),
    }));

  if (records.length === 0) return { error: "Nenhuma linha válida encontrada." };
  for (let i = 0; i < records.length; i += 500) {
    const { error } = await supabase.from("entities").insert(records.slice(i, i + 500));
    if (error) return { error: `Erro ao importar (a partir da linha ${i + 2}): ${dbError(error)}` };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: `${records.length} cadastros importados.` };
}

function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const ENTITY_PHOTO_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/entity-photos/`;

/** Grava a foto do cliente (o arquivo já foi enviado pelo navegador para entity-photos/<org>/<cliente>/). */
export async function setEntityPhoto(entityId: string, url: string): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const folder = `${ENTITY_PHOTO_PREFIX}${org.id}/${entityId}/`;
  if (!url.startsWith(folder)) return { error: "Arquivo de foto inválido." };

  const { data: current } = await supabase.from("entities").select("avatar_url").eq("id", entityId).eq("org_id", org.id).single();
  if (!current) return { error: "Cliente não encontrado." };
  const { error } = await supabase.from("entities").update({ avatar_url: url }).eq("id", entityId).eq("org_id", org.id);
  if (error) return { error: dbError(error)! };

  const old = current.avatar_url as string | null;
  if (old && old !== url && old.startsWith(folder)) {
    await supabase.storage.from("entity-photos").remove([old.slice(ENTITY_PHOTO_PREFIX.length)]);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Foto do cliente atualizada." };
}

export async function removeEntityPhoto(entityId: string): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const { data: current } = await supabase.from("entities").select("avatar_url").eq("id", entityId).eq("org_id", org.id).single();
  if (!current) return { error: "Cliente não encontrado." };
  const { error } = await supabase.from("entities").update({ avatar_url: null }).eq("id", entityId).eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  const old = current.avatar_url as string | null;
  if (old?.startsWith(`${ENTITY_PHOTO_PREFIX}${org.id}/${entityId}/`)) {
    await supabase.storage.from("entity-photos").remove([old.slice(ENTITY_PHOTO_PREFIX.length)]);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Foto do cliente removida." };
}
