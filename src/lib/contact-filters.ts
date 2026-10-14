import { UF_SIGLAS, onlyDigits } from "@/lib/br";

/** Filtros avançados de contatos, lidos da URL (compartilhado entre servidor e cliente). */
export type ContactFilterValues = {
  autor: string[];
  uf: string[];
  cidade: string;
  doc: string;
  email: string;
  fone: string;
  segmento: string[];
};

export const FILTER_KEYS = ["autor", "uf", "cidade", "doc", "email", "fone", "segmento"] as const;

export const EMPTY_FILTERS: ContactFilterValues = { autor: [], uf: [], cidade: "", doc: "", email: "", fone: "", segmento: [] };

export function countActive(v: ContactFilterValues) {
  return [v.autor.length, v.uf.length, v.cidade, v.doc, v.email, v.fone, v.segmento.length].filter(Boolean).length;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Remove caracteres com significado na sintaxe do PostgREST (ilike). */
const clean = (s: string) => s.replace(/[%_,()*\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

type Filterable = {
  in(column: string, values: string[]): Filterable;
  ilike(column: string, pattern: string): Filterable;
};

/** Aplica os filtros avançados a uma consulta de entities (lista e exportação). */
export function applyContactFilters<Q>(query: Q, f: ContactFilterValues): Q {
  let q = query as unknown as Filterable;
  if (f.autor.length) q = q.in("created_by", f.autor);
  if (f.uf.length) q = q.in("state", f.uf);
  if (f.cidade) q = q.ilike("city", `%${f.cidade}%`);
  if (f.doc) q = q.ilike("document", `%${f.doc}%`);
  if (f.email) q = q.ilike("email", `%${f.email}%`);
  if (f.fone) q = q.ilike("phone_digits", `%${f.fone}%`);
  if (f.segmento.length) q = q.in("segment", f.segmento);
  return q as unknown as Q;
}

/** Parâmetros de URL dos filtros avançados (para manter em links e formulários). */
export function filtersToParams(f: ContactFilterValues) {
  const p: Record<string, string> = {};
  if (f.autor.length) p.autor = f.autor.join(",");
  if (f.uf.length) p.uf = f.uf.join(",");
  if (f.cidade) p.cidade = f.cidade;
  if (f.doc) p.doc = f.doc;
  if (f.email) p.email = f.email;
  if (f.fone) p.fone = f.fone;
  if (f.segmento.length) p.segmento = f.segmento.join("|");
  return p;
}

export function parseContactFilters(sp: Record<string, string | string[] | undefined>): ContactFilterValues {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return {
    autor: one("autor").split(",").filter((id) => UUID_RE.test(id)).slice(0, 50),
    uf: one("uf").split(",").map((u) => u.toUpperCase()).filter((u) => UF_SIGLAS.has(u)),
    cidade: clean(one("cidade")),
    doc: onlyDigits(one("doc")).slice(0, 14),
    email: clean(one("email")),
    fone: onlyDigits(one("fone")).slice(0, 11),
    segmento: one("segmento")
      .split("|")
      .map((s) => s.trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 30),
  };
}
