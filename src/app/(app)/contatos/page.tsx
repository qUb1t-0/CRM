import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Download, Plus, Upload, User } from "lucide-react";
import { Modal } from "@/components/forms";
import { Card, EmptyState, LinkButton, PageHeader, Pagination, SearchField, Select, Table } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";
import { ActiveFilterChips, ContactFilters } from "@/components/contact-filters";
import { applyContactFilters, countActive, filtersToParams, parseContactFilters } from "@/lib/contact-filters";
import { combineOr, getContext, getCustomFields, getMembers, getOwnerFilter, ownedByFilter } from "@/lib/session";
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
  const [members, fields, ownerFilter] = await Promise.all([getMembers(), getCustomFields("entidade"), getOwnerFilter()]);

  const q = sanitizeSearch(one("q"));
  const kind = one("tipo");
  const resp = one("resp") ?? "todos";
  const page = Math.max(1, Number(one("p")) || 1);
  const filters = parseContactFilters(sp);
  const filterParams = filtersToParams(filters);

  // Segmentos já usados na base (opções do filtro "Segmento")
  const { data: segRows } = await ctx.supabase
    .from("entities")
    .select("segment")
    .eq("org_id", ctx.org.id)
    .not("segment", "is", null)
    .limit(5000);
  const segments = [...new Set((segRows ?? []).map((r) => (r.segment as string).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  let query = ctx.supabase
    .from("entities")
    .select("id, kind, name, document, email, phone, city, state, owner_id, avatar_url, contacts(count)", { count: "exact" })
    .eq("org_id", ctx.org.id);
  const orGroups: string[] = [];
  if (q) {
    const doc = q.replace(/[^0-9A-Za-z]/g, "");
    const filters = [`name.ilike.%${q}%`, `email.ilike.%${q}%`];
    if (doc.length >= 3) filters.push(`document.ilike.%${doc}%`);
    orGroups.push(filters.join(","));
  }
  // Filtro do administrador: cadastros de que os usuários são responsáveis ou que eles criaram
  if (ownerFilter) orGroups.push(ownedByFilter(["owner_id", "created_by"], ownerFilter));
  if (orGroups.length) query = query.or(combineOr(orGroups));
  if (kind === "empresa" || kind === "pessoa") query = query.eq("kind", kind);
  if (!ownerFilter && resp === "meus") query = query.eq("owner_id", ctx.user.id);
  query = applyContactFilters(query, filters);
  const { data, count } = await query.order("name").range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  const href = (p: number) => {
    const s = new URLSearchParams(filterParams);
    if (q) s.set("q", q);
    if (kind) s.set("tipo", kind);
    if (resp !== "todos") s.set("resp", resp);
    s.set("p", String(p));
    return `/contatos?${s}`;
  };
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name ?? "—";
  const hasFilters = !!q || countActive(filters) > 0;

  // Etiquetas dos filtros ativos
  const chips: { key: string; label: string }[] = [];
  if (filters.autor.length)
    chips.push({ key: "autor", label: `Autor: ${filters.autor.map((id) => memberName(id)).join(", ")}` });
  if (filters.uf.length) chips.push({ key: "uf", label: `Estado: ${filters.uf.join(", ")}` });
  if (filters.cidade) chips.push({ key: "cidade", label: `Cidade: ${filters.cidade}` });
  if (filters.doc) chips.push({ key: "doc", label: `CPF/CNPJ: ${filters.doc}` });
  if (filters.email) chips.push({ key: "email", label: `E-mail: ${filters.email}` });
  if (filters.fone) chips.push({ key: "fone", label: `Telefone: ${filters.fone}` });
  if (filters.segmento.length) chips.push({ key: "segmento", label: `Segmento: ${filters.segmento.join(", ")}` });

  return (
    <>
      <PageHeader
        title="Contatos"
        description="Empresas e pessoas com quem você se relaciona."
        actions={
          <>
            <LinkButton
              href={`/api/exportar/contatos${countActive(filters) ? `?${new URLSearchParams(filterParams)}` : ""}`}
              prefetch={false}
              variant="ghost"
              title={countActive(filters) ? "Exporta somente os contatos filtrados" : "Exportar todos os contatos"}
            >
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
      <FilterForm className="flex flex-wrap items-center gap-2" action="/contatos">
        {/* Mantém os filtros avançados ao usar a busca e os seletores */}
        {Object.entries(filterParams).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <SearchField defaultValue={q} placeholder="Nome, e-mail ou documento…" />
        <Select name="tipo" defaultValue={kind ?? ""} className="w-auto" aria-label="Tipo">
          <option value="">Empresas e pessoas</option>
          <option value="empresa">Somente empresas</option>
          <option value="pessoa">Somente pessoas</option>
        </Select>
        {!ownerFilter && (
          <Select name="resp" defaultValue={resp} className="w-auto" aria-label="Responsável">
            <option value="todos">Todos</option>
            <option value="meus">Meus cadastros</option>
          </Select>
        )}
      </FilterForm>
      <ContactFilters
        values={filters}
        members={members.map((m) => ({ id: m.id, name: m.name, email: m.email }))}
        segments={segments}
        currentUserId={ctx.user.id}
      />
      <span className="tabular ml-auto text-sm text-muted">
        {(count ?? 0).toLocaleString("pt-BR")} {count === 1 ? "contato" : "contatos"}
      </span>
      </div>

      <ActiveFilterChips chips={chips} />

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
                        {e.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- foto do cliente (Supabase Storage)
                          <img src={e.avatar_url} alt="" loading="lazy" className="size-7 shrink-0 rounded-lg object-cover ring-1 ring-line" />
                        ) : (
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                            {e.kind === "pessoa" ? <User className="size-4" /> : <Building2 className="size-4" />}
                          </span>
                        )}
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
          <EmptyState icon={<Building2 className="size-8" />} title={hasFilters ? "Nenhum contato com esses filtros" : "Nenhum cadastro ainda"}>
            {hasFilters ? "Ajuste ou limpe os filtros para ver mais resultados." : "Cadastre sua primeira empresa ou pessoa, ou importe uma planilha."}
          </EmptyState>
        )}
      </Card>
    </>
  );
}
