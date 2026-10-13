"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  BarChart3,
  Box,
  Building2,
  CalendarDays,
  CheckSquare,
  FileText,
  Home,
  Kanban,
  Menu,
  Settings,
  Target,
  X,
} from "lucide-react";
import { cn } from "@/components/ui";
import { LogoMark } from "@/components/logo";
import { OrgSwitcher } from "@/components/org-switcher";

const items = [
  { href: "/", label: "Início", icon: Home },
  { href: "/oportunidades", label: "Oportunidades", icon: Kanban },
  { href: "/contatos", label: "Contatos", icon: Building2 },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/propostas", label: "Propostas", icon: FileText },
  { href: "/produtos", label: "Produtos", icon: Box },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

function NavLinks({ onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
              active ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  return <NavLinks isAdmin={isAdmin} />;
}

export function MobileNav({
  isAdmin,
  orgs,
  activeId,
  userName,
}: {
  isAdmin: boolean;
  orgs: { id: string; name: string }[];
  activeId: string;
  userName: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    ref.current?.close();
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menu"
        onClick={() => ref.current?.showModal()}
        className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
      >
        <Menu className="size-5" />
      </button>
      <span className="lg:hidden">
        <LogoMark className="size-6" />
      </span>
      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-0 h-dvh max-h-dvh w-72 max-w-[85vw] border-r border-line bg-surface p-0 text-fg"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="font-semibold">Favo CRM</span>
            <button type="button" aria-label="Fechar menu" onClick={() => ref.current?.close()} className="p-1 text-muted">
              <X className="size-5" />
            </button>
          </div>
          <div className="px-3 pb-3">
            <OrgSwitcher orgs={orgs} activeId={activeId} />
          </div>
          <NavLinks isAdmin={isAdmin} onNavigate={() => ref.current?.close()} />
          <div className="mt-auto flex items-center justify-between border-t border-line px-5 py-3 text-sm">
            <span className="truncate">{userName}</span>
            <form action="/auth/sair" method="post">
              <button className="text-muted hover:text-fg">Sair</button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
