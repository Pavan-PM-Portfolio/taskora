/* Taskora — 24-boards.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ============================================================
   BOARD-FIRST NAVIGATION
   Workspace > Board (Scrum or Kanban) > Projects > Epics > Tickets

   * Board-scoped views (Overview, Board, List, Projects, Epics, Backlog,
     Sprints, Reports, QA, Deployments, Calendar, Board settings…) first ask
     which board. The choice is remembered; the breadcrumb switches boards.
   * Backlog, Active sprint and Sprint reports only offer Scrum boards.
   * Overview and Reports can also show All boards.
   * Workspace views (My work, Team, Members, Settings) never ask.
   * Each board: type (scrum|kanban), access (workspace|members) and
     members [{id, role:'admin'|'member'|'viewer'}], enforced in the database.
============================================================ */
const BOARD_VIEWS = new Set(['overview','board','list','projects','epics','backlog','sprint','sprintreports','flow','reports','qa','deployments','calendar','boardsettings','analytics','releases','timeline','velocity']);
const SCRUM_VIEWS = new Set(['backlog','sprint','sprintreports','velocity']);
const ALL_BOARDS_OK = new Set(['overview','reports']);
const BOARD_CARET = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
function viewLabel(v){ return v==='flow' ? 'Flow reports' : ((typeof VIEW_TITLE!=='undefined' && VIEW_TITLE[v]) || 'this view'); }

function boardType(b){ return (b && b.type==='kanban') ? 'kanban' : 'scrum'; }
function boardTypeLabel(b){ return boardType(b)==='kanban' ? 'Kanban' : 'Scrum'; }
function boardPersonId(){ return (typeof ME!=='undefined' && ME && ME.id) ? 'u_'+String(ME.id).slice(0,8) : (typeof myUid==='function' ? myUid() : null); }
function boardRole(b){
  if(!b) return null;
  if(IS_ADMIN) return 'admin';
  const me=boardPersonId();
  const m=(b.members||[]).find(x=>x.id===me);
  if((b.access||'workspace')==='workspace') return m ? m.role : 'member';
  return m ? m.role : null;
}
function boardProjects(bid){ return store.projects().filter(p=>store.projectBoardId(p)===bid); }

/* ---------------- scope ---------------- */
function boardScopeOn(){
  const v=ui.view;
  return BOARD_VIEWS.has(v) && !!ui.boardChosen && !(ui.allBoards && ALL_BOARDS_OK.has(v)) && !!store.board(ui.board);
}
function boardPickNeeded(v){
  if(!BOARD_VIEWS.has(v)) return false;
  if(!store.boards().length) return false;
  if(ALL_BOARDS_OK.has(v) && ui.allBoards) return false;
  if(!ui.boardChosen || !store.board(ui.board)) return true;
  if(SCRUM_VIEWS.has(v) && boardType(store.board(ui.board))!=='scrum') return true;
  return false;
}
const __stdAllTasks = store.standardTasks.bind(store);
store.standardTasks = function(){
  const all=__stdAllTasks();
  if(!boardScopeOn()) return all;
  const b=ui.board;
  return all.filter(t=>taskBoardId(t)===b);
};
store.allStandardTasks = __stdAllTasks;

/* A board a viewer can only read: no writes anywhere while it's in scope. */
const __canBase = can;
can = function(cap){
  if(!__canBase(cap)) return false;
  if(boardScopeOn() && /^(ticket_|field_|backlog_|sprint_|comment|log_|qa_|deploy|env_)/.test(String(cap))){
    if(boardRole(store.board(ui.board))==='viewer') return false;
  }
  return true;
};

/* ---------------- status history (feeds flow reports) ---------------- */
const __updTaskBase = store.updateTask.bind(store);
store.updateTask = function(id, patch){
  const t=this.task(id);
  if(t && patch && patch.status && patch.status!==t.status){
    const h=(t.statusHistory||[]).slice();
    if(!h.length) h.push({ status:t.status, at:t.createdTs || new Date(Date.now()-1000).toISOString() });
    h.push({ status:patch.status, at:new Date().toISOString() });
    patch=Object.assign({}, patch, { statusHistory:h });
  }
  return __updTaskBase(id, patch);
};

