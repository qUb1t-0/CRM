import type { Metadata } from "next";
import { Box, Building2, CheckSquare, FileText, Kanban, RotateCcw, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { ActionButton } from "@/components/forms";
import { Avatar, Badge, Card, CardHeader, EmptyState, Segmented, cn } from "@/components/ui";
import { getContext, getMembers } from "@/lib/session";
import { dateTime, relative } from "@/lib/format";
import { emptyTrash, purgeItem, restoreItem } from "./actions";

export const metadata: Metadata = { title: "Lixeira" };

const RETENTION_DAYS = 60;

type TrashRow = {
  item_type: "entities" | "deals" | "proposals" | "products" | "tasks";
  id: string;
  title: string;
  subtitle: string | null;
  deleted_at: string;
  deleted_by: string | null;
  extra: number;
};

const TYPES: Record<TrashRow["item_type"], { label: string; plural: string; icon: ReactNode; filter: string }> = {
  entities: { label: "Contato", plural: "Contatos", icon: <Building2 className="size-4" />, filter: "contatos" },
  deals: { label: "Oportunidade", plural: "Oportunidades", icon: <Kanban className="size-4" />, filter: "oportunidades" },
  proposals: { label: "Proposta", plural: "Propostas", icon: <FileText className="size-4" />, filter: "propostas" },
  products: { label: "Produto", plural: "Produtos", icon: <Box className="size-4" />, filter: "produtos" },
  tasks: { label: "Tarefa", plural: "Tarefas", icon: <CheckSquare className="size-4" />, filter: "tarefas" },
};

function daysLeft(deletedAt: string) {
  const ms = new Date(deletedAt).getTime() + RETENTION_DAYS * 86400000 - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export default async function TrashPage({ searchParams }: PageProps<"/configuracoes/lixeira">) {
  const sp = await searchParams;
  const ctx = await getContext();
  const members = await getMembers();
  const { data, error } = await ctx.supabase.rpc("trash_list", { p_org: ctx.org.id });
  const all = (data ?? []) as TrashRow[];

  const tipo = typeof sp.tipo === "string" ? sp.tipo : "todos";
  const typeKey = (Object.keys(TYPES) as TrashRow["item_type"][]).find((k) => TYPES[k].filter === tipo);
  const rows = typeKey ? all.filter((r) => r.item_type === typeKey) : all;
  const count = (k: TrashRow["item_type"]) => all.filter((r) => r.item_type === k).length;
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name ?? "Usuário removido";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-pretty text-muted">
          Itens excluídos ficam aqui por <strong className="text-fg">{RETENTION_DAYS} dias</strong> e podem ser recuperados com
          todos os vínculos. Depois disso, são apagados automaticamente.
          {!ctx.isAdmin && " Somente administradores podem excluir definitivamente."}
        </p>
        {ctx.isAdmin && all.length > 0 && (
          <ActionButton
            action={emptyTrash}
            confirm={`Excluir definitivamente os ${all.length} itens da lixeira? Esta ação não pode ser desfeita.`}
            confirmLabel="Esvaziar lixeira"
            variant="danger"
            size="sm"
            className="shrink-0"
          >
            <Trash2 className="size-4" /> Esvaziar lixeira
          </ActionButton>
        )}
      </div>

      <Segmented
        label="Tipo"
        value={tipo}
        items={[
          { value: "todos", label: `Todos (${all.length})`, href: "/configuracoes/lixeira" },
          ...(Object.keys(TYPES) as TrashRow["item_type"][]).map((k) => ({
            value: TYPES[k].filter,
            label: `${TYPES[k].plural} (${count(k)})`,
            href: `/configuracoes/lixeira?tipo=${TYPES[k].filter}`,
          })),
        ]}
      />

      <Card>
        <CardHeader title="Itens na lixeira" description={`${rows.length} ${rows.length === 1 ? "item" : "itens"}`} />
        {error ? (
          <p className="p-4 text-sm text-danger">Erro ao carregar a lixeira: {error.message}</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Trash2 />} title="A lixeira está vazia">
            Itens que você excluir aparecerão aqui por {RETENTION_DAYS} dias.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const t = TYPES[r.item_type];
              const left = daysLeft(r.deleted_at);
              return (
                <li key={`${r.item_type}:${r.id}`} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">{t.icon}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <Badge>{t.label}</Badge>
                        {r.extra > 0 && (
                          <Badge tone="info">
                            + {r.extra} {r.extra === 1 ? "proposta" : "propostas"}
                          </Badge>
                        )}
                      </div>
                      {r.subtitle && <p className="mt-0.5 truncate text-xs text-muted">{r.subtitle}</p>}
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar size="sm" name={memberName(r.deleted_by)} />
                          Excluído por {memberName(r.deleted_by)}
                        </span>
                        <span aria-hidden>·</span>
                        <time dateTime={r.deleted_at} title={dateTime(r.deleted_at)}>
                          {relative(r.deleted_at)}
                        </time>
                        <span aria-hidden>·</span>
                        <span className={cn(left <= 7 && "font-medium text-danger")}>
                          {left === 0 ? "será apagado hoje" : `apagado em ${left} ${left === 1 ? "dia" : "dias"}`}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 pl-11 sm:pl-0">
                    <ActionButton action={restoreItem.bind(null, r.item_type, r.id)} size="sm">
                      <RotateCcw className="size-3.5" /> Recuperar
                    </ActionButton>
                    {ctx.isAdmin && (
                      <ActionButton
                        action={purgeItem.bind(null, r.item_type, r.id)}
                        confirm={`Excluir "${r.title}" definitivamente? Esta ação não pode ser desfeita${r.item_type === "entities" ? " e também apaga as pessoas de contato, tarefas e o histórico deste cadastro" : r.item_type === "deals" ? " e também apaga itens, propostas e tarefas da oportunidade" : ""}.`}
                        confirmLabel="Excluir definitivamente"
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="size-3.5" /> Excluir
                      </ActionButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
