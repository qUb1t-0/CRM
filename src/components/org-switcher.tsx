"use client";

import { useTransition } from "react";
import { ChevronsUpDown } from "lucide-react";
import { switchOrg } from "@/app/(app)/org-actions";

/** Troca de base (organização), como o seletor de "bases" do login original. */
export function OrgSwitcher({ orgs, activeId }: { orgs: { id: string; name: string }[]; activeId: string }) {
  const [pending, start] = useTransition();
  const active = orgs.find((o) => o.id === activeId);

  if (orgs.length <= 1) {
    return (
      <div className="truncate rounded-md border border-line bg-surface-2 px-3 py-2 text-sm font-medium" title={active?.name}>
        {active?.name}
      </div>
    );
  }

  return (
    <label className="relative block">
      <span className="sr-only">Base ativa</span>
      <select
        value={activeId}
        disabled={pending}
        onChange={(e) => start(() => switchOrg(e.target.value))}
        className="h-9 w-full appearance-none truncate rounded-md border border-line bg-surface-2 pr-8 pl-3 text-sm font-medium focus:border-brand focus:outline-none"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted" />
    </label>
  );
}
