import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { getContext, getMembers } from "@/lib/session";
import { date } from "@/lib/format";
import { inviteMember, removeMember, revokeInvite, setMemberRole } from "../actions";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage() {
  const ctx = await getContext();
  const members = await getMembers();
  const { data: invites } = ctx.isAdmin
    ? await ctx.supabase.from("invites").select("id, email, role, created_at").eq("org_id", ctx.org.id).is("accepted_at", null).order("created_at")
    : { data: [] };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader title={`Membros (${members.length})`} />
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={m.name} src={m.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {m.name} {m.id === ctx.user.id && <span className="text-muted">(você)</span>}
                </p>
                <p className="truncate text-xs text-muted">{[m.jobTitle, m.email].filter(Boolean).join(" · ")}</p>
              </div>
              {ctx.isAdmin && m.id !== ctx.user.id ? (
                <div className="flex items-center gap-1">
                  <ActionButton action={setMemberRole.bind(null, m.id, m.role === "admin" ? "membro" : "admin")} variant="ghost">
                    {m.role === "admin" ? "Tornar membro" : "Tornar admin"}
                  </ActionButton>
                  <ActionButton action={removeMember.bind(null, m.id)} confirm={`Remover ${m.name} desta base?`} variant="ghost" title="Remover">
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                </div>
              ) : null}
              <Badge tone={m.role === "admin" ? "brand" : "neutral"}>{m.role === "admin" ? "Administrador" : "Membro"}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      {ctx.isAdmin && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Convidar pessoa" />
            <ActionForm action={inviteMember} className="space-y-4 p-4">
              <Field label="E-mail" htmlFor="inv-email">
                <Input id="inv-email" name="email" type="email" required />
              </Field>
              <Field label="Papel" htmlFor="inv-role">
                <Select id="inv-role" name="role" defaultValue="membro">
                  <option value="membro">Membro</option>
                  <option value="admin">Administrador</option>
                </Select>
              </Field>
              <SubmitButton>Convidar</SubmitButton>
              <p className="text-xs text-muted">
                Quando a pessoa criar a conta (ou entrar) com este e-mail, ela passa a fazer parte desta base automaticamente.
              </p>
            </ActionForm>
          </Card>
          {(invites ?? []).length > 0 && (
            <Card>
              <CardHeader title="Convites pendentes" />
              <ul className="divide-y divide-line">
                {invites!.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{i.email}</p>
                      <p className="text-xs text-muted">
                        {i.role === "admin" ? "Administrador" : "Membro"} · {date(i.created_at)}
                      </p>
                    </div>
                    <ActionButton action={revokeInvite.bind(null, i.id)} variant="ghost" title="Cancelar convite">
                      <Trash2 className="size-3.5" />
                    </ActionButton>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
