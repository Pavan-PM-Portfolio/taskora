-- =============================================================================
-- Taskora — initial schema (single Supabase project)
--
--   supabase db push          applies this to the linked project
--
-- CONTENTS
--   1. app schema + role helpers
--   2. profiles            one row per login: role (owner|admin|member), status
--   3. auth triggers        profile on user creation, email kept in sync
--   4. workspace tables     members, settings, spaces, projects, boards,
--                           statuses, teams, people, tasks, worklogs
--   5. guards               members can't promote themselves via `people`
--   6. RPCs                 pm_next_key, pm_patch_doc, my_field_perms
--   7. avatars bucket
--   8. realtime + grants
--
-- ACCESS MODEL
--   owner   everything, including managing admins and other owners
--   admin   workspace settings, boards, members (except owners)
--   member  tickets, worklogs, their own profile; the rest is per-person
--           permissions the app stores in settings
--   Role and status are written ONLY by the admin-users Edge Function
--   (service role) or by you in the SQL editor. No browser path exists.
--
-- FIRST OWNER
--   The first account ever created becomes owner. Keep public sign-ups
--   disabled (Authentication → Sign In / Providers → "Allow new users to sign
--   up" OFF) so that account is one you created. scripts/deploy.sh refuses to
--   deploy while sign-ups are enabled.
-- =============================================================================

set check_function_bodies = off;

-- -----------------------------------------------------------------------------
-- 1. app schema — private helpers. Never add "app" to the API's exposed schemas.
-- -----------------------------------------------------------------------------
create schema if not exists app;
revoke all on schema app from public, anon;
grant usage on schema app to authenticated, service_role;

-- True for the service role (Edge Functions) and for direct SQL connections
-- (SQL editor, migrations), where no request JWT is present.
create or replace function app.is_service()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '') = ''
      or coalesce(auth.role(), '') = 'service_role';
$$;

-- ---------------------------------------------------------------------------
-- 2. profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null default '',
  first_name  text,
  last_name   text,
  full_name   text,
  avatar_url  text,
  role        text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status      text not null default 'active' check (status in ('active', 'deactivated')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index profiles_email_key on public.profiles (lower(email)) where email <> '';
create index profiles_role_idx on public.profiles (role) where status = 'active';

alter table public.profiles enable row level security;

-- The caller's role, or null when they have no active profile. Everything else
-- is built on this, so deactivating someone is a kill switch for the whole app.
create or replace function app.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p
   where p.id = auth.uid() and p.status = 'active';
$$;

create or replace function app.is_member()
returns boolean language sql stable security definer set search_path = ''
as $$ select app.my_role() is not null; $$;

create or replace function app.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(app.my_role() in ('owner', 'admin'), false); $$;

create or replace function app.is_owner()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(app.my_role() = 'owner', false); $$;

-- Readable aliases used by the workspace policies below.
create or replace function app.can_read()
returns boolean language sql stable security definer set search_path = ''
as $$ select app.is_member(); $$;

create or replace function app.can_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select app.is_admin(); $$;

create or replace function app.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

-- full_name follows first/last whenever either is present.
create or replace function app.profiles_sync_name()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.first_name is not null or new.last_name is not null then
    new.full_name := nullif(btrim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '')), '');
  end if;
  return new;
end $$;

-- Belt and braces on top of the column grants: nobody but the service role
-- changes who someone is or what they may do.
create or replace function app.profiles_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if app.is_service() then return new; end if;
  if new.id     is distinct from old.id
  or new.email  is distinct from old.email
  or new.role   is distinct from old.role
  or new.status is distinct from old.status then
    raise exception 'role, status and email are managed by workspace admins'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_guard     before update on public.profiles for each row execute function app.profiles_guard();
create trigger profiles_sync_name before insert or update on public.profiles for each row execute function app.profiles_sync_name();
create trigger profiles_touch     before update on public.profiles for each row execute function app.touch_updated_at();

create policy profiles_read on public.profiles
  for select to authenticated
  using (app.is_member());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() and app.is_member())
  with check (id = auth.uid() and app.is_member());

