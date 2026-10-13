"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { cn } from "@/components/ui";
import { toast } from "@/components/toast";
import { toggleTask } from "@/app/(app)/tarefas/actions";

export function TaskCheckbox({ id, done }: { id: string; done: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={optimistic ? "Reabrir tarefa" : "Concluir tarefa"}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          const res = await toggleTask(id, !optimistic);
          if (res?.error) toast(res.error, "error");
        })
      }
      className={cn(
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
        optimistic ? "border-ok bg-ok text-white" : "border-line hover:border-ok",
      )}
    >
      {optimistic && <Check className="size-3" strokeWidth={3} />}
    </button>
  );
}
