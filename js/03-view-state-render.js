/* Taskora — 03-view-state-render.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ============================================================
   VIEW STATE + RENDER
============================================================ */
const ui = { view:'overview', space:null, project:'all', openTask:null, board:'main', groupBy:'none', analyticsTab:'productivity', anPeriod:'all', anFrom:'', anTo:'', ovRange:'all', ovFrom:'', ovTo:'', prSel:[], prQuery:'', prRows:10, dlSel:null, dlQuery:'', piSel:null, piQuery:'', setSel:null, epSel:null, epQuery:'',
  chat:{ open:false, channel:'ch_general', editing:null, newGroup:false, seen:{} },
  depFilter:{ mode:'all', from:'', to:'', project:'all', priority:'all', assignee:'all', verified:'all' },
  qaFilter:{ project:'all', priority:'all', qa:'all', status:'all' },
  listBoard:'all', listGroup:'none', projBoard:'all',
  report:{ kind:'summary', groupBy:'assignee', measure:'count',
    fields:['key','title','status','priority','assignee','due','logged'],
    f:{ project:'all', assignee:'all', status:'all', priority:'all', type:'all', epic:'all', hasTime:'any', overdue:'any', dateField:'none', from:'', to:'' } },
  filters:{search:'', assignee:'all', status:'all', priority:'all', type:'all', time:'all', epic:'all', period:'all', from:'', to:''} };
function activeBoard(){ return store.board(ui.board) || (store.boards()&&store.boards()[0]) || null; }
function allowedTargets(b, from){ return (b.transitions&&b.transitions[from])||[]; }
function canMove(b, from, to){ if(from===to) return true; if(!b.enforce) return true; return allowedTargets(b, from).includes(to); }

function boardRef(){
  // Real today — NOT the newest date in the data. Anchoring to the dataset made
  // "Today" mean whatever the latest ticket said, which hid today's actual work.
  return today();
}
function fInPeriod(dateStr, ref){
  const f=ui.filters, per=f.period||'all';
  if(per==='all') return true;
  if(per==='custom'){ if(!f.from||!f.to) return true; return !!dateStr && dateStr>=f.from && dateStr<=f.to; }
  if(!dateStr) return false;
  const pr=periodRange(per, ref);
  if(pr) return dateStr>=pr.from && dateStr<=pr.to;
  return true;
}
function tInPeriod(t, ref){
  if(fInPeriod(t.createdAt,ref)||fInPeriod(t.updatedAt,ref)||fInPeriod(t.resolvedAt,ref)) return true;
  return store.worklogs(t.id).some(w=>fInPeriod(w.date,ref));
}
function matchFilt(fv,tv){ if(!fv||fv==='all') return true; if(Array.isArray(fv)) return fv.length===0||fv.includes(tv); return fv===tv; }
/* The board that adopts legacy tickets with no `board` set. It must be STABLE —
   the same board before and after any new board is created — so new boards never
   inherit old tickets. We pick the earliest board in creation order within the
   current workspace: the seed board (fixed id) or, failing that, the board whose
   timestamp-based id sorts first. New boards get ids like 'b'+<later timestamp>,
   so they always sort after and can never become the anchor. */
function boardlessAnchorId(){
  const bs=store.boards(); if(!bs.length) return null;
  // Prefer the canonical seed board if present in this workspace.
  const seed=bs.find(b=>b.id==='main'); if(seed) return seed.id;
  // Otherwise the earliest-created board: sort by the numeric part of 'b<base36>' ids.
  const ord=b=>{ const m=/^b([0-9a-z]+)$/i.exec(b.id||''); return m?parseInt(m[1],36):-1; };
  return bs.slice().sort((a,b)=>ord(a)-ord(b))[0].id;
}
/* Single source of truth for which board a ticket lives on.
   In the strict model a ticket belongs to a project and a project belongs to one
   board, so the PROJECT decides the board. The ticket's own `board` field can drift
   out of sync (old data), so we derive from the project first, then fall back to the
   ticket's stored board, then the workspace anchor. This keeps board membership
   consistent everywhere (board view, list, projects, reports). */
function taskBoardId(t){
  if(!t) return null;
  if(t.project){ const pb=store.projectBoardId(store.project(t.project)); if(pb) return pb; }
  return t.board || boardlessAnchorId();
}
function filteredTasks(boardOverride){
  const f=ui.filters;
  const ref=(f.period&&f.period!=='all')?boardRef():null;
  /* Boards are containers: a ticket belongs to the board it was created on.
     Tickets from before boards were scoped carry no `board`. They adopt onto the
     workspace's ORIGINAL board only — never onto a board created later — so a
     brand-new board always starts genuinely empty and only shows tickets created
     on it. The anchor is the earliest board in creation order: seed boards keep
     their fixed id, and every board created afterwards is pushed to the end, so
     index 0 is stable and a new board can never become the adopter.
     Cross-cutting views (QA, Deployments, Reports, Overview) still read the whole
     space via standardTasks().
     `boardOverride` lets a view (e.g. List) choose its own board scope: pass a
     board id to scope to that board, or 'all' to include every board in the
     workspace. When omitted, the current board view (ui.board) is used. */
  const _bd = (boardOverride===undefined) ? ui.board : (boardOverride==='all' ? null : boardOverride);
  return store.standardTasks().filter(t=>{
    if(t.archived) return false;
    // The board a ticket shows on is decided by its project (source of truth),
    // falling back to the ticket's stored board, then the anchor.
    const homeBd = taskBoardId(t);
    if(_bd && homeBd !== _bd) return false;
    if(ui.project!=='all' && t.project!==ui.project) return false;
    if(f.epic!=='all'){ if(f.epic==='none'){ if(t.parent) return false; } else if(t.parent!==f.epic) return false; }
    if(!matchFilt(f.assignee, t.assignee)) return false;
    if(!matchFilt(f.status, t.status)) return false;
    if(!matchFilt(f.priority, t.priority)) return false;
    if(!matchFilt(f.type, t.type)) return false;
    if(f.time!=='all'){ const has=store.worklogs(t.id).length>0; if(f.time==='yes'&&!has) return false; if(f.time==='no'&&has) return false; }
    if(ref && !tInPeriod(t, ref)) return false;
    if(f.search){ const q=f.search.toLowerCase(); if(!(t.title.toLowerCase().includes(q)||t.key.toLowerCase().includes(q))) return false; }
    return true;
  });
}

const PROJ_COLORS={all:'#D6264F', webfe:'#0C5A9E', webbe:'#0E8FA8', db:'#7A3FF2', admin:'#B96A00', lms:'#0E8F5A', mkt:'#C026D3'};
function projColor(id){ if(id==='all') return '#D6264F'; const p=store.project(id); return (p&&p.color)||PROJ_COLORS[id]||'#8A8F98'; }
function renderProjectSwitch(){
  const nm=document.getElementById('wsName');
  if(nm){ const sp=store.space(ui.space); nm.textContent=sp?sp.name:'Workspace'; }
}

