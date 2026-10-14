"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Check, Loader2, Search, Users, X } from "lucide-react";
import { Avatar, buttonClass, cn } from "@/components/ui";
import { toast } from "@/components/toast";
import { setOwnerFilter } from "@/app/(app)/org-actions";

type Person = { id: string; name: string; email: string | null; avatarUrl?: string | null };

function Checkbox({ checked, indeterminate }: { checked: boolean; indeterminate?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
        checked || indeterminate ? "border-brand bg-brand text-brand-fg" : "border-line-strong bg-surface",
      )}
    >
      {checked ? <Check className="size-3" strokeWidth={3} /> : indeterminate ? <span className="h-0.5 w-2 rounded bg-current" /> : null}
    </span>
  );
}

/** Rótulo do botão conforme a seleção atual. */
function label(selected: string[] | null, members: Person[]) {
  if (!selected) return "Todos os usuários";
  if (selected.length === 1) return members.find((m) => m.id === selected[0])?.name ?? "1 usuário";
  return `${selected.length} usuários`;
}

/**
 * Filtro global por responsável (somente administradores): escolhe de quais usuários
 * os dados aparecem em todo o sistema (contatos, propostas, tarefas, agenda, início).
 */
export function OwnerFilter({
  members,
  selected,
  currentUserId,
}: {
  members: Person[];
  selected: string[] | null;
  currentUserId: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();
  const active = selected !== null;

  // Usuário atual primeiro, depois ordem alfabética
  const ordered = useMemo(
    () => [...members].sort((a, b) => (a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : a.name.localeCompare(b.name, "pt-BR"))),
    [members, currentUserId],
  );
  const term = query.trim().toLowerCase();
  const visible = term ? ordered.filter((m) => m.name.toLowerCase().includes(term) || m.email?.toLowerCase().includes(term)) : ordered;
  const allVisibleChecked = visible.length > 0 && visible.every((m) => draft.has(m.id));
  const someVisibleChecked = visible.some((m) => draft.has(m.id));

  function open() {
    setDraft(new Set(selected ?? members.map((m) => m.id)));
    setQuery("");
    ref.current?.showModal();
  }

  function toggle(id: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisible() {
    setDraft((prev) => {
      const next = new Set(prev);
      if (allVisibleChecked) visible.forEach((m) => next.delete(m.id));
      else visible.forEach((m) => next.add(m.id));
      return next;
    });
  }

  function apply(ids: string[]) {
    start(async () => {
      const res = await setOwnerFilter(ids);
      if (res?.error) toast(res.error, "error");
      else {
        if (res?.message) toast(res.message);
        ref.current?.close();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        title="Filtrar por responsável"
        aria-haspopup="dialog"
        className={cn(
          buttonClass("secondary"),
          "max-w-52 px-2.5",
          active && "border-brand/50 bg-brand-soft text-brand hover:bg-brand-soft hover:brightness-95",
        )}
      >
        <Users className="size-4 shrink-0" />
        <span className="hidden truncate md:inline">{label(selected, members)}</span>
        {active && (
          <span className="tabular rounded-full bg-brand px-1.5 text-[11px] leading-4 font-semibold text-brand-fg md:hidden">{selected.length}</span>
        )}
      </button>

      <dialog
        ref={ref}
        aria-label="Filtrar por responsável"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-fg shadow-lg"
      >
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <Users className="size-5 text-muted" />
            <h2 className="flex-1 text-center text-base font-semibold">Filtrar por responsável</h2>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => ref.current?.close()}
              className="-m-1 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <button
              type="button"
              role="checkbox"
              aria-checked={allVisibleChecked ? "true" : someVisibleChecked ? "mixed" : "false"}
              aria-label="Selecionar todos os exibidos"
              onClick={toggleVisible}
              className="rounded p-1"
            >
              <Checkbox checked={allVisibleChecked} indeterminate={!allVisibleChecked && someVisibleChecked} />
            </button>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Digite o nome ou e-mail"
                aria-label="Buscar usuário"
                className="h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm placeholder:text-muted/70 focus:border-brand focus:ring-3 focus:ring-brand/20 focus:outline-none"
              />
            </div>
          </div>

          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3" role="listbox" aria-multiselectable="true">
            {visible.map((m) => {
              const checked = draft.has(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(m.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                      checked ? "bg-surface-2" : "hover:bg-surface-2/60",
                    )}
                  >
                    <Checkbox checked={checked} />
                    <Avatar name={m.name} src={m.avatarUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{m.name}</span>
                      {m.email && <span className="block truncate text-xs text-muted">{m.email}</span>}
                    </span>
                    {m.id === currentUserId && (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">eu</span>
                    )}
                  </button>
                </li>
              );
            })}
            {visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nenhum usuário encontrado.</li>}
          </ul>

          <div className="flex items-center gap-2 border-t border-line px-4 py-3">
            <button type="button" className={buttonClass("secondary")} onClick={() => setDraft(new Set())}>
              Limpar
            </button>
            <button
              type="button"
              className={cn(buttonClass("secondary"), "ml-auto")}
              onClick={() => setDraft(new Set(members.map((m) => m.id)))}
            >
              Todos
            </button>
            <button
              type="button"
              disabled={draft.size === 0 || pending}
              className={buttonClass("primary")}
              onClick={() => apply([...draft])}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Aplicar ({draft.size})
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Faixa informativa exibida enquanto o filtro está ativo. */
export function OwnerFilterBanner({ names }: { names: string[] }) {
  const [pending, start] = useTransition();
  const shown = names.slice(0, 3).join(", ") + (names.length > 3 ? ` e mais ${names.length - 3}` : "");
  return (
    <div className="no-print border-b border-brand/20 bg-brand-soft/60">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 py-2 text-sm sm:px-6">
        <Users className="size-4 shrink-0 text-brand" />
        <p className="min-w-0 flex-1 truncate">
          <span className="text-muted">Exibindo dados de:</span> <span className="font-medium">{shown}</span>
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await setOwnerFilter([]);
              if (res?.message) toast(res.message);
            })
          }
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand hover:bg-brand-soft"
        >
          {pending ? "Limpando…" : "Limpar filtro"}
        </button>
      </div>
    </div>
  );
}
