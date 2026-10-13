"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext, str } from "@/lib/forms";
import type { ActionState } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function authMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (/already registered/i.test(message)) return "Este e-mail já está cadastrado. Faça login.";
  if (/rate limit/i.test(message)) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (/password/i.test(message) && /characters/i.test(message)) return "A senha precisa ter pelo menos 8 caracteres.";
  return message;
}

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email")?.toLowerCase() ?? "";
  const password = String(fd.get("password") ?? "");
  if (!EMAIL_RE.test(email)) return { error: "Informe um e-mail válido." };
  if (password.length < 4) return { error: "Informe sua senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authMessage(error.message) };

  await supabase.rpc("accept_pending_invites");
  redirect(safeNext(str(fd, "next")));
}

export async function signup(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, "name") ?? "";
  const email = str(fd, "email")?.toLowerCase() ?? "";
  const password = String(fd.get("password") ?? "");
  if (name.length < 2) return { error: "Informe seu nome." };
  if (!EMAIL_RE.test(email)) return { error: "Informe um e-mail válido." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { error: authMessage(error.message) };

  // Com confirmação de e-mail desligada, a sessão já vem pronta.
  if (data.session) {
    await supabase.rpc("accept_pending_invites");
    redirect("/onboarding");
  }
  return { ok: true, message: "Enviamos um link de confirmação para o seu e-mail." };
}

export async function forgotPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email")?.toLowerCase() ?? "";
  if (!EMAIL_RE.test(email)) return { error: "Informe um e-mail válido." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/redefinir-senha`,
  });
  if (error && /rate limit/i.test(error.message)) return { error: authMessage(error.message) };
  // Resposta neutra: não revela se o e-mail existe.
  return { ok: true, message: "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha." };
}

export async function updatePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return { error: "Use letras e números na senha." };
  if (password !== confirm) return { error: "As senhas não coincidem." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authMessage(error.message) };
  redirect("/");
}

export async function loginWithGoogle(fd: FormData) {
  const supabase = await createClient();
  const next = safeNext(str(fd, "next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?erro=google");
  redirect(data.url);
}