const CHEV_SVG='<svg class="chip-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
const FILTER_DEFS=[
  {key:'epic', label:'Epic', search:true,
   ico:'<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="color:#7C3AED"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
   opts(){ return [{v:'all',t:'All'},{v:'none',t:'No epic'}].concat(store.epics().filter(e=>ui.project==='all'||e.project===ui.project).map(e=>({v:e.id,t:e.title,dot:e.color}))); }},
  {key:'assignee', label:'Assignee', multi:true, search:true,
   ico:'<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#0C5A9E"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
   opts(){ return [{v:'all',t:'All'}].concat(store.users().map(u=>({v:u.id,t:u.name,dot:u.color,ava:avatar(u,18)}))); }},
  {key:'status', label:'Status', multi:true,
   ico:'<svg class="chip-ico" style="color:#0E8F5A" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="11" rx="1"/></svg>',
   opts(){ return [{v:'all',t:'All'}].concat(STATUSES.map(s=>({v:s.id,t:s.name,dot:s.color}))); }},
  {key:'priority', label:'Priority', multi:true,
   ico:'<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="color:#CA8A04"><path d="M4 21V4M4 4h13l-2 5 2 5H4"/></svg>',
   opts(){ return [{v:'all',t:'All'}].concat(Object.keys(PRIORITIES).map(p=>({v:p,t:p,dot:PRIORITIES[p]}))); }},
  {key:'type', label:'Type', multi:true,
   ico:'<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#0891B2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
   opts(){ return [{v:'all',t:'All'}].concat(store.types().filter(x=>x.id!=='Epic').map(x=>({v:x.id,t:x.name,dot:x.color}))); }},
  {key:'time', label:'Time', allLabel:'Any',
   ico:'<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#EA580C"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
   opts(){ return [{v:'all',t:'Any'},{v:'yes',t:'Logged'},{v:'no',t:'Not logged'}]; }},
];
function filterValLabel(def){ const cur=ui.filters[def.key];
  if(def.multi && Array.isArray(cur)){ if(!cur.length) return def.allLabel||'All'; if(cur.length===1){ const o=def.opts().find(x=>x.v===cur[0]); return o?o.t:'1 selected'; } return cur.length+' selected'; }
  const o=def.opts().find(x=>x.v===cur); return o?o.t:(def.allLabel||'All'); }
function renderFilterChips(){
  const wrap=document.getElementById('filterChips'); if(!wrap) return;
  wrap.innerHTML=FILTER_DEFS.map(def=>{ const _v=ui.filters[def.key]; const active=Array.isArray(_v)?_v.length>0:(!!_v&&_v!=='all');
    return `<button class="chip ${active?'active':''}" data-key="${def.key}">${def.ico}<span class="chip-lbl">${def.label}</span><span class="chip-val">${esc(filterValLabel(def))}</span>${CHEV_SVG}</button>`;
  }).join('');
  wrap.querySelectorAll('.chip').forEach(c=>c.onclick=e=>{ e.stopPropagation(); openFilterMenu(c.dataset.key, c); });
}
let fmOpen=null;
function closeFilterMenu(){ document.getElementById('filterMenu').classList.remove('on'); document.querySelectorAll('#filterChips .chip.open').forEach(c=>c.classList.remove('open')); fmOpen=null; }
const UIZOOM=1;
function posMenu(menu, r, gap, mw, rightAlign){ const z=UIZOOM; const vw=window.innerWidth*z;
  const leftV = rightAlign ? Math.max(8, Math.min(r.right-mw, vw-mw-8)) : Math.min(r.left, vw-mw);
  menu.style.left=(leftV/z)+'px'; menu.style.top=((r.bottom+gap)/z)+'px'; menu.classList.add('on'); }
function openFilterMenu(key, chip){
  const def=FILTER_DEFS.find(d=>d.key===key); const menu=document.getElementById('filterMenu');
  if(fmOpen===key){ closeFilterMenu(); return; }
  fmOpen=key;
  document.querySelectorAll('#filterChips .chip.open').forEach(c=>c.classList.remove('open')); if(chip) chip.classList.add('open');
  const cur=ui.filters[key]||'all';
  const isMulti=!!def.multi;
  const selArr=()=>{ const c=ui.filters[key]; return (isMulti && Array.isArray(c))?c:[]; };
  const draw=(q)=>{ const items=def.opts().filter(o=>!q||o.t.toLowerCase().includes(q.toLowerCase()));
    const sel=selArr(); const isOn=o=> isMulti ? (o.v==='all' ? sel.length===0 : sel.includes(o.v)) : (o.v===cur);
    const list=items.length?items.map(o=>`<div class="fmenu-item ${isOn(o)?'sel':''}" data-v="${o.v}">${isOn(o)?'<svg class="fchk" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>':'<span class="fchk"></span>'}${o.ava||''}<span style="overflow:hidden;text-overflow:ellipsis">${esc(o.t)}</span></div>`).join(''):'<div class="fmenu-empty">No matches</div>';
    menu.querySelector('.fmenu-list').innerHTML=list;
    menu.querySelectorAll('.fmenu-item').forEach(it=>it.onclick=(e)=>{ e.stopPropagation(); const v=it.dataset.v;
      if(isMulti){ if(v==='all'){ ui.filters[key]='all'; } else { let arr=selArr().slice(); if(arr.includes(v)) arr=arr.filter(x=>x!==v); else arr.push(v); ui.filters[key]=arr.length?arr:'all'; } draw(q); renderFilterChips(); refreshViews(); }
      else { ui.filters[key]=v; closeFilterMenu(); renderFilterChips(); refreshViews(); } }); };
  menu.innerHTML=(def.search?`<div class="fmenu-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input type="text" autocomplete="off" placeholder="Search ${def.label.toLowerCase()}"/></div>`:'')+`<div class="fmenu-list"></div>`;
  draw('');
  const r=chip.getBoundingClientRect();
  posMenu(menu, r, 6, 330, false);
  const si=menu.querySelector('.fmenu-search input'); if(si){ si.oninput=()=>draw(si.value); setTimeout(()=>si.focus(),0); }
}
document.addEventListener('click',e=>{ if(fmOpen && !e.target.closest('#filterMenu')) closeFilterMenu(); });
window.addEventListener('scroll',(e)=>{ const t=e&&e.target; if(fmOpen && !(t && t.closest && t.closest('#filterMenu'))) closeFilterMenu(); }, true);
function fillFilters(){
  renderFilterChips();
  const seg=document.getElementById('periodSeg'); if(seg){
    const isOv=ui.view==='overview';
    const curP=isOv?(ui.ovRange||'all'):(ui.filters.period||'all');
    seg.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x.dataset.p===curP));
    const cw=document.getElementById('fPeriodCustom');
    if(curP==='custom'){ cw.style.display='block';
      const cf=isOv?ui.ovFrom:ui.filters.from, ct=isOv?ui.ovTo:ui.filters.to;
      cw.innerHTML=periodCustomRow('f', cf, ct);
      wirePeriodCustom('f', cf, ct, v=>{ if(isOv) ui.ovFrom=v; else ui.filters.from=v; fillFilters(); refreshViews(); }, v=>{ if(isOv) ui.ovTo=v; else ui.filters.to=v; fillFilters(); refreshViews(); });
    } else cw.style.display='none'; }
}

