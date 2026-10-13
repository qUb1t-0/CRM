"use client";

import { AlertTriangle } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto mt-10 max-w-md p-6 text-center">
      <AlertTriangle className="mx-auto size-8 text-danger" />
      <h1 className="mt-3 text-lg font-semibold">Algo deu errado</h1>
      <p className="mt-1 text-sm text-muted">{error.message || "Não foi possível carregar esta página."}</p>
      <Button variant="primary" className="mt-5" onClick={reset}>
        Tentar novamente
      </Button>
    </Card>
  );
}
