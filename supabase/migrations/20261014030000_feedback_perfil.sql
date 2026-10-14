-- =============================================================================
-- Feedbacks do cliente: registro automático de alterações, eventos de contatos e
-- compromissos, e notificações de menções (@usuário) nas anotações.
-- =============================================================================

-- 1) Alterações no cadastro do cliente (quem, quando e o que mudou)
create or replace function public.log_entity_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_changes jsonb := '[]'::jsonb;
  v_owner_from text;
  v_owner_to text;
  k text;
begin
  -- Movimentos da lixeira têm eventos próprios
  if new.deleted_at is distinct from old.deleted_at then
    return null;
  end if;

  if new.name is distinct from old.name then
    v_changes := v_changes || jsonb_build_object('label', 'Nome', 'from', old.name, 'to', new.name);
  end if;
  if new.kind is distinct from old.kind then
    v_changes := v_changes || jsonb_build_object('label', 'Tipo',
      'from', case old.kind when 'pessoa' then 'Pessoa física' else 'Empresa' end,
      'to', case new.kind when 'pessoa' then 'Pessoa física' else 'Empresa' end);
  end if;
  if new.document is distinct from old.document then
    v_changes := v_changes || jsonb_build_object('label', 'CPF/CNPJ', 'from', old.document, 'to', new.document);
  end if;
  if new.email is distinct from old.email then
    v_changes := v_changes || jsonb_build_object('label', 'E-mail', 'from', old.email, 'to', new.email);
  end if;
  if new.phone is distinct from old.phone then
    v_changes := v_changes || jsonb_build_object('label', 'Telefone', 'from', old.phone, 'to', new.phone);
  end if;
  if new.website is distinct from old.website then
    v_changes := v_changes || jsonb_build_object('label', 'Site', 'from', old.website, 'to', new.website);
  end if;
  if new.state is distinct from old.state then
    v_changes := v_changes || jsonb_build_object('label', 'UF', 'from', old.state, 'to', new.state);
  end if;
  if new.city is distinct from old.city then
    v_changes := v_changes || jsonb_build_object('label', 'Cidade', 'from', old.city, 'to', new.city);
  end if;
  if new.segment is distinct from old.segment then
    v_changes := v_changes || jsonb_build_object('label', 'Segmento', 'from', old.segment, 'to', new.segment);
  end if;
  if new.notes is distinct from old.notes then
    v_changes := v_changes || jsonb_build_object('label', 'Observações', 'from', left(old.notes, 200), 'to', left(new.notes, 200));
  end if;
  if new.owner_id is distinct from old.owner_id then
    select coalesce(full_name, email) into v_owner_from from public.profiles where id = old.owner_id;
    select coalesce(full_name, email) into v_owner_to from public.profiles where id = new.owner_id;
    v_changes := v_changes || jsonb_build_object('label', 'Responsável', 'from', v_owner_from, 'to', v_owner_to);
  end if;
  if new.custom is distinct from old.custom then
    for k in select distinct key from (
      select jsonb_object_keys(coalesce(old.custom, '{}'::jsonb)) as key
      union select jsonb_object_keys(coalesce(new.custom, '{}'::jsonb))
    ) s loop
      if (old.custom -> k) is distinct from (new.custom -> k) then
        v_changes := v_changes || jsonb_build_object(
          'label', coalesce((select label from public.custom_fields
                             where org_id = new.org_id and entity = 'entidade' and key = k), k),
          'from', old.custom ->> k, 'to', new.custom ->> k);
      end if;
    end loop;
  end if;

  if jsonb_array_length(v_changes) > 0 then
    insert into public.timeline_events (org_id, entity_id, actor_id, kind, payload)
    values (new.org_id, new.id, (select auth.uid()), 'entidade_alterada',
            jsonb_build_object('name', new.name, 'changes', v_changes));
  end if;
  return null;
end;
$$;

drop trigger if exists entities_changes on public.entities;
create trigger entities_changes after update on public.entities
  for each row execute function public.log_entity_changes();

