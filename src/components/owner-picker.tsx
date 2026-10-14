"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, Check, ChevronDown, Loader2, Search } from "lucide-react";
import { Avatar, buttonClass, cn } from "@/components/ui";
import { toast } from "@/components/toast";
import { transferEntityOwner } from "@/app/(app)/contatos/actions";

type Person = { id: string; name: string; email: string | null; avatarUrl: string | null; jobTitle: string | null };

/**
 * Responsável pelo cliente. Para administradores vira um seletor que transfere a
 * responsabilidade (com confirmação) e notifica o novo responsável.
 */
export function OwnerPicker({
  entityId,
  ownerId,
  people,
  currentUserId,
  canEdit,
  openTasks,
}: {
  entityId: string;
  ownerId: string | null;
  people: Person[];
  currentUserId: string;
  canEdit: boolean;
  /** Tarefas em aberto deste cliente que estão com o responsável atual. */
  openTasks: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<Person | null>(null);
  const [withTasks, setWithTasks] = useState(true);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const owner = people.find((p) => p.id === ownerId);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const ownerView = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar size="sm" name={owner?.name ?? "—"} src={owner?.avatarUrl} />
      <span className="truncate">{owner?.name ?? "Sem responsável"}</span>
    </span>
  );

  if (!canEdit) return ownerView;

  const term = query.trim().toLowerCase();
  const list = [...people]
    .sort((a, b) => (a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : a.name.localeCompare(b.name, "pt-BR")))
    .filter((p) => !term || `${p.name} ${p.email ?? ""} ${p.jobTitle ?? ""}`.toLowerCase().includes(term));

  function confirm() {
    if (!target) return;
    start(async () => {
      const res = await transferEntityOwner(entityId, target.id, withTasks && openTasks > 0);
      if (res?.error) toast(res.error, "error");
      else {
        if (res?.message) toast(res.message);
        setOpen(false);
        setTarget(null);
      }
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Alterar responsável"
        onClick={() => {
          setOpen((o) => !o);
          setTarget(null);
          setQuery("");
        }}
        className="-mx-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-2"
      >
        {ownerView}
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div role="dialog" aria-label="Alterar responsável" className="animate-pop absolute top-full left-0 z-40 mt-2 w-[300px] max-w-[calc(100vw-3rem)] rounded-xl border border-line bg-surface shadow-lg">
          {!target ? (
            <>
              <div className="border-b border-line p-2.5">
                <p className="mb-2 px-1 text-xs font-medium text-muted">Transferir responsabilidade para</p>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar usuário…"
                    className="h-8 w-full rounded-lg border border-line bg-surface pr-2 pl-8 text-[13px] font-normal focus:border-brand focus:outline-none"
                  />
                </div>
              </div>
              <ul className="max-h-64 overflow-y-auto p-1.5">
                {list.map((p) => {
                  const current = p.id === ownerId;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={current}
                        onClick={() => setTarget(p)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left font-normal",
                          current ? "cursor-default bg-surface-2/60" : "hover:bg-surface-2",
                        )}
                      >
                        <Avatar size="sm" name={p.name} src={p.avatarUrl} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {p.name} {p.id === currentUserId && <span className="text-xs font-normal text-muted">(você)</span>}
                          </span>
                          <span className="block truncate text-xs text-muted">{p.jobTitle ?? p.email}</span>
                        </span>
                        {current && <Check className="size-4 text-brand" aria-label="Responsável atual" />}
                      </button>
                    </li>
                  );
                })}
                {list.length === 0 && <li className="px-2 py-3 text-center text-sm font-normal text-muted">Nenhum usuário encontrado.</li>}
              </ul>
            </>
          ) : (
            <div className="p-4 font-normal">
              <p className="text-sm font-semibold">Transferir responsabilidade</p>
              <div className="mt-3 flex items-center justify-center gap-3">
                <Avatar name={owner?.name ?? "—"} src={owner?.avatarUrl} size="lg" />
                <ArrowRight className="size-4 text-muted" />
                <Avatar name={target.name} src={target.avatarUrl} size="lg" />
              </div>
              <p className="mt-3 text-center text-sm text-pretty">
                <span className="text-muted">De</span> <strong>{owner?.name ?? "ninguém"}</strong> <span className="text-muted">para</span>{" "}
                <strong>{target.name}</strong>
              </p>
              {openTasks > 0 && (
                <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-surface-2/60 p-2.5 text-[13px]">
                  <input type="checkbox" checked={withTasks} onChange={(e) => setWithTasks(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand)]" />
                  <span>
                    Transferir também {openTasks === 1 ? "a tarefa em aberto" : `as ${openTasks} tarefas em aberto`} deste cliente
                  </span>
                </label>
              )}
              {target.id !== currentUserId && (
                <p className="mt-3 text-xs text-muted">{target.name.split(" ")[0]} receberá uma notificação sobre a transferência.</p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" disabled={pending} onClick={() => setTarget(null)} className={buttonClass("secondary", "sm")}>
                  Voltar
                </button>
                <button type="button" disabled={pending} onClick={confirm} className={buttonClass("primary", "sm")}>
                  {pending && <Loader2 className="size-3.5 animate-spin" />}
                  Transferir
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
