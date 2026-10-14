/**
 * Módulos bloqueados temporariamente.
 * Para liberar a seção Vendas, defina NEXT_PUBLIC_BLOQUEAR_VENDAS=false (ou remova) no .env.local
 * e reinicie o servidor.
 */
export const SALES_LOCKED = process.env.NEXT_PUBLIC_BLOQUEAR_VENDAS === "true";

export const SALES_PATHS = ["/oportunidades", "/propostas", "/produtos", "/metas"];

export function isLockedPath(pathname: string) {
  return SALES_LOCKED && SALES_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
