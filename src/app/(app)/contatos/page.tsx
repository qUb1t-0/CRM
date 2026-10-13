import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Download, Plus, Upload, User } from "lucide-react";
import { Modal } from "@/components/forms";
import { Card, EmptyState, LinkButton, PageHeader, Pagination, SearchField, Select, Table } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";
import { getContext, getCustomFields, getMembers } from "@/lib/session";
import { sanitizeSearch } from "@/lib/forms";
import { documentMask } from "@/lib/format";
import { createEntity } from "./actions";
import { EntityForm } from "./entity-form";

export const metadata: Metadata = { title: "Contatos" };

const PER_PAGE = 50;

export default async function EntitiesPage({ searchParams }: PageProps<"/contatos">) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const ctx = await getContext();
  const [members, fields] = await Promise.all([getMembers(), getCustomFields("entidade")]);

  const q = sanitizeSearch(one("q"));
  const kind = one("tipo");
  const resp = one("resp") ?? "todos";
  const page = Math.max(1, Number(one("p")) || 1);

  let query = ctx.supabase
    .from("entities")
    .select("id, kind, name, document, email, phone, city, state, owner_id, contacts(count)", { count: "exact" })
    .eq("org_id", ctx.org.id);
  if (q) {
    const doc = q.replace(/[^0-9A-Za-z]/g, "");
    const filters = [`name.ilike.%${q}%`, `email.ilike.%${q}%`];
    if (doc.length >= 3) filters.push(`document.ilike.%${doc}%`);
    query = query.or(filters.join(","));
  }
  if (kind === "empresa" || kind === "pessoa") query = query.eq("kind", kind);
  if (resp === "meus") query = query.eq("owner_id", ctx.user.id);
  const { data, count } = await query.order("name").range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  const href = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (kind) s.set("tipo", kind);
    if (resp !== "todos") s.set("resp", resp);
    s.set("p", String(p));
    return `/contatos?${s}`;
  };
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name ?? "—";

  return (
    <>
      <PageHeader
        title="Contatos"
        description="Empresas e pessoas com quem você se relaciona."
        actions={
          <>
            <LinkButton href="/api/exportar/contatos" prefetch={false} variant="ghost">
              <Download className="size-4" /> Exportar
            </LinkButton>
            <LinkButton href="/contatos/importar" variant="ghost">
              <Upload className="size-4" /> Importar
            </LinkButton>
            <Modal title="Novo cadastro" autoOpenParam="novo" triggerVariant="primary" wide trigger={<><Plus className="size-4" /> Novo cadastro</>}>
              <EntityForm action={createEntity} members={members} fields={fields} currentUserId={ctx.user.id} submitLabel="Cadastrar" />
            </Modal>
          </>
        }
      />

      <FilterForm className="mb-4 flex flex-wrap gap-2" action="/contatos">
        <SearchField defaultValue={q} placeholder="Nome, e-mail ou documento…" />
        <Select name="tipo" defaultValue={kind ?? ""} className="w-auto" aria-label="Tipo">
          <option value="">Empresas e pessoas</option>
          <option value="empresa">Somente empresas</option>
          <option value="pessoa">Somente pessoas</option>
        </Select>
        <Select name="resp" defaultValue={resp} className="w-auto" aria-label="Responsável">
          <option value="todos">Todos</option>
          <option value="meus">Meus cadastros</option>
        </Select>
      </FilterForm>

      <Card>
        {data && data.length > 0 ? (
          <>
            <Table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Documento</th>
                  <th>E-mail</th>
                  <th>Telefone</th>
                  <th>Cidade</th>
                  <th>Contatos</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {data.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/contatos/${e.id}`} className="flex items-center gap-2 font-medium hover:text-brand">
                        {e.kind === "pessoa" ? <User className="size-4 text-muted" /> : <Building2 className="size-4 text-muted" />}
                        {e.name}
                      </Link>
                    </td>
                    <td className="tabular text-muted">{documentMask(e.document)}</td>
                    <td className="text-muted">{e.email ?? "—"}</td>
                    <td className="text-muted">{e.phone ?? "—"}</td>
                    <td className="text-muted">{[e.city, e.state].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="tabular text-muted">{(e.contacts as { count: number }[])?.[0]?.count ?? 0}</td>
                    <td className="text-muted">{memberName(e.owner_id)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} total={count ?? 0} perPage={PER_PAGE} href={href} />
          </>
        ) : (
          <EmptyState icon={<Building2 className="size-8" />} title={q ? "Nada encontrado" : "Nenhum cadastro ainda"}>
            {q ? "Tente outros termos de busca." : "Cadastre sua primeira empresa ou pessoa, ou importe uma planilha."}
          </EmptyState>
        )}
      </Card>
    </>
  );
}
