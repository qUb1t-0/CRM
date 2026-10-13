export const TZ = "America/Sao_Paulo";
/** O Brasil não tem horário de verão desde 2019, então o offset é fixo. */
export const TZ_OFFSET = "-03:00";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function money(value: number | string | null | undefined) {
  return brl.format(Number(value ?? 0));
}

export function moneyCompact(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Math.abs(n) < 10000 ? brl.format(n) : brlCompact.format(n);
}

export function date(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d =
    typeof value === "string" && value.length === 10 ? new Date(`${value}T12:00:00${TZ_OFFSET}`) : new Date(value);
  return d.toLocaleDateString("pt-BR", { timeZone: TZ });
}

export function dateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function time(value: string | Date) {
  return new Date(value).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function relative(value: string | Date) {
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return "agora";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return date(value);
}

/** Partes da data no fuso de São Paulo. */
export function zonedParts(value: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { year: get("year"), month: get("month"), day: get("day"), hour, minute: get("minute") };
}

/** Valor para <input type="datetime-local"> no horário de São Paulo. */
export function toLocalInput(value: string | Date | null | undefined) {
  if (!value) return "";
  const p = zonedParts(new Date(value));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Converte um valor de <input type="datetime-local"> (horário de SP) em ISO. */
export function fromLocalInput(value: FormDataEntryValue | null) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const d = new Date(`${v.length === 16 ? `${v}:00` : v}${TZ_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Data de hoje (YYYY-MM-DD) em São Paulo. */
export function todayISO() {
  const p = zonedParts();
  return `${p.year}-${p.month}-${p.day}`;
}

/** Instante ISO da meia-noite (SP) de uma data YYYY-MM-DD. */
export function dayStart(isoDate: string) {
  return new Date(`${isoDate}T00:00:00${TZ_OFFSET}`).toISOString();
}

export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Primeiro dia do mês (YYYY-MM-01) em São Paulo, com deslocamento opcional. */
export function monthStartISO(offsetMonths = 0, base?: string) {
  const p = base ? { year: base.slice(0, 4), month: base.slice(5, 7) } : zonedParts();
  const d = new Date(Date.UTC(Number(p.year), Number(p.month) - 1 + offsetMonths, 1));
  return d.toISOString().slice(0, 10);
}

export function monthLabel(iso: string, long = false) {
  const d = new Date(`${iso.slice(0, 7)}-15T12:00:00Z`);
  const s = d.toLocaleDateString("pt-BR", {
    month: long ? "long" : "short",
    year: long ? "numeric" : "2-digit",
    timeZone: "UTC",
  });
  return s.replace(".", "").replace(/^\w/, (c) => c.toUpperCase());
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

/** Formata CPF/CNPJ. O CNPJ alfanumérico (Receita, jul/2026) também é aceito. */
export function documentMask(doc: string | null | undefined) {
  if (!doc) return "—";
  const d = doc.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (d.length === 11 && /^\d+$/.test(d)) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(.{2})(.{3})(.{3})(.{4})(.{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

export function isPast(value: string | Date | null | undefined) {
  return !!value && new Date(value).getTime() < Date.now();
}
