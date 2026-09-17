/* Taskora — 21-sprints-and-backlog.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ============================================================
   SPRINTS & BACKLOG — Scrum planning, modelled on Jira
   ------------------------------------------------------------
   Data
     sprints   {id, ws, board, name, goal, state:'future'|'active'|'closed',
                start, end (ISO), startedAt, completedAt, order, createdAt,
                committed:{ids, values{id:{p,h}}, count, points, hours},
                completed:{ids,count,points,hours}, incomplete:{…}, movedTo}
     tasks     .sprint   current (or last completed) sprint id
               .points   story points
               .rank     backlog order (lower = higher up)
               .sprintHistory [{sprint, action:'added'|'removed', at, by}]
   Views
     backlog        plan sprints, rank, estimate
     sprint         active sprint board
     sprintreports  burndown, velocity, sprint report
============================================================ */
const SPR = {
  sel: new Set(), lastClick: null, collapsed: {},
  q: '', assignees: new Set(), mine: false, recent: false, flagged: false,
  epic: 'all', type: 'all', version: 'all', panel: null, drag: null,
  boardGroup: 'none', boardSprint: null, boardQ: '', boardMine: false, boardFlagged: false, boardAssignees: new Set(),
  reportTab: 'burndown', reportSprint: null
};
const SPR_EST_KEY = 'taskora_sprint_estimation';
function sprStat(){ try{ return localStorage.getItem(SPR_EST_KEY) || 'points'; }catch(e){ return 'points'; } }
function sprSetStat(v){ try{ localStorage.setItem(SPR_EST_KEY, v); }catch(e){} }
function sprCfg(){ const s=store.settings(); return Object.assign({ parallel:false, defaultWeeks:2 }, s.sprintCfg||{}); }
const SPR_STAT_LABEL = { points:'Story points', count:'Issue count', hours:'Original estimate' };

/* ---------------- helpers ---------------- */
function sprD(v){ if(!v) return null; const d=new Date(String(v).length<=10 ? v+'T00:00:00' : v); return isNaN(d.getTime()) ? null : d; }
function sprDay(v){ const d=sprD(v); return d ? d.toLocaleDateString(undefined,{day:'numeric', month:'short'}) : ''; }
function sprDayTime(v){ const d=sprD(v); return d ? d.toLocaleString(undefined,{day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}) : ''; }
function sprInput(d){ const p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes()); }
function sprCat(t){ const s=store.status(t.status); return s ? s.cat : 'todo'; }
function sprIsDone(t){ return sprCat(t)==='done'; }
function sprEst(t, stat){ stat=stat||sprStat(); if(stat==='count') return 1; if(stat==='hours') return (Number(t.estimate)||0)/60; return Number(t.points)||0; }
function sprFmt(v, stat){ stat=stat||sprStat(); if(stat==='hours') return hm(Math.round(v*60)); if(stat==='count') return String(v); return String(Math.round(v*10)/10); }
function sprRank(t){ return (typeof t.rank==='number') ? t.rank : (Date.parse(t.createdTs || ((t.createdAt||'1970-01-01')+'T00:00:00')) || 0); }
function sprSortRank(a,b){ return sprRank(a)-sprRank(b); }
function sprBoardId(){ const b=activeBoard(); return b ? b.id : null; }
function sprTaskBoard(t){ return taskBoardId(t); }
function sprOfBoard(s){ return (s.board || (typeof boardlessAnchorId==='function' ? boardlessAnchorId() : null)); }
function sprNow(){ return new Date().toISOString(); }
function sprCanRank(){ return can('backlog_rank'); }
function sprCanManage(){ return can('sprint_manage'); }
function sprTypeColor(t){ const ty=(store.types()||[]).find(x=>x.id===t.type||x.name===t.type); return ty ? ty.color : '#8A8F98'; }
function sprPrioIcon(p){ const c=PRIORITIES[p]||'#8A8F98';
  const path = (p==='Highest'||p==='High') ? 'M12 19V5M5 12l7-7 7 7' : (p==='Low' ? 'M12 5v14M19 12l-7 7-7-7' : 'M5 9h14M5 15h14');
  return `<svg class="spr-prio" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-label="${esc(p||'')} priority"><title>${esc(p||'No priority')}</title><path d="${path}"/></svg>`; }
const SPR_IC = {
  flag:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 21V4h11l-1.5 4L16 12H7v9z"/></svg>',
  more:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  caret:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  grip:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>',
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
};

