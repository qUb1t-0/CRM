"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, ChevronRight, Filter, FilterX, Search, X } from "lucide-react";
import { Avatar, buttonClass, cn, inputClass } from "@/components/ui";
import { UFS, maskCNPJ, maskCPF, onlyDigits } from "@/lib/br";
import { EMPTY_FILTERS, FILTER_KEYS, countActive, type ContactFilterValues } from "@/lib/contact-filters";

type Person = { id: string; name: string; email: string | null };

function Check2({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        checked ? "border-brand bg-brand text-brand-fg" : "border-line-strong bg-surface",
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </span>
  );
}

function Section({
  title,
  active,
  defaultOpen,
  children,
}: {
  title: string;
  active?: string | null;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-line">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium select-none hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{title}</span>
        {active && <span className="max-w-36 truncate rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">{active}</span>}
        <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-4">{children}</div>
    </details>
  );
}

/** Lista de opções marcáveis com busca (para Autor, Estado e Segmento). */
function CheckList({
  options,
  selected,
  onToggle,
  placeholder,
  render,
}: {
  options: { value: string; label: string; hint?: string | null }[];
  selected: string[];
  onToggle: (value: string) => void;
  placeholder: string;
  render?: (o: { value: string; label: string; hint?: string | null }) => ReactNode;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const visible = term ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(term)) : options;
  return (
    <div className="space-y-2">
      {options.length > 6 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className={cn(inputClass, "h-8 pl-8 text-[13px]")} />
        </div>
      )}
      <ul className="max-h-56 space-y-0.5 overflow-y-auto">
        {visible.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <li key={o.value}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => onToggle(o.value)}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm", checked ? "bg-surface-2" : "hover:bg-surface-2/60")}
              >
                <Check2 checked={checked} />
                {render ? render(o) : <span className="truncate">{o.label}</span>}
              </button>
            </li>
          );
        })}
        {visible.length === 0 && <li className="px-2 py-2 text-xs text-muted">Nenhuma opção.</li>}
      </ul>
    </div>
  );
}

const cityCache = new Map<string, string[]>();

