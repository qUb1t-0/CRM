"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { buttonClass, cn } from "@/components/ui";
import { toast } from "@/components/toast";
import type { ActionState } from "@/lib/types";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;
type Variant = "primary" | "secondary" | "ghost" | "danger";

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingText,
}: {
  children: ReactNode;
  variant?: Variant;
  size?: "sm" | "md";
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={cn(buttonClass(variant, size), className)}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/**
 * Formulário ligado a uma Server Action: mostra o erro em linha, dispara um toast
 * no sucesso e fecha o <dialog> que o contém.
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
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}
    </form>
  );
}

/** Diálogo de confirmação estilizado (substitui window.confirm). */
function ConfirmDialog({
  dialogRef,
  message,
  confirmLabel,
  danger,
  onConfirm,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  message: string;
  confirmLabel: string;
  danger: boolean;
  onConfirm: () => void;
}) {
  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-line bg-surface p-0 text-fg shadow-lg"
    >
      <div className="p-5">
        <div className="flex gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              danger ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand",
            )}
          >
            <AlertTriangle className="size-4" />
          </span>
          <div className="pt-1">
            <h2 className="text-sm font-semibold">Confirmar ação</h2>
            <p className="mt-1 text-sm text-pretty text-muted">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" autoFocus className={buttonClass("secondary")} onClick={() => dialogRef.current?.close()}>
            Cancelar
          </button>
          <button
            type="button"
            className={
              danger
                ? "inline-flex h-9 items-center justify-center rounded-lg bg-danger px-3.5 text-sm font-medium text-white shadow-sm transition-[filter,transform] hover:brightness-110 active:scale-[0.98] dark:text-[#1a0f0e]"
                : buttonClass("primary")
            }
            onClick={() => {
              dialogRef.current?.close();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Botão que executa uma Server Action simples, com confirmação opcional. */
export function ActionButton({
  action,
  children,
  confirm: confirmText,
  confirmLabel,
  variant = "secondary",
  size = "sm",
  className,
  title,
}: {
  action: () => Promise<ActionState>;
  children: ReactNode;
  confirm?: string;
  confirmLabel?: string;
  variant?: Variant;
  size?: "sm" | "md";
  className?: string;
  title?: string;
}) {
  const [pending, setPending] = useState(false);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const isDelete = /excluir|remover|cancelar|lixeira/i.test(confirmText ?? "") || variant === "danger";

  async function run() {
    setPending(true);
    try {
      const res = await action();
      if (res?.error) toast(res.error, "error");
      else if (res?.message) toast(res.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        title={title}
        aria-label={title}
        disabled={pending}
        aria-busy={pending}
        className={cn(buttonClass(variant, size), className)}
        onClick={() => (confirmText ? confirmRef.current?.showModal() : run())}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : children}
      </button>
      {confirmText && (
        <ConfirmDialog
          dialogRef={confirmRef}
          message={confirmText}
          confirmLabel={confirmLabel ?? (isDelete ? "Excluir" : "Confirmar")}
          danger={isDelete}
          onConfirm={run}
        />
      )}
    </>
  );
}

export function Modal({
  trigger,
  title,
  description,
  children,
  triggerVariant = "secondary",
  triggerSize = "md",
  triggerClassName,
  triggerLabel,
  wide,
  autoOpenParam,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  triggerVariant?: Variant;
  triggerSize?: "sm" | "md";
  triggerClassName?: string;
  /** Rótulo acessível quando o gatilho é só um ícone. */
  triggerLabel?: string;
  wide?: boolean;
  /** Abre automaticamente quando a URL tem ?<param>=1 (atalhos "Novo …"). */
  autoOpenParam?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const shouldAutoOpen = !!autoOpenParam && searchParams.get(autoOpenParam) === "1";
  const [open, setOpen] = useState(shouldAutoOpen);

  useEffect(() => {
    if (!shouldAutoOpen) return;
    ref.current?.showModal();
    const params = new URLSearchParams(searchParams.toString());
    params.delete(autoOpenParam!);
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  }, [shouldAutoOpen, autoOpenParam, searchParams, pathname, router]);

  return (
    <>
      <button
        type="button"
        title={triggerLabel}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
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
        aria-label={title}
        className={cn(
          "m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-fg shadow-lg",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
      >
        {open && (
          <div className="flex max-h-[88dvh] flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => ref.current?.close()}
                className="-m-1 rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
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
  return <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">{children}</div>;
}