/* ---------------- store ---------------- */
Object.assign(store, {
  sprints(){ return this.data.sprints || (this.data.sprints=[]); },
  sprint(id){ return this.sprints().find(s=>s.id===id) || null; },
  boardSprints(bid){ const w=(ui.space||'ws_main'); return this.sprints().filter(s=>(s.ws||'ws_main')===w && sprOfBoard(s)===bid); },
  openSprints(bid){ return this.boardSprints(bid).filter(s=>s.state!=='closed')
    .sort((a,b)=>(a.state==='active'?0:1)-(b.state==='active'?0:1) || (a.order||0)-(b.order||0)); },
  activeSprints(bid){ return this.boardSprints(bid).filter(s=>s.state==='active'); },
  addSprint(bid, name){
    const mine=this.boardSprints(bid);
    const id='sp'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    const n=mine.length+1;
    const order=mine.reduce((m,s)=>Math.max(m, s.order||0), 0)+1;
    this.sprints().push({ id, ws:(ui.space||'ws_main'), board:bid, name:name||('Sprint '+n), goal:'', state:'future',
      start:null, end:null, order, createdAt:sprNow() });
    this._persist(); return id; },
  updateSprint(id, patch){ const s=this.sprint(id); if(s){ Object.assign(s, patch); this._persist(); } },
  removeSprint(id){
    this.tasksInSprint(id).forEach(t=>this.setTaskSprint(t.id, null, true));
    this.data.sprints=this.sprints().filter(s=>s.id!==id); this._persist(); },
  tasksInSprint(id){ return this.standardTasks().filter(t=>t.sprint===id && !t.archived).sort(sprSortRank); },
  backlogTasks(bid){
    return this.standardTasks().filter(t=>{
      if(t.archived || sprIsDone(t)) return false;
      if(bid && sprTaskBoard(t)!==bid) return false;
      if(!t.sprint) return true;
      const s=this.sprint(t.sprint);
      return !s || s.state==='closed';
    }).sort(sprSortRank); },
  setTaskSprint(taskId, sprintId, quiet){
    const t=this.task(taskId); if(!t) return;
    const from=t.sprint||null, to=sprintId||null;
    const fromS=from?this.sprint(from):null;
    if(from===to) return;
    const hist=(t.sprintHistory||[]).slice(); const at=sprNow(), by=this._actor();
    if(fromS && fromS.state!=='closed') hist.push({sprint:from, action:'removed', at, by});
    if(to) hist.push({sprint:to, action:'added', at, by});
    this.updateTask(taskId, { sprint:to, sprintHistory:hist });
  },
  _sprintSnap(ids){
    const values={}; let points=0, hours=0;
    ids.forEach(id=>{ const t=this.task(id); if(!t) return; const p=Number(t.points)||0, h=(Number(t.estimate)||0)/60; values[id]={p,h}; points+=p; hours+=h; });
    return { ids:ids.slice(), values, count:ids.length, points, hours }; },
  startSprint(id, o){
    const s=this.sprint(id); if(!s) return;
    const ids=this.tasksInSprint(id).map(t=>t.id);
    Object.assign(s, { name:o.name||s.name, goal:o.goal||'', start:o.start, end:o.end, state:'active', startedAt:sprNow(), committed:this._sprintSnap(ids) });
    this._persist(); },
  completeSprint(id, target){
    const s=this.sprint(id); if(!s) return null;
    const tasks=this.tasksInSprint(id);
    const done=tasks.filter(sprIsDone), open=tasks.filter(t=>!sprIsDone(t));
    let dest=null;
    if(target==='new'){ dest=this.addSprint(sprOfBoard(s)); }
    else if(target && target!=='backlog'){ dest=target; }
    const snap=this._sprintSnap(done.map(t=>t.id)); delete snap.values;
    const inc=this._sprintSnap(open.map(t=>t.id)); delete inc.values;
    Object.assign(s, { state:'closed', completedAt:sprNow(), completed:snap, incomplete:inc, movedTo:dest||'backlog' });
    let base=dest ? Math.min(0, ...this.tasksInSprint(dest).map(sprRank)) : Math.min(0, ...this.backlogTasks(sprOfBoard(s)).map(sprRank));
    open.forEach((t,i)=>{ this.setTaskSprint(t.id, dest, true); this.updateTask(t.id, { rank: base - 1000*(open.length-i) }); });
    this._persist();
    return { done:done.length, open:open.length, dest }; }
});

/* ---------------- shared bits ---------------- */
function sprCss(){ /* styles live in css/ */ }