/** Painel lateral de filtros de contatos (inspirado no painel "Filtros" do Nectar). */
export function ContactFilters({
  values,
  members,
  segments,
  currentUserId,
}: {
  values: ContactFilterValues;
  members: Person[];
  segments: string[];
  currentUserId: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<ContactFilterValues>(values);
  // Mostra os valores do documento já formatados ao abrir o painel
  const withMask = (v: ContactFilterValues) => ({ ...v, doc: v.doc.length > 11 ? maskCNPJ(v.doc) : v.doc ? maskCPF(v.doc) : "" });
  const [cities, setCities] = useState<{ uf: string; list: string[] }>({ uf: "", list: [] });
  const active = countActive(values);

  // Sugestões de cidade quando exatamente uma UF está marcada
  const singleUf = draft.uf.length === 1 ? draft.uf[0] : "";
  useEffect(() => {
    if (!singleUf) return;
    const cached = cityCache.get(singleUf);
    if (cached) {
      Promise.resolve().then(() => setCities({ uf: singleUf, list: cached }));
      return;
    }
    let cancelled = false;
    fetch(`/api/cidades/${singleUf}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: string[]) => {
        cityCache.set(singleUf, list);
        if (!cancelled) setCities({ uf: singleUf, list });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [singleUf]);
  const citySuggestions = cities.uf === singleUf ? cities.list : [];

  const memberOptions = useMemo(
    () =>
      [...members]
        .sort((a, b) => (a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : a.name.localeCompare(b.name, "pt-BR")))
        .map((m) => ({ value: m.id, label: m.name, hint: m.email })),
    [members, currentUserId],
  );

  const toggleIn = (key: "autor" | "uf" | "segmento", value: string) =>
    setDraft((d) => ({ ...d, [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value] }));

  function navigate(next: ContactFilterValues) {
    const params = new URLSearchParams(searchParams.toString());
    FILTER_KEYS.forEach((k) => params.delete(k));
    params.delete("p");
    if (next.autor.length) params.set("autor", next.autor.join(","));
    if (next.uf.length) params.set("uf", next.uf.join(","));
    if (next.cidade.trim()) params.set("cidade", next.cidade.trim());
    if (onlyDigits(next.doc)) params.set("doc", onlyDigits(next.doc));
    if (next.email.trim()) params.set("email", next.email.trim());
    if (onlyDigits(next.fone)) params.set("fone", onlyDigits(next.fone));
    if (next.segmento.length) params.set("segmento", next.segmento.join("|"));
    router.push(params.size ? `${pathname}?${params}` : pathname);
  }

  const docDigits = onlyDigits(draft.doc);
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? "Usuário";

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setDraft(withMask(values));
          ref.current?.showModal();
        }}
        className={cn(buttonClass("secondary"), active > 0 && "border-brand/50 bg-brand-soft text-brand hover:bg-brand-soft")}
      >
        <Filter className="size-4" />
        Filtros
        {active > 0 && <span className="tabular rounded-full bg-brand px-1.5 text-[11px] leading-4 font-semibold text-brand-fg">{active}</span>}
      </button>

      <dialog
        ref={ref}
        aria-label="Filtros"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="drawer-right m-0 ml-auto h-dvh max-h-dvh w-[400px] max-w-[92vw] border-l border-line bg-surface p-0 text-fg shadow-lg"
      >
        <form
          className="flex h-full flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            ref.current?.close();
            navigate(draft);
          }}
        >
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <button type="button" aria-label="Fechar filtros" onClick={() => ref.current?.close()} className="-m-1 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg">
              <ChevronRight className="size-5" />
            </button>
            <Filter className="size-4 text-muted" />
            <h2 className="flex-1 text-base font-semibold">Filtros</h2>
            {countActive(draft) > 0 && <span className="text-xs text-muted">{countActive(draft)} ativo(s)</span>}
          </div>

          <div className="flex-1 overflow-y-auto">
            <Section title="Autor" active={draft.autor.length ? (draft.autor.length === 1 ? memberName(draft.autor[0]) : `${draft.autor.length} usuários`) : null} defaultOpen={draft.autor.length > 0}>
              <p className="mb-2 text-xs text-muted">Quem fez o cadastro.</p>
              <CheckList
                options={memberOptions}
                selected={draft.autor}
                onToggle={(v) => toggleIn("autor", v)}
                placeholder="Buscar usuário…"
                render={(o) => (
                  <>
                    <Avatar size="sm" name={o.label} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.label}</span>
                      {o.hint && <span className="block truncate text-xs text-muted">{o.hint}</span>}
                    </span>
                    {o.value === currentUserId && <span className="rounded-full bg-brand-soft px-1.5 text-[11px] font-medium text-brand">eu</span>}
                  </>
                )}
              />
            </Section>

            <Section title="Estado" active={draft.uf.length ? draft.uf.join(", ") : null} defaultOpen={draft.uf.length > 0}>
              <CheckList
                options={UFS.map((u) => ({ value: u.sigla, label: `${u.sigla} – ${u.nome}` }))}
                selected={draft.uf}
                onToggle={(v) => toggleIn("uf", v)}
                placeholder="Buscar estado…"
              />
            </Section>

            <Section title="Cidade" active={draft.cidade || null} defaultOpen={!!draft.cidade}>
              <input
                value={draft.cidade}
                onChange={(e) => setDraft((d) => ({ ...d, cidade: e.target.value }))}
                list="filtro-cidades"
                placeholder={singleUf ? `Cidade em ${singleUf}…` : "Nome da cidade (contém)…"}
                className={cn(inputClass, "h-9")}
              />
              <datalist id="filtro-cidades">
                {citySuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <p className="mt-1.5 text-xs text-muted">Dica: marque um único estado para ver sugestões de cidades.</p>
            </Section>

            <Section title="CPF / CNPJ" active={docDigits ? `${docDigits.length} dígitos` : null} defaultOpen={!!draft.doc}>
              <input
                value={draft.doc}
                inputMode="numeric"
                onChange={(e) => {
                  const d = onlyDigits(e.target.value).slice(0, 14);
                  setDraft((v) => ({ ...v, doc: d.length > 11 ? maskCNPJ(d) : maskCPF(d) }));
                }}
                placeholder="Número completo ou parte dele"
                className={cn(inputClass, "h-9")}
              />
            </Section>

            <Section title="E-mail" active={draft.email || null} defaultOpen={!!draft.email}>
              <input
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                placeholder="Contém… (ex.: @empresa.com.br)"
                className={cn(inputClass, "h-9")}
              />
            </Section>

            <Section title="Telefone" active={draft.fone ? onlyDigits(draft.fone) : null} defaultOpen={!!draft.fone}>
              <input
                value={draft.fone}
                inputMode="numeric"
                onChange={(e) => setDraft((d) => ({ ...d, fone: onlyDigits(e.target.value).slice(0, 11) }))}
                placeholder="Números (ex.: 62 ou 993796408)"
                className={cn(inputClass, "h-9")}
              />
              <p className="mt-1.5 text-xs text-muted">Busca pelos dígitos, ignorando parênteses, espaços e traços.</p>
            </Section>

            <Section
              title="Segmento"
              active={draft.segmento.length ? (draft.segmento.length === 1 ? draft.segmento[0] : `${draft.segmento.length} segmentos`) : null}
              defaultOpen={draft.segmento.length > 0}
            >
              {segments.length === 0 ? (
                <p className="text-xs text-muted">Nenhum segmento cadastrado ainda.</p>
              ) : (
                <CheckList
                  options={segments.map((s) => ({ value: s, label: s }))}
                  selected={draft.segmento}
                  onToggle={(v) => toggleIn("segmento", v)}
                  placeholder="Buscar segmento…"
                />
              )}
            </Section>
          </div>

          <div className="flex items-center gap-2 border-t border-line px-5 py-3">
            <button
              type="button"
              className={buttonClass("secondary")}
              onClick={() => setDraft(EMPTY_FILTERS)}
            >
              <FilterX className="size-4" /> Limpar
            </button>
            <button type="submit" className={cn(buttonClass("primary"), "ml-auto")}>
              Aplicar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** Etiquetas dos filtros ativos, com botão para remover cada um. */
export function ActiveFilterChips({ chips }: { chips: { key: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (chips.length === 0) return null;

  const remove = (keys: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    keys.forEach((k) => params.delete(k));
    params.delete("p");
    router.push(params.size ? `${pathname}?${params}` : pathname);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft py-0.5 pr-1 pl-2.5 text-xs font-medium text-brand">
          {c.label}
          <button type="button" aria-label={`Remover filtro ${c.label}`} onClick={() => remove([c.key])} className="rounded-full p-0.5 hover:bg-brand/15">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <button type="button" onClick={() => remove([...FILTER_KEYS])} className="text-xs font-medium text-muted hover:text-fg">
        Limpar filtros
      </button>
    </div>
  );
}
