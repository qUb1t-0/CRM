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
  ChevronsUpDown,
  FileText,
  Home,
  Kanban,
  Lock,
  LogOut,
  Menu as MenuIcon,
  Settings,
  Target,
  UserRound,
  X,
} from "lucide-react";
import { Avatar, cn } from "@/components/ui";
import { LogoMark } from "@/components/logo";
import { Menu, menuItemClass } from "@/components/menu";
import { OrgSwitcher } from "@/components/org-switcher";
import { ThemeSwitcher } from "@/components/theme";
import { SALES_LOCKED, isLockedPath } from "@/lib/features";

const sections = [
  {
    label: null,
    items: [{ href: "/", label: "Início", icon: Home }],
  },
  {
    label: "Vendas",
    items: [
      { href: "/oportunidades", label: "Oportunidades", icon: Kanban },
      { href: "/propostas", label: "Propostas", icon: FileText },
      { href: "/produtos", label: "Produtos", icon: Box },
      { href: "/metas", label: "Metas", icon: Target },
    ],
  },
  {
    label: "Relacionamento",
    items: [
      { href: "/contatos", label: "Contatos", icon: Building2 },
      { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
    ],
  },
  {
    label: "Análise",
    items: [{ href: "/relatorios", label: "Relatórios", icon: BarChart3 }],
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-4 px-3" aria-label="Principal">
      {sections.map((section, i) => (
        <div key={i}>
          {section.label && (
            <p className="mb-1 flex items-center gap-1.5 px-2.5 text-[11px] font-semibold tracking-wider text-muted/80 uppercase">
              {section.label}
              {section.label === "Vendas" && SALES_LOCKED && (
                <span className="rounded bg-surface-2 px-1.5 py-px text-[10px] font-medium tracking-normal normal-case ring-1 ring-line">
                  Em breve
                </span>
              )}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
              if (isLockedPath(href)) {
                return (
                  <li key={href}>
                    <span
                      aria-disabled="true"
                      title="Bloqueado por enquanto"
                      className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-sm text-muted/50 select-none"
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1">{label}</span>
                      <Lock className="size-3.5" aria-label="Bloqueado" />
                    </span>
                  </li>
                );
              }
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-sm transition-colors",
                      active ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    {active && <span className="absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r-full bg-brand" aria-hidden />}
                    <Icon className={cn("size-4 shrink-0", !active && "opacity-80 group-hover:opacity-100")} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserMenu({ name, email, role, avatarUrl, side = "top" }: { name: string; email: string; role: string; avatarUrl: string | null; side?: "top" | "bottom" }) {
  return (
    <Menu
      side={side}
      align="start"
      className="w-64"
      buttonLabel="Menu do usuário"
      buttonClassName="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-surface-2"
      button={
        <>
          <Avatar name={name} src={avatarUrl} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs text-muted">{role}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted" />
        </>
      }
    >
      <div className="px-2.5 pt-1.5 pb-2">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted">{email}</p>
      </div>
      <div className="px-2.5 pb-2.5">
        <p className="mb-1.5 text-xs text-muted">Tema</p>
        <ThemeSwitcher className="w-full" />
      </div>
      <div className="my-1 h-px bg-line" />
      <Link href="/configuracoes/perfil" className={menuItemClass}>
        <UserRound /> Meu perfil
      </Link>
      <Link href="/configuracoes/usuarios" className={menuItemClass}>
        <Settings /> Configurações
      </Link>
      <div className="my-1 h-px bg-line" />
      <form action="/auth/sair" method="post">
        <button className={cn(menuItemClass, "text-danger [&_svg]:text-danger")}>
          <LogOut /> Sair
        </button>
      </form>
    </Menu>
  );
}

type ShellProps = {
  orgs: { id: string; name: string }[];
  activeId: string;
  userName: string;
  userAvatar: string | null;
  userEmail: string;
  roleLabel: string;
};

export function Sidebar(props: ShellProps) {
  return (
    <>
      <div className="px-3 pb-4">
        <OrgSwitcher orgs={props.orgs} activeId={props.activeId} />
      </div>
      <div className="flex-1 overflow-y-auto pb-4">
        <NavLinks />
      </div>
      <div className="border-t border-line p-3">
        <UserMenu name={props.userName} email={props.userEmail} role={props.roleLabel} avatarUrl={props.userAvatar} />
      </div>
    </>
  );
}

export function MobileNav(props: ShellProps) {
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
        className="-ml-1.5 rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
      >
        <MenuIcon className="size-5" />
      </button>
      <Link href="/" className="lg:hidden" aria-label="Início">
        <LogoMark className="size-7" />
      </Link>
      <dialog
        ref={ref}
        aria-label="Menu"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="drawer m-0 h-dvh max-h-dvh w-72 max-w-[85vw] border-r border-line bg-surface p-0 text-fg shadow-lg"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="flex items-center gap-2 font-semibold">
              <LogoMark className="size-6" /> Favo CRM
            </span>
            <button type="button" aria-label="Fechar menu" onClick={() => ref.current?.close()} className="rounded-md p-1 text-muted hover:bg-surface-2">
              <X className="size-5" />
            </button>
          </div>
          <Sidebar {...props} />
        </div>
      </dialog>
    </>
  );
}
