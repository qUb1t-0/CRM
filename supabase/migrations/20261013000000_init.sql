-- =============================================================================
-- Favo CRM — schema inicial
-- Multi-tenant por organização ("base"), com RLS em todas as tabelas.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Organizações, perfis e membros
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create type public.member_role as enum ('admin', 'membro');

create table public.memberships (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'membro',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.member_role not null default 'membro',
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);
create index invites_email_idx on public.invites(lower(email));

-- Funções auxiliares de autorização (security definer evita recursão de RLS)
create or replace function public.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = 'admin'
  );
$$;

create or replace function public.shares_org(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships a
    join public.memberships b on a.org_id = b.org_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;

-- Perfil criado automaticamente no cadastro
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Configuração: pipelines, etapas, motivos de perda, campos personalizados
-- -----------------------------------------------------------------------------
create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index pipelines_org_idx on public.pipelines(org_id);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  name text not null,
  position int not null default 0,
  probability int not null default 0 check (probability between 0 and 100),
  created_at timestamptz not null default now()
);
create index stages_pipeline_idx on public.stages(pipeline_id, position);
create index stages_org_idx on public.stages(org_id);

create table public.loss_reasons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index loss_reasons_org_idx on public.loss_reasons(org_id);

create type public.custom_field_entity as enum ('entidade', 'oportunidade');
create type public.custom_field_type as enum ('texto', 'numero', 'data', 'lista');

create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity public.custom_field_entity not null,
  key text not null check (key ~ '^[a-z0-9_]{1,40}$'),
  label text not null,
  type public.custom_field_type not null default 'texto',
  options text[] not null default '{}',
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (org_id, entity, key)
);

-- -----------------------------------------------------------------------------
-- Cadastros: entidades (empresas/pessoas), contatos, produtos
-- -----------------------------------------------------------------------------
create type public.entity_kind as enum ('empresa', 'pessoa');

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind public.entity_kind not null default 'empresa',
  name text not null check (char_length(name) between 1 and 200),
  document text,
  email text,
  phone text,
  website text,
  city text,
  state text,
  segment text,
  notes text,
  custom jsonb not null default '{}',
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index entities_org_idx on public.entities(org_id, created_at desc);
create index entities_owner_idx on public.entities(owner_id);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  name text not null,
  job_title text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);
create index contacts_entity_idx on public.contacts(entity_id);
create index contacts_org_idx on public.contacts(org_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  price numeric(14,2) not null default 0 check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index products_org_idx on public.products(org_id);

-- -----------------------------------------------------------------------------
-- Vendas: oportunidades, itens, propostas, metas
-- -----------------------------------------------------------------------------
create type public.deal_status as enum ('aberta', 'ganha', 'perdida');

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete restrict,
  stage_id uuid not null references public.stages(id) on delete restrict,
  entity_id uuid references public.entities(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  value numeric(14,2) not null default 0 check (value >= 0),
  status public.deal_status not null default 'aberta',
  expected_close date,
  closed_at timestamptz,
  loss_reason_id uuid references public.loss_reasons(id) on delete set null,
  loss_note text,
  source text,
  custom jsonb not null default '{}',
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deals_org_idx on public.deals(org_id, status);
create index deals_stage_idx on public.deals(stage_id);
create index deals_pipeline_idx on public.deals(pipeline_id);
create index deals_entity_idx on public.deals(entity_id);
create index deals_owner_idx on public.deals(owner_id);
create index deals_contact_idx on public.deals(contact_id);
create index deals_loss_reason_idx on public.deals(loss_reason_id);

create table public.deal_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  created_at timestamptz not null default now()
);
create index deal_items_deal_idx on public.deal_items(deal_id);
create index deal_items_org_idx on public.deal_items(org_id);
create index deal_items_product_idx on public.deal_items(product_id);

create type public.proposal_status as enum ('rascunho', 'enviada', 'aceita', 'recusada');

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  number int not null,
  title text not null,
  status public.proposal_status not null default 'rascunho',
  valid_until date,
  notes text,
  items jsonb not null default '[]',
  total numeric(14,2) not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, number)
);
create index proposals_deal_idx on public.proposals(deal_id);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, -- null = meta da equipe
  month date not null check (extract(day from month) = 1),
  target numeric(14,2) not null check (target >= 0),
  created_at timestamptz not null default now()
);
create unique index goals_unique_idx on public.goals(org_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), month);
create index goals_user_idx on public.goals(user_id);

