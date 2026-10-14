import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Kanban, User, UserRound } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { combineOr, getContext, getOwnerFilter, ownedByFilter } from "@/lib/session";
import { SALES_LOCKED } from "@/lib/features";
import { sanitizeSearch } from "@/lib/forms";
import { money } from "@/lib/format";
import { dealStatusLabel, dealStatusTone } from "@/lib/labels";

export const metadata: Metadata = { title: "Busca" };

export default async function SearchPage({ searchParams }: PageProps<"/busca">) {
  const sp = await searchParams;
  const q = sanitizeSearch(typeof sp.q === "string" ? sp.q : "");
  const ctx = await getContext();

  if (q.length < 2) {
    return (
      <>
        <PageHeader title="Busca" />
        <Card>
          <EmptyState title="Digite pelo menos 2 caracteres na busca" />
        </Card>
      </>
    );
  }

  const pattern = `%${q}%`;
  const ownerFilter = await getOwnerFilter();
  const textOr = `name.ilike.${pattern},email.ilike.${pattern}`;
  const entityOr = ownerFilter ? combineOr([textOr, ownedByFilter(["owner_id", "created_by"], ownerFilter)]) : textOr;
  const [entities, contacts, deals] = await Promise.all([
    ctx.supabase.from("entities").select("id, name, kind, city, state").eq("org_id", ctx.org.id).or(entityOr).order("name").limit(20),
    ctx.supabase
      .from("contacts")
      .select("id, name, email, job_title, entity:entities!inner(id, name)")
      .eq("org_id", ctx.org.id)
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .order("name")
      .limit(20),
    SALES_LOCKED
      ? Promise.resolve({ data: [] as { id: string; title: string; value: number; status: string }[] })
      : (ownerFilter
          ? ctx.supabase.from("deals").select("id, title, value, status").eq("org_id", ctx.org.id).or(ownedByFilter(["owner_id", "created_by"], ownerFilter))
          : ctx.supabase.from("deals").select("id, title, value, status").eq("org_id", ctx.org.id)
        ).ilike("title", pattern).order("created_at", { ascending: false }).limit(20),
  ]);

  const total = (entities.data?.length ?? 0) + (contacts.data?.length ?? 0) + (deals.data?.length ?? 0);

  return (
    <>
      <PageHeader title={`Resultados para “${q}”`} description={`${total} resultado${total === 1 ? "" : "s"}`} />
      {total === 0 ? (
        <Card>
          <EmptyState title="Nada encontrado">Tente outro termo.</EmptyState>
        </Card>
      ) : (
        <div className={SALES_LOCKED ? "grid gap-6 lg:grid-cols-2" : "grid gap-6 lg:grid-cols-3"}>
          <Card>
            <CardHeader title="Empresas e pessoas" />
            <ul className="divide-y divide-line">
              {(entities.data ?? []).map((e) => (
                <li key={e.id}>
                  <Link href={`/contatos/${e.id}`} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-2/60">
                    {e.kind === "pessoa" ? <User className="size-4 text-muted" /> : <Building2 className="size-4 text-muted" />}
                    <span className="flex-1 truncate">{e.name}</span>
                    <span className="text-xs text-muted">{e.state}</span>
                  </Link>
                </li>
              ))}
              {(entities.data ?? []).length === 0 && <li className="px-4 py-3 text-sm text-muted">Nenhum.</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Pessoas de contato" />
            <ul className="divide-y divide-line">
              {(contacts.data ?? []).map((c) => {
                const entity = c.entity as unknown as { id: string; name: string } | null;
                return (
                  <li key={c.id}>
                    <Link href={`/contatos/${entity?.id}`} className="flex items-start gap-2 px-4 py-2.5 text-sm hover:bg-surface-2/60">
                      <UserRound className="mt-0.5 size-4 text-muted" />
                      <span className="min-w-0">
                        <span className="block truncate">{c.name}</span>
                        <span className="block truncate text-xs text-muted">{[c.job_title, entity?.name].filter(Boolean).join(" · ")}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
              {(contacts.data ?? []).length === 0 && <li className="px-4 py-3 text-sm text-muted">Nenhum.</li>}
            </ul>
          </Card>
          {!SALES_LOCKED && (
          <Card>
            <CardHeader title="Oportunidades" />
            <ul className="divide-y divide-line">
              {(deals.data ?? []).map((d) => (
                <li key={d.id}>
                  <Link href={`/oportunidades/${d.id}`} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-2/60">
                    <Kanban className="size-4 text-muted" />
                    <span className="flex-1 truncate">{d.title}</span>
                    <span className="tabular text-xs text-muted">{money(d.value)}</span>
                    <Badge tone={dealStatusTone[d.status as keyof typeof dealStatusTone]}>{dealStatusLabel[d.status as keyof typeof dealStatusLabel]}</Badge>
                  </Link>
                </li>
              ))}
              {(deals.data ?? []).length === 0 && <li className="px-4 py-3 text-sm text-muted">Nenhuma.</li>}
            </ul>
          </Card>
          )}
        </div>
      )}
    </>
  );
}