-- 2) Pessoas de contato: adicionada, alterada, removida
create or replace function public.log_contact_events()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.timeline_events (org_id, entity_id, actor_id, kind, payload)
    values (new.org_id, new.entity_id, (select auth.uid()), 'contato_adicionado',
            jsonb_build_object('name', new.name, 'job_title', new.job_title));
  elsif tg_op = 'UPDATE' then
    if (new.name, new.job_title, new.email, new.phone) is distinct from (old.name, old.job_title, old.email, old.phone) then
      insert into public.timeline_events (org_id, entity_id, actor_id, kind, payload)
      values (new.org_id, new.entity_id, (select auth.uid()), 'contato_alterado', jsonb_build_object('name', new.name));
    end if;
  elsif tg_op = 'DELETE' then
    -- Na exclusão definitiva do cliente os contatos caem em cascata: não registra
    if exists (select 1 from public.entities where id = old.entity_id) then
      insert into public.timeline_events (org_id, entity_id, actor_id, kind, payload)
      values (old.org_id, old.entity_id, (select auth.uid()), 'contato_removido', jsonb_build_object('name', old.name));
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists contacts_timeline on public.contacts;
create trigger contacts_timeline after insert or update or delete on public.contacts
  for each row execute function public.log_contact_events();

-- 3) Compromissos agendados para o cliente
create or replace function public.log_appointment_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.entity_id is not null then
    insert into public.timeline_events (org_id, entity_id, deal_id, actor_id, kind, payload)
    values (new.org_id, new.entity_id, new.deal_id, (select auth.uid()), 'compromisso_criado',
            jsonb_build_object('title', new.title, 'starts_at', new.starts_at));
  end if;
  return null;
end;
$$;

drop trigger if exists appointments_timeline on public.appointments;
create trigger appointments_timeline after insert on public.appointments
  for each row execute function public.log_appointment_created();

-- 4) Notificações (menções com @)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null,
  entity_id uuid references public.entities(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  event_id uuid references public.timeline_events(id) on delete cascade,
  text text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read_at, created_at desc);
create index if not exists notifications_org_idx on public.notifications (org_id);
create index if not exists notifications_actor_idx on public.notifications (actor_id);
create index if not exists notifications_entity_idx on public.notifications (entity_id);
create index if not exists notifications_deal_idx on public.notifications (deal_id);
create index if not exists notifications_event_idx on public.notifications (event_id);

alter table public.notifications enable row level security;
drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_delete on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- Cria uma notificação para cada usuário mencionado numa anotação (somente membros da base)
create or replace function public.notify_mentions()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  if new.kind <> 'nota' or jsonb_typeof(new.payload -> 'mentions') is distinct from 'array' then
    return null;
  end if;
  for v_user in
    select distinct m::uuid
      from jsonb_array_elements_text(new.payload -> 'mentions') m
     where m ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}  loop
    if v_user <> new.actor_id and exists (
      select 1 from public.memberships where org_id = new.org_id and user_id = v_user
    ) then
      insert into public.notifications (org_id, user_id, actor_id, kind, entity_id, deal_id, event_id, text)
      values (new.org_id, v_user, new.actor_id, 'mencao', new.entity_id, new.deal_id, new.id, left(new.payload ->> 'text', 280));
    end if;
  end loop;
  return null;
end;
$$;

drop trigger if exists timeline_mentions on public.timeline_events;
create trigger timeline_mentions after insert on public.timeline_events
  for each row execute function public.notify_mentions();

revoke execute on function public.log_entity_changes() from public, anon, authenticated;
revoke execute on function public.log_contact_events() from public, anon, authenticated;
revoke execute on function public.log_appointment_created() from public, anon, authenticated;
revoke execute on function public.notify_mentions() from public, anon, authenticated;
 -- ignora ids inválidos
  loop
    if v_user <> new.actor_id and exists (
      select 1 from public.memberships where org_id = new.org_id and user_id = v_user
    ) then
      insert into public.notifications (org_id, user_id, actor_id, kind, entity_id, deal_id, event_id, text)
      values (new.org_id, v_user, new.actor_id, 'mencao', new.entity_id, new.deal_id, new.id, left(new.payload ->> 'text', 280));
    end if;
  end loop;
  return null;
end;
$$;

drop trigger if exists timeline_mentions on public.timeline_events;
create trigger timeline_mentions after insert on public.timeline_events
  for each row execute function public.notify_mentions();

revoke execute on function public.log_entity_changes() from public, anon, authenticated;
revoke execute on function public.log_contact_events() from public, anon, authenticated;
revoke execute on function public.log_appointment_created() from public, anon, authenticated;
revoke execute on function public.notify_mentions() from public, anon, authenticated;

-- Tempo real: sininho de notificações e feed do cliente
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.timeline_events;