-- -----------------------------------------------------------------------------
-- Atividades: tarefas, compromissos, timeline
-- -----------------------------------------------------------------------------
create type public.task_priority as enum ('baixa', 'media', 'alta');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  due_at timestamptz,
  priority public.task_priority not null default 'media',
  done boolean not null default false,
  done_at timestamptz,
  assignee_id uuid references auth.users(id) on delete set null,
  entity_id uuid references public.entities(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index tasks_org_idx on public.tasks(org_id, done, due_at);
create index tasks_assignee_idx on public.tasks(assignee_id);
create index tasks_entity_idx on public.tasks(entity_id);
create index tasks_deal_idx on public.tasks(deal_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  owner_id uuid references auth.users(id) on delete set null,
  entity_id uuid references public.entities(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);
create index appointments_org_idx on public.appointments(org_id, starts_at);
create index appointments_owner_idx on public.appointments(owner_id);
create index appointments_entity_idx on public.appointments(entity_id);
create index appointments_deal_idx on public.appointments(deal_id);

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.entities(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index timeline_org_idx on public.timeline_events(org_id, created_at desc);
create index timeline_entity_idx on public.timeline_events(entity_id, created_at desc);
create index timeline_deal_idx on public.timeline_events(deal_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Triggers: updated_at, valor da oportunidade e timeline (auditoria)
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger entities_touch before update on public.entities
  for each row execute function public.touch_updated_at();
create trigger deals_touch before update on public.deals
  for each row execute function public.touch_updated_at();

-- Garante que a etapa pertence ao pipeline e à mesma organização
create or replace function public.deals_check_stage()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.stages s
    where s.id = new.stage_id and s.pipeline_id = new.pipeline_id and s.org_id = new.org_id
  ) then
    raise exception 'Etapa inválida para este funil';
  end if;
  if new.status <> 'aberta' and (tg_op = 'INSERT' or old.status = 'aberta') then
    new.closed_at := coalesce(new.closed_at, now());
  elsif new.status = 'aberta' then
    new.closed_at := null;
    new.loss_reason_id := null;
  end if;
  return new;
end;
$$;

create trigger deals_check_stage before insert or update on public.deals
  for each row execute function public.deals_check_stage();

-- Recalcula o valor da oportunidade a partir dos itens
create or replace function public.deal_items_recalc()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_deal uuid := coalesce(new.deal_id, old.deal_id);
begin
  update public.deals d
     set value = coalesce((
       select sum(round(i.quantity * i.unit_price * (1 - i.discount_pct / 100), 2))
         from public.deal_items i where i.deal_id = v_deal
     ), 0)
   where d.id = v_deal;
  return null;
end;
$$;

create trigger deal_items_recalc after insert or update or delete on public.deal_items
  for each row execute function public.deal_items_recalc();

-- Eventos de timeline
create or replace function public.log_deal_events()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.timeline_events (org_id, entity_id, deal_id, actor_id, kind, payload)
    values (new.org_id, new.entity_id, new.id, v_actor, 'oportunidade_criada',
            jsonb_build_object('title', new.title, 'value', new.value));
    return new;
  end if;

  if new.stage_id is distinct from old.stage_id then
    insert into public.timeline_events (org_id, entity_id, deal_id, actor_id, kind, payload)
    values (new.org_id, new.entity_id, new.id, v_actor, 'etapa_alterada',
            jsonb_build_object(
              'title', new.title,
              'from', (select name from public.stages where id = old.stage_id),
              'to', (select name from public.stages where id = new.stage_id)));
  end if;

  if new.status is distinct from old.status then
    insert into public.timeline_events (org_id, entity_id, deal_id, actor_id, kind, payload)
    values (new.org_id, new.entity_id, new.id, v_actor,
            case new.status when 'ganha' then 'oportunidade_ganha'
                            when 'perdida' then 'oportunidade_perdida'
                            else 'oportunidade_reaberta' end,
            jsonb_build_object(
              'title', new.title, 'value', new.value,
              'reason', (select name from public.loss_reasons where id = new.loss_reason_id)));
  end if;

  if new.owner_id is distinct from old.owner_id then
    insert into public.timeline_events (org_id, entity_id, deal_id, actor_id, kind, payload)
    values (new.org_id, new.entity_id, new.id, v_actor, 'responsavel_alterado',
            jsonb_build_object('title', new.title,
              'to', (select coalesce(full_name, email) from public.profiles where id = new.owner_id)));
  end if;
  return new;
end;
$$;

create trigger deals_timeline after insert or update on public.deals
  for each row execute function public.log_deal_events();

create or replace function public.log_entity_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.timeline_events (org_id, entity_id, actor_id, kind, payload)
  values (new.org_id, new.id, (select auth.uid()), 'entidade_criada',
          jsonb_build_object('name', new.name, 'kind', new.kind));
  return new;
end;
$$;

create trigger entities_timeline after insert on public.entities
  for each row execute function public.log_entity_created();

create or replace function public.log_task_events()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.done and not coalesce(old.done, false) then
    new.done_at := now();
  elsif not new.done then
    new.done_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_done_at before insert or update on public.tasks
  for each row execute function public.log_task_events();

create or replace function public.log_task_timeline()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.done) or (tg_op = 'UPDATE' and new.done and not old.done) then
    insert into public.timeline_events (org_id, entity_id, deal_id, actor_id, kind, payload)
    values (new.org_id, new.entity_id, new.deal_id, (select auth.uid()), 'tarefa_concluida',
            jsonb_build_object('title', new.title));
  elsif tg_op = 'INSERT' and (new.entity_id is not null or new.deal_id is not null) then
    insert into public.timeline_events (org_id, entity_id, deal_id, actor_id, kind, payload)
    values (new.org_id, new.entity_id, new.deal_id, (select auth.uid()), 'tarefa_criada',
            jsonb_build_object('title', new.title, 'due_at', new.due_at));
  end if;
  return null;
end;
$$;

create trigger tasks_timeline after insert or update on public.tasks
  for each row execute function public.log_task_timeline();

create or replace function public.log_proposal_events()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_entity uuid;
begin
  select entity_id into v_entity from public.deals where id = new.deal_id;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.timeline_events (org_id, entity_id, deal_id, actor_id, kind, payload)
    values (new.org_id, v_entity, new.deal_id, (select auth.uid()), 'proposta_' || new.status::text,
            jsonb_build_object('number', new.number, 'title', new.title, 'total', new.total));
  end if;
  return null;
end;
$$;

create trigger proposals_timeline after insert or update on public.proposals
  for each row execute function public.log_proposal_events();

-- Numeração sequencial de propostas por organização
create or replace function public.proposals_number()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.org_id::text));
  select coalesce(max(number), 0) + 1 into new.number from public.proposals where org_id = new.org_id;
  return new;
