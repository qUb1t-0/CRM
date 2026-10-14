"use client";

import { useState, type ReactNode } from "react";
import { MailWarning } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inputClass, cn } from "@/components/ui";
import { maskPhone } from "@/lib/br";
import { saveProfile } from "@/app/(app)/configuracoes/perfil/actions";

export type ProfileValues = {
  name: string;
  email: string;
  pendingEmail: string | null;
  jobTitle: string | null;
  phone: string | null;
  birthDate: string | null;
  bio: string | null;
};

/** Linha no estilo do Nectar: rótulo à esquerda, campo à direita. */
function Row({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
      <label htmlFor={htmlFor} className="pt-2 text-sm font-medium">
        {label}
      </label>
      <div className="min-w-0">
        {children}
        {hint && <div className="mt-1.5 text-xs text-muted">{hint}</div>}
      </div>
    </div>
  );
}

export function ProfileForm({ values, avatar }: { values: ProfileValues; avatar: ReactNode }) {
  const [phone, setPhone] = useState(values.phone ? maskPhone(values.phone) : "");
  const [bio, setBio] = useState(values.bio ?? "");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <ActionForm action={saveProfile}>
      <div className="divide-y divide-line">
        <Row label="Foto do perfil">{avatar}</Row>

        <Row label="Nome" htmlFor="full_name">
          <input id="full_name" name="full_name" required minLength={2} maxLength={120} defaultValue={values.name} autoComplete="name" className={cn(inputClass, "h-10 max-w-md")} />
        </Row>

        <Row label="Cargo" htmlFor="job_title">
          <input
            id="job_title"
            name="job_title"
            maxLength={80}
            defaultValue={values.jobTitle ?? ""}
            placeholder="Ex.: Assessor comercial"
            autoComplete="organization-title"
            className={cn(inputClass, "h-10 max-w-md")}
          />
        </Row>

        <Row
          label="E-mail"
          htmlFor="email"
          hint={
            values.pendingEmail ? (
              <span className="inline-flex items-center gap-1.5 text-brand">
                <MailWarning className="size-3.5" /> Aguardando confirmação de {values.pendingEmail}. Verifique a caixa de entrada.
              </span>
            ) : (
              "Também é o seu login. Ao trocar, enviamos um link de confirmação para o novo endereço."
            )
          }
        >
          <input id="email" name="email" type="email" required defaultValue={values.email} autoComplete="email" className={cn(inputClass, "h-10 max-w-sm")} />
        </Row>

        <Row label="Data de nascimento" htmlFor="birth_date">
          <input id="birth_date" name="birth_date" type="date" min="1900-01-01" max={today} defaultValue={values.birthDate ?? ""} className={cn(inputClass, "h-10 max-w-[200px]")} />
        </Row>

        <Row label="Celular" htmlFor="phone">
          <div className="flex max-w-[260px] items-stretch">
            <span className="flex items-center gap-1.5 rounded-l-lg border border-r-0 border-line bg-surface-2 px-2.5 text-sm" title="Brasil">
              <span aria-hidden>🇧🇷</span> +55
            </span>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(00) 0 0000-0000"
              maxLength={16}
              autoComplete="tel-national"
              className={cn(inputClass, "h-10 rounded-l-none")}
            />
          </div>
        </Row>

        <Row label="Observação" htmlFor="bio" hint={<span className="tabular">{bio.length}/500</span>}>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            maxLength={500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Digite uma informação relevante sobre você"
            className={cn(inputClass, "max-w-2xl resize-y")}
          />
        </Row>
      </div>

      <div className="sticky bottom-0 -mx-5 mt-2 flex justify-end border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <SubmitButton pendingText="Salvando…">Salvar</SubmitButton>
      </div>
    </ActionForm>
  );
}
