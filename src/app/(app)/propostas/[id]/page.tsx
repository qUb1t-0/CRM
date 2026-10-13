import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/forms";
import { PrintButton } from "@/components/print-button";
import { Badge, Card, Table } from "@/components/ui";
import { getContext, getMembers } from "@/lib/session";
import { date, documentMask, money } from "@/lib/format";
import { deleteProposal, setProposalStatus } from "../actions";
import { proposalTone } from "@/lib/labels";

export const metadata: Metadata = { title: "Proposta" };

type Item = { description: string; quantity: number; unit_price: number; discount_pct: number; total: number };

export default async function ProposalPage({ params }: PageProps<"/propostas/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  const { data: p } = await ctx.supabase
    .from("proposals")
    .select(
      "*, deal:deals(id, title, owner_id, entity:entities(name, document, email, phone, city, state), contact:contacts(name, email))",
    )
    .eq("id", id)
    .eq("org_id", ctx.org.id)
    .maybeSingle();
  if (!p) notFound();

  const members = await getMembers();
  const deal = p.deal as {
    id: string;
    title: string;
    owner_id: string | null;
    entity: { name: string; document: string | null; email: string | null; phone: string | null; city: string | null; state: string | null } | null;
    contact: { name: string; email: string | null } | null;
  };
  const seller = members.find((m) => m.id === deal.owner_id) ?? members.find((m) => m.id === p.created_by);
  const items = (p.items ?? []) as Item[];

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/oportunidades/${deal.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" /> {deal.title}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={proposalTone[p.status as keyof typeof proposalTone]} className="capitalize">
            {p.status}
          </Badge>
          {p.status === "rascunho" && (
            <ActionButton action={setProposalStatus.bind(null, p.id, "enviada")} size="md">
              Marcar como enviada
            </ActionButton>
          )}
          {(p.status === "rascunho" || p.status === "enviada") && (
            <>
              <ActionButton action={setProposalStatus.bind(null, p.id, "aceita")} size="md">
                Aceita
              </ActionButton>
              <ActionButton action={setProposalStatus.bind(null, p.id, "recusada")} size="md" variant="danger">
                Recusada
              </ActionButton>
            </>
          )}
          {(p.status === "aceita" || p.status === "recusada") && (
            <ActionButton action={setProposalStatus.bind(null, p.id, "enviada")} size="md" variant="ghost">
              Voltar para enviada
            </ActionButton>
          )}
          <PrintButton />
          <ActionButton action={deleteProposal.bind(null, p.id)} confirm="Excluir esta proposta?" variant="ghost" size="md" title="Excluir proposta">
            <Trash2 className="size-4" />
          </ActionButton>
        </div>
      </div>

      <Card className="mx-auto max-w-3xl p-8 print:border-0 print:p-0 sm:p-10">
        <header className="flex flex-col justify-between gap-6 border-b border-line pb-6 sm:flex-row">
          <div>
            <p className="text-xs font-medium tracking-wider text-brand uppercase">Proposta comercial</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{p.title}</h1>
            <p className="mt-1 text-sm text-muted">{ctx.org.name}</p>
          </div>
          <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:text-right">
            <dt className="text-muted">Número</dt>
            <dd className="font-medium">{String(p.number).padStart(4, "0")}</dd>
            <dt className="text-muted">Emissão</dt>
            <dd>{date(p.created_at)}</dd>
            <dt className="text-muted">Validade</dt>
            <dd>{date(p.valid_until)}</dd>
          </dl>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-medium tracking-wider text-muted uppercase">Cliente</h2>
            <p className="mt-1.5 font-medium">{deal.entity?.name ?? "—"}</p>
            {deal.entity?.document && <p className="text-sm text-muted">{documentMask(deal.entity.document)}</p>}
            {deal.contact && <p className="text-sm text-muted">A/C {deal.contact.name}</p>}
            {(deal.contact?.email || deal.entity?.email) && <p className="text-sm text-muted">{deal.contact?.email ?? deal.entity?.email}</p>}
            {deal.entity?.city && (
              <p className="text-sm text-muted">{[deal.entity.city, deal.entity.state].filter(Boolean).join(" / ")}</p>
            )}
          </div>
          <div>
            <h2 className="text-xs font-medium tracking-wider text-muted uppercase">Responsável</h2>
            <p className="mt-1.5 font-medium">{seller?.name ?? "—"}</p>
            {seller?.email && <p className="text-sm text-muted">{seller.email}</p>}
          </div>
        </section>

        <div className="-mx-4 rounded-lg border border-line">
          <Table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th className="text-right!">Qtd.</th>
                <th className="text-right!">Unitário</th>
                <th className="text-right!">Desc.</th>
                <th className="text-right!">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={idx}>
                  <td>{i.description}</td>
                  <td className="tabular text-right">{Number(i.quantity).toLocaleString("pt-BR")}</td>
                  <td className="tabular text-right">{money(i.unit_price)}</td>
                  <td className="tabular text-right">{Number(i.discount_pct)}%</td>
                  <td className="tabular text-right">{money(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div className="mt-4 flex justify-end">
          <div className="tabular flex items-baseline gap-6 rounded-lg bg-surface-2 px-5 py-3">
            <span className="text-sm text-muted">Total</span>
            <span className="text-xl font-semibold">{money(p.total)}</span>
          </div>
        </div>

        {p.notes && (
          <section className="mt-8 border-t border-line pt-6">
            <h2 className="text-xs font-medium tracking-wider text-muted uppercase">Condições e observações</h2>
            <p className="mt-2 text-sm whitespace-pre-wrap">{p.notes}</p>
          </section>
        )}
      </Card>
    </>
  );
}
