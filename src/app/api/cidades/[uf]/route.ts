import { NextResponse, type NextRequest } from "next/server";
import { UF_SIGLAS } from "@/lib/br";

/**
 * Lista os municípios de uma UF usando a API pública de localidades do IBGE.
 * A resposta fica em cache por 30 dias (os municípios praticamente não mudam).
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/cidades/[uf]">) {
  const { uf } = await ctx.params;
  const sigla = uf.toUpperCase();
  if (!UF_SIGLAS.has(sigla)) return NextResponse.json({ error: "UF inválida" }, { status: 400 });

  try {
    const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${sigla}/municipios?orderBy=nome`, {
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!res.ok) throw new Error(`IBGE ${res.status}`);
    const data = (await res.json()) as { nome: string }[];
    const cidades = data.map((m) => m.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return NextResponse.json(cidades, {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar as cidades agora." }, { status: 502 });
  }
}
