"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Building2, User, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { inputClass, cn } from "@/components/ui";

type Option = { id: string; name: string; kind: "empresa" | "pessoa" };
type ContactOption = { id: string; name: string };

/**
 * Busca de empresa/pessoa com autocompletar (consulta direto no Supabase, protegido por RLS)
 * e, opcionalmente, seleção do contato vinculado.
 */
export function EntityPicker({
  orgId,
  defaultValue,
  defaultContactId,
  withContact = false,
  name = "entity_id",
}: {
  orgId: string;
  defaultValue?: { id: string; name: string; kind?: "empresa" | "pessoa" } | null;
  defaultContactId?: string | null;
  withContact?: boolean;
  name?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [selected, setSelected] = useState<Option | null>(
    defaultValue ? { id: defaultValue.id, name: defaultValue.name, kind: defaultValue.kind ?? "empresa" } : null,
  );
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [contactState, setContactState] = useState<{ entityId: string | null; list: ContactOption[] }>({ entityId: null, list: [] });
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selected || !open) return;
    const term = query.replace(/[%_,()*\\]/g, " ").trim();
    const t = setTimeout(async () => {
      let q = supabase.from("entities").select("id, name, kind").eq("org_id", orgId).order("name").limit(8);
      if (term) q = q.ilike("name", `%${term}%`);
      const { data } = await q;
      setOptions((data as Option[]) ?? []);
      setActive(0);
    }, 180);
    return () => clearTimeout(t);
  }, [query, open, selected, orgId, supabase]);

  useEffect(() => {
    if (!withContact || !selected) return;
    const entityId = selected.id;
    supabase
      .from("contacts")
      .select("id, name")
      .eq("entity_id", entityId)
      .order("name")
      .then(({ data }) => setContactState({ entityId, list: data ?? [] }));
  }, [selected, withContact, supabase]);
  const contacts = contactState.entityId === selected?.id ? contactState.list : [];

  function choose(o: Option) {
    setSelected(o);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      {selected ? (
        <div className={cn(inputClass, "flex h-9 items-center gap-2")}>
          {selected.kind === "pessoa" ? <User className="size-4 text-muted" /> : <Building2 className="size-4 text-muted" />}
          <span className="flex-1 truncate">{selected.name}</span>
          <button
            type="button"
            aria-label="Remover seleção"
            className="text-muted hover:text-fg"
            onClick={() => {
              setSelected(null);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            placeholder="Buscar empresa ou pessoa…"
            className={cn(inputClass, "h-9")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, options.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && open && options[active]) {
                e.preventDefault();
                choose(options[active]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
          />
          {open && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-lg"
            >
              {options.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted">Nenhum resultado.</li>
              ) : (
                options.map((o, i) => (
                  <li
                    key={o.id}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(o);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={cn("flex cursor-pointer items-center gap-2 px-3 py-2 text-sm", i === active && "bg-surface-2")}
                  >
                    {o.kind === "pessoa" ? <User className="size-4 text-muted" /> : <Building2 className="size-4 text-muted" />}
                    {o.name}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      {withContact && selected && contacts.length > 0 && (
        <select name="contact_id" defaultValue={defaultContactId ?? ""} className={cn(inputClass, "h-9")} aria-label="Contato">
          <option value="">Contato (opcional)</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
