import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Card, CardHeader, Field, Input } from "@/components/ui";
import { getContext } from "@/lib/session";
import { updateOrganization } from "./actions";

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
        <Link href="/configuracoes/perfil" className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-2/60">
          <Avatar name={ctx.profile.name} src={ctx.profile.avatarUrl} size="lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{ctx.profile.name}</span>
            <span className="block truncate text-xs text-muted">{ctx.profile.jobTitle ?? ctx.profile.email}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-brand">
            Editar perfil <ChevronRight className="size-4" />
          </span>
        </Link>
      </Card>
    </div>
  );
}
