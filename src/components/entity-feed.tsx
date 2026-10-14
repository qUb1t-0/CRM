"use client";

import { Fragment, useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRightLeft,
  AtSign,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  FilePlus2,
  FileText,
  ListTodo,
  Loader2,
  Pencil,
  PlusCircle,
  RotateCcw,
  Search,
  SendHorizontal,
  Trash2,
  Trophy,
  UserMinus,
  UserPlus,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ActionButton } from "@/components/forms";
import { Avatar, cn } from "@/components/ui";
import { toast } from "@/components/toast";
import { addNote, deleteNote } from "@/app/(app)/timeline-actions";
import type { ActionState } from "@/lib/types";

export type FeedEvent = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
};

type Person = { id: string; name: string; email: string | null; avatarUrl?: string | null };
type Change = { label: string; from: string | null; to: string | null };

const TZ = "America/Sao_Paulo";
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " às");
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const brl = (v: unknown) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "mensagens", label: "Mensagens" },
  { key: "alteracoes", label: "Alterações de dados" },
  { key: "pessoas", label: "Pessoas de contato" },
  { key: "tarefas", label: "Tarefas e compromissos" },
  { key: "vendas", label: "Oportunidades e propostas" },
];

function category(kind: string) {
  if (kind === "nota") return "mensagens";
  if (kind === "entidade_alterada" || kind === "entidade_criada" || kind === "movido_lixeira" || kind === "restaurado") return "alteracoes";
  if (kind.startsWith("contato_")) return "pessoas";
  if (kind.startsWith("tarefa_") || kind === "compromisso_criado") return "tarefas";
  return "vendas";
}

/** Ícone, título curto e detalhes de cada tipo de evento. */
function describe(e: FeedEvent): { icon: ReactNode; title: string; tone: string; details?: ReactNode } {
  const p = e.payload as Record<string, unknown>;
  const t = (v: unknown) => (v == null || v === "" ? "—" : String(v));
  switch (e.kind) {
    case "entidade_criada":
      return { icon: <PlusCircle />, title: "Cadastro criado", tone: "brand" };
    case "entidade_alterada": {
      const changes = (p.changes as Change[]) ?? [];
      return {
        icon: <Pencil />,
        title: `Alteração de dados${changes.length ? ` (${changes.length})` : ""}`,
        tone: "brand",
        details: (
          <ul className="space-y-1.5">
            {changes.map((c, i) => (
              <li key={i} className="text-[13px]">
                <span className="font-medium">{c.label}:</span>{" "}
                <span className="text-muted line-through decoration-muted/50">{t(c.from)}</span> <span className="text-muted">→</span>{" "}
                <span className="font-medium text-fg">{t(c.to)}</span>
              </li>
            ))}
          </ul>
        ),
      };
    }
    case "contato_adicionado":
      return { icon: <UserPlus />, title: `Pessoa de contato adicionada: ${t(p.name)}`, tone: "info" };
    case "contato_alterado":
      return { icon: <UserRound />, title: `Pessoa de contato alterada: ${t(p.name)}`, tone: "info" };
    case "contato_removido":
      return { icon: <UserMinus />, title: `Pessoa de contato removida: ${t(p.name)}`, tone: "danger" };
    case "tarefa_criada":
      return { icon: <ListTodo />, title: `Tarefa criada: ${t(p.title)}`, tone: "info" };
    case "tarefa_concluida":
      return { icon: <CheckCircle2 />, title: `Tarefa concluída: ${t(p.title)}`, tone: "ok" };
    case "compromisso_criado":
      return {
        icon: <CalendarPlus />,
        title: `Compromisso agendado: ${t(p.title)}`,
        tone: "info",
        details: p.starts_at ? <p className="text-[13px]">Para {fmtDateTime(String(p.starts_at))}</p> : undefined,
      };
    case "oportunidade_criada":
      return { icon: <PlusCircle />, title: `Oportunidade criada: ${t(p.title)}`, tone: "neutral", details: <p className="text-[13px]">Valor: {brl(p.value)}</p> };
    case "etapa_alterada":
      return { icon: <ArrowRightLeft />, title: `${t(p.title)}: ${t(p.from)} → ${t(p.to)}`, tone: "neutral" };
    case "oportunidade_ganha":
      return { icon: <Trophy />, title: `Oportunidade ganha: ${t(p.title)} (${brl(p.value)})`, tone: "ok" };
    case "oportunidade_perdida":
      return { icon: <XCircle />, title: `Oportunidade perdida: ${t(p.title)}${p.reason ? ` · ${p.reason}` : ""}`, tone: "danger" };
    case "oportunidade_reaberta":
      return { icon: <RotateCcw />, title: `Oportunidade reaberta: ${t(p.title)}`, tone: "neutral" };
    case "responsavel_alterado":
      return { icon: <UserRound />, title: `${t(p.title)}: responsável agora é ${t(p.to)}`, tone: "neutral" };
    case "movido_lixeira":
      return { icon: <Trash2 />, title: `Movido para a lixeira: ${t(p.title)}`, tone: "danger" };
    case "restaurado":
      return { icon: <RotateCcw />, title: `Recuperado da lixeira: ${t(p.title)}`, tone: "ok" };
    default:
      if (e.kind.startsWith("proposta_")) {
        const status = e.kind.replace("proposta_", "");
        const verb: Record<string, string> = { rascunho: "gerada", enviada: "enviada", aceita: "aceita", recusada: "recusada" };
        return {
          icon: status === "rascunho" ? <FilePlus2 /> : <FileText />,
          title: `Proposta Nº ${t(p.number)} ${verb[status] ?? "alterada"}`,
          tone: status === "aceita" ? "ok" : status === "recusada" ? "danger" : "neutral",
          details: <p className="text-[13px]">{t(p.title)} · {brl(p.total)}</p>,
        };
      }
      return { icon: <PlusCircle />, title: e.kind, tone: "neutral" };
  }
}

