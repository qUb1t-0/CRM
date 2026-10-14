import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { Card, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Módulo bloqueado" };

const NAMES: Record<string, string> = {
  oportunidades: "Oportunidades",
  propostas: "Propostas",
  produtos: "Produtos",
  metas: "Metas",
};

export default async function LockedPage({ searchParams }: PageProps<"/bloqueado">) {
  const sp = await searchParams;
  const name = NAMES[typeof sp.modulo === "string" ? sp.modulo : ""] ?? "Este módulo";

  return (
    <Card className="mx-auto mt-6 max-w-md p-8 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Lock className="size-5" />
      </span>
      <h1 className="mt-4 text-lg font-semibold">{name} está bloqueado por enquanto</h1>
      <p className="mt-1.5 text-sm text-pretty text-muted">
        A seção Vendas (Oportunidades, Propostas, Produtos e Metas) ainda não está liberada. Enquanto isso, use Contatos,
        Tarefas e Agenda.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <LinkButton href="/" variant="primary">
          Voltar ao início
        </LinkButton>
        <LinkButton href="/contatos">Ir para Contatos</LinkButton>
      </div>
    </Card>
  );
}