function cfControl(t, f){
  const val=(t.custom||{})[f.id];
  if(f.type==='number') return `<input type="number" class="cfedit cf-in" data-fid="${f.id}" value="${val==null?'':val}" placeholder="—"/>`;
  if(f.type==='date') return `<input type="date" class="cfedit cf-in cedit-date" data-fid="${f.id}" value="${val||''}"/>`;
  if(f.type==='select') return `<select class="cfedit" data-fid="${f.id}"><option value="">—</option>${(f.options||[]).map(o=>`<option ${val===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  if(f.type==='check') return `<label class="cf-check"><input type="checkbox" class="cfedit" data-fid="${f.id}" ${val?'checked':''}/></label>`;
  if(f.type==='multi'){ const arr=Array.isArray(val)?val:[]; return `<button class="cfmulti" data-fid="${f.id}" data-id="${t.id}">${arr.length?arr.map(v=>`<span class="cftag">${esc(v)}</span>`).join(' '):'<span class="cf-muted">—</span>'}<svg class="cfchev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>`; }
  return `<input type="text" class="cfedit cf-in" data-fid="${f.id}" value="${esc(val||'')}" placeholder="—"/>`;
}
function customFieldsHTML(t, onlyCard){
  const fs=store.fields().filter(f=>onlyCard?f.onCard:true);
  return fs.map(f=>`<div class="kvrow"><span class="kvl">${esc(f.name)}</span><span class="kvv">${cfControl(t,f)}</span></div>`).join('');
}
function cardHTML(t){
  const tot=taskTotals(t.id);
  const ep = t.parent ? store.task(t.parent) : null;
  const proj = store.project(t.project);
  const u = t.assignee ? store.user(t.assignee) : null;
  const priColor = PRIORITIES[t.priority]||'#999';
  const pcol = projColor(t.project);
  const overdue = HL_OVERDUE && t.due && (store.status(t.status)||{}).cat!=='done' && Date.parse(t.due) < Date.parse(today());
  const priOpts=['Highest','High','Medium','Low'].map(p=>`<option ${t.priority===p?'selected':''}>${p}</option>`).join('');
  const stOpts=STATUSES.map(s=>`<option value="${s.id}" ${t.status===s.id?'selected':''}>${esc(s.name)}</option>`).join('');
  const asgOpts=`<option value="">Unassigned</option>`+store.activeUsers(t.assignee).map(x=>`<option value="${x.id}" ${t.assignee===x.id?'selected':''}>${esc(x.name)}</option>`).join('');
  return `<div class="card" draggable="true" data-id="${t.id}">
    ${t.color?`<div class="card-strip" style="background:${t.color}"></div>`:''}
    <div class="card-body">
      <div class="card-toprow">
        <span class="card-num">${t.flagged?'<svg class="flag-ic" width="11" height="11" viewBox="0 0 24 24" fill="#CE2F26" stroke="#CE2F26" stroke-width="1.5" stroke-linejoin="round"><path d="M4 21V4h13l-2 5 2 5H4"/></svg>':''}${t.key}</span>
        <button class="cdate cdate-start" data-id="${t.id}" data-field="start">${t.start?fdate(t.start):'<span class="cf-muted">Start date</span>'}<svg class="cfchev" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
      </div>
      <div class="card-projrow"><button class="projbtn" data-id="${t.id}"><span class="projbtn-t">${proj?esc(proj.name):'Not Assigned'}</span><svg class="cfchev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button><button class="card-kebab" data-id="${t.id}" aria-label="More actions"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg></button></div>
      <div class="card-title">${esc(t.title)}</div>
      ${ep?`<div class="epic-tag"><span class="epic-lbl">Epic:</span><span class="tx">${esc(ep.title)}</span></div>`:''}
      <div class="card-kv">
        <div class="kvrow"><span class="kvl">Priority</span><span class="kvv"><select class="cedit cedit-pri" data-f="priority" style="color:${priColor}">${priOpts}</select></span></div>
        <div class="kvrow"><span class="kvl">Due date</span><span class="kvv"><button class="cdate ${overdue?'over':''}" data-id="${t.id}" data-field="due">${t.due?fdate(t.due):'<span class="cf-muted">Set date</span>'}<svg class="cfchev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button></span></div>
        <div class="kvrow"><span class="kvl">Status</span><span class="kvv"><select class="cedit" data-f="status">${stOpts}</select></span></div>
        <div class="kvrow"><span class="kvl">Logged</span><span class="kvv"><button class="clog" data-id="${t.id}">${tot.total?hm(tot.total):'Log time'}<svg class="cfchev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button></span></div>
        ${customFieldsHTML(t,true)}
        <div class="kvrow"><span class="kvl">Assignee</span><span class="kvv"><button class="asgbtn" data-id="${t.id}">${u?avatar(u,18)+`<span class="asg-nm">${esc(u.name)}</span>`:'<span class="cf-muted">Unassigned</span>'}<svg class="cfchev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button></span></div>
      </div>
    </div></div>`;
}

function boardColsHTML(cols, tasks, canon){
  const _c = canon || (x=>x);
  return cols.map(s=>{
    const col=tasks.filter(t=>_c(t.status)===s.id);
    const mins=col.reduce((a,t)=>a+taskTotals(t.id).total,0);
    return `<div class="col" data-status="${s.id}">
      <div class="col-h">
        <span class="t">${esc(s.name)}</span><span class="c">${col.length}</span></div>
      <div class="col-body">${col.map(cardHTML).join('')||'<div style="padding:8px 4px;font-size:11.5px;color:var(--faint)">No tickets</div>'}</div>
    </div>`;
  }).join('');
}
function groupValue(t,g){ if(g==='assignee')return t.assignee||'__un'; if(g==='epic')return t.parent||'__noepic'; if(g==='priority')return t.priority; if(g==='type')return t.type; return '__all'; }
function orderGroupKeys(g,keys){
  if(g==='assignee'){ const o=store.users().map(u=>u.id); return keys.sort((a,b)=>a==='__un'?1:b==='__un'?-1:o.indexOf(a)-o.indexOf(b)); }
  if(g==='epic'){ const o=store.epics().map(e=>e.id); return keys.sort((a,b)=>a==='__noepic'?1:b==='__noepic'?-1:o.indexOf(a)-o.indexOf(b)); }
  if(g==='priority'){ return keys.sort((a,b)=>store.priorityRank(a)-store.priorityRank(b)); }
  if(g==='type'){ const o=store.types().map(x=>x.id); return keys.sort((a,b)=>o.indexOf(a)-o.indexOf(b)); }
  return keys;
}
function groupHeaderHTML(g,key){
  if(g==='assignee'){ if(key==='__un') return `<span class="avatar" style="width:22px;height:22px;background:#C6CCD6">–</span>Unassigned`; const u=store.user(key); return u?`${avatar(u,22)}${esc(u.name)}`:'Unknown'; }
  if(g==='epic'){ if(key==='__noepic') return 'No epic'; const e=store.task(key); return e?`<span class="col-dot" style="background:${e.color||'#999'}"></span>${esc(e.title)}`:'Epic'; }
  if(g==='priority'){ return `<span class="col-dot" style="background:${PRIORITIES[key]||'#999'}"></span>${esc(key)} priority`; }
  if(g==='type'){ return esc(key); }
  return '';
}
function updBoardSlide(){
  const sc=document.getElementById('scroll'), L=document.getElementById('boardSlideL'), R=document.getElementById('boardSlideR');
  if(!sc||!L||!R) return;
  const onBoard=document.body.classList.contains('view-board');
  const canScroll=sc.scrollWidth - sc.clientWidth > 8;
  const atStart=sc.scrollLeft<=4, atEnd=sc.scrollLeft>=sc.scrollWidth - sc.clientWidth - 4;
  L.classList.toggle('show', onBoard && canScroll && !atStart);
  R.classList.toggle('show', onBoard && canScroll && !atEnd);
  // keep the slider pill in step with the real scroll position
  const bar=document.getElementById('boardHbar'), th=document.getElementById('boardHbarThumb');
  if(bar && th){
    bar.classList.toggle('show', onBoard && canScroll);
    if(onBoard && canScroll){
      const track=bar.clientWidth;
      const tw=Math.max(44, Math.round(track * sc.clientWidth / sc.scrollWidth));
      const range=sc.scrollWidth - sc.clientWidth;
      const x=Math.round((track - tw) * (range ? sc.scrollLeft / range : 0));
      th.style.width=tw+'px';
      th.style.transform='translateX('+x+'px)';
    }
  }
}
let _boardSlideWired=false;
function wireBoardSlide(){
  if(_boardSlideWired) return;
  const sc=document.getElementById('scroll'), L=document.getElementById('boardSlideL'), R=document.getElementById('boardSlideR');
  if(!sc||!L||!R) return;
  _boardSlideWired=true;
  const step=()=>Math.max(300, Math.round(sc.clientWidth*0.7));
  L.onclick=()=>sc.scrollBy({left:-step(), behavior:'smooth'});
  R.onclick=()=>sc.scrollBy({left: step(), behavior:'smooth'});
  sc.addEventListener('scroll', updBoardSlide, {passive:true});
  window.addEventListener('resize', updBoardSlide);
  // slider pill: drag the thumb, or click the track to jump there
  const bar=document.getElementById('boardHbar'), th=document.getElementById('boardHbarThumb');
  if(bar && th){
    const toScroll=(clientX, grabOffset)=>{
      const r=bar.getBoundingClientRect();
      const tw=th.offsetWidth, range=r.width - tw;
      const x=Math.min(range, Math.max(0, clientX - r.left - grabOffset));
      const max=sc.scrollWidth - sc.clientWidth;
      sc.scrollLeft = range ? (x / range) * max : 0;
    };
    th.addEventListener('pointerdown', e=>{
      e.preventDefault(); e.stopPropagation();
      const grab=e.clientX - th.getBoundingClientRect().left;
      th.classList.add('dragging'); th.setPointerCapture(e.pointerId);
      const mv=ev=>toScroll(ev.clientX, grab);
      const up=ev=>{ th.classList.remove('dragging');
        th.removeEventListener('pointermove', mv); th.removeEventListener('pointerup', up); th.removeEventListener('pointercancel', up); };
      th.addEventListener('pointermove', mv);
      th.addEventListener('pointerup', up);
      th.addEventListener('pointercancel', up);
    });
    bar.addEventListener('pointerdown', e=>{
      if(e.target===th) return;                    // thumb handles its own drag
      toScroll(e.clientX, th.offsetWidth/2);       // centre the thumb on the click
    });
  }
}
function renderBoard(){ try{ wireBoardSlide(); requestAnimationFrame(updBoardSlide); }catch(e){}
  const board=document.getElementById('board');
  const bd=activeBoard();
  if(!bd){ board.className='board'; board.innerHTML=`<div class="empty" style="margin:40px auto"><div class="big">No board yet</div>This workspace hasn’t been set up. An admin needs to load data (Settings → reset), or check the console for a setup error.</div>`; return; }
  const tasks=filteredTasks();
  // Part A — a board always shows a column for EVERY status its tickets actually
  // use, so nothing a ticket on this board can ever end up invisible. Start from the
  // board's configured columns, then append every other status present on this
  // board's tickets. Statuses that exist in the global list keep their name/colour
  // and global ordering; any status id that isn't in the global list (orphaned or
  // workspace-specific) still gets a synthetic column so its tickets show. Result:
  // "Not on this board" is effectively never populated for tickets created here.
  const cfgCols=store.boardColumns(bd);
  const cfgIds=new Set(cfgCols.map(s=>s.id));
  const usedIds=[...new Set(tasks.map(t=>t.status).filter(Boolean))].filter(id=>!cfgIds.has(id));
  // known statuses first (in global order), then any unknown ids as synthetic cols
  const knownExtra=STATUSES.filter(s=>usedIds.includes(s.id));
  const knownExtraIds=new Set(knownExtra.map(s=>s.id));
  const unknownExtra=usedIds.filter(id=>!knownExtraIds.has(id))
    .map(id=>({id, name:(store.status(id)||{}).name||id, cat:'todo', color:'#71717A'}));
  const rawCols=cfgCols.concat(knownExtra, unknownExtra);
  // Dedupe columns that resolve to the same status NAME (ignoring case/spacing). Duplicate
  // status definitions (e.g. "Back Log" and "Backlog") otherwise render as two identical
  // columns. Keep the first occurrence as the canonical column and remember which status
  // ids map onto it, so every ticket in any of the duplicates shows under the one column.
  const _norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const cols=[]; const _seenName={}; const _stMap={};   // _stMap: status id -> canonical column id
  rawCols.forEach(s=>{ const n=_norm(s.name);
    if(_seenName[n]!==undefined){ _stMap[s.id]=_seenName[n]; }      // fold into the kept column
    else { _seenName[n]=s.id; _stMap[s.id]=s.id; cols.push(s); }
  });
  // Any ticket status that maps onto a canonical column via a duplicate is treated as that column.
  const canon=st=> _stMap[st] || st;
  const shownIds=cols.map(s=>s.id);
  const hidden=tasks.filter(t=>!shownIds.includes(canon(t.status))).length;
  const hiddenCol = hidden?`<div class="col" style="border-style:dashed;opacity:.7"><div class="col-h"><span class="t" style="color:var(--muted)">Not on this board</span><span class="c">${hidden}</span></div><div class="col-body"><div style="padding:8px 4px;font-size:11px;color:var(--faint)">${hidden} ticket${hidden!==1?'s':''} in statuses this board doesn't show.</div></div></div>`:'';
  const g=ui.groupBy||'none';
  board.classList.toggle('grouped', g!=='none');
  if(g==='none'){
    board.innerHTML = boardColsHTML(cols, tasks, canon) + hiddenCol;
  } else {
    const groups={}; tasks.forEach(t=>{ const k=groupValue(t,g); (groups[k]=groups[k]||[]).push(t); });
    const keys=orderGroupKeys(g, Object.keys(groups));
    board.innerHTML = keys.map(k=>`<div class="swimlane">
      <div class="swim-h">${groupHeaderHTML(g,k)}<span class="swim-count">${groups[k].length}</span></div>
      <div class="swim-cols">${boardColsHTML(cols, groups[k], canon)}</div></div>`).join('')
      + (hidden?`<div class="swimlane"><div class="swim-h" style="color:var(--muted)">Not on this board<span class="swim-count">${hidden}</span></div><div class="swim-cols">${boardColsHTML(cols, tasks.filter(t=>!shownIds.includes(canon(t.status))), canon)}</div></div>`:'');
  }
  attachCardEvents(board);
  attachDnD(board);
}

function listPersonCell(uid){ const u=store.user(uid); return `<td>${u?`<div class="assignee-cell">${avatar(u,20)}<span>${esc(u.name)}</span></div>`:'<span class="lmuted">—</span>'}</td>`; }
const LIST_COLS = {
  key:      { label:'Key',            sort:'key',      cell:t=>`<td class="lkey">${t.key}</td>` },
  title:    { label:'Title',          sort:'title',    cell:t=>`<td><div class="ltitle">${esc(t.title)}</div></td>` },
  project:  { label:'Project',        sort:'project',  cell:t=>{const p=store.project(t.project);return `<td>${p?`<span class="tag" style="background:var(--surface-2);color:var(--ink-2)">${esc(p.name)}</span>`:'<span class="lmuted">—</span>'}</td>`;} },
  epic:     { label:'Epic',                            cell:t=>{const e=t.parent?store.task(t.parent):null;return `<td>${e?esc(e.title):'<span class="lmuted">—</span>'}</td>`;} },
  type:     { label:'Type',           sort:'type',     cell:t=>`<td>${esc(t.type||'')}</td>` },
  status:   { label:'Status',         sort:'status',   cell:t=>{const st=store.status(t.status);return `<td><span class="tag" style="background:var(--surface-2);color:var(--ink-2)"><span class="col-dot" style="background:${st?st.color:'#999'}"></span>${st?esc(st.name):t.status}</span></td>`;} },
  priority: { label:'Priority',       sort:'priority', cell:t=>`<td>${priIcon(t.priority)} <span style="font-size:12px">${esc(t.priority||'')}</span></td>` },
  assignee: { label:'Developer',      sort:'assignee', cell:t=>listPersonCell(t.assignee) },
  qa:       { label:'Quality Analyst',                 cell:t=>listPersonCell(t.qa) },
  reviewer: { label:'Code Reviewer',                   cell:t=>listPersonCell(t.reviewer) },
  deployer: { label:'Deployer',                        cell:t=>listPersonCell(t.deployer) },
  reporter: { label:'Reporter',                        cell:t=>listPersonCell(t.reporter) },
  due:      { label:'Due date',       sort:'due',      cell:t=>`<td>${fdate(t.due)||'<span class="lmuted">—</span>'}</td>` },
  start:    { label:'Start date',     sort:'start',    cell:t=>`<td>${fdate(t.start)||'<span class="lmuted">—</span>'}</td>` },
  estimate: { label:'Estimate',                        cell:t=>`<td>${t.estimate?hm(t.estimate):'<span class="lmuted">—</span>'}</td>` },
  time:     { label:'Logged',         sort:'time',     cell:t=>{const tot=taskTotals(t.id);return `<td class="num" style="font-family:Inter;font-weight:600;color:${tot.total?'var(--ink)':'var(--faint)'}">${tot.total?hm(tot.total):'—'}</td>`;} },
  resolution:{label:'Resolution',                      cell:t=>`<td>${t.resolution?esc(t.resolution):'<span class="lmuted">—</span>'}</td>` },
  created:  { label:'Created',        sort:'createdAt',cell:t=>`<td>${fdate(t.createdAt)||'<span class="lmuted">—</span>'}</td>` },
  updated:  { label:'Updated',        sort:'updatedAt',cell:t=>`<td>${fdate(t.updatedAt)||'<span class="lmuted">—</span>'}</td>` },
  deployed: { label:'Deployed',                        cell:t=>`<td>${t.deployedAt?fdatetime(t.deployedAt):'<span class="lmuted">—</span>'}</td>` },
  flagged:  { label:'Flag',                            cell:t=>`<td>${t.flagged?'<span style="color:var(--crit)">Flagged</span>':'<span class="lmuted">—</span>'}</td>` },
};
const LIST_COL_ORDER = ['key','title','project','epic','type','status','priority','assignee','qa','reviewer','deployer','reporter','due','start','estimate','time','resolution','created','updated','deployed','flagged'];
const LIST_COL_DEFAULT = ['key','title','assignee','status','priority','type','due','time'];
function listColDef(id){ if(id&&id.indexOf('cf:')===0){ const fid=id.slice(3); const f=store.fields().find(x=>x.id===fid); if(!f) return null; return { label:f.name, cell:t=>{ const v=(t.custom||{})[fid]; const disp=(v==null||v===''||(Array.isArray(v)&&!v.length))?'':(Array.isArray(v)?v.join(', '):(v===true?'Yes':v===false?'':String(v))); return `<td>${disp!==''?esc(disp):'<span class="lmuted">—</span>'}</td>`; } }; } return LIST_COLS[id]||null; }
function listAllCols(){ return LIST_COL_ORDER.map(id=>({id,label:LIST_COLS[id].label})).concat(store.fields().map(f=>({id:'cf:'+f.id,label:f.name}))); }
function renderList(){
  const wrap=document.getElementById('listwrap');
  // List View has its own board scope (ui.listBoard), independent of the board view.
  // Scope by which board each ticket BELONGS to (so reporting is per-board correct),
  // not by status/column membership.
  let tasks=filteredTasks(ui.listBoard==='all' ? 'all' : ui.listBoard);
  let cols=store.listCols().filter(id=>listColDef(id)); if(!cols.length) cols=['key','title'];
  const LGROUPS={none:'None',assignee:'Assignee',epic:'Epic',priority:'Priority',type:'Type'};
  const boardOpts=[{v:'all',t:'All boards'}].concat(store.boards().map(b=>({v:b.id,t:b.name})));
  const grpOpts=Object.entries(LGROUPS).map(([v,t])=>({v,t}));
  const ICO_BOARD='<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#0C5A9E"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="11" rx="1"/></svg>';
  const ICO_GRP='<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:#0891B2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
  const boardVal=ui.listBoard==='all'?'All':((store.board(ui.listBoard)||{}).name||'All');
  const grpVal=LGROUPS[ui.listGroup]||'None';
  const chip=(id,ico,label,val,active)=>`<button class="chip lchip ${active?'active':''}" id="${id}">${ico}<span class="chip-lbl">${label}</span><span class="chip-val">${esc(val)}</span>${CHEV_SVG}</button>`;
  const toolbar=`<div class="ltoolbar">
    <div class="ltbar-l"><span class="ltbar-title">List View</span><span class="lcount">${tasks.length} ticket${tasks.length!==1?'s':''}</span><span class="ltbar-div"></span>${chip('listBoardBtn',ICO_BOARD,'Board',boardVal,ui.listBoard!=='all')}${chip('listGroupBtn',ICO_GRP,'Group',grpVal,ui.listGroup!=='none')}</div>
    <div class="ltbar-r"><button class="lcols-btn" id="listColsBtn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18M15 3v18"/></svg>Columns</button></div>
  </div>`;
  const wireTop=()=>{ wireListCols();
    document.getElementById('listBoardBtn').onclick=e=>{ e.stopPropagation(); chipMenu(e.currentTarget, boardOpts, ui.listBoard, v=>{ ui.listBoard=v; ui.listPage=1; renderList(); }); };
    document.getElementById('listGroupBtn').onclick=e=>{ e.stopPropagation(); chipMenu(e.currentTarget, grpOpts, ui.listGroup, v=>{ ui.listGroup=v; ui.listPage=1; renderList(); }); };
  };
  if(!tasks.length){ wrap.innerHTML=toolbar+`<div class="empty"><div class="big">No tickets match</div>Try clearing a filter.</div>`; wireTop(); return; }
  const head=cols.map(id=>{ const d=listColDef(id); const s=LIST_COLS[id]&&LIST_COLS[id].sort; return `<th ${s?`data-sort="${s}"`:''}>${esc(d.label)}</th>`; }).join('');
  const rowHTML=t=>`<tr data-id="${t.id}">${cols.map(id=>listColDef(id).cell(t)).join('')}</tr>`;
  let bodyRows, moreRow='';
  if(ui.listGroup==='none'){ const page=ui.listPage||1; const shown=Math.min(tasks.length, PAGE_SIZE*page);
    bodyRows=tasks.slice(0,shown).map(rowHTML).join('');
    if(shown<tasks.length){ moreRow=`<tr class="lmore-row"><td colspan="${cols.length}"><div class="lmore"><span class="lmore-c">Showing ${shown} of ${tasks.length}</span><button class="stx-mini" id="listMore">Show ${Math.min(PAGE_SIZE, tasks.length-shown)} more</button><button class="stx-mini" id="listAll">Show all</button></div></td></tr>`; } }
  else { const gm={}; tasks.forEach(t=>{ const k=groupValue(t,ui.listGroup); (gm[k]=gm[k]||[]).push(t); });
    const keys=orderGroupKeys(ui.listGroup, Object.keys(gm));
    bodyRows=keys.map(k=>`<tr class="lgroup-row"><td colspan="${cols.length}"><div class="lgroup-h">${groupHeaderHTML(ui.listGroup,k)}<span class="lgroup-n">${gm[k].length}</span></div></td></tr>`+gm[k].map(rowHTML).join('')).join(''); }
  wrap.innerHTML=toolbar+`<div class="ltable-scroll"><table class="ltable"><thead><tr>${head}</tr></thead><tbody>${bodyRows}${moreRow}</tbody></table></div>`;
  { const lm=document.getElementById('listMore'); if(lm) lm.onclick=()=>{ ui.listPage=(ui.listPage||1)+1; renderList(); };
    const la=document.getElementById('listAll'); if(la) la.onclick=()=>{ ui.listPage=Math.ceil(tasks.length/PAGE_SIZE)+1; renderList(); }; }
  wrap.querySelectorAll('tbody tr[data-id]').forEach(tr=>tr.onclick=()=>openPanel(tr.dataset.id));
  wrap.querySelectorAll('th[data-sort]').forEach(th=>th.onclick=()=>sortList(th.dataset.sort));
  wireTop();
}
function wireListCols(){ const b=document.getElementById('listColsBtn'); if(b) b.onclick=e=>{ e.stopPropagation(); openColumnManager(); }; }
let colmDraft=[];
function openColumnManager(){
  closeColumnManager();
  colmDraft=store.listCols().filter(id=>listColDef(id)); if(!colmDraft.length) colmDraft=LIST_COL_DEFAULT.slice();
  const ov=document.createElement('div'); ov.className='colm-overlay'; ov.id='colmOverlay';
  ov.innerHTML=`<div class="colm">
    <div class="colm-h"><span>Manage Columns</span><button class="colm-close" id="colmClose" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
    <div class="colm-body">
      <div class="colm-pane">
        <div class="colm-pane-h">Available Columns</div>
        <div class="colm-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input id="colmSearch" placeholder="Search fields" autocomplete="off"/></div>
        <div class="colm-avail" id="colmAvail"></div>
      </div>
      <div class="colm-pane">
        <div class="colm-pane-h">Selected Columns <span class="colm-count">(0)</span></div>
        <div class="colm-selected" id="colmSelected"></div>
      </div>
    </div>
    <div class="colm-foot"><button class="colm-link" id="colmAll">Select all</button><button class="colm-link" id="colmReset">Reset to default</button><span class="colm-sp"></span><button class="btn" id="colmCancel">Cancel</button><button class="btn primary" id="colmSave">Save</button></div>
  </div>`;
  document.body.appendChild(ov);
  ov.onclick=e=>{ if(e.target===ov) closeColumnManager(); };
  document.getElementById('colmClose').onclick=closeColumnManager;
  document.getElementById('colmCancel').onclick=closeColumnManager;
  document.getElementById('colmSave').onclick=()=>{ store.setListCols(colmDraft.length?colmDraft:['key','title']); renderList(); closeColumnManager(); toast('Columns updated'); };
  document.getElementById('colmAll').onclick=()=>{ colmDraft=listAllCols().map(c=>c.id); renderColmPanes(); };
  document.getElementById('colmReset').onclick=()=>{ colmDraft=LIST_COL_DEFAULT.slice(); renderColmPanes(); };
  document.getElementById('colmSearch').oninput=renderColmPanes;
  renderColmPanes();
}
function renderColmPanes(){
  const q=(document.getElementById('colmSearch').value||'').toLowerCase();
  const avail=document.getElementById('colmAvail');
  avail.innerHTML=listAllCols().filter(c=>c.label.toLowerCase().includes(q)).map(c=>{ const on=colmDraft.includes(c.id); return `<label class="colm-arow"><input type="checkbox" ${on?'checked':''} data-col="${c.id}"/><span class="colm-nm">${esc(c.label)}</span></label>`; }).join('')||'<div class="colm-empty">No fields match</div>';
  avail.querySelectorAll('input[data-col]').forEach(cb=>cb.onchange=()=>{ const id=cb.dataset.col; if(cb.checked){ if(!colmDraft.includes(id)) colmDraft.push(id); } else colmDraft=colmDraft.filter(x=>x!==id); renderColmPanes(); });
  const sel=document.getElementById('colmSelected');
  sel.innerHTML=colmDraft.map(id=>{ const d=listColDef(id); if(!d) return ''; return `<div class="colm-srow" draggable="true" data-id="${id}"><span class="colm-grip">⋮⋮</span><span class="colm-nm">${esc(d.label)}</span><button class="colm-x" data-rm="${id}" title="Remove">✕</button></div>`; }).join('')||'<div class="colm-empty">No columns selected — add from the left</div>';
  const cnt=document.querySelector('.colm-count'); if(cnt) cnt.textContent='('+colmDraft.length+')';
  sel.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ colmDraft=colmDraft.filter(x=>x!==b.dataset.rm); renderColmPanes(); });
  let dragEl=null;
  sel.querySelectorAll('.colm-srow').forEach(row=>{
    row.ondragstart=e=>{ dragEl=row; row.classList.add('drag'); e.dataTransfer.effectAllowed='move'; };
    row.ondragend=()=>{ row.classList.remove('drag'); dragEl=null; colmDraft=[...sel.querySelectorAll('.colm-srow')].map(r=>r.dataset.id); };
    row.ondragover=e=>{ e.preventDefault(); if(!dragEl||dragEl===row) return; const after=[...sel.querySelectorAll('.colm-srow:not(.drag)')].find(r=>{ const rc=r.getBoundingClientRect(); return e.clientY<rc.top+rc.height/2; }); if(after) sel.insertBefore(dragEl, after); else sel.appendChild(dragEl); };
  });
}
function closeColumnManager(){ const ov=document.getElementById('colmOverlay'); if(ov) ov.remove(); }

