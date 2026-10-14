"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Bell, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, cn } from "@/components/ui";
import { Menu } from "@/components/menu";
import { markNotificationsRead } from "@/app/(app)/timeline-actions";

export type NotificationItem = {
  id: string;
  kind: string;
  actorName: string;
  actorAvatar: string | null;
  entityId: string | null;
  entityName: string | null;
  dealId: string | null;
  text: string | null;
  read: boolean;
  createdAt: string;
};

function ago(iso: string) {
  const s = (Date.parse(iso) - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (Math.abs(s) < 60) return "agora";
  if (Math.abs(s) < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (Math.abs(s) < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

/** Sininho de notificações (menções com @), atualizado em tempo real. */
export function NotificationBell({ userId, items, unread }: { userId: string; items: NotificationItem[]; unread: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  function open(n: NotificationItem) {
    start(async () => {
      if (!n.read) await markNotificationsRead(n.id);
      router.push(n.entityId ? `/contatos/${n.entityId}` : n.dealId ? `/oportunidades/${n.dealId}` : "/");
    });
  }

  return (
    <Menu
      className="w-[360px] max-w-[calc(100vw-2rem)] p-0"
      buttonLabel={unread ? `Notificações (${unread} não lidas)` : "Notificações"}
      buttonClassName="relative inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      button={
        <>
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="tabular absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </>
      }
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-sm font-semibold">Notificações</p>
        {unread > 0 && (
          <button
            type="button"
            data-close
            disabled={pending}
            onClick={() => start(async () => void (await markNotificationsRead()))}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
          >
            <CheckCheck className="size-3.5" /> Marcar todas como lidas
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-muted">
            <AtSign className="size-5" />
          </span>
          <p className="mt-3 text-sm font-medium">Nenhuma notificação</p>
          <p className="mt-1 text-xs text-muted">Menções com @ e clientes transferidos para você aparecem aqui.</p>
        </div>
      ) : (
        <ul className="max-h-[420px] overflow-y-auto py-1">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                data-close
                onClick={() => open(n)}
                className={cn("flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/70", !n.read && "bg-brand-soft/40")}
              >
                <Avatar size="sm" name={n.actorName} src={n.actorAvatar} />
                <span className="min-w-0 flex-1">
                  {n.kind === "responsavel" ? (
                    <span className="block text-sm">
                      <span className="font-medium">{n.actorName}</span> passou para você a responsabilidade pelo cliente{" "}
                      <span className="font-medium">{n.entityName ?? n.text}</span>
                    </span>
                  ) : (
                    <>
                      <span className="block text-sm">
                        <span className="font-medium">{n.actorName}</span> mencionou você
                        {n.entityName && (
                          <>
                            {" "}em <span className="font-medium">{n.entityName}</span>
                          </>
                        )}
                      </span>
                      {n.text && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.text}</span>}
                    </>
                  )}
                  <span className="mt-1 block text-[11px] text-muted">{ago(n.createdAt)}</span>
                </span>
                {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-label="Não lida" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Menu>
  );
}
