import Link from "next/link";

export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="var(--brand)" />
      <polygon points="16,9 22,12.5 22,19.5 16,23 10,19.5 10,12.5" fill="var(--brand-fg)" fillOpacity="0.9" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <LogoMark />
      <span>Favo CRM</span>
    </Link>
  );
}
