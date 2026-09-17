-- =============================================================================
-- Taskora — board access
--
-- Workspace > Board (Scrum or Kanban) > Projects > Epics > Tickets
--
-- boards.doc
--   type     'scrum' | 'kanban'            (UI behaviour only)
--   access   'workspace' | 'members'       who can see the board
--   members  [{ "id": "<person id>", "role": "admin" | "member" | "viewer" }]
--
-- A person's role on a board:
--   * workspace owners and admins           → admin, on every board
--   * listed in members                     → that role
--   * not listed, access = 'workspace'      → member
--   * not listed, access = 'members'        → no access (board is invisible)
-- Viewers can read everything on the board and write nothing.
--
-- A ticket's board is its project's board (falling back to the ticket's own
-- `board` field), so moving a project moves all of its tickets with it.
-- =============================================================================

create or replace function app.board_role(p_ws text, p_board text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_doc  jsonb;
  v_role text;
begin
  if app.is_admin() then return 'admin'; end if;
  if not app.is_member() then return null; end if;
  if p_board is null or p_board = '' then return 'member'; end if;   -- legacy, boardless rows

  select doc into v_doc from public.boards where workspace_id = p_ws and id = p_board;
  if v_doc is null then return 'member'; end if;                       -- board not synced yet

  select m ->> 'role' into v_role
    from jsonb_array_elements(coalesce(v_doc -> 'members', '[]'::jsonb)) m
   where m ->> 'id' = 'u_' || left(auth.uid()::text, 8)
   limit 1;
  if v_role in ('admin', 'member', 'viewer') then return v_role; end if;

  if coalesce(v_doc ->> 'access', 'workspace') = 'workspace' then return 'member'; end if;
  return null;
end $$;

create or replace function app.can_read_board(p_ws text, p_board text)
returns boolean language sql stable security definer set search_path = ''
as $$ select app.board_role(p_ws, p_board) is not null; $$;

create or replace function app.can_write_board(p_ws text, p_board text)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(app.board_role(p_ws, p_board) in ('admin', 'member'), false); $$;

-- the board a ticket lives on: its project's board, else its own board field
create or replace function app.task_board(p_ws text, p_doc jsonb)
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select nullif(p.doc ->> 'board', '') from public.projects p
      where p.workspace_id = p_ws and p.id = p_doc ->> 'project'),
    nullif(p_doc ->> 'board', ''));
$$;

-- ---------------------------------------------------------------- boards ----
drop policy if exists boards_read on public.boards;
create policy boards_read on public.boards
  for select to authenticated
  using (app.can_read_board(workspace_id, id));

-- --------------------------------------------------------------- projects ---
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects
  for select to authenticated
  using (app.can_read_board(workspace_id, doc ->> 'board'));

-- ------------------------------------------------------------------ tasks ----
drop policy if exists tasks_read  on public.tasks;
drop policy if exists tasks_write on public.tasks;
create policy tasks_read on public.tasks
  for select to authenticated
  using (app.can_read_board(workspace_id, app.task_board(workspace_id, doc)));
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (app.can_write_board(workspace_id, app.task_board(workspace_id, doc)));
create policy tasks_update on public.tasks
  for update to authenticated
  using      (app.can_write_board(workspace_id, app.task_board(workspace_id, doc)))
  with check (app.can_write_board(workspace_id, app.task_board(workspace_id, doc)));
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (app.can_write_board(workspace_id, app.task_board(workspace_id, doc)));

-- --------------------------------------------------------------- worklogs ---
drop policy if exists worklogs_read  on public.worklogs;
drop policy if exists worklogs_write on public.worklogs;
create policy worklogs_read on public.worklogs
  for select to authenticated
  using (exists (select 1 from public.tasks tk
                  where tk.workspace_id = worklogs.workspace_id and tk.id = worklogs.doc ->> 'task'
                    and app.can_read_board(tk.workspace_id, app.task_board(tk.workspace_id, tk.doc))));