-- ---------------------------------------------------------------------------
-- 3. auth triggers
-- ---------------------------------------------------------------------------
-- Every new login gets a profile — whether it was created by the admin-users
-- Edge Function or by hand in Supabase → Authentication → Users.
--   * role comes from app_metadata.taskora_role (only the service role can set
--     app_metadata), defaulting to member
--   * the very first account becomes owner
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_role  text := lower(coalesce(new.raw_app_meta_data ->> 'taskora_role', ''));
  v_first text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), '');
  v_last  text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), '');
  v_full  text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), '');
begin
  -- serialise so two accounts created at once can't both become "first"
  perform pg_advisory_xact_lock(hashtext('taskora:first-owner'));

  if v_role not in ('owner', 'admin', 'member') then v_role := 'member'; end if;
  if not exists (select 1 from public.profiles where role = 'owner') then v_role := 'owner'; end if;

  if v_first is null and v_full is not null then
    v_first := split_part(v_full, ' ', 1);
    v_last  := nullif(btrim(substr(v_full, length(v_first) + 1)), '');
  end if;
  if v_first is null and v_full is null and new.email is not null then
    v_first := initcap(regexp_replace(split_part(new.email, '@', 1), '[._-]+', ' ', 'g'));
  end if;

  insert into public.profiles (id, email, first_name, last_name, full_name, role, status)
  values (new.id, lower(coalesce(new.email, '')), v_first, v_last, v_full, v_role, 'active')
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function app.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = lower(coalesce(new.email, '')) where id = new.id;
  return new;
end $$;

drop trigger if exists taskora_on_auth_user_created on auth.users;
create trigger taskora_on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

drop trigger if exists taskora_on_auth_user_email on auth.users;
create trigger taskora_on_auth_user_email
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function app.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- 4. workspace tables
-- ---------------------------------------------------------------------------
-- members: bookkeeping for who has opened the workspace. Not used for
-- authority. PRIMARY KEY IS (user_id) ALONE on purpose: the app upserts with
-- onConflict 'user_id' and runs a single workspace ('main').
create table public.members (
  workspace_id text not null,
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  email        text,
  role         text not null default 'member' check (role in ('member', 'admin'))
);
alter table public.members enable row level security;

create policy members_read on public.members
  for select to authenticated using (user_id = auth.uid() or app.can_admin());
create policy members_selfjoin on public.members
  for insert to authenticated
  with check (user_id = auth.uid() and role = 'member' and app.can_read());
create policy members_admin on public.members
  for all to authenticated using (app.can_admin()) with check (app.can_admin());

create table public.settings (
  workspace_id text primary key,
  doc          jsonb not null default '{}'::jsonb
);
alter table public.settings enable row level security;
create policy settings_read  on public.settings for select to authenticated using (app.can_read());
create policy settings_admin on public.settings for all    to authenticated using (app.can_admin()) with check (app.can_admin());

-- Admin-managed structure: everyone reads, admins write.
do $$
declare t text;
begin
  foreach t in array array['spaces', 'projects', 'boards', 'statuses', 'teams'] loop
    execute format($f$
      create table public.%1$I (
        workspace_id text not null,
        id           text not null,
        doc          jsonb not null default '{}'::jsonb,
        sort         integer,
        primary key (workspace_id, id)
      );
      alter table public.%1$I enable row level security;
      create policy %1$s_read  on public.%1$I for select to authenticated using (app.can_read());
      create policy %1$s_admin on public.%1$I for all    to authenticated using (app.can_admin()) with check (app.can_admin());
    $f$, t);
  end loop;
end $$;

-- people: the board's view of a person. doc->>'authId' links it to a profile.
create table public.people (
  workspace_id text not null,
  id           text not null,
  doc          jsonb not null default '{}'::jsonb,
  sort         integer,
  primary key (workspace_id, id)
);
alter table public.people enable row level security;
create index people_authid_idx on public.people ((doc ->> 'authId'));

create policy people_read on public.people
  for select to authenticated using (app.can_read());
create policy people_admin on public.people
  for all to authenticated using (app.can_admin()) with check (app.can_admin());
-- Members may create and edit only their own row (prefs, photo). The guard
-- trigger below pins every permission-bearing field.
create policy people_self_insert on public.people
  for insert to authenticated
  with check (app.can_read() and (doc ->> 'authId') = auth.uid()::text);
