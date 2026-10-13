import { NextResponse, type NextRequest } from "next/server";
import { getContext, getMembers } from "@/lib/session";

function csv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    // Evita injeção de fórmulas ao abrir no Excel
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}

const num = (n: number | string | null) => (n == null ? "" : String(n).replace(".", ","));

export async function GET(_req: NextRequest, ctxRoute: RouteContext<"/api/exportar/[tipo]">) {
  const { tipo } = await ctxRoute.params;
  const ctx = await getContext();
  const members = await getMembers();
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name ?? "";
  let body: string;

  if (tipo === "contatos") {
    const { data } = await ctx.supabase
      .from("entities")
      .select("name, kind, document, email, phone, website, city, state, segment, owner_id, created_at")
      .eq("org_id", ctx.org.id)
      .order("name")
      .limit(10000);
    body = csv([
      ["nome", "tipo", "documento", "email", "telefone", "site", "cidade", "estado", "segmento", "responsavel", "criado_em"],
      ...(data ?? []).map((e) => [e.name, e.kind, e.document, e.email, e.phone, e.website, e.city, e.state, e.segment, memberName(e.owner_id), e.created_at.slice(0, 10)]),
    ]);
  } else if (tipo === "oportunidades") {
    const { data } = await ctx.supabase
      .from("deals")
      .select("title, value, status, expected_close, closed_at, source, owner_id, created_at, entity:entities(name), stage:stages(name), pipeline:pipelines(name), loss_reason:loss_reasons(name)")
      .eq("org_id", ctx.org.id)
      .order("created_at", { ascending: false })
      .limit(10000);
    body = csv([
      ["titulo", "empresa_pessoa", "funil", "etapa", "valor", "situacao", "previsao", "fechamento", "motivo_perda", "origem", "responsavel", "criado_em"],
      ...(data ?? []).map((d) => {
        const rel = d as unknown as Record<string, { name: string } | null>;
        return [
          d.title,
          rel.entity?.name,
          rel.pipeline?.name,
          rel.stage?.name,
          num(d.value),
          d.status,
          d.expected_close,
          d.closed_at?.slice(0, 10),
          rel.loss_reason?.name,
          d.source,
          memberName(d.owner_id),
          d.created_at.slice(0, 10),
        ];
      }),
    ]);
  } else {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 404 });
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tipo}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