end;
$$;

create trigger proposals_number before insert on public.proposals
  for each row execute function public.proposals_number();

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------

-- Cria uma organização com o usuário atual como admin e dados padrão
create or replace function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_pipe uuid;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;

  insert into public.organizations (name, created_by) values (trim(p_name), v_user) returning id into v_org;
  insert into public.memberships (org_id, user_id, role) values (v_org, v_user, 'admin');

  insert into public.pipelines (org_id, name, position) values (v_org, 'Funil de vendas', 0) returning id into v_pipe;
  insert into public.stages (org_id, pipeline_id, name, position, probability) values
    (v_org, v_pipe, 'Prospecção', 0, 10),
    (v_org, v_pipe, 'Qualificação', 1, 25),
    (v_org, v_pipe, 'Apresentação', 2, 50),
    (v_org, v_pipe, 'Proposta', 3, 70),
    (v_org, v_pipe, 'Negociação', 4, 90);

  insert into public.loss_reasons (org_id, name) values
    (v_org, 'Preço'), (v_org, 'Escolheu concorrente'), (v_org, 'Sem orçamento'),
    (v_org, 'Sem resposta'), (v_org, 'Timing inadequado');

  return v_org;
end;
$$;

-- Aceita convites pendentes para o e-mail do usuário atual
create or replace function public.accept_pending_invites()
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower((select email from auth.users where id = v_user));
  v_count int := 0;
  r record;