create policy people_self_update on public.people
  for update to authenticated
  using      (app.can_read() and (doc ->> 'authId') = auth.uid()::text)
  with check (app.can_read() and (doc ->> 'authId') = auth.uid()::text);

-- tasks: any member reads and writes (a ticket tracker), per-person limits
-- are enforced in the app from settings.
create table public.tasks (
  workspace_id text not null,
  id           text not null,
  doc          jsonb not null default '{}'::jsonb,
  sort         integer,
  primary key (workspace_id, id)
);
alter table public.tasks enable row level security;
create policy tasks_read  on public.tasks for select to authenticated using (app.can_read());
create policy tasks_write on public.tasks for all    to authenticated using (app.can_read()) with check (app.can_read());

create index tasks_doc_gin      on public.tasks using gin (doc jsonb_path_ops);
create index tasks_status_idx   on public.tasks (workspace_id, (doc ->> 'status'));
create index tasks_assignee_idx on public.tasks (workspace_id, (doc ->> 'assignee'));
create index tasks_key_idx      on public.tasks (workspace_id, (doc ->> 'key'));

-- Ticket numbering, reached only through pm_next_key(). RLS on, no policies.
create table public.pm_key_counters (
  workspace_id text not null,
  space        text not null,
  prefix       text not null,
  n            integer not null default 0,
  primary key (workspace_id, space, prefix)
);
alter table public.pm_key_counters enable row level security;

create table public.worklogs (
  workspace_id text not null,
  id           text not null,
  doc          jsonb not null default '{}'::jsonb,
  sort         integer,
  primary key (workspace_id, id)
);
alter table public.worklogs enable row level security;
create policy worklogs_read on public.worklogs
  for select to authenticated using (app.can_read());
-- a worklog may only be written when its parent task exists
create policy worklogs_write on public.worklogs
  for all to authenticated
  using (app.can_read())
  with check (app.can_read() and exists (
    select 1 from public.tasks tk
     where tk.workspace_id = worklogs.workspace_id
       and tk.id = worklogs.doc ->> 'task'));
create index worklogs_task_idx on public.worklogs (workspace_id, (doc ->> 'task'));

-- ---------------------------------------------------------------------------
-- 5. guards
-- ---------------------------------------------------------------------------
-- Runs on every insert/update of people — including writes made through the
-- SECURITY DEFINER pm_patch_doc RPC, which RLS alone would not cover.
-- A member can't re-point their row at someone else, and every field the app
-- reads permissions from is forced to the member defaults.
create or replace function app.people_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if app.is_service() or app.is_admin() then return new; end if;

  if (new.doc ->> 'authId') is distinct from auth.uid()::text then
    raise exception 'You can only edit your own person record' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (old.doc ->> 'authId') is distinct from (new.doc ->> 'authId') then
    raise exception 'authId cannot be changed' using errcode = '42501';
  end if;

  new.doc := new.doc || jsonb_build_object(
    'master', false, 'masterAdmin', false,
    'toolRole', 'user', 'perm', 'User', 'profile', 'pf_users');
  return new;
end $$;

create trigger people_guard
  before insert or update on public.people
  for each row execute function app.people_guard();

-- When an admin changes someone's role or status, mirror it onto their person
-- record so the board reflects it without waiting for a client to resync.
create or replace function app.profiles_to_people()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role or new.status is distinct from old.status then
    update public.people pe
       set doc = pe.doc || jsonb_build_object(
             'master',   new.role = 'owner',
             'toolRole', case when new.role = 'member' then 'user'     else 'admin'    end,
             'perm',     case when new.role = 'member' then 'User'     else 'Admin'    end,
             'profile',  case when new.role = 'member' then 'pf_users' else 'pf_admin' end,
             'status',   case when new.status = 'active' then 'active' else 'deactivated' end)
     where pe.doc ->> 'authId' = new.id::text;
  end if;
  return new;
end $$;

create trigger profiles_to_people
  after update on public.profiles
  for each row execute function app.profiles_to_people();

-- Never leave the workspace without an active owner, whoever is asking.
create or replace function app.keep_an_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active')
     and not exists (select 1 from public.profiles p
                      where p.id <> old.id and p.role = 'owner' and p.status = 'active') then
    raise exception 'Taskora needs at least one active owner. Make someone else an owner first.'
      using errcode = '23514';
  end if;
  return coalesce(new, old);
