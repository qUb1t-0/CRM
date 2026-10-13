import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { forgotPassword } from "../actions";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Recuperar senha</h1>
      <p className="mt-1 text-sm text-muted">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>

      <ActionForm action={forgotPassword} className="mt-6 space-y-4">
        <Field label="E-mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <SubmitButton className="w-full" pendingText="Enviando…">
          Enviar link
        </SubmitButton>
      </ActionForm>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-brand hover:underline">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
