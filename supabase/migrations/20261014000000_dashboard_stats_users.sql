-- Indicadores do painel para um conjunto de usuários (filtro por responsável do administrador).
-- p_users null = equipe toda. Não altera a função dashboard_stats existente.
create or replace function public.dashboard_stats_users(p_org uuid, p_users uuid[] default null)
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
  where d.org_id = p_org and (p_users is null or d.owner_id = any(p_users));

  v_result := v_result || jsonb_build_object(
    'tasks_overdue', (select count(*) from public.tasks t
                       where t.org_id = p_org and not t.done and t.due_at < now()
                         and (p_users is null or t.assignee_id = any(p_users))),
    'tasks_today', (select count(*) from public.tasks t
                     where t.org_id = p_org and not t.done
                       and t.due_at >= date_trunc('day', now()) and t.due_at < date_trunc('day', now()) + interval '1 day'
                       and (p_users is null or t.assignee_id = any(p_users)))
  );
  return v_result;
end;
$$;

revoke execute on function public.dashboard_stats_users(uuid, uuid[]) from public, anon;
grant execute on function public.dashboard_stats_users(uuid, uuid[]) to authenticated;
