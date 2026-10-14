-- =============================================================================
-- Foto do cliente (empresa/pessoa)
-- =============================================================================

alter table public.entities add column if not exists avatar_url text;

-- Bucket público (leitura pela URL), até 2 MB, só imagens.
-- Caminho: entity-photos/<org_id>/<entity_id>/<arquivo>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entity-photos', 'entity-photos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A primeira pasta do caminho precisa ser uma base (organização) da qual o usuário é membro
create or replace function public.can_write_entity_photo(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_folder text := (storage.foldername(p_name))[1];
begin
  if v_folder is null or v_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_member(v_folder::uuid);
end;
$$;

revoke execute on function public.can_write_entity_photo(text) from public, anon;
grant execute on function public.can_write_entity_photo(text) to authenticated;

drop policy if exists entity_photos_insert on storage.objects;
drop policy if exists entity_photos_update on storage.objects;
drop policy if exists entity_photos_delete on storage.objects;
drop policy if exists entity_photos_select on storage.objects;

create policy entity_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'entity-photos' and public.can_write_entity_photo(name));
create policy entity_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'entity-photos' and public.can_write_entity_photo(name))
  with check (bucket_id = 'entity-photos' and public.can_write_entity_photo(name));
create policy entity_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'entity-photos' and public.can_write_entity_photo(name));
create policy entity_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'entity-photos' and public.can_write_entity_photo(name));

-- Registra a troca de foto no Feedbacks (acrescenta à função de alterações do cliente)
create or replace function public.log_entity_photo_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.avatar_url is distinct from old.avatar_url and new.deleted_at is not distinct from old.deleted_at then
    insert into public.timeline_events (org_id, entity_id, actor_id, kind, payload)
    values (new.org_id, new.id, (select auth.uid()), 'entidade_alterada',
            jsonb_build_object('name', new.name, 'changes', jsonb_build_array(jsonb_build_object(
              'label', 'Foto',
              'from', case when old.avatar_url is null then 'sem foto' else 'foto anterior' end,
              'to', case when new.avatar_url is null then 'foto removida' else 'nova foto' end))));
  end if;
  return null;
end;
$$;

drop trigger if exists entities_photo_change on public.entities;
create trigger entities_photo_change after update of avatar_url on public.entities
  for each row execute function public.log_entity_photo_change();

revoke execute on function public.log_entity_photo_change() from public, anon, authenticated;