const toneClass: Record<string, string> = {
  brand: "bg-brand-soft text-brand",
  info: "bg-info-soft text-info",
  ok: "bg-ok-soft text-ok",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-surface-2 text-muted",
};

/** Destaca as menções (@Nome) no texto da mensagem. */
function renderMentions(text: string, people: Person[], currentUserId: string) {
  const names = people.map((p) => p.name).sort((a, b) => b.length - a.length);
  if (names.length === 0) return text;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`@(${escaped.join("|")})`, "g");
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    const person = people.find((p) => p.name === m[1]);
    parts.push(
      <span
        key={m.index}
        className={cn(
          "rounded px-1 font-medium",
          person?.id === currentUserId ? "bg-brand text-brand-fg" : "bg-brand-soft text-brand",
        )}
      >
        @{m[1]}
      </span>,
    );
    last = m.index! + m[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

function SystemEvent({ e, actor }: { e: FeedEvent; actor: string }) {
  const d = describe(e);
  const [open, setOpen] = useState(false);
  return (
    <li className="flex gap-3">
      <span className={cn("relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface [&_svg]:size-4", toneClass[d.tone])}>
        {d.icon}
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          disabled={!d.details}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={d.details ? open : undefined}
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-left text-sm font-medium shadow-sm",
            d.details ? "hover:border-line-strong" : "cursor-default",
          )}
        >
          <span className="truncate">{d.title}</span>
          {d.details && <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />}
        </button>
        {open && d.details && <div className="mt-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">{d.details}</div>}
        <p className="mt-1 text-xs text-muted">
          {actor} · {fmtDateTime(e.created_at)}
        </p>
      </div>
    </li>
  );
}

function Message({ e, author, people, currentUserId }: { e: FeedEvent; author: Person | undefined; people: Person[]; currentUserId: string }) {
  const mine = e.actor_id === currentUserId;
  const name = author?.name ?? "Usuário";
  const text = String((e.payload as { text?: string }).text ?? "");
  return (
    <li className={cn("group flex gap-3", mine && "flex-row-reverse")}>
      <span className="relative z-10 ring-4 ring-surface rounded-full">
        <Avatar name={name} src={author?.avatarUrl} />
      </span>
      <div className={cn("flex min-w-0 max-w-[85%] flex-col", mine ? "items-end" : "items-start")}>
        <p className="mb-1 text-xs text-muted">
          <span className="font-medium text-fg">{mine ? "Você" : name}</span> · {fmtDateTime(e.created_at)}
        </p>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap shadow-sm",
            mine ? "rounded-tr-sm bg-brand-soft text-fg" : "rounded-tl-sm border border-line bg-surface",
          )}
        >
          {renderMentions(text, people, currentUserId)}
        </div>
        {mine && (
          <ActionButton
            action={deleteNote.bind(null, e.id)}
            confirm="Excluir esta mensagem?"
            variant="ghost"
            className="mt-0.5 h-6 px-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            Excluir
          </ActionButton>
        )}
      </div>
    </li>
  );
}

