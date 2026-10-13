"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/components/ui";

export type ThemePref = "light" | "dark" | "system";

const KEY = "favo-theme";
const EVENT = "favo-theme-change";

/**
 * Script executado antes da primeira pintura: aplica o tema salvo (ou o do sistema)
 * em <html data-theme>, evitando o "flash" de tema errado.
 */
export const themeScript = `(function(){try{var p=localStorage.getItem("${KEY}")||"system";var m=window.matchMedia("(prefers-color-scheme: dark)");var r=p==="system"?(m.matches?"dark":"light"):p;var d=document.documentElement;d.setAttribute("data-theme",r);d.setAttribute("data-theme-pref",p);m.addEventListener("change",function(e){if((localStorage.getItem("${KEY}")||"system")==="system"){d.setAttribute("data-theme",e.matches?"dark":"light");window.dispatchEvent(new Event("${EVENT}"))}})}catch(e){}})()`;

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function setTheme(pref: ThemePref) {
  const root = document.documentElement;
  const resolved = pref === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : pref;
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // armazenamento indisponível: aplica só nesta sessão
  }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) root.classList.add("theme-transition");
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-theme-pref", pref);
  window.dispatchEvent(new Event(EVENT));
  if (!reduce) setTimeout(() => root.classList.remove("theme-transition"), 250);
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as ThemePref);
  const resolved = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"),
    () => "light",
  );
  return { pref, resolved, setTheme };
}

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

/** Seletor segmentado: Claro / Escuro / Sistema. */
export function ThemeSwitcher({ className, compact }: { className?: string; compact?: boolean }) {
  const { pref } = useTheme();
  return (
    <div role="radiogroup" aria-label="Tema" className={cn("inline-flex rounded-lg border border-line bg-surface-2 p-0.5", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              active ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="size-3.5" />
            {!compact && label}
            {compact && <span className="sr-only">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Botão de ícone que alterna entre claro e escuro (atalho rápido na barra superior). */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolved } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={resolved === "dark" ? "Usar tema claro" : "Usar tema escuro"}
      aria-label={resolved === "dark" ? "Usar tema claro" : "Usar tema escuro"}
      className={cn("relative inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg", className)}
    >
      <Sun className="size-[18px] scale-100 rotate-0 transition-transform duration-300 dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-[18px] scale-0 rotate-90 transition-transform duration-300 dark:scale-100 dark:rotate-0" />
    </button>
  );
}
