import Link from "next/link";
import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Table, cn } from "@/components/ui";
import { getContext } from "@/lib/session";
import { proposalTone } from "@/lib/labels";
import { date, money } from "@/lib/format";

export const metadata: Metadata = { title: "Propostas" };


const STATUSES = ["todas", "rascunho", "enviada", "aceita", "recusada"];

export default async function ProposalsPage({ searchParams }: PageProps<"/propostas">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status) ? sp.status : "todas";
  const ctx = await getContext();

  let query = ctx.supabase
    .from("proposals")
    .select("id, number, title, status, total, valid_until, created_at, deal:deals(id, title, entity:entities(name))")
    .eq("org_id", ctx.org.id)
    .order("number", { ascending: false })
    .limit(200);
  if (status !== "todas") query = query.eq("status", status);
  const { data } = await query;

  return (
    <>
      <PageHeader title="Propostas" description="Propostas comerciais geradas a partir das oportunidades." />
      <nav className="mb-4 inline-flex flex-wrap gap-1 rounded-md border border-line bg-surface p-0.5" aria-label="Situação">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/propostas?status=${s}`}
            className={cn("rounded px-2.5 py-1.5 text-sm capitalize", status === s ? "bg-surface-2 font-medium" : "text-muted hover:text-fg")}
          >
            {s}
          </Link>
        ))}
      </nav>
      <Card>
        {data && data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Proposta</th>
                <th>Cliente</th>
                <th className="text-right!">Total</th>
                <th>Validade</th>
                <th>Criada</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => {
                const deal = p.deal as unknown as { id: string; title: string; entity: { name: string } | null } | null;
                return (
                  <tr key={p.id}>
                    <td className="tabular text-muted">{p.number}</td>
                    <td>
                      <Link href={`/propostas/${p.id}`} className="font-medium hover:text-brand">
                        {p.title}
                      </Link>
                    </td>
                    <td className="text-muted">{deal?.entity?.name ?? "—"}</td>
                    <td className="tabular text-right">{money(p.total)}</td>
                    <td className="tabular text-muted">{date(p.valid_until)}</td>
                    <td className="tabular text-muted">{date(p.created_at)}</td>
                    <td>
                      <Badge tone={proposalTone[p.status as keyof typeof proposalTone]} className="capitalize">
                        {p.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<FileText className="size-8" />} title="Nenhuma proposta">
            Gere propostas na página de uma oportunidade.
          </EmptyState>
        )}
      </Card>
    </>
  );
}