create policy worklogs_write on public.worklogs
  for all to authenticated
  using (exists (select 1 from public.tasks tk
                  where tk.workspace_id = worklogs.workspace_id and tk.id = worklogs.doc ->> 'task'
                    and app.can_write_board(tk.workspace_id, app.task_board(tk.workspace_id, tk.doc))))
  with check (exists (select 1 from public.tasks tk
                  where tk.workspace_id = worklogs.workspace_id and tk.id = worklogs.doc ->> 'task'
                    and app.can_write_board(tk.workspace_id, app.task_board(tk.workspace_id, tk.doc))));

-- ---------------------------------------------------------------- sprints ---
drop policy if exists sprints_read  on public.sprints;
drop policy if exists sprints_write on public.sprints;
create policy sprints_read on public.sprints
  for select to authenticated
  using (app.can_read_board(workspace_id, doc ->> 'board'));
create policy sprints_write on public.sprints
  for all to authenticated
  using      (app.can_manage_sprints(workspace_id) and app.can_write_board(workspace_id, doc ->> 'board'))
  with check (app.can_manage_sprints(workspace_id) and app.can_write_board(workspace_id, doc ->> 'board'));

-- ----------------------------------------------------------- pm_patch_doc ---
-- SECURITY DEFINER skips RLS, so the board rules are repeated here — checked
-- against the row as it is AND as it would be after the patch.
create or replace function public.pm_patch_doc(p_table text, p_ws text, p_id text, p_patch jsonb)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_allowed    text[] := array['people', 'projects', 'statuses', 'boards', 'teams', 'tasks', 'worklogs', 'spaces', 'sprints'];
  v_admin_only text[] := array['statuses', 'projects', 'boards', 'teams', 'spaces'];
  v_doc  jsonb;
  v_task jsonb;
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

  if p_table = 'tasks' then
    select doc into v_doc from public.tasks where workspace_id = p_ws and id = p_id;
    if v_doc is not null and (
         not app.can_write_board(p_ws, app.task_board(p_ws, v_doc))
      or not app.can_write_board(p_ws, app.task_board(p_ws, v_doc || p_patch))) then
      raise exception 'You can''t change tickets on this board' using errcode = '42501';
    end if;
  elsif p_table = 'worklogs' then
    select doc into v_doc from public.worklogs where workspace_id = p_ws and id = p_id;
    select tk.doc into v_task from public.tasks tk
     where tk.workspace_id = p_ws and tk.id = coalesce((v_doc || p_patch) ->> 'task', v_doc ->> 'task');
    if v_doc is not null and (v_task is null or not app.can_write_board(p_ws, app.task_board(p_ws, v_task))) then
      raise exception 'You can''t log time on this board' using errcode = '42501';
    end if;
  elsif p_table = 'sprints' then
    if not app.can_manage_sprints(p_ws) then
      raise exception 'You don''t have permission to manage sprints' using errcode = '42501';
    end if;
    select doc into v_doc from public.sprints where workspace_id = p_ws and id = p_id;
    if v_doc is not null and (
         not app.can_write_board(p_ws, v_doc ->> 'board')
      or not app.can_write_board(p_ws, (v_doc || p_patch) ->> 'board')) then
      raise exception 'You can''t change sprints on this board' using errcode = '42501';
    end if;
  end if;

  execute format('update public.%I set doc = doc || $1 where workspace_id = $2 and id = $3', p_table)
    using p_patch, p_ws, p_id;
  get diagnostics v_rows = row_count;
  return v_rows;
end $$;

grant execute on function public.pm_patch_doc(text, text, text, jsonb) to authenticated;
revoke execute on function app.board_role(text, text), app.can_read_board(text, text),
                          app.can_write_board(text, text), app.task_board(text, jsonb) from public, anon;
grant  execute on function app.board_role(text, text), app.can_read_board(text, text),
                          app.can_write_board(text, text), app.task_board(text, jsonb) to authenticated, service_role;

create index if not exists projects_board_idx on public.projects (workspace_id, (doc ->> 'board'));