end $$;

create trigger profiles_keep_an_owner
  before update or delete on public.profiles
  for each row execute function app.keep_an_owner();

-- ---------------------------------------------------------------------------
-- 6. RPCs
-- ---------------------------------------------------------------------------
create or replace function public.pm_next_key(p_ws text, p_space text, p_prefix text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_n int;
begin
  if auth.uid() is null or not app.can_read() then
    raise exception 'no access' using errcode = '42501';
  end if;
  insert into public.pm_key_counters (workspace_id, space, prefix, n)
    values (p_ws, p_space, p_prefix, 1)
  on conflict (workspace_id, space, prefix)
    do update set n = public.pm_key_counters.n + 1
  returning n into v_n;
  return v_n;
end $$;

-- Shallow field merge (doc || patch), so two people editing different fields of
-- the same record both keep their change. The table name is whitelisted before
-- it reaches format(%I).
create or replace function public.pm_patch_doc(p_table text, p_ws text, p_id text, p_patch jsonb)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_allowed    text[] := array['people', 'projects', 'statuses', 'boards', 'teams', 'tasks', 'worklogs', 'spaces'];
  v_admin_only text[] := array['statuses', 'projects', 'boards', 'teams', 'spaces'];
  v_rows int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not (p_table = any (v_allowed)) then
    raise exception 'table not permitted' using errcode = '42501';
  end if;
  if not app.can_read() then
    raise exception 'no access' using errcode = '42501';
  end if;
  if p_table = any (v_admin_only) and not app.can_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_table = 'people' and not app.can_admin() then
    if not exists (select 1 from public.people
                    where workspace_id = p_ws and id = p_id
                      and doc ->> 'authId' = auth.uid()::text) then
      raise exception 'not your row' using errcode = '42501';
    end if;
  end if;

  execute format('update public.%I set doc = doc || $1 where workspace_id = $2 and id = $3', p_table)
    using p_patch, p_ws, p_id;
  get diagnostics v_rows = row_count;
  return v_rows;   -- 0 => row absent; the client re-inserts it whole
end $$;

-- Kept for the client contract; field rules live in settings.doc.
create or replace function public.my_field_perms(p_tool text)
returns table (field_key text, can_read boolean, can_write boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  return;
end $$;

-- ---------------------------------------------------------------------------
-- 7. avatars bucket — <user-id>.jpg, public read, owner-only write
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists taskora_avatars_read   on storage.objects;
drop policy if exists taskora_avatars_insert on storage.objects;
drop policy if exists taskora_avatars_update on storage.objects;
drop policy if exists taskora_avatars_delete on storage.objects;

create policy taskora_avatars_read on storage.objects
  for select using (bucket_id = 'avatars');
create policy taskora_avatars_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg' and app.is_member());
create policy taskora_avatars_update on storage.objects
  for update to authenticated
  using      (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg' and app.is_member())
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg' and app.is_member());
create policy taskora_avatars_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg' and app.is_member());

-- ---------------------------------------------------------------------------
-- 8. realtime + grants
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['settings', 'spaces', 'projects', 'boards', 'statuses', 'teams', 'people', 'tasks', 'worklogs'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Newer projects no longer expose new tables to the API automatically, so
-- every grant is explicit. anon gets nothing: there is no signed-out surface.
revoke all on all tables    in schema public from anon;
revoke all on all functions in schema public from anon, public;

grant select                         on public.profiles  to authenticated;
grant update (first_name, last_name, avatar_url) on public.profiles to authenticated;

grant select, insert, update, delete on public.members, public.settings, public.spaces,
  public.projects, public.boards, public.statuses, public.teams, public.people,
  public.tasks, public.worklogs to authenticated;

grant all on all tables in schema public to service_role;

grant execute on function public.pm_next_key(text, text, text)          to authenticated;
grant execute on function public.pm_patch_doc(text, text, text, jsonb)   to authenticated;
grant execute on function public.my_field_perms(text)                    to authenticated;

revoke all     on all functions in schema app from public, anon;
grant execute  on all functions in schema app to authenticated, service_role;