let sortKey='key', sortDir=1;
function sortList(key){
  if(sortKey===key) sortDir*=-1; else{ sortKey=key; sortDir=1; }
  store.data.tasks.sort((a,b)=>{
    let va,vb;
    if(key==='time'){ va=taskTotals(a.id).total; vb=taskTotals(b.id).total; }
    else if(key==='assignee'){ va=(store.user(a.assignee)||{}).name||''; vb=(store.user(b.assignee)||{}).name||''; }
    else if(key==='priority'){ const o=['Low','Medium','High','Highest']; va=o.indexOf(a.priority); vb=o.indexOf(b.priority); }
    else { va=a[key]||''; vb=b[key]||''; }
    return (va>vb?1:va<vb?-1:0)*sortDir;
  });
  renderList();
}

function attachCardEvents(root){ root.querySelectorAll('.card').forEach(c=>c.onclick=e=>{ if(e.target.closest('.cedit')||e.target.closest('.clog')||e.target.closest('.cfedit')||e.target.closest('.cfmulti')||e.target.closest('.projbtn')||e.target.closest('.asgbtn')||e.target.closest('.cdate')||e.target.closest('.card-kebab')) return; if(!c.classList.contains('dragging')) openPanel(c.dataset.id); });
  root.querySelectorAll('.cedit').forEach(el=>{ el.onmousedown=e=>e.stopPropagation(); el.onclick=e=>e.stopPropagation();
    el.onchange=e=>{ e.stopPropagation(); const id=el.closest('.card').dataset.id; const f=el.dataset.f; if(!canEditField(f)){ toast('You can\u2019t edit this field'); refreshViews(); return; } let v=el.value;
      if(f==='due'||f==='assignee'||f==='project') v=v||null; store.updateTask(id,{[f]:v}); refreshViews(); }; });
  root.querySelectorAll('.clog').forEach(el=>{ el.onmousedown=e=>e.stopPropagation();
    el.onclick=e=>{ e.stopPropagation(); openLogModal(el.dataset.id); }; });
  wireCustomEdits(root, ()=>refreshViews());
}
function wireCustomEdits(root, after){
  root.querySelectorAll('.cfedit').forEach(el=>{ el.onmousedown=e=>e.stopPropagation(); el.onclick=e=>e.stopPropagation();
    el.onchange=e=>{ e.stopPropagation(); if(!canEditField('custom')){ toast('You can\u2019t edit custom fields'); if(after)after(); return; } const card=el.closest('.card')||el.closest('#panel'); const id=(card&&card.dataset&&card.dataset.id)||ui.openTask; const fid=el.dataset.fid;
      const f=store.fields().find(x=>x.id===fid); let v; if(f&&f.type==='check') v=el.checked; else if(f&&f.type==='number') v=el.value===''?null:Number(el.value); else v=el.value;
      store.setCustom(id,fid,v); if(after) after(); }; });
  root.querySelectorAll('.cfmulti').forEach(el=>{ el.onmousedown=e=>e.stopPropagation();
    el.onclick=e=>{ e.stopPropagation(); if(!canEditField('custom')){ toast('You can\u2019t edit custom fields'); return; } openCfMulti(el.dataset.id, el.dataset.fid, el, after); }; });
  root.querySelectorAll('.projbtn').forEach(el=>{ el.onmousedown=e=>e.stopPropagation();
    el.onclick=e=>{ e.stopPropagation(); if(!canEditField('project')){ toast('You can\u2019t edit this field'); return; } const id=el.dataset.id; const t=store.task(id);
      const opts=[{v:'',t:'Not Assigned'}].concat(store.projects().map(pr=>({v:pr.id,t:pr.name})));
      openSelMenu(el, opts, t.project||'', v=>{ store.updateTask(id,{project:v||null}); refreshViews(); }); }; });
  root.querySelectorAll('.asgbtn').forEach(el=>{ el.onmousedown=e=>e.stopPropagation();
    el.onclick=e=>{ e.stopPropagation(); if(!canEditField('assignee')){ toast('You can\u2019t edit this field'); return; } const id=el.dataset.id; const t=store.task(id);
      const opts=[{v:'',t:'Unassigned'}].concat(store.activeUsers().map(u=>({v:u.id,t:u.name,ava:avatar(u,18)})));
      openSelMenu(el, opts, t.assignee||'', v=>{ store.updateTask(id,{assignee:v||null}); refreshViews(); }); }; });
  root.querySelectorAll('.cdate').forEach(el=>{ el.onmousedown=e=>e.stopPropagation();
    el.onclick=e=>{ e.stopPropagation(); const f=el.dataset.field||'due'; if(!canEditField(f)){ toast('You can\u2019t edit this field'); return; } openDateMenu(el, el.dataset.id, (store.task(el.dataset.id)||{})[f], f); }; });
  root.querySelectorAll('.card-kebab').forEach(el=>{ el.onmousedown=e=>e.stopPropagation();
    el.onclick=e=>{ e.stopPropagation(); openCardMenu(el, el.dataset.id); }; });
}
function copyText(s){ try{ if(navigator.clipboard){ navigator.clipboard.writeText(s); return; } }catch(_){}
  const ta=document.createElement('textarea'); ta.value=s; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(_){} ta.remove(); }
