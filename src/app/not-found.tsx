import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <LogoMark className="size-10" />
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="text-sm text-muted">O registro pode ter sido excluído ou o endereço está incorreto.</p>
      <Link href="/" className={buttonClass("primary")}>
        Voltar ao início
      </Link>
    </main>
  );
}
