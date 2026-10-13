import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardHeader, Field, Input } from "@/components/ui";
import { getContext } from "@/lib/session";
import { updateOrganization, updateProfile } from "./actions";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const ctx = await getContext();
  return (
    <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Empresa" />
        <ActionForm action={updateOrganization} className="space-y-4 p-4">
          <Field label="Nome da empresa" htmlFor="org-name">
            <Input id="org-name" name="name" defaultValue={ctx.org.name} required disabled={!ctx.isAdmin} />
          </Field>
          {ctx.isAdmin ? (
            <SubmitButton>Salvar</SubmitButton>
          ) : (
            <p className="text-xs text-muted">Somente administradores podem alterar.</p>
          )}
        </ActionForm>
      </Card>
      <Card>
        <CardHeader title="Meu perfil" />
        <ActionForm action={updateProfile} className="space-y-4 p-4">
          <Field label="Nome" htmlFor="full_name">
            <Input id="full_name" name="full_name" defaultValue={ctx.profile.name} required />
          </Field>
          <Field label="E-mail" htmlFor="email" hint="Para trocar a senha, use “Esqueci minha senha” na tela de login.">
            <Input id="email" value={ctx.profile.email} disabled readOnly />
          </Field>
          <SubmitButton>Salvar</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