function closeCardMenu(){ const m=document.getElementById('cardMenu'); if(m) m.classList.remove('on'); }
function openCardMenu(anchor, id){
  const menu=document.getElementById('cardMenu'); const t=store.task(id); if(!t) return;
  const arrow='<svg class="cm-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
  const boardMenu=()=>{
    const cur=t.board || boardlessAnchorId();
    const BK='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
    const CK='<svg class="cm-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    menu.innerHTML=`<button class="cm-item cm-back" data-back="1">${BK}Move to board</button><div class="cm-sep"></div>`
      + store.boards().map(b=>`<button class="cm-item${b.id===cur?' cm-cur':''}" data-bd="${b.id}">${esc(b.name)}${b.id===cur?CK:''}</button>`).join('');
    menu.querySelector('[data-back]').onclick=e=>{ e.stopPropagation(); main(); };
    menu.querySelectorAll('[data-bd]').forEach(b=>b.onclick=e=>{ e.stopPropagation();
      const bid=b.dataset.bd;
      if(bid===cur){ closeCardMenu(); return; }
      store.updateTask(id,{board:bid});
      closeCardMenu(); refreshViews();
      const bn=(store.board(bid)||{}).name||'that board';
      toast(`${t.key} moved to ${bn}`); });
  };
  const main=()=>{ menu.innerHTML=`
      ${can('ticket_move')?`<button class="cm-item" data-a="status">Change status ${arrow}</button><div class="cm-sep"></div>`:''}
      ${can('ticket_copy')?`<button class="cm-item" data-a="copykey">Copy key</button><button class="cm-item" data-a="copylink">Copy link</button>`:''}
      ${can('ticket_flag')?`<button class="cm-item" data-a="flag">${t.flagged?'Remove flag':'Add flag'}</button>`:''}
      <button class="cm-item" data-a="colour">Card colour ${arrow}</button>
      ${(can('ticket_move') && store.boards().length>1)?`<button class="cm-item" data-a="board">Move to board ${arrow}</button>`:''}
      ${(can('ticket_archive')||can('ticket_delete'))?'<div class="cm-sep"></div>':''}
      ${can('ticket_archive')?`<button class="cm-item" data-a="archive">Archive</button>`:''}
      ${can('ticket_delete')?`<button class="cm-item cm-danger" data-a="delete">Delete</button>`:''}`;
    menu.querySelectorAll('.cm-item').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const a=b.dataset.a;
      if(a==='status'){ statusMenu(); return; }
      if(a==='colour'){ colourMenu(); return; }
      if(a==='board'){ boardMenu(); return; }
      if(a==='copykey'){ copyText(t.key); toast('Key copied'); }
      else if(a==='copylink'){ copyText(location.origin+location.pathname+'#'+t.key); toast('Link copied'); }
      else if(a==='flag'){ store.updateTask(id,{flagged:!t.flagged}); refreshViews(); }
      else if(a==='archive'){ store.updateTask(id,{archived:true}); refreshViews(); toast(`${t.key} archived`); }
      else if(a==='delete'){ if(!can('ticket_delete')){ toast('You don\u2019t have permission to delete tickets'); closeCardMenu(); return; }
        const _cm=((t.comments)||[]).length, _sb=((t.subtasks)||[]).length, _wl=store.data.worklogs.filter(w=>w.task===id).length;
        confirmDelete({ title:'Delete ticket', lead:`Delete <b>${esc(t.key)}</b> \u2014 ${esc(t.title)}?`,
          impact:[{n:_sb,label:'subtask'+(_sb===1?'':'s')},{n:_cm,label:'comment'+(_cm===1?'':'s')},{n:_wl,label:'time log'+(_wl===1?'':'s')}],
          confirmLabel:'Delete ticket',
          onConfirm:()=>{ store.removeTask(id); if(ui.openTask===id) closePanel(); refreshViews(); toast(`${t.key} deleted`); } }); }
      closeCardMenu(); }); };
  const statusMenu=()=>{ const bd=activeBoard(); const enf=!!(bd&&bd.enforce);
    const allow = enf ? [t.status, ...allowedTargets(bd, t.status)] : STATUSES.map(s=>s.id);
    const opts = STATUSES.filter(s=>allow.includes(s.id));
    menu.innerHTML=`<button class="cm-item cm-back" data-back="1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg> Back</button><div class="cm-sep"></div>`+
      opts.map(s=>`<button class="cm-item${t.status===s.id?' cm-cur':''}" data-s="${s.id}">${esc(s.name)}${t.status===s.id?'<svg class="cm-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>':''}</button>`).join('')+
      (enf?'<div class="cm-sep"></div><div style="padding:7px 12px 4px;font-size:10.5px;color:var(--muted)">Only allowed transitions for this board</div>':'');
    menu.querySelector('[data-back]').onclick=e=>{ e.stopPropagation(); main(); };
    menu.querySelectorAll('[data-s]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const bd2=activeBoard();
      if(bd2&&bd2.enforce&&!canMove(bd2,t.status,b.dataset.s)){ toast(`${store.status(t.status).name} → ${store.status(b.dataset.s).name} isn't an allowed transition`); return; }
      store.moveTask(id,b.dataset.s); closeCardMenu(); refreshViews(); toast(`${t.key} → ${store.status(b.dataset.s).name}`); }); };
  const colourMenu=()=>{ menu.innerHTML=`<button class="cm-item cm-back" data-back="1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg> Back</button><div class="cm-sep"></div>`+
      `<div class="cm-swatches">${SWATCHES.map(c=>`<button class="cm-sw${t.color===c?' on':''}" style="background:${c}" data-c="${c}" title="${c}"></button>`).join('')}</div>`+
      `<div class="cm-sep"></div><button class="cm-item" data-c="">${t.color?'Remove colour':'No colour'}</button>`;
    menu.querySelector('[data-back]').onclick=e=>{ e.stopPropagation(); main(); };
    menu.querySelectorAll('[data-c]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); store.updateTask(id,{color:b.dataset.c||null}); closeCardMenu(); refreshViews(); }); };
  main();
  const r=anchor.getBoundingClientRect(); const w=210;
  posMenu(menu, r, 4, w, true);
}
document.addEventListener('click',e=>{ if(!e.target.closest('#cardMenu')&&!e.target.closest('.card-kebab')) closeCardMenu(); });
