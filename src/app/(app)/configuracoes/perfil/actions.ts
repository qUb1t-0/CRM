"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { dbError, str } from "@/lib/forms";
import { EMAIL_RE, PHONE_RE, maskPhone, onlyDigits } from "@/lib/br";
import { SUPABASE_URL } from "@/lib/supabase/env";
import type { ActionState } from "@/lib/types";

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

/** Salva os dados do perfil. Troca de e-mail exige confirmação pelo link enviado ao novo endereço. */
export async function saveProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await getContext();

  const name = str(fd, "full_name");
  if (!name || name.length < 2) return { error: "Informe seu nome." };
  if (name.length > 120) return { error: "O nome pode ter no máximo 120 caracteres." };

  const jobTitle = str(fd, "job_title");
  if (jobTitle && jobTitle.length > 80) return { error: "O cargo pode ter no máximo 80 caracteres." };

  const phoneDigits = onlyDigits(str(fd, "phone"));
  const phone = phoneDigits ? maskPhone(phoneDigits) : null;
  if (phone && !PHONE_RE.test(phone)) return { error: "Informe o celular completo no formato (00) 0 0000-0000." };

  const birth = str(fd, "birth_date");
  if (birth) {
    const d = new Date(`${birth}T12:00:00Z`);
    if (Number.isNaN(d.getTime()) || birth < "1900-01-01" || d.getTime() > Date.now()) {
      return { error: "Data de nascimento inválida." };
    }
  }

  const bio = str(fd, "bio");
  if (bio && bio.length > 500) return { error: "A observação pode ter no máximo 500 caracteres." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: name, job_title: jobTitle, phone, birth_date: birth, bio })
    .eq("id", user.id);
  if (error) return { error: dbError(error)! };

  // Troca de e-mail (login): o Supabase envia um link de confirmação
  const email = str(fd, "email")?.toLowerCase();
  let emailMsg = "";
  if (email && email !== user.email?.toLowerCase()) {
    if (!EMAIL_RE.test(email)) return { error: "Informe um e-mail válido, com @." };
    const { error: emailError } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${await siteUrl()}/auth/callback?next=/configuracoes/perfil` },
    );
    if (emailError) {
      return {
        error: /already|registered|exists/i.test(emailError.message)
          ? "Este e-mail já está em uso por outra conta."
          : `Perfil salvo, mas não foi possível trocar o e-mail: ${emailError.message}`,
      };
    }
    emailMsg = ` Enviamos um link de confirmação para ${email}. O e-mail só muda depois da confirmação.`;
  }

  revalidatePath("/", "layout");
  return { ok: true, message: `Perfil atualizado.${emailMsg}` };
}

const AVATAR_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/avatars/`;

/** Grava a URL da nova foto (o arquivo já foi enviado pelo navegador para avatars/<user_id>/). */
export async function setAvatar(url: string): Promise<ActionState> {
  const { supabase, user } = await getContext();
  // Só aceita arquivos da pasta do próprio usuário no bucket de avatares
  if (!url.startsWith(`${AVATAR_PREFIX}${user.id}/`)) return { error: "Arquivo de foto inválido." };

  const { data: current } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (error) return { error: dbError(error)! };

  // Remove a foto anterior do armazenamento
  const old = current?.avatar_url as string | null;
  if (old && old !== url && old.startsWith(`${AVATAR_PREFIX}${user.id}/`)) {
    await supabase.storage.from("avatars").remove([old.slice(AVATAR_PREFIX.length).split("?")[0]]);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Foto de perfil atualizada." };
}

export async function removeAvatar(): Promise<ActionState> {
  const { supabase, user } = await getContext();
  const { data: current } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return { error: dbError(error)! };
  const old = current?.avatar_url as string | null;
  if (old?.startsWith(`${AVATAR_PREFIX}${user.id}/`)) {
    await supabase.storage.from("avatars").remove([old.slice(AVATAR_PREFIX.length).split("?")[0]]);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Foto removida." };
}