/* ---------------- board store helpers ---------------- */
store.moveProjectToBoard = function(pid, bid){
  const p=this.project(pid); const to=this.board(bid);
  if(!p || !to) return 0;
  p.board=bid;
  let n=0;
  this.data.tasks.filter(t=>t.project===pid).forEach(t=>{
    const patch={ board:bid };
    this.updateTask(t.id, patch); n++;
    const s=t.sprint ? this.sprint(t.sprint) : null;
    if(s && s.state!=='closed' && sprOfBoard(s)!==bid) this.setTaskSprint(t.id, null);
  });
  this._persist();
  return n;
};
function boardDefaultColumns(type){
  const ids=(store.data.statuses||[]).map(s=>s.id);
  const want = type==='kanban' ? ['st_ready','st_dev','st_review','st_done'] : ['st_backlog','st_ready','st_dev','st_review','st_qa','st_done'];
  const cols=want.filter(id=>ids.includes(id));
  return cols.length ? cols : ids.slice(0,4);
}

/* ---------------- remember the chosen board ---------------- */
let __lastBoardSeen=null, __lastSpaceSeen=null;
const __saveSpotBase = saveSpot;
saveSpot = function(){
  __saveSpotBase();
  try{ localStorage.setItem('tsk_board_pick', JSON.stringify({ space:ui.space||null, board:ui.board||null, chosen:!!ui.boardChosen, all:!!ui.allBoards })); }catch(e){}
};
const __restoreSpotBase = restoreSpot;
restoreSpot = function(){
  const r=__restoreSpotBase.apply(this, arguments);
  try{
    const p=JSON.parse(localStorage.getItem('tsk_board_pick')||'null');
    if(p && p.space===ui.space && p.board && store.board(p.board)){ ui.board=p.board; ui.boardChosen=!!p.chosen; ui.allBoards=!!p.all; }
  }catch(e){}
  __lastBoardSeen=ui.board; __lastSpaceSeen=ui.space;
  return r;
};

/* ---------------- render wrapper ---------------- */
const __renderAllBase = renderAll;
renderAll = function(){
  if(__lastSpaceSeen!==null && ui.space!==__lastSpaceSeen){ ui.boardChosen=false; ui.allBoards=false; }
  else if(__lastBoardSeen!==null && ui.board!==__lastBoardSeen && store.board(ui.board)){ ui.boardChosen=true; ui.allBoards=false; }
  __lastSpaceSeen=ui.space; __lastBoardSeen=ui.board;
  const v=ui.view;
  const pick=boardPickNeeded(v);
  document.body.classList.toggle('board-pick', pick);
  __renderAllBase();
  const title=document.getElementById('pageTitle');
  if(title && BOARD_VIEWS.has(v) && v!=='analytics') title.textContent = pick ? viewLabel(v) : (v==='board' ? 'Board' : viewLabel(v));
  renderBoardCrumb(pick);
  const w=document.getElementById('boardpickwrap');
  if(pick) renderBoardPicker(v); else if(w){ w.innerHTML=''; w.style.display='none'; }
};
function pickBoard(id, v){
  ui.board=id; ui.boardChosen=true; ui.allBoards=false;
  ui.listBoard=id; ui.projBoard=id;
  __lastBoardSeen=id;
  try{ if(typeof SPR!=='undefined') SPR.sel.clear(); }catch(e){}
  setView(v||ui.view);
  try{ urlSync(); }catch(e){}
}
function showAllBoards(v){ ui.allBoards=true; setView(v||ui.view); try{ urlSync(); }catch(e){} }
function backToBoardPicker(){ ui.boardChosen=false; ui.allBoards=false; renderAll(); saveSpot(); try{ urlSync(); }catch(e){} }

