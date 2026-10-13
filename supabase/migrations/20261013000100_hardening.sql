-- Endurecimento apontado pelos advisors do Supabase

-- Funções de trigger não devem ser chamáveis via /rest/v1/rpc
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.deal_items_recalc() from public, anon, authenticated;
revoke execute on function public.log_deal_events() from public, anon, authenticated;
revoke execute on function public.log_entity_created() from public, anon, authenticated;
revoke execute on function public.log_task_events() from public, anon, authenticated;
revoke execute on function public.log_task_timeline() from public, anon, authenticated;
revoke execute on function public.log_proposal_events() from public, anon, authenticated;
revoke execute on function public.proposals_number() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.deals_check_stage() from public, anon, authenticated;

-- Helpers de RLS: usados pelas políticas de usuários autenticados; anônimos não precisam
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.is_admin(uuid) from public, anon;
revoke execute on function public.shares_org(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.shares_org(uuid) to authenticated;

-- Índices para chaves estrangeiras de auditoria
create index if not exists appointments_created_by_idx on public.appointments(created_by);
create index if not exists deals_created_by_idx on public.deals(created_by);
create index if not exists entities_created_by_idx on public.entities(created_by);
create index if not exists invites_invited_by_idx on public.invites(invited_by);
create index if not exists organizations_created_by_idx on public.organizations(created_by);
create index if not exists proposals_created_by_idx on public.proposals(created_by);
create index if not exists tasks_created_by_idx on public.tasks(created_by);
create index if not exists timeline_actor_idx on public.timeline_events(actor_id);
