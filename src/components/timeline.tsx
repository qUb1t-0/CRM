import Link from "next/link";
import {
  ArrowRightLeft,
  CheckCircle2,
  FilePlus2,
  FileText,
  MessageSquare,
  PlusCircle,
  RotateCcw,
  Trophy,
  UserRound,
  XCircle,
  ListTodo,
} from "lucide-react";
import type { ReactNode } from "react";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Textarea } from "@/components/ui";
import { dateTime, money, relative } from "@/lib/format";
import type { Member } from "@/lib/types";
import { addNote, deleteNote } from "@/app/(app)/timeline-actions";

export type TimelineEvent = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
  deal_id: string | null;
  entity_id: string | null;
};

function describe(e: TimelineEvent): { icon: ReactNode; text: ReactNode } {
  const p = e.payload as Record<string, string | number | null>;
  const title = <strong className="font-medium">{p.title}</strong>;
  switch (e.kind) {
    case "nota":
      return { icon: <MessageSquare className="size-4" />, text: <span className="whitespace-pre-wrap">{p.text}</span> };
    case "oportunidade_criada":
      return { icon: <PlusCircle className="size-4" />, text: <>criou a oportunidade {title}</> };
    case "etapa_alterada":
      return { icon: <ArrowRightLeft className="size-4" />, text: <>moveu {title} de {p.from} para <strong className="font-medium">{p.to}</strong></> };
    case "oportunidade_ganha":
      return { icon: <Trophy className="size-4 text-ok" />, text: <>ganhou {title} ({money(p.value)})</> };
    case "oportunidade_perdida":
      return { icon: <XCircle className="size-4 text-danger" />, text: <>perdeu {title}{p.reason ? ` · motivo: ${p.reason}` : ""}</> };
    case "oportunidade_reaberta":
      return { icon: <RotateCcw className="size-4" />, text: <>reabriu {title}</> };
    case "responsavel_alterado":
      return { icon: <UserRound className="size-4" />, text: <>passou {title} para {p.to ?? "ninguém"}</> };
    case "entidade_criada":
      return { icon: <PlusCircle className="size-4" />, text: <>cadastrou <strong className="font-medium">{p.name}</strong></> };
    case "tarefa_criada":
      return { icon: <ListTodo className="size-4" />, text: <>criou a tarefa {title}</> };
    case "tarefa_concluida":
      return { icon: <CheckCircle2 className="size-4 text-ok" />, text: <>concluiu a tarefa {title}</> };
    default:
      if (e.kind.startsWith("proposta_")) {
        const status = e.kind.replace("proposta_", "");
        const verbs: Record<string, string> = {
          rascunho: "criou a proposta",
          enviada: "enviou a proposta",
          aceita: "registrou como aceita a proposta",
          recusada: "registrou como recusada a proposta",
        };
        return {
          icon: status === "rascunho" ? <FilePlus2 className="size-4" /> : <FileText className="size-4" />,
          text: <>{verbs[status] ?? "alterou a proposta"} nº {p.number} ({money(p.total)})</>,
        };
      }
      return { icon: <PlusCircle className="size-4" />, text: e.kind };
  }
}

export function Timeline({
  events,
  members,
  currentUserId,
  showLinks,
  noteTarget,
}: {
  events: TimelineEvent[];
  members: Member[];
  currentUserId: string;
  showLinks?: boolean;
  noteTarget?: { entityId?: string | null; dealId?: string | null };
}) {
  const name = (id: string | null) => members.find((m) => m.id === id)?.name ?? "Alguém";

  return (
    <div>
      {noteTarget && (
        <ActionForm action={addNote} className="mb-5">
          <input type="hidden" name="entity_id" value={noteTarget.entityId ?? ""} />
          <input type="hidden" name="deal_id" value={noteTarget.dealId ?? ""} />
          <Textarea name="text" required maxLength={5000} placeholder="Registrar uma anotação, ligação ou reunião…" />
          <div className="mt-2 flex justify-end">
            <SubmitButton size="sm">Salvar anotação</SubmitButton>
          </div>
        </ActionForm>
      )}
      {events.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nenhuma atividade registrada ainda.</p>
      ) : (
        <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-line">
          {events.map((e) => {
            const d = describe(e);
            const isNote = e.kind === "nota";
            return (
              <li key={e.id} className="relative flex gap-3">
                <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-muted">
                  {d.icon}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm">
                    <span className="font-medium">{name(e.actor_id)}</span>{" "}
                    {isNote ? <span className="text-muted">registrou uma anotação</span> : d.text}
                  </p>
                  {isNote && <div className="mt-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm">{d.text}</div>}
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <time dateTime={e.created_at} title={dateTime(e.created_at)}>
                      {relative(e.created_at)}
                    </time>
                    {showLinks && e.deal_id && (
                      <Link href={`/oportunidades/${e.deal_id}`} className="hover:text-brand hover:underline">
                        ver oportunidade
                      </Link>
                    )}
                    {showLinks && !e.deal_id && e.entity_id && (
                      <Link href={`/contatos/${e.entity_id}`} className="hover:text-brand hover:underline">
                        ver contato
                      </Link>
                    )}
                    {isNote && e.actor_id === currentUserId && (
                      <ActionButton
                        action={deleteNote.bind(null, e.id)}
                        confirm="Excluir esta anotação?"
                        variant="ghost"
                        className="h-auto px-1 py-0 text-xs"
                      >
                        excluir
                      </ActionButton>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
