"use client";

import type { ComponentProps } from "react";

/**
 * Formulário de filtros via GET que se aplica sozinho ao mudar um <select>.
 * Campos de texto aplicam ao pressionar Enter.
 */
export function FilterForm({ children, ...props }: ComponentProps<"form">) {
  return (
    <form
      {...props}
      onChange={(e) => {
        if ((e.target as HTMLElement).tagName === "SELECT") e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
