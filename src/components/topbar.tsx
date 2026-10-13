"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Building2, CalendarPlus, CheckSquare, Kanban, Plus, Search } from "lucide-react";
import { Kbd, buttonClass, cn } from "@/components/ui";
import { Menu, menuItemClass } from "@/components/menu";

/** Busca global: foco com "/" ou Ctrl/⌘+K. */
export function SearchBox() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.closest("input, textarea, select, [contenteditable=true]");
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form action="/busca" role="search" className="group relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        name="q"
        type="search"
        autoComplete="off"
        placeholder="Buscar contatos, empresas, oportunidades…"
        aria-label="Buscar"
        aria-keyshortcuts="Control+K /"
        onKeyDown={(e) => {
          if (e.key === "Escape") e.currentTarget.blur();
        }}
        className="h-9 w-full rounded-lg border border-line bg-surface pr-16 pl-9 text-sm shadow-sm transition-[border-color,box-shadow] placeholder:text-muted/70 hover:border-line-strong focus:border-brand focus:ring-3 focus:ring-brand/20 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 items-center gap-0.5 transition-opacity group-focus-within:opacity-0 sm:flex">
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </span>
    </form>
  );
}

const CREATE = [
  { href: "/oportunidades?novo=1", label: "Oportunidade", hint: "N O", icon: Kanban },
  { href: "/contatos?novo=1", label: "Empresa ou pessoa", hint: "N C", icon: Building2 },
  { href: "/tarefas?novo=1", label: "Tarefa", hint: "N T", icon: CheckSquare },
  { href: "/agenda?novo=1", label: "Compromisso", hint: "N A", icon: CalendarPlus },
];

/** Menu "Novo" com atalhos de teclado em sequência (N e depois O/C/T/A). */
export function QuickCreate() {
  const router = useRouter();

  useEffect(() => {
    let armed = false;
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || target.closest("input, textarea, select, [contenteditable=true], dialog")) return;
      const key = e.key.toLowerCase();
      if (!armed && key === "n") {
        armed = true;
        clearTimeout(timer);
        timer = setTimeout(() => (armed = false), 1200);
        return;
      }
      if (armed) {
        armed = false;
        const map: Record<string, string> = { o: CREATE[0].href, c: CREATE[1].href, t: CREATE[2].href, a: CREATE[3].href };
        if (map[key]) {
          e.preventDefault();
          router.push(map[key]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [router]);

  return (
    <Menu
      buttonLabel="Criar novo"
      buttonClassName={cn(buttonClass("primary"), "px-2.5 sm:px-3.5")}
      button={
        <>
          <Plus className="size-4" />
          <span className="hidden sm:inline">Novo</span>
        </>
      }
    >
      <p className="px-2.5 pt-1 pb-1.5 text-xs font-medium text-muted">Criar</p>
      {CREATE.map(({ href, label, hint, icon: Icon }) => (
        <Link key={href} href={href} className={menuItemClass}>
          <Icon />
          <span className="flex-1">{label}</span>
          <span className="flex gap-0.5">
            {hint.split(" ").map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
        </Link>
      ))}
    </Menu>
  );
}
