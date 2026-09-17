-- =============================================================================
-- Taskora — sprints
--
-- Sprints live in their own table (same shape as the other workspace tables).
-- Ticket fields that belong to sprint planning — sprint, points, rank,
-- sprintHistory — live on the ticket doc in public.tasks, which members can
-- already edit.
--
-- WHO MAY MANAGE SPRINTS (create, edit, start, complete, delete)
--   * owners and admins
--   * a member an admin has granted "Create, start & complete sprints" under
--     Settings → Access & permissions (settings.doc.userPerms[<person>].sprint_manage)
-- Everyone in the workspace can read sprints.
-- =============================================================================

create table public.sprints (
  workspace_id text not null,
  id           text not null,
  doc          jsonb not null default '{}'::jsonb,
  sort         integer,
  primary key (workspace_id, id)
);
alter table public.sprints enable row level security;

create or replace function app.can_manage_sprints(p_ws text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_admin()
      or (app.is_member() and exists (
            select 1
              from public.people pe
              join public.settings st on st.workspace_id = pe.workspace_id
             where pe.workspace_id = p_ws
               and pe.doc ->> 'authId' = auth.uid()::text
               and pe.id = 'u_' || left(auth.uid()::text, 8)
               and (st.doc -> 'userPerms' -> pe.id ->> 'sprint_manage') = 'true'));
$$;

-- A member's own person row must use the id the app gives it ('u_' + first 8
-- characters of their user id). Permissions are keyed by that id, so this stops
-- a member creating a row under someone else's id to inherit their grants.
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
  if tg_op = 'INSERT' and new.id <> 'u_' || left(auth.uid()::text, 8) then
    raise exception 'Your person record must use your own id' using errcode = '42501';
  end if;

  new.doc := new.doc || jsonb_build_object(
    'master', false, 'masterAdmin', false,
    'toolRole', 'user', 'perm', 'User', 'profile', 'pf_users');
  return new;
end $$;

create policy sprints_read on public.sprints
  for select to authenticated using (app.can_read());

create policy sprints_write on public.sprints
  for all to authenticated
  using (app.can_manage_sprints(workspace_id))
  with check (app.can_manage_sprints(workspace_id));

grant select, insert, update, delete on public.sprints to authenticated;
grant all on public.sprints to service_role;

create index sprints_board_idx on public.sprints (workspace_id, (doc ->> 'board'));
create index tasks_sprint_idx  on public.tasks   (workspace_id, (doc ->> 'sprint'));

-- pm_patch_doc: allow 'sprints', gated the same way as the table.
create or replace function public.pm_patch_doc(p_table text, p_ws text, p_id text, p_patch jsonb)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_allowed    text[] := array['people', 'projects', 'statuses', 'boards', 'teams', 'tasks', 'worklogs', 'spaces', 'sprints'];
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
  if p_table = 'sprints' and not app.can_manage_sprints(p_ws) then
    raise exception 'You don''t have permission to manage sprints' using errcode = '42501';
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
  return v_rows;
end $$;

grant execute on function public.pm_patch_doc(text, text, text, jsonb) to authenticated;
revoke execute on function app.can_manage_sprints(text) from public, anon;
grant  execute on function app.can_manage_sprints(text) to authenticated, service_role;

do $$
begin
  alter publication supabase_realtime add table public.sprints;
exception when duplicate_object then null;
end $$;