function renderBoardCrumb(pick){
  let el=document.getElementById('tskCrumb');
  if(!el){
    const t=document.getElementById('pageTitle'); if(!t || !t.parentNode) return;
    el=document.createElement('div'); el.id='tskCrumb'; el.className='tsk-crumb';
    t.parentNode.insertBefore(el, t);
  }
  const v=ui.view;
  if(!BOARD_VIEWS.has(v) || !store.boards().length){ el.innerHTML=''; el.hidden=true; document.body.classList.remove('has-crumb'); return; }
  el.hidden=false; document.body.classList.add('has-crumb');
  const b=store.board(ui.board);
  let mid;
  if(pick) mid='<span class="tc-cur">Choose a board</span>';
  else if(ui.allBoards && ALL_BOARDS_OK.has(v)) mid=`<button type="button" class="tc-board" id="tcBoard">All boards ${BOARD_CARET}</button>`;
  else mid=`<button type="button" class="tc-board" id="tcBoard" aria-label="Switch board"><span class="tc-type ${boardType(b)}">${boardTypeLabel(b)}</span>${esc(b?b.name:'')} ${BOARD_CARET}</button>`;
  el.innerHTML=`<button type="button" class="tc-link" id="tcAll">All boards</button><span class="tc-sep">/</span>${mid}<span class="tc-sep">/</span>`;
  document.getElementById('tcAll').onclick=backToBoardPicker;
  const tb=document.getElementById('tcBoard');
  if(tb) tb.onclick=e=>{
    e.stopPropagation();
    const scrumOnly=SCRUM_VIEWS.has(v);
    const items=[{ head:'Switch board' }];
    store.boards().forEach(x=>{
      const off=scrumOnly && boardType(x)!=='scrum';
      items.push({ label:`${x.name} · ${boardTypeLabel(x)}${x.id===ui.board&&!ui.allBoards?'  ✓':''}`, disabled:off, act:()=>pickBoard(x.id, v) });
    });
    if(ALL_BOARDS_OK.has(v)) items.push({ sep:true }, { label:'All boards'+(ui.allBoards?'  ✓':''), act:()=>showAllBoards(v) });
    items.push({ sep:true }, { label:'Show all boards…', act:backToBoardPicker });
    sprMenu(tb, items);
  };
}

function renderBoardPicker(v){
  sprCss(); boardCss();
  let w=document.getElementById('boardpickwrap');
  if(!w){ const sc=document.getElementById('scroll'); if(!sc) return; w=document.createElement('div'); w.id='boardpickwrap'; w.className='pagewrap'; sc.insertBefore(w, sc.firstChild); }
  w.style.display='';
  const scrumOnly=SCRUM_VIEWS.has(v);
  const cur=store.board(ui.board);
  const all=store.allStandardTasks().filter(t=>!t.archived && t.type!=='Epic');
  const sp=(store.space && store.space(ui.space)) || {};
  const note = (scrumOnly && ui.boardChosen && cur && boardType(cur)!=='scrum')
    ? `<div class="bp-note"><b>${esc(cur.name)}</b> is a Kanban board, so it has no backlog or sprints. Choose a Scrum board for ${esc(viewLabel(v))}.</div>` : '';
  const card=b=>{
    const type=boardType(b), off=scrumOnly && type!=='scrum';
    const role=boardRole(b);
    const projs=boardProjects(b.id);
    const tasks=all.filter(t=>taskBoardId(t)===b.id);
    const open=tasks.filter(t=>{ const s=store.status(t.status); return !s || s.cat!=='done'; }).length;
    const act=(type==='scrum' && store.activeSprints) ? store.activeSprints(b.id)[0] : null;
    const locked=(b.access||'workspace')==='members';
    return `<button type="button" class="bp-card ${off?'off':''} ${b.id===ui.board&&ui.boardChosen?'last':''}" data-board="${b.id}" ${off?'disabled aria-disabled="true"':''}>
      <div class="bp-top"><span class="tc-type ${type}">${boardTypeLabel(b)}</span>${locked?'<span class="bp-lock" title="Only board members can see this board">Members only</span>':''}${role==='viewer'?'<span class="bp-lock">View only</span>':''}</div>
      <div class="bp-name">${esc(b.name)}</div>
      <div class="bp-projs">${projs.length?projs.slice(0,4).map(p=>`<span>${esc(p.key||p.name)}</span>`).join('')+(projs.length>4?`<span>+${projs.length-4}</span>`:''):'<em>No projects yet</em>'}</div>
      <div class="bp-meta"><span><b>${projs.length}</b> project${projs.length===1?'':'s'}</span><span><b>${open}</b> open ticket${open===1?'':'s'}</span>
        ${type==='scrum' ? `<span>${act?`Sprint: <b>${esc(act.name)}</b>`:'No active sprint'}</span>` : '<span>Continuous flow</span>'}</div>
      ${off?'<div class="bp-why">Kanban boards don’t use sprints</div>':''}
    </button>`;
  };
  const boards=store.boards();
  w.innerHTML=`<div class="bp-page">
    <div class="bp-head"><div class="bp-kicker">${esc(sp.name||'Workspace')}</div>
      <h2>Choose a board</h2>
      <p>${esc(viewLabel(v))} is organised by board. Pick one to see its projects, epics and tickets — you can switch any time from the breadcrumb above.</p></div>
    ${note}
    <div class="bp-grid">
      ${ALL_BOARDS_OK.has(v)?`<button type="button" class="bp-card bp-all" data-all="1"><div class="bp-top"><span class="tc-type all">Workspace</span></div><div class="bp-name">All boards</div><div class="bp-projs"><em>Every project in ${esc(sp.name||'this workspace')}</em></div><div class="bp-meta"><span><b>${boards.length}</b> boards</span><span><b>${all.filter(t=>{ const s=store.status(t.status); return !s||s.cat!=='done'; }).length}</b> open tickets</span></div></button>`:''}
      ${boards.map(card).join('')}
      ${IS_ADMIN?`<button type="button" class="bp-card bp-new" data-new="1"><span class="bp-plus">+</span><div class="bp-name">New board</div><div class="bp-projs"><em>Scrum or Kanban</em></div></button>`:''}
    </div></div>`;
  w.querySelectorAll('[data-board]').forEach(c=>c.onclick=()=>{ if(!c.disabled) pickBoard(c.dataset.board, v); });
  const a=w.querySelector('[data-all]'); if(a) a.onclick=()=>showAllBoards(v);
  const n=w.querySelector('[data-new]'); if(n) n.onclick=()=>openNewBoard(v);
}

