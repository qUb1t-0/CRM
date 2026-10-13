"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext, getCustomFields } from "@/lib/session";
import { dbError, readCustom, str } from "@/lib/forms";
import type { ActionState } from "@/lib/types";

async function readEntity(fd: FormData) {
  const fields = await getCustomFields("entidade");
  const kind = str(fd, "kind") === "pessoa" ? "pessoa" : "empresa";
  const document = str(fd, "document")?.replace(/[^0-9A-Za-z]/g, "").toUpperCase() || null;
  return {
    kind,
    name: str(fd, "name"),
    document,
    email: str(fd, "email")?.toLowerCase() ?? null,
    phone: str(fd, "phone"),
    website: str(fd, "website"),
    city: str(fd, "city"),
    state: str(fd, "state")?.toUpperCase().slice(0, 2) ?? null,
    segment: str(fd, "segment"),
    notes: str(fd, "notes"),
    owner_id: str(fd, "owner_id"),
    custom: readCustom(fd, fields),
  };
}

function validDocument(doc: string | null, kind: string) {
  if (!doc) return true;
  if (kind === "pessoa") return /^\d{11}$/.test(doc);
  // CNPJ numérico ou alfanumérico (a partir de jul/2026): 12 caracteres alfanuméricos + 2 dígitos
  return /^[0-9A-Z]{12}\d{2}$/.test(doc);
}

export async function createEntity(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, org, user } = await getContext();
  const entity = await readEntity(fd);
  if (!entity.name) return { error: "Informe o nome." };
  if (!validDocument(entity.document, entity.kind)) {
    return { error: entity.kind === "pessoa" ? "CPF deve ter 11 dígitos." : "CNPJ inválido (14 caracteres)." };
  }
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
  const { supabase, org } = await getContext();
  const entity = await readEntity(fd);
  if (!entity.name) return { error: "Informe o nome." };
  if (!validDocument(entity.document, entity.kind)) {
    return { error: entity.kind === "pessoa" ? "CPF deve ter 11 dígitos." : "CNPJ inválido (14 caracteres)." };
  }
  const { error } = await supabase.from("entities").update(entity).eq("id", id).eq("org_id", org.id);
  if (error) return { error: dbError(error)! };
  revalidatePath("/", "layout");
  return { ok: true, message: "Cadastro atualizado." };
}

export async function deleteEntity(id: string): Promise<ActionState> {
  const { supabase, org } = await getContext();
  const { error } = await supabase.from("entities").delete().eq("id", id).eq("org_id", org.id);
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
