import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Logo } from "@/components/logo";
import { Card, Field, Input } from "@/components/ui";
import { getUser } from "@/lib/session";
import { updatePassword } from "../(auth)/actions";

export const metadata: Metadata = { title: "Nova senha" };

export default async function ResetPasswordPage() {
  const user = await getUser();
  if (!user) redirect("/login?erro=link");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <Logo />
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold">Criar nova senha</h1>
        <p className="mt-1 text-sm text-muted">Para {user.email}</p>
        <ActionForm action={updatePassword} className="mt-5 space-y-4">
          <Field label="Nova senha" htmlFor="password" hint="Mínimo de 8 caracteres, com letras e números.">
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
          <Field label="Confirmar senha" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
          <SubmitButton className="w-full">Salvar senha</SubmitButton>
        </ActionForm>
      </Card>
    </main>
  );
}
