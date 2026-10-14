-- =============================================================================
-- Lixeira (exclusão reversível) para contatos, oportunidades, propostas, produtos e tarefas.
-- Itens ficam recuperáveis por 60 dias e depois são excluídos automaticamente.
-- =============================================================================

-- 1) Colunas de exclusão
do $$
declare t text;
begin
  foreach t in array array['entities', 'deals', 'proposals', 'products', 'tasks'] loop
    execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
    execute format('alter table public.%I add column if not exists deleted_by uuid references auth.users(id) on delete set null', t);
    execute format('create index if not exists %1$s_trash_idx on public.%1$I (org_id, deleted_at) where deleted_at is not null', t);
    execute format('create index if not exists %1$s_deleted_by_idx on public.%1$I (deleted_by) where deleted_by is not null', t);

    -- Itens na lixeira ficam invisíveis para leitura e edição comuns (o acesso é só pelas funções abaixo)
    execute format('drop policy if exists %1$s_select on public.%1$I', t);
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.is_member(org_id) and deleted_at is null)', t);
    execute format('drop policy if exists %1$s_update on public.%1$I', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.is_member(org_id) and deleted_at is null) with check (public.is_member(org_id))', t);
  end loop;
end $$;

-- 2) Mover para a lixeira
create or replace function public.trash_move(p_table text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_now timestamptz := now();
  v_user uuid := (select auth.uid());
  v_title text;
  v_entity uuid;
begin
  if p_table not in ('entities', 'deals', 'proposals', 'products', 'tasks') then
    raise exception 'Tipo de registro inválido';
  end if;
  execute format('select org_id from public.%I where id = $1 and deleted_at is null', p_table) into v_org using p_id;
  if v_org is null or not public.is_member(v_org) then
    raise exception 'Registro não encontrado';
  end if;

  execute format('update public.%I set deleted_at = $1, deleted_by = $2 where id = $3', p_table) using v_now, v_user, p_id;

  if p_table = 'deals' then
    -- As propostas da oportunidade vão junto (e voltam junto)
    update public.proposals set deleted_at = v_now, deleted_by = v_user where deal_id = p_id and deleted_at is null;
    select title, entity_id into v_title, v_entity from public.deals where id = p_id;
    insert into public.timeline_events (org_id, entity_id, deal_id, actor_id, kind, payload)
    values (v_org, v_entity, p_id, v_user, 'movido_lixeira', jsonb_build_object('title', v_title, 'tipo', 'oportunidade'));
  elsif p_table = 'entities' then
    select name into v_title from public.entities where id = p_id;
    insert into public.timeline_events (org_id, entity_id, actor_id, kind, payload)
    values (v_org, p_id, v_user, 'movido_lixeira', jsonb_build_object('title', v_title, 'tipo', 'contato'));
  end if;
end;
$$;

-- 3) Recuperar da lixeira
create or replace function public.trash_restore(p_table text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_deleted timestamptz;
  v_user uuid := (select auth.uid());
  v_title text;
  v_entity uuid;
begin
  if p_table not in ('entities', 'deals', 'proposals', 'products', 'tasks') then
    raise exception 'Tipo de registro inválido';
  end if;
  execute format('select org_id, deleted_at from public.%I where id = $1', p_table) into v_org, v_deleted using p_id;
  if v_org is null or v_deleted is null or not public.is_member(v_org) then
    raise exception 'Item não encontrado na lixeira';
  end if;

  if p_table = 'proposals' and exists (
    select 1 from public.proposals p join public.deals d on d.id = p.deal_id
    where p.id = p_id and d.deleted_at is not null
  ) then
    raise exception 'A oportunidade desta proposta está na lixeira. Recupere a oportunidade primeiro.';
  end if;

  execute format('update public.%I set deleted_at = null, deleted_by = null where id = $1', p_table) using p_id;

  if p_table = 'deals' then
    update public.proposals set deleted_at = null, deleted_by = null where deal_id = p_id and deleted_at = v_deleted;
    select title, entity_id into v_title, v_entity from public.deals where id = p_id;
    insert into public.timeline_events (org_id, entity_id, deal_id, actor_id, kind, payload)
    values (v_org, v_entity, p_id, v_user, 'restaurado', jsonb_build_object('title', v_title, 'tipo', 'oportunidade'));
  elsif p_table = 'entities' then
    select name into v_title from public.entities where id = p_id;
    insert into public.timeline_events (org_id, entity_id, actor_id, kind, payload)
    values (v_org, p_id, v_user, 'restaurado', jsonb_build_object('title', v_title, 'tipo', 'contato'));
  end if;
end;
$$;

-- 4) Excluir definitivamente (somente administradores)
create or replace function public.trash_purge(p_table text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_deleted timestamptz;
begin
  if p_table not in ('entities', 'deals', 'proposals', 'products', 'tasks') then
    raise exception 'Tipo de registro inválido';
  end if;
  execute format('select org_id, deleted_at from public.%I where id = $1', p_table) into v_org, v_deleted using p_id;
  if v_org is null or v_deleted is null then
    raise exception 'Item não encontrado na lixeira';
  end if;
  if not public.is_admin(v_org) then
    raise exception 'Apenas administradores podem excluir definitivamente';
  end if;
  execute format('delete from public.%I where id = $1', p_table) using p_id;
end;
$$;

-- 5) Esvaziar a lixeira da base (somente administradores)
create or replace function public.trash_empty(p_org uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int := 0;
  v_n int;
  t text;
begin
  if not public.is_admin(p_org) then
    raise exception 'Apenas administradores podem esvaziar a lixeira';
  end if;
  -- Ordem respeita as dependências (propostas antes das oportunidades)
  foreach t in array array['proposals', 'tasks', 'deals', 'products', 'entities'] loop
    execute format('delete from public.%I where org_id = $1 and deleted_at is not null', t) using p_org;
    get diagnostics v_n = row_count;
    v_count := v_count + v_n;
  end loop;
  return v_count;
end;
$$;

-- 6) Listar a lixeira da base
create or replace function public.trash_list(p_org uuid)
returns table (
  item_type text,
  id uuid,
  title text,
  subtitle text,
  deleted_at timestamptz,
  deleted_by uuid,
  extra int
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_member(p_org) then
    raise exception 'Acesso negado';
  end if;
  return query
    select 'entities'::text, e.id, e.name,
           case e.kind when 'pessoa' then 'Pessoa física' else 'Empresa' end
             || coalesce(' · ' || e.city || '/' || e.state, ''),
           e.deleted_at, e.deleted_by, 0
      from public.entities e
     where e.org_id = p_org and e.deleted_at is not null
    union all
    select 'deals', d.id, d.title,
           coalesce((select en.name from public.entities en where en.id = d.entity_id), 'Sem cliente')
             || ' · R$ ' || to_char(d.value, 'FM999G999G990D00'),
           d.deleted_at, d.deleted_by,
           (select count(*)::int from public.proposals p where p.deal_id = d.id and p.deleted_at = d.deleted_at)
      from public.deals d
     where d.org_id = p_org and d.deleted_at is not null
    union all
    select 'proposals', p.id, 'Nº ' || p.number || ' · ' || p.title,
           coalesce((select dd.title from public.deals dd where dd.id = p.deal_id), '') || ' · R$ ' || to_char(p.total, 'FM999G999G990D00'),
           p.deleted_at, p.deleted_by, 0
      from public.proposals p
     where p.org_id = p_org and p.deleted_at is not null
       -- propostas que foram junto com a oportunidade aparecem dentro dela
       and not exists (select 1 from public.deals d2 where d2.id = p.deal_id and d2.deleted_at = p.deleted_at)
    union all
    select 'products', pr.id, pr.name,
           coalesce(pr.code || ' · ', '') || 'R$ ' || to_char(pr.price, 'FM999G999G990D00'),
           pr.deleted_at, pr.deleted_by, 0
      from public.products pr
     where pr.org_id = p_org and pr.deleted_at is not null
    union all
    select 'tasks', t.id, t.title,
           case when t.done then 'Concluída' else 'Em aberto' end
             || coalesce(' · prazo ' || to_char(t.due_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), ''),
           t.deleted_at, t.deleted_by, 0
      from public.tasks t
     where t.org_id = p_org and t.deleted_at is not null
    order by 5 desc;
end;
$$;

-- 7) Limpeza automática: remove itens com mais de 60 dias na lixeira
create or replace function public.trash_purge_expired()
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int := 0;
  v_n int;
  t text;
begin
  foreach t in array array['proposals', 'tasks', 'deals', 'products', 'entities'] loop
    execute format('delete from public.%I where deleted_at < now() - interval ''60 days''', t);
    get diagnostics v_n = row_count;
    v_count := v_count + v_n;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.trash_move(text, uuid) from public, anon;
revoke execute on function public.trash_restore(text, uuid) from public, anon;
revoke execute on function public.trash_purge(text, uuid) from public, anon;
revoke execute on function public.trash_empty(uuid) from public, anon;
revoke execute on function public.trash_list(uuid) from public, anon;
revoke execute on function public.trash_purge_expired() from public, anon, authenticated;
grant execute on function public.trash_move(text, uuid) to authenticated;
grant execute on function public.trash_restore(text, uuid) to authenticated;
grant execute on function public.trash_purge(text, uuid) to authenticated;
grant execute on function public.trash_empty(uuid) to authenticated;
grant execute on function public.trash_list(uuid) to authenticated;

-- Agenda diária (03:15 UTC) para a limpeza automática
create extension if not exists pg_cron;
select cron.schedule('favo-lixeira-limpeza', '15 3 * * *', $cron$select public.trash_purge_expired()$cron$);
