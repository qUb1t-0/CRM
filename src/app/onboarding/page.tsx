import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Logo } from "@/components/logo";
import { Card, Field, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/session";
import { createOrganization } from "./actions";

export const metadata: Metadata = { title: "Criar sua base" };

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  await supabase.rpc("accept_pending_invites");
  const { count } = await supabase.from("memberships").select("org_id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) > 0) redirect("/");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <Logo />
      <Card className="w-full max-w-md p-6">
        <h1 className="text-lg font-semibold">Crie a base da sua empresa</h1>
        <p className="mt-1 text-sm text-muted">
          A base reúne sua equipe, seus contatos e o funil de vendas. Você poderá convidar colegas depois.
        </p>
        <ActionForm action={createOrganization} className="mt-5 space-y-4">
          <Field label="Nome da empresa" htmlFor="name">
            <Input id="name" name="name" required minLength={2} maxLength={120} autoFocus placeholder="Ex.: Acme Soluções" />
          </Field>
          <SubmitButton className="w-full" pendingText="Criando…">
            Criar base e começar
          </SubmitButton>
        </ActionForm>
        <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
          Foi convidado por alguém? Peça para enviarem o convite para <strong className="text-fg">{user.email}</strong> e
          recarregue esta página.
        </p>
      </Card>
      <form action="/auth/sair" method="post">
        <button className="text-sm text-muted hover:text-fg">Sair</button>
      </form>
    </main>
  );
}
