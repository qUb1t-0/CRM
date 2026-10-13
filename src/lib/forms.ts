import type { CustomField } from "@/lib/types";

export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

/** Aceita "1.234,56", "1234.56" ou "1234,56". */
export function decimal(fd: FormData, key: string, fallback = 0) {
  const s = str(fd, key);
  if (s === null) return fallback;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : fallback;
}

export function readCustom(fd: FormData, fields: CustomField[]) {
  const out: Record<string, string | number> = {};
  for (const f of fields) {
    const raw = str(fd, `cf_${f.key}`);
    if (raw === null) continue;
    if (f.type === "numero") {
      const n = Number(raw.replace(",", "."));
      if (Number.isFinite(n)) out[f.key] = n;
    } else if (f.type === "lista") {
      if (f.options.includes(raw)) out[f.key] = raw;
    } else {
      out[f.key] = raw.slice(0, 500);
    }
  }
  return out;
}

/** Remove caracteres com significado na sintaxe de filtros do PostgREST. */
export function sanitizeSearch(q: string | null | undefined) {
  return (q ?? "")
    .replace(/[%_,()*\\:"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Só aceita caminhos relativos internos (evita open redirect). */
export function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export function dbError(error: { message: string; code?: string } | null) {
  if (!error) return null;
  if (error.code === "23503") return "Este registro está em uso por outros dados e não pode ser removido.";
  if (error.code === "23505") return "Já existe um registro com esses dados.";
  if (error.code === "42501") return "Você não tem permissão para esta ação.";
  if (error.code === "23514") return "Algum valor informado é inválido.";
  return error.message;
}
