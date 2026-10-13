"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { CalendarClock, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, cn } from "@/components/ui";
import { toast } from "@/components/toast";
import { moneyCompact, money, date, todayISO } from "@/lib/format";
import type { Member, Stage } from "@/lib/types";
import { moveDeal } from "./actions";

export type KanbanDeal = {
  id: string;
  title: string;
  value: number;
  stage_id: string;
  owner_id: string | null;
  expected_close: string | null;
  entity: { name: string } | null;
};

export function Kanban({
  orgId,
  stages,
  deals,
  members,
}: {
  orgId: string;
  stages: Stage[];
  deals: KanbanDeal[];
  members: Member[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [optimistic, applyMove] = useOptimistic(deals, (state, move: { id: string; stageId: string }) =>
    state.map((d) => (d.id === move.id ? { ...d, stage_id: move.stageId } : d)),
  );
  const today = todayISO();

  // Atualização em tempo real (papel do NotificationService/WebSocket do sistema original)
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`deals:${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals", filter: `org_id=eq.${orgId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 400);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [orgId, router]);

  const byStage = useMemo(() => {
    const map = new Map<string, KanbanDeal[]>();
    stages.forEach((s) => map.set(s.id, []));
    optimistic.forEach((d) => map.get(d.stage_id)?.push(d));
    return map;
  }, [optimistic, stages]);

  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name ?? "Sem responsável";

  function drop(stageId: string) {
    const id = dragging;
    setDragging(null);
    setOver(null);
    if (!id) return;
    const deal = optimistic.find((d) => d.id === id);
    if (!deal || deal.stage_id === stageId) return;
    startTransition(async () => {
      applyMove({ id, stageId });
      const res = await moveDeal(id, stageId);
      if (res?.error) toast(res.error, "error");
    });
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
      <div className="flex min-w-max gap-3">
        {stages.map((stage) => {
          const items = byStage.get(stage.id) ?? [];
          const total = items.reduce((acc, d) => acc + Number(d.value), 0);
          return (
            <section
              key={stage.id}
              aria-label={stage.name}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOver(stage.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(stage.id);
              }}
              className={cn(
                "flex w-[272px] flex-col rounded-xl border bg-surface-2/60 transition-colors",
                over === stage.id ? "border-brand bg-brand-soft/40" : "border-line",
              )}
            >
              <header className="border-b border-line px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-semibold">{stage.name}</h3>
                  <span className="tabular rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{items.length}</span>
                </div>
                <p className="tabular mt-0.5 text-xs text-muted">
                  {money(total)} · {stage.probability}%
                </p>
              </header>
              <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
                {items.map((d) => {
                  const late = d.expected_close && d.expected_close < today;
                  return (
                    <Link
                      key={d.id}
                      href={`/oportunidades/${d.id}`}
                      draggable
                      onDragStart={(e) => {
                        setDragging(d.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", d.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      className={cn(
                        "block rounded-lg border border-line bg-surface p-3 shadow-sm transition hover:border-brand/50 hover:shadow",
                        dragging === d.id && "opacity-50",
                      )}
                    >
                      <p className="line-clamp-2 text-sm font-medium">{d.title}</p>
                      {d.entity && (
                        <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted">
                          <Building2 className="size-3 shrink-0" />
                          <span className="truncate">{d.entity.name}</span>
                        </p>
                      )}
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="tabular text-sm font-semibold">{moneyCompact(d.value)}</span>
                        <div className="flex items-center gap-1.5">
                          {d.expected_close && (
                            <span
                              title="Previsão de fechamento"
                              className={cn("flex items-center gap-1 text-xs", late ? "text-danger" : "text-muted")}
                            >
                              <CalendarClock className="size-3" />
                              {date(d.expected_close).slice(0, 5)}
                            </span>
                          )}
                          <Avatar size="sm" name={memberName(d.owner_id)} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {items.length === 0 && (
                  <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line p-4 text-center text-xs text-muted">
                    Arraste oportunidades para cá
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
