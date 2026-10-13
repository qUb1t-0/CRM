import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { getContext } from "@/lib/session";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui";
import { MobileNav, SidebarNav } from "@/components/nav";
import { OrgSwitcher } from "@/components/org-switcher";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getContext();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 pt-5 pb-4">
          <Logo />
        </div>
        <div className="px-3 pb-3">
          <OrgSwitcher orgs={ctx.orgs} activeId={ctx.org.id} />
        </div>
        <SidebarNav isAdmin={ctx.isAdmin} />
        <div className="mt-auto flex items-center gap-2.5 border-t border-line px-4 py-3">
          <Avatar name={ctx.profile.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{ctx.profile.name}</p>
            <p className="truncate text-xs text-muted">{ctx.isAdmin ? "Administrador" : "Membro"}</p>
          </div>
          <form action="/auth/sair" method="post">
            <button className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-fg">Sair</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur sm:px-6">
          <MobileNav isAdmin={ctx.isAdmin} orgs={ctx.orgs} activeId={ctx.org.id} userName={ctx.profile.name} />
          <form action="/busca" className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              name="q"
              type="search"
              placeholder="Buscar contatos, empresas, oportunidades…"
              aria-label="Buscar"
              className="h-9 w-full rounded-md border border-line bg-surface pr-3 pl-9 text-sm placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
            />
          </form>
          <span className="ml-auto hidden truncate text-sm text-muted sm:block">{ctx.org.name}</span>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