/** Caixa de mensagem com autocompletar de menções (@). */
function Composer({ entityId, people, currentUserId }: { entityId: string; people: Person[]; currentUserId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addNote, null);
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [query, setQuery] = useState<{ start: number; term: string } | null>(null);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.message) toast(state.message);
      Promise.resolve().then(() => {
        setText("");
        setMentions([]);
      });
    } else if (state.error) toast(state.error, "error");
  }, [state]);

  // Ajusta a altura do campo ao conteúdo
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  // Todos os usuários da plataforma (base): o usuário atual primeiro, depois ordem alfabética
  const options = query
    ? [...people]
        .sort((a, b) => (a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : a.name.localeCompare(b.name, "pt-BR")))
        .filter((p) =>
          `${p.name} ${p.email ?? ""}`
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
            .includes(query.term.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()),
        )
    : [];

  function detectMention(value: string, caret: number) {
    const before = value.slice(0, caret);
    const m = before.match(/(^|\s)@([^\s@]{0,30})$/);
    if (m) {
      setQuery({ start: caret - m[2].length - 1, term: m[2] });
      setActive(0);
    } else setQuery(null);
  }

  function pick(p: Person) {
    if (!query) return;
    const caret = ref.current?.selectionStart ?? text.length;
    const next = `${text.slice(0, query.start)}@${p.name} ${text.slice(caret)}`;
    setText(next);
    setMentions((m) => (m.includes(p.id) ? m : [...m, p.id]));
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = query.start + p.name.length + 2;
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  }

  return (
    <form ref={formRef} action={formAction} className="relative">
      <input type="hidden" name="entity_id" value={entityId} />
      <input type="hidden" name="mentions" value={JSON.stringify(mentions)} />

      {query && (
        <ul role="listbox" aria-label="Mencionar usuário" className="animate-pop absolute right-0 bottom-full left-0 z-20 mb-2 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          <li className="flex items-center justify-between px-2 pt-0.5 pb-1.5 text-xs font-medium text-muted">
            <span>Mencionar usuário</span>
            <span className="tabular">
              {options.length} de {people.length}
            </span>
          </li>
          {options.length === 0 && <li className="px-2 py-3 text-center text-sm text-muted">Nenhum usuário encontrado para “{query.term}”.</li>}
          {options.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  pick(p);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm", i === active && "bg-surface-2")}
              >
                <Avatar size="sm" name={p.name} src={p.avatarUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  {p.email && <span className="block truncate text-xs text-muted">{p.email}</span>}
                </span>
                {p.id === currentUserId && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">eu</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-md transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/20">
        <button
          type="button"
          title="Mencionar alguém"
          aria-label="Mencionar alguém"
          onClick={() => {
            const el = ref.current;
            const caret = el?.selectionStart ?? text.length;
            const prefix = caret > 0 && !/\s$/.test(text.slice(0, caret)) ? " @" : "@";
            const next = text.slice(0, caret) + prefix + text.slice(caret);
            setText(next);
            requestAnimationFrame(() => {
              const pos = caret + prefix.length;
              el?.focus();
              el?.setSelectionRange(pos, pos);
              detectMention(next, pos);
            });
          }}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"
        >
          <AtSign className="size-4" />
        </button>
        <textarea
          ref={ref}
          name="text"
          rows={1}
          value={text}
          maxLength={5000}
          placeholder="Escreva uma mensagem… use @ para mencionar alguém"
          aria-label="Mensagem"
          onChange={(ev) => {
            setText(ev.target.value);
            detectMention(ev.target.value, ev.target.selectionStart);
          }}
          onClick={(ev) => detectMention(text, ev.currentTarget.selectionStart)}
          onBlur={() => setTimeout(() => setQuery(null), 150)}
          onKeyDown={(ev) => {
            if (query && options.length > 0) {
              if (ev.key === "ArrowDown") {
                ev.preventDefault();
                setActive((a) => (a + 1) % options.length);
                return;
              }
              if (ev.key === "ArrowUp") {
                ev.preventDefault();
                setActive((a) => (a - 1 + options.length) % options.length);
                return;
              }
              if (ev.key === "Enter" || ev.key === "Tab") {
                ev.preventDefault();
                pick(options[active]);
                return;
              }
              if (ev.key === "Escape") {
                setQuery(null);
                return;
              }
            }
            if (ev.key === "Enter" && !ev.shiftKey) {
              ev.preventDefault();
              if (text.trim() && !pending) formRef.current?.requestSubmit();
            }
          }}
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-sm placeholder:text-muted/70 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || pending}
          title="Enviar (Enter)"
          aria-label="Enviar mensagem"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-fg transition-[filter,opacity] hover:brightness-110 disabled:opacity-40"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-muted">Enter envia · Shift+Enter quebra linha · @ menciona e notifica a pessoa</p>
    </form>
  );
}

/** Aba "Feedbacks" do cliente: histórico automático + mensagens da equipe. */
export function EntityFeed({
  events,
  people,
  currentUserId,
  entityId,
}: {
  events: FeedEvent[];
  people: Person[];
  currentUserId: string;
  entityId: string;
}) {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.name ?? "Sistema";

  // Tempo real: novas mensagens/alterações deste cliente aparecem sem recarregar
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`feed:${entityId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "timeline_events", filter: `entity_id=eq.${entityId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 300);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [entityId, router]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((e) => {
      if (filter !== "todos" && category(e.kind) !== filter) return false;
      if (!term) return true;
      const hay = `${JSON.stringify(e.payload)} ${describe(e).title} ${nameOf(e.actor_id)}`.toLowerCase();
      return hay.includes(term);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, filter, search]);

  // Rola para a mensagem mais recente
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length, filter]);

  return (
    <div className="flex h-[min(72dvh,760px)] min-h-[480px] flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Feedbacks</h2>
        <span className="tabular text-xs text-muted">{visible.length}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {searchOpen ? (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar no histórico…"
                className="h-8 w-48 rounded-lg border border-line bg-surface pr-7 pl-8 text-[13px] focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                aria-label="Fechar busca"
                onClick={() => {
                  setSearch("");
                  setSearchOpen(false);
                }}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <button type="button" aria-label="Buscar no histórico" onClick={() => setSearchOpen(true)} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
              <Search className="size-4" />
            </button>
          )}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Tipo de evento"
            className="h-8 cursor-pointer rounded-full border border-line bg-surface-2 px-3 text-xs font-medium focus:border-brand focus:outline-none"
          >
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">{events.length === 0 ? "Nenhum registro ainda. Envie a primeira mensagem." : "Nada encontrado com esse filtro."}</p>
        ) : (
          <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-line">
            {visible.map((e, i) => {
              const showDay = i === 0 || dayKey(visible[i - 1].created_at) !== dayKey(e.created_at);
              return (
                <Fragment key={e.id}>
                  {showDay && (
                    <li className="relative z-10 flex justify-center">
                      <span className="rounded-full border border-line bg-surface px-3 py-0.5 text-[11px] font-medium text-muted first-letter:uppercase">
                        {fmtDay(e.created_at)}
                      </span>
                    </li>
                  )}
                  {e.kind === "nota" ? (
                    <Message e={e} author={people.find((p) => p.id === e.actor_id)} people={people} currentUserId={currentUserId} />
                  ) : (
                    <SystemEvent e={e} actor={nameOf(e.actor_id)} />
                  )}
                </Fragment>
              );
            })}
          </ol>
        )}
      </div>

      <div className="border-t border-line bg-surface-2/40 px-4 pt-3 pb-2">
        <Composer entityId={entityId} people={people} currentUserId={currentUserId} />
      </div>
    </div>
  );
}