function sprMenu(anchor, items){
  document.querySelectorAll('.spr-menu').forEach(m=>m.remove());
  const m=document.createElement('div'); m.className='spr-menu'; m.setAttribute('role','menu');
  m.innerHTML=items.map((it,i)=> it.sep ? '<hr>' : it.head ? `<div class="h">${esc(it.head)}</div>`
    : `<button role="menuitem" data-i="${i}" class="${it.danger?'danger':''}" ${it.disabled?'disabled':''}>${esc(it.label)}</button>`).join('');
  document.body.appendChild(m);
  const r=anchor.getBoundingClientRect();
  const w=m.offsetWidth, h=m.offsetHeight;
  m.style.left=Math.max(8, Math.min(window.innerWidth-w-8, r.right-w))+'px';
  m.style.top=(r.bottom+h+8>window.innerHeight ? Math.max(8, r.top-h-4) : r.bottom+4)+'px';
  m.querySelectorAll('button[data-i]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); m.remove(); const it=items[+b.dataset.i]; if(it && it.act) it.act(); });
  setTimeout(()=>{ const off=e=>{ if(!m.contains(e.target)){ m.remove(); document.removeEventListener('mousedown', off, true); } }; document.addEventListener('mousedown', off, true); }, 0);
}
function sprBoardSelect(id){
  const bs=store.boards(); const cur=sprBoardId();
  return bs.length>1 ? `<select class="spr-sel" id="${id}" aria-label="Board">${bs.map(b=>`<option value="${b.id}" ${b.id===cur?'selected':''}>${esc(b.name)}</option>`).join('')}</select>` : '';
}
function sprWireBoardSelect(id, rerender){ const el=document.getElementById(id); if(el) el.onchange=()=>{ ui.board=el.value; SPR.sel.clear(); rerender(); try{ urlSync(); }catch(e){} }; }
function sprDates(s){
  if(!s.start && !s.end) return '';
  return `${sprDay(s.start)} – ${sprDay(s.end)}`;
}
function sprPills(tasks){
  const stat=sprStat(); const sum={todo:0,inprogress:0,done:0};
  tasks.forEach(t=>{ const c=sprCat(t); sum[c in sum?c:'todo']+=sprEst(t,stat); });
  return `<div class="spr-pills" title="${esc(SPR_STAT_LABEL[stat])}: to do, in progress, done">
    <span class="spr-pill todo">${sprFmt(sum.todo)}</span><span class="spr-pill inprogress">${sprFmt(sum.inprogress)}</span><span class="spr-pill done">${sprFmt(sum.done)}</span></div>`;
}
function sprAddedAfterStart(t, s){
  if(!s || !s.startedAt) return false;
  const st=sprD(s.startedAt);
  return (t.sprintHistory||[]).some(h=>h.sprint===s.id && h.action==='added' && sprD(h.at)>st);
}
function sprLozenge(t){ const st=store.status(t.status); const c=sprCat(t); return `<span class="spr-lz ${c}">${esc(st?st.name:t.status||'')}</span>`; }
function sprEpicTag(t){ const ep=t.parent?store.task(t.parent):null; if(!ep) return '';
  const c=ep.color||'#7C3AED'; return `<span class="spr-epic" style="background:${c}1F;color:${c}" title="Epic: ${esc(ep.title)}">${esc(ep.title)}</span>`; }

/* ---------------- backlog ---------------- */
function sprFilter(t){
  if(SPR.q){ const q=SPR.q.toLowerCase(); if(!((t.title||'').toLowerCase().includes(q) || (t.key||'').toLowerCase().includes(q))) return false; }
  if(SPR.assignees.size && !SPR.assignees.has(t.assignee||'__none')) return false;
  if(SPR.mine && t.assignee!==myUid()) return false;
  if(SPR.flagged && !t.flagged) return false;
  if(SPR.recent){ const y=new Date(Date.now()-864e5); if((t.updatedAt||'') < _isoLocal(y)) return false; }
  if(SPR.epic!=='all'){ if(SPR.epic==='none'){ if(t.parent) return false; } else if(t.parent!==SPR.epic) return false; }
  if(SPR.version!=='all'){ if(SPR.version==='none'){ if(t.release) return false; } else if(t.release!==SPR.version) return false; }
  if(SPR.type!=='all' && t.type!==SPR.type) return false;
  return true;
}
function sprRow(t, s){
  const u=store.user(t.assignee);
  const drag=sprCanRank();
  const pts=t.points!=null && t.points!=='' ? String(t.points) : '–';
  return `<div class="spr-row ${SPR.sel.has(t.id)?'sel':''}" data-id="${t.id}" ${drag?'draggable="true"':''} role="row" aria-selected="${SPR.sel.has(t.id)}">
    <span class="spr-grip">${drag?SPR_IC.grip:''}</span>
    <span class="spr-type" style="background:${sprTypeColor(t)}" title="${esc(t.type||'')}">${esc((t.type||'?')[0].toUpperCase())}</span>
    <span class="spr-key" data-open>${esc(t.key||'')}</span>
    <span class="spr-sum" data-open>${esc(t.title||'')}${s && s.state==='active' && sprAddedAfterStart(t,s) ? '<span class="spr-star" title="Added after the sprint started">*</span>' : ''}</span>
    ${sprEpicTag(t)}
    ${t.flagged?`<span class="spr-flag" title="Flagged">${SPR_IC.flag}</span>`:''}
    ${sprLozenge(t)}
    ${sprPrioIcon(t.priority)}
    <span class="spr-av">${u?avatar(u,22):''}</span>
    <button class="spr-pts ${pts==='–'?'none':''}" data-pts title="Story points" ${can('field_points')?'':'disabled'}>${esc(pts)}</button>
    <button class="spr-more" data-more aria-label="Actions for ${esc(t.key||'')}">${SPR_IC.more}</button>
  </div>`;
}
function sprBox(kind, s, tasks, bid){
  const id = kind==='backlog' ? 'backlog' : s.id;
  const visible = tasks.filter(sprFilter);
  const filtered = visible.length!==tasks.length;
  const collapsed = !!SPR.collapsed[id];
  const manage = sprCanManage();
  const count = filtered ? `${visible.length} of ${tasks.length} issues` : `${tasks.length} issue${tasks.length===1?'':'s'}`;
  let title, actions='', goal='';
  if(kind==='backlog'){
    title = `<b>Backlog</b><span class="c">${count}</span>`;
    actions = manage ? `<button class="btn" data-act="create-sprint">Create sprint</button>` : '';
  } else {
    const state = s.state==='active' ? '<span class="spr-state active">Active</span>' : '';
    title = `<b>${esc(s.name)}</b>${state}<span class="d">${esc(sprDates(s))}</span><span class="c">${count}</span>`;
    if(manage){
      const blocked = s.state==='future' && !sprCfg().parallel && store.activeSprints(bid).length>0;
      const firstFuture = store.openSprints(bid).find(x=>x.state==='future');
      if(s.state==='active') actions += `<button class="btn" data-act="complete" data-sid="${s.id}">Complete sprint</button>`;
      else if(firstFuture && firstFuture.id===s.id || sprCfg().parallel) actions += `<button class="btn ${blocked?'':'primary'}" data-act="start" data-sid="${s.id}" ${blocked?'title="Complete the active sprint first, or turn on parallel sprints"':''}>Start sprint</button>`;
      actions += `<button class="spr-more" data-act="sprint-menu" data-sid="${s.id}" aria-label="Sprint actions">${SPR_IC.more}</button>`;
    }
    if(s.goal) goal = `<div class="spr-goal"><span>Goal:</span> ${esc(s.goal)}</div>`;
  }
  const rows = visible.map(t=>sprRow(t, s)).join('');
  const empty = !tasks.length ? `<div class="spr-empty">${kind==='backlog' ? 'Your backlog is empty. Create tickets below, or finish planning.' : 'Plan this sprint by dragging tickets here from the backlog.'}</div>` : '';
  return `<section class="spr-box ${kind==='backlog'?'backlog':s.state} ${collapsed?'collapsed':''}" data-cont="${id}">
    <header class="spr-bh">
      <button class="spr-caret" data-act="toggle" data-cid="${id}" aria-label="${collapsed?'Expand':'Collapse'}" aria-expanded="${!collapsed}">${SPR_IC.caret}</button>
      <div class="spr-bt">${title}</div>
      ${sprPills(tasks)}
      <div class="spr-bacts">${actions}</div>
    </header>
    ${goal}
    <div class="spr-list" data-drop="${id}">${rows}${empty}</div>
    ${can('ticket_create') ? `<div class="spr-create" data-create="${id}"><button class="spr-create-btn" data-act="create-issue" data-cid="${id}">${SPR_IC.plus} Create ticket</button></div>` : ''}
  </section>`;
}
function sprPanel(bid){
  if(!SPR.panel) return '';
  const all = store.standardTasks().filter(t=>!t.archived && sprTaskBoard(t)===bid);
  if(SPR.panel==='epics'){
    const eps = store.epics().filter(e=>all.some(t=>t.parent===e.id) || sprTaskBoard(e)===bid);
    const item=(v,label,color,kids)=>{ const done=kids.filter(sprIsDone).length; const pct=kids.length?Math.round(done/kids.length*100):0;
      return `<button class="spr-pitem ${SPR.epic===v?'on':''}" data-epic="${v}">${color?`<i style="background:${color}"></i>`:''}<span>${esc(label)}</span><span class="n">${kids.length}</span></button>${kids.length?`<div class="spr-pbar" title="${pct}% done"><b style="width:${pct}%"></b></div>`:''}`; };
    return `<aside class="spr-panel"><h4>Epics</h4>
      <button class="spr-pitem ${SPR.epic==='all'?'on':''}" data-epic="all">All tickets</button>
      ${eps.map(e=>item(e.id, e.title, e.color||'#7C3AED', all.filter(t=>t.parent===e.id))).join('')}
      ${item('none','Tickets without epic',null, all.filter(t=>!t.parent))}</aside>`;
  }
  const rels = store.releases();
  const item=(v,label,kids)=>`<button class="spr-pitem ${SPR.version===v?'on':''}" data-version="${v}"><span>${esc(label)}</span><span class="n">${kids.length}</span></button>`;
  return `<aside class="spr-panel"><h4>Versions</h4>
    <button class="spr-pitem ${SPR.version==='all'?'on':''}" data-version="all">All tickets</button>
    ${rels.map(r=>item(r.id, r.name+(r.status==='released'?' (released)':''), all.filter(t=>t.release===r.id))).join('')}
    ${item('none','Tickets without version', all.filter(t=>!t.release))}</aside>`;
}
function renderBacklog(){
  sprCss();
  const el=document.getElementById('backlogwrap');
  const board=activeBoard();
  if(!board){ el.innerHTML='<div class="sr-empty">Create a board first — sprints belong to a board.</div>'; return; }
  const bid=board.id;
  const open=store.openSprints(bid);
  const backlog=store.backlogTasks(bid);
  const onBoard=open.flatMap(s=>store.tasksInSprint(s.id)).concat(backlog);
  const people=[...new Set(onBoard.map(t=>t.assignee).filter(Boolean))].map(id=>store.user(id)).filter(Boolean).slice(0,8);
  const stat=sprStat();
  const types=(store.types()||[]).filter(x=>x.id!=='Epic');
  const epics=store.epics();
  el.innerHTML=`<div class="spr-page">
    <div class="spr-head">
      <div class="spr-title"><h2>Backlog</h2>${sprBoardSelect('sprBoard')}</div>
      <div class="spr-tools">
        <input class="spr-search" id="sprQ" type="search" placeholder="Search backlog" value="${esc(SPR.q)}" aria-label="Search backlog"/>
        ${people.length?`<div class="spr-avs">${people.map(u=>`<button data-av="${u.id}" class="${SPR.assignees.has(u.id)?'on':''}" title="${esc(u.name)}">${avatar(u,26)}</button>`).join('')}</div>`:''}
        <button class="spr-chip ${SPR.mine?'on':''}" data-chip="mine">Only my issues</button>
        <button class="spr-chip ${SPR.recent?'on':''}" data-chip="recent">Recently updated</button>
        <button class="spr-chip ${SPR.flagged?'on':''}" data-chip="flagged">Flagged</button>
        <select class="spr-sel" id="sprEpic" aria-label="Epic"><option value="all">All epics</option><option value="none" ${SPR.epic==='none'?'selected':''}>No epic</option>${epics.map(e=>`<option value="${e.id}" ${SPR.epic===e.id?'selected':''}>${esc(e.title)}</option>`).join('')}</select>
        <select class="spr-sel" id="sprType" aria-label="Type"><option value="all">All types</option>${types.map(x=>`<option value="${esc(x.id)}" ${SPR.type===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
        <button class="spr-chip ${SPR.panel==='epics'?'on':''}" data-panel="epics">Epics</button>
        <button class="spr-chip ${SPR.panel==='versions'?'on':''}" data-panel="versions">Versions</button>
        <select class="spr-sel" id="sprStat" aria-label="Estimation">${Object.entries(SPR_STAT_LABEL).map(([k,v])=>`<option value="${k}" ${stat===k?'selected':''}>${v}</option>`).join('')}</select>
        ${IS_ADMIN?`<button class="spr-ibtn" id="sprCfg" title="Sprint settings" aria-label="Sprint settings">${SPR_IC.gear}</button>`:''}
      </div>
    </div>
    <div class="spr-body ${SPR.panel?'with-panel':''}">
      ${sprPanel(bid)}
      <div class="spr-main">
        ${open.map(s=>sprBox('sprint', s, store.tasksInSprint(s.id), bid)).join('')}
        ${sprBox('backlog', null, backlog, bid)}
      </div>
    </div>
  </div>
  <div id="sprBulk"></div>`;
  sprWireBacklog(el, bid);
  sprPaintBulk(bid);
}
function sprWireBacklog(el, bid){
  const rer=()=>renderBacklog();
  sprWireBoardSelect('sprBoard', rer);
  const q=document.getElementById('sprQ'); if(q){ q.oninput=()=>{ SPR.q=q.value; const pos=q.selectionStart; rer(); const n=document.getElementById('sprQ'); if(n){ n.focus(); n.setSelectionRange(pos,pos); } }; }
  el.querySelectorAll('[data-av]').forEach(b=>b.onclick=()=>{ const v=b.dataset.av; SPR.assignees.has(v)?SPR.assignees.delete(v):SPR.assignees.add(v); rer(); });
  el.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>{ SPR[b.dataset.chip]=!SPR[b.dataset.chip]; rer(); });
  el.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>{ SPR.panel = SPR.panel===b.dataset.panel ? null : b.dataset.panel; rer(); });
  el.querySelectorAll('[data-epic]').forEach(b=>b.onclick=()=>{ SPR.epic=b.dataset.epic; rer(); });
  el.querySelectorAll('[data-version]').forEach(b=>b.onclick=()=>{ SPR.version=b.dataset.version; rer(); });
  const ep=document.getElementById('sprEpic'); if(ep) ep.onchange=()=>{ SPR.epic=ep.value; rer(); };
  const ty=document.getElementById('sprType'); if(ty) ty.onchange=()=>{ SPR.type=ty.value; rer(); };
  const stt=document.getElementById('sprStat'); if(stt) stt.onchange=()=>{ sprSetStat(stt.value); rer(); };
  const cfg=document.getElementById('sprCfg'); if(cfg) cfg.onclick=()=>sprOpenSettings();

  el.querySelectorAll('[data-act]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const a=b.dataset.act, sid=b.dataset.sid;
    if(a==='toggle'){ SPR.collapsed[b.dataset.cid]=!SPR.collapsed[b.dataset.cid]; rer(); }
    else if(a==='create-sprint'){ const id=store.addSprint(bid); toast(store.sprint(id).name+' created'); rer(); }
    else if(a==='start') sprOpenStart(sid);
    else if(a==='complete') sprOpenComplete(sid);
    else if(a==='sprint-menu') sprSprintMenu(b, sid, bid);
    else if(a==='create-issue') sprInlineCreate(b.closest('.spr-create'), b.dataset.cid, bid);
  });

  // rows: open, select, points, menu
  el.querySelectorAll('.spr-row').forEach(row=>{
    const id=row.dataset.id;
    row.addEventListener('click', e=>{
      if(e.target.closest('[data-pts],[data-more]')) return;
      if(e.target.closest('[data-open]') && !(e.metaKey||e.ctrlKey||e.shiftKey)){ openPanel(id); return; }
      sprSelectClick(id, e); });
    const pb=row.querySelector('[data-pts]'); if(pb) pb.onclick=e=>{ e.stopPropagation(); sprEditPoints(pb, id); };
    const mb=row.querySelector('[data-more]'); if(mb) mb.onclick=e=>{ e.stopPropagation(); sprRowMenu(mb, id, bid); };
    if(row.draggable){
      row.addEventListener('dragstart', e=>{
        if(!SPR.sel.has(id)){ SPR.sel.clear(); SPR.sel.add(id); }
        SPR.drag=[...SPR.sel];
        try{ e.dataTransfer.setData('text/plain', SPR.drag.join(',')); e.dataTransfer.effectAllowed='move'; }catch(_){}
        requestAnimationFrame(()=>el.querySelectorAll('.spr-row').forEach(r=>{ if(SPR.drag.includes(r.dataset.id)) r.classList.add('dragging'); }));
      });
      row.addEventListener('dragend', ()=>{ SPR.drag=null; el.querySelectorAll('.dragging,.ins-before').forEach(r=>r.classList.remove('dragging','ins-before')); el.querySelectorAll('.ins-end,.drop-over').forEach(l=>l.classList.remove('ins-end','drop-over')); });
    }
  });
  el.querySelectorAll('.spr-box').forEach(box=>{
    const list=box.querySelector('.spr-list'); const cont=box.dataset.cont;
    const clear=()=>{ list.querySelectorAll('.ins-before').forEach(r=>r.classList.remove('ins-before')); list.classList.remove('ins-end','drop-over'); };
    const over=e=>{ if(!SPR.drag) return; e.preventDefault(); clear(); list.classList.add('drop-over');
      const after=sprAfterRow(list, e.clientY); if(after) after.classList.add('ins-before'); else list.classList.add('ins-end'); };
    box.addEventListener('dragover', over);
    box.addEventListener('dragleave', e=>{ if(!box.contains(e.relatedTarget)) clear(); });
    box.addEventListener('drop', e=>{ if(!SPR.drag) return; e.preventDefault();
      const after = list.contains(e.target) || e.target===list ? sprAfterRow(list, e.clientY) : null;
      const ids=SPR.drag; clear(); SPR.drag=null;
      sprMove(ids, cont, after?after.dataset.id:null); SPR.sel.clear(); rer(); });
  });
}
function sprAfterRow(list, y){
  const rows=[...list.querySelectorAll('.spr-row:not(.dragging)')];
  return rows.find(r=>{ const b=r.getBoundingClientRect(); return y < b.top + b.height/2; }) || null;
}
function sprSelectClick(id, e){
  const rows=[...document.querySelectorAll('#backlogwrap .spr-row')].map(r=>r.dataset.id);
  if(e.shiftKey && SPR.lastClick && rows.includes(SPR.lastClick)){
    const a=rows.indexOf(SPR.lastClick), b=rows.indexOf(id);
    rows.slice(Math.min(a,b), Math.max(a,b)+1).forEach(x=>SPR.sel.add(x));
  } else if(e.metaKey || e.ctrlKey){
    SPR.sel.has(id) ? SPR.sel.delete(id) : SPR.sel.add(id); SPR.lastClick=id;
  } else {
    const only = SPR.sel.size===1 && SPR.sel.has(id);
    SPR.sel.clear(); if(!only) SPR.sel.add(id); SPR.lastClick=id;
  }
  document.querySelectorAll('#backlogwrap .spr-row').forEach(r=>{ const on=SPR.sel.has(r.dataset.id); r.classList.toggle('sel', on); r.setAttribute('aria-selected', on); });
  sprPaintBulk(sprBoardId());
}
/* Move tickets into a container (sprint id or 'backlog'), before a given row. */
function sprMove(ids, cont, beforeId){
  if(!sprCanRank()){ toast('You don’t have permission to rank tickets'); return; }
  const s = cont==='backlog' ? null : store.sprint(cont);
  if(cont!=='backlog' && (!s || s.state==='closed')) return;
  const bid = s ? sprOfBoard(s) : sprBoardId();
  const moving = ids.map(id=>store.task(id)).filter(Boolean).sort(sprSortRank);
  const movingIds = new Set(moving.map(t=>t.id));
  const target = (s ? store.tasksInSprint(s.id) : store.backlogTasks(bid)).filter(t=>!movingIds.has(t.id));
  let idx = beforeId ? target.findIndex(t=>t.id===beforeId) : target.length; if(idx<0) idx=target.length;
  const prev=target[idx-1], next=target[idx];
  const n=moving.length;
  let lo, hi;
  if(prev && next){ lo=sprRank(prev); hi=sprRank(next); }
  else if(prev){ lo=sprRank(prev); hi=lo+1000*(n+1); }
  else if(next){ hi=sprRank(next); lo=hi-1000*(n+1); }
  else { lo=Date.now(); hi=lo+1000*(n+1); }
  const step=(hi-lo)/(n+1);
  moving.forEach((t,i)=>{
    const want = s ? s.id : null;
    if((t.sprint||null)!==want){
      const cur = t.sprint ? store.sprint(t.sprint) : null;
      if(!want && cur && cur.state==='closed'){ /* already in the backlog */ }
      else store.setTaskSprint(t.id, want);
    }
    store.updateTask(t.id, { rank: lo + step*(i+1) });
  });
  if(n) toast(n===1 ? `${moving[0].key} moved to ${s?s.name:'Backlog'}` : `${n} tickets moved to ${s?s.name:'Backlog'}`);
}
function sprMoveEdge(ids, cont, edge){
  const s = cont==='backlog' ? null : store.sprint(cont);
  const list = s ? store.tasksInSprint(s.id) : store.backlogTasks(sprBoardId());
  const others = list.filter(t=>!ids.includes(t.id));
  sprMove(ids, cont, edge==='top' && others.length ? others[0].id : null);
}
function sprRowMenu(anchor, id, bid){
  const t=store.task(id); if(!t) return;
  const ids = SPR.sel.has(id) ? [...SPR.sel] : [id];
  const rank=sprCanRank();
  const cur = t.sprint ? store.sprint(t.sprint) : null;
  const inSprint = cur && cur.state!=='closed';
  const items=[{ label:'Open ticket', act:()=>openPanel(id) }, {sep:true}];
  if(ids.length>1) items.push({ head:`${ids.length} selected` });
  items.push({ head:'Move to' });
  store.openSprints(bid).forEach(s=>{ if(!inSprint || s.id!==cur.id) items.push({ label:s.name+(s.state==='active'?' (active)':''), disabled:!rank, act:()=>{ sprMove(ids, s.id, null); SPR.sel.clear(); renderBacklog(); } }); });
  if(inSprint) items.push({ label:'Backlog', disabled:!rank, act:()=>{ sprMove(ids, 'backlog', null); SPR.sel.clear(); renderBacklog(); } });
  const container = inSprint ? cur.id : 'backlog';
  items.push({ label:'Top of '+(inSprint?cur.name:'backlog'), disabled:!rank, act:()=>{ sprMoveEdge(ids, container, 'top'); renderBacklog(); } });
  items.push({ label:'Bottom of '+(inSprint?cur.name:'backlog'), disabled:!rank, act:()=>{ sprMoveEdge(ids, container, 'bottom'); renderBacklog(); } });
  items.push({sep:true});
  items.push({ label:t.flagged?'Remove flag':'Add flag', disabled:!can('ticket_flag'), act:()=>{ ids.forEach(x=>store.updateTask(x,{flagged:!t.flagged})); renderBacklog(); } });
  sprMenu(anchor, items);
}
function sprSprintMenu(anchor, sid, bid){
  const s=store.sprint(sid); if(!s) return;
  const fut=store.openSprints(bid).filter(x=>x.state==='future');
  const i=fut.findIndex(x=>x.id===sid);
  const swap=(j)=>{ const o=fut[j]; if(!o) return; const a=s.order||0, b=o.order||0; store.updateSprint(s.id,{order:b}); store.updateSprint(o.id,{order:a===b?b-1:a}); renderBacklog(); };
  sprMenu(anchor, [
    { label:'Edit sprint', act:()=>sprOpenEdit(sid) },
    ...(s.state==='future' ? [{ label:'Move sprint up', disabled:i<=0, act:()=>swap(i-1) }, { label:'Move sprint down', disabled:i<0||i>=fut.length-1, act:()=>swap(i+1) }] : []),
    { label:'View sprint report', disabled:s.state==='future', act:()=>{ SPR.reportSprint=sid; SPR.reportTab='report'; setView('sprintreports'); } },
    {sep:true},
    { label:'Delete sprint', danger:true, act:()=>confirmDelete({ title:'Delete sprint', lead:`Delete <b>${esc(s.name)}</b>? Its tickets move back to the backlog.`, confirmLabel:'Delete sprint',
      onConfirm:()=>{ store.removeSprint(sid); renderBacklog(); toast('Sprint deleted'); } }) }
  ]);
}
function sprEditPoints(btn, id){
  if(!can('field_points')) return;
  const t=store.task(id); if(!t) return;
  const inp=document.createElement('input'); inp.type='number'; inp.min='0'; inp.step='0.5'; inp.className='spr-pts-in'; inp.value=(t.points!=null?t.points:'');
  inp.setAttribute('aria-label','Story points for '+(t.key||''));
  btn.replaceWith(inp); inp.focus(); inp.select();
  let done=false;
  const save=(commit)=>{ if(done) return; done=true;
    if(commit){ const v=inp.value.trim(); const n=v===''?null:Math.max(0, Math.round(parseFloat(v)*2)/2);
      if(!(n!==null && isNaN(n)) && n!==(t.points??null)) store.updateTask(id, { points:n }); }
    renderBacklog(); };
  inp.onkeydown=e=>{ if(e.key==='Enter') save(true); if(e.key==='Escape') save(false); e.stopPropagation(); };
  inp.onblur=()=>save(true);
  inp.onclick=e=>e.stopPropagation();
}
function sprPaintBulk(bid){
  const host=document.getElementById('sprBulk'); if(!host) return;
  const ids=[...SPR.sel].filter(id=>store.task(id));
  if(ids.length<2){ host.innerHTML=''; return; }
  const open=store.openSprints(bid);
  host.innerHTML=`<div class="spr-bulk" role="toolbar" aria-label="Bulk actions">
    <span>${ids.length} selected</span>
    ${sprCanRank()?`<select id="sprBulkMove" aria-label="Move selected"><option value="">Move to…</option>${open.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}<option value="backlog">Backlog</option></select>`:''}
    ${can('field_points')?`<input id="sprBulkPts" type="number" min="0" step="0.5" placeholder="Points" aria-label="Set story points"/>`:''}
    ${can('ticket_flag')?'<button id="sprBulkFlag">Flag</button>':''}
    <button id="sprBulkClear">Clear</button></div>`;
  const mv=document.getElementById('sprBulkMove'); if(mv) mv.onchange=()=>{ if(!mv.value) return; sprMove(ids, mv.value, null); SPR.sel.clear(); renderBacklog(); };
  const pt=document.getElementById('sprBulkPts'); if(pt) pt.onkeydown=e=>{ if(e.key!=='Enter') return; const n=pt.value===''?null:Math.max(0, parseFloat(pt.value)); ids.forEach(id=>store.updateTask(id,{points:isNaN(n)?null:n})); toast('Story points updated'); renderBacklog(); };
  const fl=document.getElementById('sprBulkFlag'); if(fl) fl.onclick=()=>{ const all=ids.every(id=>store.task(id).flagged); ids.forEach(id=>store.updateTask(id,{flagged:!all})); renderBacklog(); };
  document.getElementById('sprBulkClear').onclick=()=>{ SPR.sel.clear(); renderBacklog(); };
}
async function sprInlineCreate(host, cont, bid){
  if(!host) return;
  const board=store.board(bid);
  const projects=store.projects().filter(p=>store.projectBoardId(p)===bid);
  const pid = (ui.project && ui.project!=='all' && projects.some(p=>p.id===ui.project)) ? ui.project : (projects[0]&&projects[0].id);
  if(!pid){ toast('Add a project to this board first — ticket keys come from the project'); openModal(); return; }
  const types=(store.types()||[]).filter(x=>x.id!=='Epic');
  host.innerHTML=`<div class="spr-create-form">
    <select class="spr-sel" aria-label="Type">${types.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select>
    ${projects.length>1?`<select class="spr-sel" aria-label="Project">${projects.map(p=>`<option value="${p.id}" ${p.id===pid?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`:''}
    <input type="text" placeholder="What needs to be done?" aria-label="Ticket summary" maxlength="255"/>
  </div>`;
  const [typeSel, projSel] = host.querySelectorAll('select');
  const inp=host.querySelector('input'); inp.focus();
  const cols=store.boardColumns(board||{});
  const status=(cols.find(c=>c.cat==='todo')||cols[0]||store.data.statuses[0]||{}).id;
  let busy=false;
  const create=async()=>{
    const title=inp.value.trim(); if(!title || busy) return; busy=true; inp.disabled=true;
    try{
      const proj = projSel ? projSel.value : pid;
      const key=await allocateKey(proj);
      const s = cont==='backlog' ? null : store.sprint(cont);
      const list = s ? store.tasksInSprint(s.id) : store.backlogTasks(bid);
      const rank = list.length ? sprRank(list[list.length-1])+1000 : Date.now();
      const prios=Object.keys(PRIORITIES);
      const t={ id:newTaskId('t'), ws:(ui.space||'ws_main'), board:bid, project:proj, key, title, type:typeSel.value, status,
        priority: prios.includes('Medium') ? 'Medium' : prios[0], assignee:null, reporter:myUid(),
        parent:(SPR.epic!=='all'&&SPR.epic!=='none')?SPR.epic:null, due:null, start:null, estimate:null,
        resolution:'Unresolved', createdAt:today(), createdTs:new Date().toISOString(), updatedAt:today(), resolvedAt:null, desc:'',
        sprint:null, rank, points:null, sprintHistory:[] };
      store._applyResolution(t); store.addTask(t);
      if(s) store.setTaskSprint(t.id, s.id);
      toast(key+' created');
      renderBacklog();
      const again=document.querySelector(`#backlogwrap [data-create="${cont}"] [data-act="create-issue"]`); if(again) again.click();
    }catch(e){ toast('Couldn’t create the ticket: '+((e&&e.message)||'error')); busy=false; inp.disabled=false; }
  };
  inp.onkeydown=e=>{ if(e.key==='Enter') create(); if(e.key==='Escape') renderBacklog(); };
  inp.onblur=()=>setTimeout(()=>{ if(!busy && !host.contains(document.activeElement) && !inp.value.trim()) renderBacklog(); }, 150);
}
