"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, X } from "lucide-react";
import { buttonClass, cn } from "@/components/ui";
import { toast } from "@/components/toast";
import type { ActionState } from "@/lib/types";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingText,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(buttonClass(variant, size), className)}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/**
 * Formulário ligado a uma Server Action. Mostra o erro em linha e um toast no
 * sucesso, e fecha o <dialog> que o contém. É o papel do envelope
 * {sucesso, mensagem} + AlertMessage do sistema original.
 */
export function ActionForm({
  action,
  children,
  className,
  onSuccess,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.message) toast(state.message);
      ref.current?.closest("dialog")?.close();
      onSuccess?.();
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state, onSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** Botão que executa uma Server Action simples, com confirmação opcional. */
export function ActionButton({
  action,
  children,
  confirm: confirmText,
  variant = "secondary",
  size = "sm",
  className,
  title,
}: {
  action: () => Promise<ActionState>;
  children: ReactNode;
  confirm?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  title?: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={pending}
      className={cn(buttonClass(variant, size), className)}
      onClick={async () => {
        if (confirmText && !window.confirm(confirmText)) return;
        setPending(true);
        try {
          const res = await action();
          if (res?.error) toast(res.error, "error");
          else if (res?.message) toast(res.message);
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : children}
    </button>
  );
}

export function Modal({
  trigger,
  title,
  children,
  triggerVariant = "secondary",
  triggerSize = "md",
  triggerClassName,
  wide,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
  triggerVariant?: "primary" | "secondary" | "ghost" | "danger";
  triggerSize?: "sm" | "md";
  triggerClassName?: string;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={cn(buttonClass(triggerVariant, triggerSize), triggerClassName)}
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => ref.current?.showModal());
        }}
      >
        {trigger}
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className={cn(
          "m-auto w-[calc(100%-2rem)] rounded-xl border border-line bg-surface p-0 text-fg shadow-2xl",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
      >
        {open && (
          <div className="flex max-h-[85vh] flex-col">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-base font-semibold">{title}</h2>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => ref.current?.close()}
                className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
          </div>
        )}
      </dialog>
    </>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex justify-end gap-2">{children}</div>;
}
