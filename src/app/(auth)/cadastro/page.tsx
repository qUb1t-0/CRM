import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { signup } from "../actions";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Criar conta</h1>
      <p className="mt-1 text-sm text-muted">Comece a organizar suas vendas em poucos minutos.</p>

      <ActionForm action={signup} className="mt-6 space-y-4">
        <Field label="Seu nome" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required autoFocus />
        </Field>
        <Field label="E-mail de trabalho" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Senha" htmlFor="password" hint="Mínimo de 8 caracteres.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <SubmitButton className="w-full" pendingText="Criando conta…">
          Criar conta
        </SubmitButton>
      </ActionForm>

      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
