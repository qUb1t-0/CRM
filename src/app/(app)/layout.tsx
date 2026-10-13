import type { ReactNode } from "react";
import { getContext } from "@/lib/session";
import { Logo } from "@/components/logo";
import { MobileNav, Sidebar } from "@/components/nav";
import { ThemeToggleButton } from "@/components/theme";
import { QuickCreate, SearchBox } from "@/components/topbar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getContext();
  const shell = {
    orgs: ctx.orgs,
    activeId: ctx.org.id,
    userName: ctx.profile.name,
    userEmail: ctx.profile.email,
    roleLabel: ctx.isAdmin ? "Administrador" : "Membro",
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[244px_1fr]">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-brand px-3 py-2 text-brand-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>

      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 pt-5 pb-4">
          <Logo />
        </div>
        <Sidebar {...shell} />
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/70">
          <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
            <MobileNav {...shell} />
            <SearchBox />
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <ThemeToggleButton />
              <QuickCreate />
            </div>
          </div>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
