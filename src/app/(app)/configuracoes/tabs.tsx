"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const tabs = [
  { href: "/configuracoes", label: "Geral" },
  { href: "/configuracoes/usuarios", label: "Usuários" },
  { href: "/configuracoes/funis", label: "Funis e etapas" },
  { href: "/configuracoes/motivos", label: "Motivos de perda" },
  { href: "/configuracoes/campos", label: "Campos personalizados" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Configurações">
      <ul className="flex min-w-max gap-5">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block border-b-2 pb-2.5 text-sm transition-colors",
                  active ? "border-brand font-medium text-fg" : "border-transparent text-muted hover:text-fg",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
