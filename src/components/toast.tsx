"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type Toast = { id: number; kind: "ok" | "error"; text: string };

const EVENT = "crm:toast";

export function toast(text: string, kind: Toast["kind"] = "ok") {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, kind } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    let seq = 0;
    const onToast = (e: Event) => {
      const { text, kind } = (e as CustomEvent).detail as Omit<Toast, "id">;
      const id = ++seq;
      setItems((prev) => [...prev.slice(-3), { id, text, kind }]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), kind === "error" ? 6000 : 3500);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div
      aria-live="polite"
      className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm shadow-lg"
        >
          {t.kind === "ok" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
          )}
          <span className="flex-1">{t.text}</span>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-muted hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