begin
  if v_user is null then
    return 0;
  end if;
  for r in
    select * from public.invites where lower(email) = v_email and accepted_at is null
  loop
    insert into public.memberships (org_id, user_id, role)
    values (r.org_id, v_user, r.role)
    on conflict do nothing;
    update public.invites set accepted_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Indicadores do painel inicial (uma ida ao banco)
create or replace function public.dashboard_stats(p_org uuid, p_user uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_month date := date_trunc('month', now())::date;
  v_result jsonb;
begin
  if not public.is_member(p_org) then
    raise exception 'Acesso negado';
  end if;

  select jsonb_build_object(
    'open_count', count(*) filter (where status = 'aberta'),
    'open_value', coalesce(sum(value) filter (where status = 'aberta'), 0),
    'weighted_value', coalesce(sum(d.value * s.probability / 100.0) filter (where status = 'aberta'), 0),
    'won_month_count', count(*) filter (where status = 'ganha' and closed_at >= v_month),
    'won_month_value', coalesce(sum(value) filter (where status = 'ganha' and closed_at >= v_month), 0),
    'lost_month_count', count(*) filter (where status = 'perdida' and closed_at >= v_month)
  ) into v_result
  from public.deals d
  join public.stages s on s.id = d.stage_id
  where d.org_id = p_org and (p_user is null or d.owner_id = p_user);

  v_result := v_result || jsonb_build_object(
    'tasks_overdue', (select count(*) from public.tasks t
                       where t.org_id = p_org and not t.done and t.due_at < now()
                         and (p_user is null or t.assignee_id = p_user)),
    'tasks_today', (select count(*) from public.tasks t
                     where t.org_id = p_org and not t.done
                       and t.due_at >= date_trunc('day', now()) and t.due_at < date_trunc('day', now()) + interval '1 day'
                       and (p_user is null or t.assignee_id = p_user))
  );
  return v_result;
end;
$$;

-- Dados agregados para relatórios e metas
create or replace function public.deals_report(p_org uuid, p_since timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if not public.is_member(p_org) then
    raise exception 'Acesso negado';
  end if;

  return jsonb_build_object(
    'by_month', (
      select coalesce(jsonb_agg(x order by x.month), '[]'::jsonb) from (
        select (date_trunc('month', d.closed_at at time zone 'America/Sao_Paulo'))::date as month,
               count(*) filter (where d.status = 'ganha') as won_count,
               coalesce(sum(d.value) filter (where d.status = 'ganha'), 0) as won_value,
               count(*) filter (where d.status = 'perdida') as lost_count
          from public.deals d
         where d.org_id = p_org and d.status <> 'aberta' and d.closed_at >= p_since
         group by 1
      ) x),
    'by_stage', (
      select coalesce(jsonb_agg(x order by x.pipeline_position, x.pipeline, x.position), '[]'::jsonb) from (
        select s.id, s.name, s.position, s.probability,
               p.id as pipeline_id, p.name as pipeline, p.position as pipeline_position,
               count(d.id) as count, coalesce(sum(d.value), 0) as value
          from public.stages s
          join public.pipelines p on p.id = s.pipeline_id
          left join public.deals d on d.stage_id = s.id and d.status = 'aberta'
         where s.org_id = p_org
         group by s.id, p.id
      ) x),
    'by_owner', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select d.owner_id,
               count(*) filter (where d.status = 'ganha' and d.closed_at >= p_since) as won_count,
               coalesce(sum(d.value) filter (where d.status = 'ganha' and d.closed_at >= p_since), 0) as won_value,
               count(*) filter (where d.status = 'perdida' and d.closed_at >= p_since) as lost_count,
               count(*) filter (where d.status = 'aberta') as open_count,
               coalesce(sum(d.value) filter (where d.status = 'aberta'), 0) as open_value
          from public.deals d
         where d.org_id = p_org
         group by d.owner_id
      ) x),
    'by_loss_reason', (
      select coalesce(jsonb_agg(x order by x.count desc), '[]'::jsonb) from (
        select coalesce(r.name, 'Sem motivo') as name, count(*) as count
          from public.deals d
          left join public.loss_reasons r on r.id = d.loss_reason_id
         where d.org_id = p_org and d.status = 'perdida' and d.closed_at >= p_since
         group by 1
      ) x),
    'by_source', (
      select coalesce(jsonb_agg(x order by x.count desc), '[]'::jsonb) from (
        select coalesce(nullif(d.source, ''), 'Não informada') as name, count(*) as count,
               count(*) filter (where d.status = 'ganha') as won
          from public.deals d
         where d.org_id = p_org and d.created_at >= p_since
         group by 1
      ) x)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;
alter table public.pipelines enable row level security;
alter table public.stages enable row level security;
alter table public.loss_reasons enable row level security;
alter table public.custom_fields enable row level security;
alter table public.entities enable row level security;
alter table public.contacts enable row level security;
alter table public.products enable row level security;
alter table public.deals enable row level security;
alter table public.deal_items enable row level security;
alter table public.proposals enable row level security;
alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.appointments enable row level security;
alter table public.timeline_events enable row level security;

-- Organizações
create policy org_select on public.organizations for select to authenticated
  using (public.is_member(id));
create policy org_update on public.organizations for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

-- Perfis: o próprio e colegas de organização
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_org(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Membros
create policy memberships_select on public.memberships for select to authenticated
  using (public.is_member(org_id));
create policy memberships_update on public.memberships for update to authenticated
  using (public.is_admin(org_id) and user_id <> (select auth.uid()))
  with check (public.is_admin(org_id));
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.is_admin(org_id) and user_id <> (select auth.uid()));

-- Convites (apenas admins)
create policy invites_select on public.invites for select to authenticated
  using (public.is_admin(org_id));
create policy invites_insert on public.invites for insert to authenticated
  with check (public.is_admin(org_id));
create policy invites_update on public.invites for update to authenticated
  using (public.is_admin(org_id)) with check (public.is_admin(org_id));
create policy invites_delete on public.invites for delete to authenticated
  using (public.is_admin(org_id));

-- Tabelas de configuração: leitura por membros, escrita por admins
do $$
declare t text;
begin
  foreach t in array array['pipelines', 'stages', 'loss_reasons', 'custom_fields'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_member(org_id))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_admin(org_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_admin(org_id)) with check (public.is_admin(org_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_admin(org_id))', t);
  end loop;
end $$;

-- Tabelas operacionais: todos os membros leem e escrevem
do $$
declare t text;
begin
  foreach t in array array['entities', 'contacts', 'products', 'deals', 'deal_items', 'proposals', 'tasks', 'appointments'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_member(org_id))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_member(org_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_member(org_id))', t);
  end loop;
end $$;

-- Metas: leitura por membros, escrita por admins
create policy goals_select on public.goals for select to authenticated using (public.is_member(org_id));
create policy goals_insert on public.goals for insert to authenticated with check (public.is_admin(org_id));
create policy goals_update on public.goals for update to authenticated using (public.is_admin(org_id)) with check (public.is_admin(org_id));
create policy goals_delete on public.goals for delete to authenticated using (public.is_admin(org_id));

-- Timeline: leitura por membros; inserção manual apenas de anotações; sem edição
create policy timeline_select on public.timeline_events for select to authenticated
  using (public.is_member(org_id));
create policy timeline_insert_note on public.timeline_events for insert to authenticated
  with check (public.is_member(org_id) and kind = 'nota' and actor_id = (select auth.uid()));
create policy timeline_delete_note on public.timeline_events for delete to authenticated
  using (public.is_member(org_id) and kind = 'nota' and actor_id = (select auth.uid()));

-- Funções: somente usuários autenticados executam as RPCs
revoke execute on function public.create_organization(text) from public, anon;
revoke execute on function public.accept_pending_invites() from public, anon;
revoke execute on function public.dashboard_stats(uuid, uuid) from public, anon;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.accept_pending_invites() to authenticated;
grant execute on function public.dashboard_stats(uuid, uuid) to authenticated;
revoke execute on function public.deals_report(uuid, timestamptz) from public, anon;
grant execute on function public.deals_report(uuid, timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime (equivalente ao NotificationService: atualização ao vivo do funil)
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.deals;
alter publication supabase_realtime add table public.tasks;
