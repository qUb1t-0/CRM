import type { ReactNode } from "react";
import { getContext, getMembers, getOwnerFilter } from "@/lib/session";
import { OwnerFilter, OwnerFilterBanner } from "@/components/owner-filter";
import { Logo } from "@/components/logo";
import { MobileNav, Sidebar } from "@/components/nav";
import { ThemeToggleButton } from "@/components/theme";
import { NotificationBell } from "@/components/notification-bell";
import { QuickCreate, SearchBox } from "@/components/topbar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getContext();
  const [members, ownerFilter, notifRes, unreadRes] = await Promise.all([
    getMembers(),
    ctx.isAdmin ? getOwnerFilter() : Promise.resolve(null),
    ctx.supabase
      .from("notifications")
      .select("id, kind, actor_id, entity_id, deal_id, text, read_at, created_at, entity:entities(name)")
      .eq("user_id", ctx.user.id)
      .eq("org_id", ctx.org.id)
      .order("created_at", { ascending: false })
      .limit(20),
    ctx.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.user.id)
      .eq("org_id", ctx.org.id)
      .is("read_at", null),
  ]);
  const notifications = (notifRes.data ?? []).map((n) => ({
    id: n.id as string,
    kind: n.kind as string,
    actorName: members.find((m) => m.id === n.actor_id)?.name ?? "Alguém",
    actorAvatar: members.find((m) => m.id === n.actor_id)?.avatarUrl ?? null,
    entityId: n.entity_id as string | null,
    entityName: (n.entity as unknown as { name: string } | null)?.name ?? null,
    dealId: n.deal_id as string | null,
    text: n.text as string | null,
    read: !!n.read_at,
    createdAt: n.created_at as string,
  }));
  const filteredNames = ownerFilter?.map((id) => members.find((m) => m.id === id)?.name ?? "Usuário") ?? [];
  const shell = {
    orgs: ctx.orgs,
    activeId: ctx.org.id,
    userName: ctx.profile.name,
    userAvatar: ctx.profile.avatarUrl,
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
              {ctx.isAdmin && members.length > 1 && (
                <OwnerFilter
                  members={members.map((m) => ({ id: m.id, name: m.name, email: m.email, avatarUrl: m.avatarUrl ?? null }))}
                  selected={ownerFilter}
                  currentUserId={ctx.user.id}
                />
              )}
              <NotificationBell userId={ctx.user.id} items={notifications} unread={unreadRes.count ?? 0} />
              <ThemeToggleButton />
              <QuickCreate />
            </div>
          </div>
          {ownerFilter && <OwnerFilterBanner names={filteredNames} />}
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
