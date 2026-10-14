import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { initials } from "@/lib/format";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export const buttonClass = (variant: Variant = "secondary", size: "sm" | "md" = "md") =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap select-none",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-55",
    size === "md" ? "h-9 px-3.5 text-sm" : "h-8 px-2.5 text-[13px]",
    variant === "primary" && "bg-brand text-brand-fg shadow-sm hover:bg-brand-hover",
    variant === "secondary" && "border border-line bg-surface text-fg shadow-sm hover:border-line-strong hover:bg-surface-2",
    variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-fg",
    variant === "danger" && "border border-line bg-surface text-danger shadow-sm hover:border-danger/40 hover:bg-danger-soft",
  );

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button type="button" className={cn(buttonClass(variant, size), className)} {...props} />;
}

export function LinkButton({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link className={cn(buttonClass(variant, size), className)} {...props} />;
}

export const inputClass =
  "block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg shadow-sm transition-[border-color,box-shadow] placeholder:text-muted/70 hover:border-line-strong focus:border-brand focus:ring-3 focus:ring-brand/20 focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70";

/** Remove o "w-full" padrão quando o componente recebe uma largura própria (ex.: "w-auto", "w-48"). */
function baseInput(className?: string) {
  return className && /(^|\s)([a-z]+:)?w-/.test(className) ? inputClass.replace(" w-full", "") : inputClass;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(baseInput(className), "h-9", className)} {...props} />;
}

/** Campo de busca de filtros (name="q"), com ícone; Enter aplica. */
export function SearchField({ className, ...props }: Omit<ComponentProps<"input">, "name" | "type">) {
  return (
    <div className={cn("relative", className)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input name="q" type="search" aria-label={props.placeholder ?? "Buscar"} className={cn(inputClass, "h-9 w-full pl-9 sm:w-64")} {...props} />
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={3} className={cn(inputClass, "resize-y", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(baseInput(className), "h-9 cursor-pointer pr-8", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-line bg-surface shadow-sm", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-line px-4 py-3", className)}>
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
    </div>
  );
}

const badgeTones = {
  neutral: "bg-surface-2 text-muted ring-line",
  brand: "bg-brand-soft text-brand ring-brand/20",
  ok: "bg-ok-soft text-ok ring-ok/20",
  danger: "bg-danger-soft text-danger ring-danger/20",
  info: "bg-info-soft text-info ring-info/20",
};

export function Badge({
  tone = "neutral",
  dot,
  children,
  className,
}: {
  tone?: keyof typeof badgeTones;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        badgeTones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="mt-1 text-sm text-pretty text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted [&_svg]:size-6">{icon}</div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-pretty text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* Cores de avatar estáveis por nome (8 tons que funcionam nos dois temas) */
const AVATAR_TONES = [
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
];

function toneFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function Avatar({
  name,
  size = "md",
  src,
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** URL da foto de perfil; sem foto, mostra as iniciais. */
  src?: string | null;
  className?: string;
}) {
  const sizeClass = cn(
    size === "xl" && "size-24 text-2xl",
    size === "lg" && "size-10 text-sm",
    size === "md" && "size-8 text-xs",
    size === "sm" && "size-6 text-[10px]",
  );
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto vinda do Supabase Storage, já redimensionada no envio
      <img src={src} alt={name} title={name} loading="lazy" className={cn("shrink-0 rounded-full object-cover ring-1 ring-line", sizeClass, className)} />
    );
  }
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", toneFor(name), sizeClass, className)}
    >
      {initials(name) || "?"}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  icon,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "ok" | "danger" | "brand" | "info";
  icon?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {icon && (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg [&_svg]:size-4",
              tone === "ok" && "bg-ok-soft text-ok",
              tone === "danger" && "bg-danger-soft text-danger",
              tone === "info" && "bg-info-soft text-info",
              (tone === "brand" || !tone) && "bg-brand-soft text-brand",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="tabular -mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );
  const cls = "block rounded-xl border border-line bg-surface p-4 shadow-sm";
  return href ? (
    <Link href={href} className={cn(cls, "transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-md")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface-2 px-1 font-sans text-[11px] font-medium text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm [&_tbody_tr]:border-t [&_tbody_tr]:border-line [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-surface-2/60 [&_td]:px-4 [&_td]:py-2.5 [&_th]:bg-surface-2/50 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-muted">
        {children}
      </table>
    </div>
  );
}

export function Pagination({ page, total, perPage, href }: { page: number; total: number; perPage: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted">
      <span className="tabular">
        Página {page} de {pages} · {total.toLocaleString("pt-BR")} registros
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <LinkButton size="sm" href={href(page - 1)}>
            Anterior
          </LinkButton>
        )}
        {page < pages && (
          <LinkButton size="sm" href={href(page + 1)}>
            Próxima
          </LinkButton>
        )}
      </div>
    </div>
  );
}

/** Controle segmentado baseado em links (filtros por URL). */
export function Segmented({
  items,
  value,
  label,
}: {
  items: { value: string; label: ReactNode; href: string }[];
  value: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="inline-flex flex-wrap gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5">
      {items.map((i) => {
        const active = i.value === value;
        return (
          <Link
            key={i.value}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
              active ? "bg-surface font-medium text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
