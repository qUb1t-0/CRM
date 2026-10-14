-- =============================================================================
-- Perfil do usuário: foto, cargo, telefone, data de nascimento e biografia.
-- =============================================================================

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists job_title text check (char_length(job_title) <= 80),
  add column if not exists phone text check (char_length(phone) <= 20),
  add column if not exists birth_date date check (birth_date between date '1900-01-01' and current_date),
  add column if not exists bio text check (char_length(bio) <= 500),
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Mantém o e-mail do perfil igual ao da conta (após a confirmação da troca de e-mail)
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

revoke execute on function public.sync_profile_email() from public, anon, authenticated;

-- Armazenamento das fotos: bucket público (leitura por URL), até 2 MB, só imagens
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada usuário só grava/apaga dentro da própria pasta: avatars/<user_id>/...
drop policy if exists avatars_insert_own on storage.objects;
drop policy if exists avatars_update_own on storage.objects;
drop policy if exists avatars_delete_own on storage.objects;
drop policy if exists avatars_select_own on storage.objects;

create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Listagem só da própria pasta (a exibição usa a URL pública, sem listar)
create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