function openNewBoard(v){
  const d=tskModal('New board', `
    <div class="spr-f"><label for="nbName">Board name</label><input id="nbName" maxlength="60" placeholder="e.g. Mobile squad"/></div>
    <div class="spr-f"><label>Type</label>
      <div class="bt-choice">
        <label class="bt-opt"><input type="radio" name="nbType" value="scrum" ${SCRUM_VIEWS.has(v)||v!=='flow'?'checked':''}/><span><b>Scrum</b>Backlog, sprints, burndown and velocity.</span></label>
        <label class="bt-opt"><input type="radio" name="nbType" value="kanban" ${v==='flow'?'checked':''}/><span><b>Kanban</b>Continuous flow on a board, with flow reports. No sprints.</span></label>
      </div></div>
    <div class="pw-err" id="nbErr"></div>
    <div class="mem-foot"><button class="btn" id="nbCancel">Cancel</button><button class="btn primary" id="nbGo">Create board</button></div>`, 480);
  d.q('#nbCancel').onclick=d.close;
  d.q('#nbGo').onclick=()=>{
    const name=d.q('#nbName').value.trim();
    if(!name){ const e=d.q('#nbErr'); e.textContent='Give the board a name.'; e.classList.add('on'); return; }
    const type=d.el.querySelector('input[name=nbType]:checked').value;
    const id=store.addBoard(name);
    store.updateBoard(id, { type, access:'workspace', members:[], columns:boardDefaultColumns(type) });
    d.close(); toast(`${name} created`);
    const target = (SCRUM_VIEWS.has(v) && type!=='scrum') ? 'board' : v;
    pickBoard(id, target);
  };
}

