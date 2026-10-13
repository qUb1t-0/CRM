import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeSwitcher compact />
        </div>
        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm py-10">{children}</div>
        </div>
        <p className="text-xs text-muted">© {new Date().getFullYear()} Favo CRM</p>
      </main>
      <aside className="relative hidden overflow-hidden border-l border-line bg-surface-2 lg:block" aria-hidden>
        <HoneycombArt />
        <div className="absolute inset-x-12 bottom-12 max-w-md">
          <p className="text-2xl font-semibold tracking-tight text-balance">
            Seu funil de vendas, organizado do primeiro contato ao fechamento.
          </p>
          <p className="mt-3 text-sm text-muted">
            Oportunidades, contatos, tarefas, propostas e metas no mesmo lugar, para toda a equipe.
          </p>
        </div>
      </aside>
    </div>
  );
}

function HoneycombArt() {
  const cells: { x: number; y: number; o: number }[] = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 8; col++) {
      const x = col * 90 + (row % 2) * 45;
      const y = row * 78;
      const o = ((row * 7 + col * 3) % 10) / 10;
      cells.push({ x, y, o });
    }
  }
  return (
    <svg viewBox="0 0 720 640" className="absolute -top-10 -right-24 h-[120%] text-brand" preserveAspectRatio="xMidYMin slice">
      {cells.map((c, i) => (
        <polygon
          key={i}
          transform={`translate(${c.x} ${c.y})`}
          points="45,0 90,26 90,78 45,104 0,78 0,26"
          fill="currentColor"
          fillOpacity={c.o > 0.75 ? 0.22 : c.o > 0.5 ? 0.08 : 0.03}
          stroke="currentColor"
          strokeOpacity={0.18}
        />
      ))}
    </svg>
  );
}
