"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui";

/** Menu suspenso simples: fecha com Esc, clique fora ou ao escolher um item. */
export function Menu({
  button,
  buttonClassName,
  buttonLabel,
  children,
  align = "end",
  side = "bottom",
  className,
}: {
  button: ReactNode;
  buttonClassName?: string;
  buttonLabel?: string;
  children: ReactNode;
  align?: "start" | "end";
  side?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={buttonLabel}
        title={buttonLabel}
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName}
      >
        {button}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a,[data-close]")) setOpen(false);
          }}
          className={cn(
            "animate-pop absolute z-50 min-w-56 rounded-xl border border-line bg-surface p-1.5 shadow-lg",
            align === "end" ? "right-0" : "left-0",
            side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export const menuItemClass =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-fg transition-colors hover:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted";