/* ---------------- board settings: type, access, members, projects ---------------- */
const __rbsBase = renderBoardSettings;
renderBoardSettings = function(){
  __rbsBase.apply(this, arguments);
  try{ injectBoardAccessCard(); }catch(e){ __dbg && __dbg.warn && __dbg.warn('board card', e); }
};
function injectBoardAccessCard(){
  boardCss();
  const wrap=document.getElementById('boardsettingswrap'); const b=activeBoard();
  if(!wrap || !b) return;
  const edit=IS_ADMIN;
  const type=boardType(b), access=b.access||'workspace', members=b.members||[];
  const people=store.users();
  const others=store.boards().filter(x=>x.id!==b.id);
  const projs=boardProjects(b.id);
  const act=store.activeSprints ? store.activeSprints(b.id) : [];
  const card=document.createElement('section');
  card.className='bt-card'; card.id='boardAccessCard';
  card.innerHTML=`
    <div class="bt-row">
      <div class="bt-lbl"><b>Board type</b><span>Scrum boards plan in sprints. Kanban boards flow continuously.</span></div>
      <div class="bt-seg" role="radiogroup" aria-label="Board type">
        <button type="button" data-type="scrum" class="${type==='scrum'?'on':''}" ${edit?'':'disabled'}>Scrum</button>
        <button type="button" data-type="kanban" class="${type==='kanban'?'on':''}" ${edit?'':'disabled'}>Kanban</button></div>
    </div>
    <div class="bt-row">
      <div class="bt-lbl"><b>Who can see this board</b><span>${access==='members'?'Only the members below, plus workspace owners and admins.':'Everyone in the workspace. Members below can have a different role.'}</span></div>
      <div class="bt-seg" role="radiogroup" aria-label="Board access">
        <button type="button" data-access="workspace" class="${access==='workspace'?'on':''}" ${edit?'':'disabled'}>Everyone</button>
        <button type="button" data-access="members" class="${access==='members'?'on':''}" ${edit?'':'disabled'}>Members only</button></div>
    </div>
    <div class="bt-sub">Board members</div>
    <div class="bt-list">${members.length?members.map(m=>{ const u=store.user(m.id); return `<div class="bt-mem">${u?avatar(u,26):''}<span class="bt-nm">${esc(u?u.name:m.id)}</span>
        <select data-role="${esc(m.id)}" ${edit?'':'disabled'} aria-label="Role">${['admin','member','viewer'].map(r=>`<option value="${r}" ${m.role===r?'selected':''}>${r[0].toUpperCase()+r.slice(1)}</option>`).join('')}</select>
        ${edit?`<button type="button" class="bt-x" data-remove="${esc(m.id)}" aria-label="Remove">✕</button>`:''}</div>`; }).join('') : '<p class="bt-empty">No board members yet. With “Everyone”, the whole workspace can use this board.</p>'}</div>
    ${edit?`<div class="bt-add"><select id="btAddWho" aria-label="Person"><option value="">Add a person…</option>${people.filter(u=>!members.some(m=>m.id===u.id)).map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select>
      <select id="btAddRole" aria-label="Role"><option value="member">Member</option><option value="admin">Admin</option><option value="viewer">Viewer</option></select><button type="button" class="btn" id="btAddGo">Add</button></div>`:''}
    <div class="bt-sub">Projects on this board</div>
    <div class="bt-list">${projs.length?projs.map(p=>`<div class="bt-mem"><span class="bt-key">${esc(p.key||'')}</span><span class="bt-nm">${esc(p.name)}</span>
        ${edit&&others.length?`<select data-move="${p.id}" aria-label="Move ${esc(p.name)} to another board"><option value="">Move to board…</option>${others.map(o=>`<option value="${o.id}">${esc(o.name)} (${boardTypeLabel(o)})</option>`).join('')}</select>`:''}</div>`).join('') : '<p class="bt-empty">No projects on this board yet.</p>'}</div>
    <p class="bt-foot">Viewers can open everything on the board but can’t change it. Board access is enforced by the database, not just hidden here.</p>`;
  const first=wrap.querySelector('.bs-wrap, .pagewrap > div, div');
  wrap.insertBefore(card, wrap.firstChild);
  const save=(patch,msg)=>{ store.updateBoard(b.id, patch); toast(msg); renderAll(); };
  card.querySelectorAll('[data-type]').forEach(btn=>btn.onclick=()=>{
    const t=btn.dataset.type; if(t===type) return;
    if(t==='kanban' && act.length){ toast(`Complete ${act[0].name} first — Kanban boards don’t have sprints`); return; }
    const msg = t==='kanban' ? `Switch ${b.name} to Kanban? Backlog and sprint views are hidden for this board; closed sprints stay in the history.` : `Switch ${b.name} to Scrum? It gets a backlog and sprints.`;
    if(!confirm(msg)) return;
    save({ type:t }, `${b.name} is now a ${t==='kanban'?'Kanban':'Scrum'} board`);
  });
  card.querySelectorAll('[data-access]').forEach(btn=>btn.onclick=()=>{
    const a=btn.dataset.access; if(a===access) return;
    if(a==='members' && !members.length && !confirm('No one is a board member yet, so only workspace owners and admins will see this board. Continue?')) return;
    save({ access:a }, a==='members' ? 'Only board members can see this board now' : 'Everyone in the workspace can see this board');
  });
  card.querySelectorAll('[data-role]').forEach(sel=>sel.onchange=()=>{ save({ members:members.map(m=>m.id===sel.dataset.role?Object.assign({},m,{role:sel.value}):m) }, 'Role updated'); });
  card.querySelectorAll('[data-remove]').forEach(x=>x.onclick=()=>{ save({ members:members.filter(m=>m.id!==x.dataset.remove) }, 'Removed from the board'); });
  const add=card.querySelector('#btAddGo'); if(add) add.onclick=()=>{
    const who=card.querySelector('#btAddWho').value, role=card.querySelector('#btAddRole').value;
    if(!who){ toast('Pick a person to add'); return; }
    save({ members:members.concat([{ id:who, role }]) }, `${(store.user(who)||{}).name||'Person'} added as ${role}`);
  };
  card.querySelectorAll('[data-move]').forEach(sel=>sel.onchange=()=>{
    const to=store.board(sel.value); const p=store.project(sel.dataset.move); if(!to||!p) return;
    if(!confirm(`Move ${p.name} to ${to.name}? Its epics and tickets go with it and keep their keys. Tickets in an open sprint on this board are taken out of that sprint.`)){ sel.value=''; return; }
    const n=store.moveProjectToBoard(p.id, to.id); toast(`${p.name} moved to ${to.name} (${n} ticket${n===1?'':'s'})`); renderAll();
  });
}

/* ---------------- flow reports (any board, made for Kanban) ---------------- */
function flowStatusAt(t, at, cols){
  const created=Date.parse(t.createdTs || ((t.createdAt||'1970-01-01')+'T00:00:00'));
  if(!(created<=at)) return null;
  const h=t.statusHistory||[];
  if(h.length){ let s=h[0].status; for(const e of h){ if(Date.parse(e.at)<=at) s=e.status; else break; } return s; }
  const done=cols.find(c=>c.cat==='done');
  if(t.resolvedTs && Date.parse(t.resolvedTs)<=at) return done ? done.id : t.status;
  const st=store.status(t.status);
  if(st && st.cat==='done') return (cols[0]||{}).id;
  return t.status;
}
function flowCycleDays(t){
  if(!t.resolvedTs) return null;
  const end=Date.parse(t.resolvedTs);
  const h=t.statusHistory||[];
  const startEv=h.find(e=>{ const s=store.status(e.status); return s && s.cat==='inprogress'; });
  const start=startEv ? Date.parse(startEv.at) : Date.parse(t.createdTs || ((t.createdAt||'1970-01-01')+'T00:00:00'));
  return Math.max(0, (end-start)/864e5);
}
function renderFlow(){
  sprCss(); boardCss();
  const el=document.getElementById('flowwrap'); if(!el) return;
  const b=activeBoard(); if(!b){ el.innerHTML='<div class="sr-empty">Create a board first.</div>'; return; }
  const cols=store.boardColumns(b);
  const tasks=store.allStandardTasks().filter(t=>!t.archived && t.type!=='Epic' && taskBoardId(t)===b.id);
  const D=864e5, now=Date.now(), days=30;
  const dayEnds=[]; for(let i=days-1;i>=0;i--){ const d=new Date(now-i*D); d.setHours(23,59,59,999); dayEnds.push(Math.min(d.getTime(), now)); }
  const series=dayEnds.map(at=>{ const c={}; cols.forEach(x=>c[x.id]=0); tasks.forEach(t=>{ const s=flowStatusAt(t, at, cols); if(s && s in c) c[s]++; }); return c; });
  // stacked area: done at the bottom, earlier columns on top
  const order=cols.slice().reverse();
  const W=900,H=300,L=40,R=12,T=12,B=34;
  const ymax=Math.max(1, ...series.map(c=>order.reduce((a,x)=>a+c[x.id],0)))*1.08;
  const X=i=>L+(W-L-R)*(i/(days-1)), Y=v=>T+(H-T-B)*(1-v/ymax);
  let g=''; const base=new Array(days).fill(0);
  order.forEach(col=>{
    const top=series.map((c,i)=>base[i]+c[col.id]);
    const pts=top.map((v,i)=>`${X(i)},${Y(v)}`).join(' ')+' '+base.map((v,i)=>`${X(days-1-i)},${Y(base[days-1-i])}`).join(' ');
    g+=`<polygon points="${pts}" fill="${col.color||'#999'}" fill-opacity=".78" stroke="${col.color||'#999'}" stroke-width="1"><title>${esc(col.name)}</title></polygon>`;
    top.forEach((v,i)=>base[i]=v);
  });
  for(let i=0;i<=4;i++){ const v=ymax/1.08*i/4, y=Y(v); g+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="#fff" stroke-opacity=".5"/><text x="${L-6}" y="${y+4}" text-anchor="end" font-size="11" fill="#71717A">${Math.round(v)}</text>`; }
  dayEnds.forEach((at,i)=>{ if(i%5 && i!==days-1) return; g+=`<text x="${X(i)}" y="${H-B+18}" text-anchor="middle" font-size="11" fill="#71717A">${esc(new Date(at).toLocaleDateString(undefined,{day:'numeric',month:'short'}))}</text>`; });
  const cfd=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative flow diagram">${g}</svg>`;
  // throughput per week (last 8 weeks)
  const weeks=[]; for(let i=7;i>=0;i--){ const end=now-i*7*D, start=end-7*D; weeks.push({ start, end, n:tasks.filter(t=>t.resolvedTs && Date.parse(t.resolvedTs)>start && Date.parse(t.resolvedTs)<=end).length }); }
  const tmax=Math.max(1,...weeks.map(w=>w.n))*1.15, TW=900, TH=200, TB=30;
  const bw=(TW-L-R)/weeks.length;
  let tg=''; weeks.forEach((w,i)=>{ const h=(TH-T-TB)*(w.n/tmax); tg+=`<rect x="${L+bw*i+bw*.22}" y="${TH-TB-h}" width="${bw*.56}" height="${h}" fill="#0E8F5A" rx="3"><title>${w.n} done</title></rect><text x="${L+bw*i+bw/2}" y="${TH-TB-h-5}" text-anchor="middle" font-size="11" fill="#3F3F3F">${w.n}</text><text x="${L+bw*i+bw/2}" y="${TH-TB+16}" text-anchor="middle" font-size="11" fill="#71717A">${esc(new Date(w.end).toLocaleDateString(undefined,{day:'numeric',month:'short'}))}</text>`; });
  const thr=`<svg viewBox="0 0 ${TW} ${TH}" role="img" aria-label="Weekly throughput">${tg}<line x1="${L}" x2="${TW-R}" y1="${TH-TB}" y2="${TH-TB}" stroke="#C8CCD4"/></svg>`;
  // cycle time
  const recent=tasks.filter(t=>t.resolvedTs && Date.parse(t.resolvedTs)>now-days*D).map(t=>({ t, d:flowCycleDays(t) })).filter(x=>x.d!=null).sort((a,b)=>a.d-b.d);
  const pct=p=>recent.length?recent[Math.min(recent.length-1, Math.floor(p*(recent.length-1)))].d:0;
  const avg=recent.length?recent.reduce((a,x)=>a+x.d,0)/recent.length:0;
  const fmtD=d=>d<1?`${Math.max(1,Math.round(d*24))}h`:`${Math.round(d*10)/10}d`;
  // WIP + ageing
  const open=tasks.filter(t=>{ const s=store.status(t.status); return s && s.cat!=='done'; });
  const ageOf=t=>{ const h=t.statusHistory||[]; const last=h.length?Date.parse(h[h.length-1].at):Date.parse(t.createdTs||((t.createdAt||'1970-01-01')+'T00:00:00')); return (now-last)/D; };
  const ageing=open.map(t=>({ t, a:ageOf(t) })).sort((a,b)=>b.a-a.a).slice(0,8);
  const wipMax=Math.max(1,...cols.filter(c=>c.cat!=='done').map(c=>open.filter(t=>t.status===c.id).length));
  el.innerHTML=`<div class="spr-page">
    <div class="spr-head"><div class="spr-title"><h2>Flow reports</h2></div><div class="spr-tools"><span class="tc-type ${boardType(b)}">${boardTypeLabel(b)}</span></div></div>
    ${!tasks.length?'<div class="sr-card sr-empty">No tickets on this board yet.</div>':`
    <div class="spr-stats">
      <div class="spr-stat"><b>${open.length}</b><span>work in progress</span></div>
      <div class="spr-stat"><b>${weeks[weeks.length-1].n}</b><span>done in the last 7 days</span></div>
      <div class="spr-stat"><b>${recent.length?fmtD(avg):'—'}</b><span>average cycle time</span></div>
      <div class="spr-stat"><b>${recent.length?fmtD(pct(.85)):'—'}</b><span>85% finish within</span></div>
    </div>
    <div class="sr-card"><h3>Cumulative flow</h3><p class="sr-sub">Tickets in each column over the last ${days} days. Widening bands mean work is piling up there.</p>
      <div class="sr-chart">${cfd}</div>
      <div class="sr-legend">${cols.map(c=>`<span><i style="background:${c.color};height:10px"></i>${esc(c.name)}</span>`).join('')}</div></div>
    <div class="fl-grid">
      <div class="sr-card"><h3>Throughput</h3><p class="sr-sub">Tickets finished per week.</p><div class="sr-chart">${thr}</div></div>
      <div class="sr-card"><h3>Work in progress by column</h3><p class="sr-sub">Right now.</p>
        ${cols.filter(c=>c.cat!=='done').map(c=>{ const n=open.filter(t=>t.status===c.id).length; return `<div class="fl-wip"><span>${esc(c.name)}</span><div class="fl-bar"><i style="width:${n/wipMax*100}%;background:${c.color}"></i></div><b>${n}</b></div>`; }).join('')}</div>
    </div>
    <div class="fl-grid">
      <div class="sr-card"><h3>Cycle time</h3><p class="sr-sub">From first “in progress” to done, tickets finished in the last ${days} days.</p>
        ${recent.length?`<div class="spr-stats"><div class="spr-stat"><b>${fmtD(pct(.5))}</b><span>median</span></div><div class="spr-stat"><b>${fmtD(pct(.85))}</b><span>85th percentile</span></div><div class="spr-stat"><b>${fmtD(recent[recent.length-1].d)}</b><span>slowest</span></div></div>
        <table class="sr-tbl"><thead><tr><th>Ticket</th><th class="num">Cycle time</th></tr></thead><tbody>${recent.slice(-5).reverse().map(x=>`<tr><td><span class="spr-key" data-open="${x.t.id}">${esc(x.t.key)}</span> ${esc(x.t.title)}</td><td class="num">${fmtD(x.d)}</td></tr>`).join('')}</tbody></table>`:'<p class="sr-sub" style="margin:0">Nothing finished in this period yet.</p>'}</div>
      <div class="sr-card"><h3>Ageing work</h3><p class="sr-sub">Open tickets that have sat longest in their current column.</p>
        ${ageing.length?`<table class="sr-tbl"><thead><tr><th>Ticket</th><th>Column</th><th class="num">Age</th></tr></thead><tbody>${ageing.map(x=>`<tr><td><span class="spr-key" data-open="${x.t.id}">${esc(x.t.key)}</span> ${esc(x.t.title)}</td><td>${sprLozenge(x.t)}</td><td class="num ${x.a>7?'inc':''}">${fmtD(x.a)}</td></tr>`).join('')}</tbody></table>`:'<p class="sr-sub" style="margin:0">No open tickets.</p>'}</div>
    </div>`}
  </div>`;
  el.querySelectorAll('[data-open]').forEach(k=>k.onclick=()=>openPanel(k.dataset.open));
}

/* ---------------- styles ---------------- */
function boardCss(){ /* styles live in css/ */ }

function boardMarkSeen(){ __lastBoardSeen=ui.board; __lastSpaceSeen=ui.space; }

async function boot(){
  wireChat();
  if(CONFIGURED && !window.supabase){
    if(new URLSearchParams(location.search).has('guest')){ enterGuest(); return; }
    authError('Can\u2019t reach the sign-in service. Check your connection and refresh, or sign in as a guest.');
    return;
  }
  if(REMOTE){
    sb=window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, { auth:{ storageKey:'taskora-auth' } });
    pmdb=sb;   // one project: auth, profiles and every workspace table
    try{ sb.auth.onAuthStateChange(function(event){
      if(event==='PASSWORD_RECOVERY'){ setTimeout(openRecoveryPassword, 400); }
      if(event==='SIGNED_OUT'){ try{ clearLocalAppData(); }catch(e){} location.reload(); }
    }); }catch(e){}
    const {data:{session}}=await sb.auth.getSession();
    if(session){
      ME=session.user;
      try{ const {data:pf}=await sb.from('profiles').select('avatar_url,email').eq('id',ME.id).maybeSingle(); if(pf){ ME_AVATAR=pf.avatar_url||null; if(pf.avatar_url&&pf.email){ try{ dpSet(pf.email,pf.avatar_url); }catch(e){} } } }catch(e){}
      await loadWorkspace(); if(goLogin._done) return; migrateProfiles(); renderAll();
    } else if(new URLSearchParams(location.search).has('guest')){ enterGuest(); }
    else { goLogin(); }
  } else {
    // No backend configured yet: show the sign-in page anyway. Guest sign-in works;
    // email sign-in explains that accounts aren't switched on.
    if(new URLSearchParams(location.search).has('guest')) enterGuest();
    else goLogin();
  }
  try{ wireNotifs(); scanDueSoon(); updateBell(); }catch(e){ __dbg.warn('notif init', e); }
}
boot();
