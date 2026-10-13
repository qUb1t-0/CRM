import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, buttonClass } from "@/components/ui";
import { login, loginWithGoogle } from "../actions";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const error = sp.erro === "google" ? "Não foi possível entrar com o Google." : sp.erro === "link" ? "O link expirou ou é inválido. Tente novamente." : null;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
      <p className="mt-1 text-sm text-muted">Acesse sua conta para continuar.</p>

      {error && <p className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <ActionForm action={login} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="E-mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <Field label="Senha" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <div className="flex justify-end">
          <Link href="/esqueci-senha" className="text-sm text-brand hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <SubmitButton className="w-full" pendingText="Entrando…">
          Entrar
        </SubmitButton>
      </ActionForm>

      {process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true" && (
        <form action={loginWithGoogle} className="mt-3">
          <input type="hidden" name="next" value={next} />
          <button type="submit" className={`${buttonClass("secondary")} w-full`}>
            <GoogleIcon /> Entrar com Google
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        Não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-brand hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  );
}
