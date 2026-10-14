-- Filtros de contatos: telefone só com dígitos (busca ignora a máscara) e índices auxiliares.
alter table public.entities
  add column if not exists phone_digits text generated always as (regexp_replace(coalesce(phone, ''), '\D', '', 'g')) stored;

create index if not exists entities_state_idx on public.entities (org_id, state);
create index if not exists entities_segment_idx on public.entities (org_id, segment);
create index if not exists entities_created_by_org_idx on public.entities (org_id, created_by);
