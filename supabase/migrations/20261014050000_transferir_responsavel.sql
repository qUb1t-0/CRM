-- =============================================================================
-- Responsável pelo cliente: só administradores podem transferir, e o novo
-- responsável recebe uma notificação.
-- =============================================================================

-- 1) Regra: alteração do responsável exige administrador e um membro da base
create or replace function public.entities_owner_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is distinct from old.owner_id then
    -- Chamadas internas (sem usuário logado, ex.: manutenção) não são bloqueadas
    if (select auth.uid()) is not null and not public.is_admin(new.org_id) then
      raise exception 'Apenas administradores podem alterar o responsável pelo cliente.';
    end if;
    if new.owner_id is not null and not exists (
      select 1 from public.memberships where org_id = new.org_id and user_id = new.owner_id
    ) then
      raise exception 'O novo responsável precisa ser um usuário desta empresa.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists entities_owner_guard on public.entities;
create trigger entities_owner_guard before update of owner_id on public.entities
  for each row execute function public.entities_owner_guard();

-- 2) Notificação para o novo responsável
create or replace function public.notify_entity_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if new.owner_id is distinct from old.owner_id
     and new.owner_id is not null
     and new.owner_id is distinct from v_actor then
    insert into public.notifications (org_id, user_id, actor_id, kind, entity_id, text)
    values (new.org_id, new.owner_id, v_actor, 'responsavel', new.id, new.name);
  end if;
  return null;
end;
$$;

drop trigger if exists entities_owner_notify on public.entities;
create trigger entities_owner_notify after update of owner_id on public.entities
  for each row execute function public.notify_entity_owner();

revoke execute on function public.entities_owner_guard() from public, anon, authenticated;
revoke execute on function public.notify_entity_owner() from public, anon, authenticated;
