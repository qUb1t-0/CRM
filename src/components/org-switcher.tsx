"use client";

import { useTransition } from "react";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { switchOrg } from "@/app/(app)/org-actions";

function OrgMark({ name }: { name: string }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand text-[11px] font-bold text-brand-fg">
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/** Troca de base (organização), como o seletor de "bases" do login original. */
export function OrgSwitcher({ orgs, activeId }: { orgs: { id: string; name: string }[]; activeId: string }) {
  const [pending, start] = useTransition();
  const active = orgs.find((o) => o.id === activeId);
  const name = active?.name ?? "";

  if (orgs.length <= 1) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-2/60 px-2.5 py-2" title={name}>
        <OrgMark name={name} />
        <span className="truncate text-sm font-medium">{name}</span>
      </div>
    );
  }

  return (
    <label className="relative flex items-center gap-2.5 rounded-lg border border-line bg-surface-2/60 px-2.5 py-2 transition-colors focus-within:border-brand hover:border-line-strong">
      <span className="sr-only">Base ativa</span>
      <OrgMark name={name} />
      <span className="flex-1 truncate text-sm font-medium">{name}</span>
      {pending ? <Loader2 className="size-4 animate-spin text-muted" /> : <ChevronsUpDown className="size-4 text-muted" />}
      <select
        value={activeId}
        disabled={pending}
        onChange={(e) => start(() => switchOrg(e.target.value))}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
