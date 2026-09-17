/* Taskora — 07-new-ticket.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ============================================================
   NEW TICKET
============================================================ */
function ntWireDates(){
  ['ntStart','ntDue'].forEach(id=>{
    const inp=document.getElementById(id); const btn=document.querySelector('.nt-val[data-date="'+id+'"]'); if(!inp||!btn) return;
    const refresh=()=>{ const v=inp.value; const t=btn.querySelector('.nt-val-in span');
      if(v){ const d=new Date(v+'T00:00'); t.textContent=d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); btn.classList.remove('ph'); }
      else { t.textContent='Pick date'; btn.classList.add('ph'); } };
    inp.onchange=refresh; inp._refresh=refresh; refresh();
  });
}
function ntIsPerson(id){ return id==='ntAssignee'||id==='ntReporter'; }
function ntBtnDisplay(selId){
  const sel=document.getElementById(selId); const btn=document.querySelector('.nt-val[data-for="'+selId+'"]'); if(!sel||!btn) return;
  const opt=sel.options[sel.selectedIndex]; const label=opt?opt.textContent:'';
  let inner=''; if(ntIsPerson(selId) && sel.value){ const u=store.user(sel.value); if(u) inner=avatar(u,18); }
  const ph=(!sel.value||label==='None'||label==='Unassigned');
  btn.querySelector('.nt-val-in').innerHTML=inner+'<span>'+esc(label||'')+'</span>';
  btn.classList.toggle('ph', ph && !inner);
}
function openNtMenu(btn){
  const selId=btn.dataset.for; const sel=document.getElementById(selId); if(!sel) return;
  const menu=document.getElementById('ntMenu'); const isP=ntIsPerson(selId);
  menu.innerHTML=[...sel.options].map(o=>{ let ic=''; if(isP&&o.value){ const u=store.user(o.value); if(u) ic=avatar(u,18); }
    const on=o.value===sel.value;
    return '<div class="nt-mi '+(on?'sel':'')+'" data-v="'+esc(o.value)+'">'+ic+'<span class="nt-mi-t">'+esc(o.textContent)+'</span>'+(on?'<svg class="nt-mi-chk" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>':'')+'</div>';
  }).join('');
  const r=btn.getBoundingClientRect(); const mw=Math.max(190, r.width);
  menu.style.minWidth=mw+'px';
  menu.style.left=Math.max(8, Math.min(r.right-mw, window.innerWidth-mw-8))+'px';
  menu.style.visibility='hidden'; menu.classList.add('on');
  const mh=menu.offsetHeight; let top=r.bottom+5;
  if(top+mh>window.innerHeight-8) top=Math.max(8, r.top-5-mh);
  menu.style.top=top+'px'; menu.style.visibility='';
  menu._sel=selId;
  menu.querySelectorAll('.nt-mi').forEach(mi=>mi.onclick=(e)=>{ e.stopPropagation(); sel.value=mi.dataset.v; sel.dispatchEvent(new Event('change')); ntBtnDisplay(selId); menu.classList.remove('on'); });
}
function closeNtMenu(){ const m=document.getElementById('ntMenu'); if(m) m.classList.remove('on'); }
function wireNtVals(){
  document.querySelectorAll('#modalWrap .nt-val').forEach(btn=>{
    btn.onclick=(e)=>{ e.stopPropagation(); const m=document.getElementById('ntMenu'); const isOpen=m.classList.contains('on')&&m._sel===btn.dataset.for; if(isOpen) closeNtMenu(); else openNtMenu(btn); };
    ntBtnDisplay(btn.dataset.for);
  });
}
document.addEventListener('click',e=>{ const m=document.getElementById('ntMenu'); if(m&&m.classList.contains('on')&&!e.target.closest('#ntMenu')&&!e.target.closest('.nt-val')) closeNtMenu(); });
window.addEventListener('scroll',(e)=>{ const m=document.getElementById('ntMenu'); if(m&&m.classList.contains('on')&&!(e.target&&e.target.closest&&e.target.closest('#ntMenu'))) closeNtMenu(); }, true);
/* Ticket keys.  PREFIX_001, PREFIX_002 …
   The old version used (100 + number-of-tickets), so deleting a ticket handed
   the next one a number that was already taken — and two clients with the same
   count minted identical keys. This walks the highest number actually in use
   and then guarantees the result is free. */
/* Ids must be unique across clients — Date.now() alone collides when two people
   create a ticket in the same millisecond, and the DB upsert then silently
   overwrites one of them. */
function newTaskId(prefix){
  return (prefix||'t')+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
}
/* Ask Postgres for the number.
   computeNextKey() below reads THIS browser's task list and returns max+1 —
   two browsers both see 118 and both mint _119. pm_next_key() increments a
   counter row inside the database, so concurrent callers queue and each gets a
   distinct number. The local path stays as an offline fallback only. */
/* Ticket keys are per-project: LMS-1, LMS-2, PAY-1 … The prefix comes from the
   project's Key, so each project counts independently (the Jira model). */
function projPrefix(pid){
  const p=pid?store.project(pid):null;
  if(p && p.key) return String(p.key).toUpperCase();
  if(p && p.name) return (p.name.replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase())||'PRJ';
  return 'NP';                       // no project → "NP-1" rather than a clash
}
function keyPrefix(pid){ return projPrefix(pid); }
async function allocateKey(pid){
  const prefix = projPrefix(pid);
  const space  = (typeof ui!=='undefined' && ui.space) || 'ws_main';
  // The set of keys already in use for this prefix, so we can never mint a duplicate
  // even if the DB counter is behind the actual tickets (e.g. after an import or a
  // counter that was never seeded). collision-proofing applies to BOTH paths.
  const takenNums = ()=>{
    const re=new RegExp('^'+prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[-_ ]?(\\d+)$','i');
    const s=new Set();
    store.data.tasks.forEach(t=>{ const m=(t.key||'').match(re); if(m) s.add(parseInt(m[1],10)); });
    return s;
  };
  if(typeof sb!=='undefined' && sb && WS){
    try{
      const {data, error} = await pmdb.rpc('pm_next_key', { p_ws:WS, p_space:space, p_prefix:prefix });
      if(!error && Number.isFinite(data)){
        let n=data; const taken=takenNums();
        // if the DB counter handed back a number that's already used locally, walk
        // forward until we find a free one (and keep calling the RPC to advance its
        // counter so other clients don't re-hand the same numbers).
        let guard=0;
        while(taken.has(n) && guard<200){
          const r=await pmdb.rpc('pm_next_key', { p_ws:WS, p_space:space, p_prefix:prefix });
          if(r && !r.error && Number.isFinite(r.data) && r.data>n){ n=r.data; } else { n=n+1; }
          guard++;
        }
        return prefix+'-'+n;
      }
      __dbg.warn('[key] allocator unavailable, falling back locally', error);
    }catch(e){ __dbg.warn('[key] allocator threw, falling back locally', e); }
  }
  return computeNextKey(pid);          // offline / local mode (already collision-proof)
}

/* ---- One-time key migration ---------------------------------------------
   Renumbers every ticket to its project's key (LMS-1, LMS-2, PAY-1 …) in
   creation order. The original key is kept as legacyKey so an old reference
   in Slack or a PR can still be traced. Preview first, then apply. */
function planKeyRenumber(){
  const byProj={};
  store.data.tasks.forEach(t=>{ const k=t.project||'__none'; (byProj[k]=byProj[k]||[]).push(t); });
  const plan=[]; let changed=0;
  Object.keys(byProj).forEach(pk=>{
    const pid = pk==='__none' ? null : pk;
    const prefix = projPrefix(pid);
    const list = byProj[pk].slice().sort((a,b)=>{
      const at=a.createdTs||a.createdAt||'', bt=b.createdTs||b.createdAt||'';
      if(at!==bt) return at<bt?-1:1;
      return String(a.id).localeCompare(String(b.id));      // stable tiebreak
    });
    list.forEach((t,i)=>{ const nk=prefix+'-'+(i+1);
      if(nk!==t.key) changed++;
      plan.push({id:t.id, from:t.key||'\u2014', to:nk, project:(store.project(pid)||{}).name||'No project', title:t.title});
    });
  });
  return {plan, changed, total:plan.length};
}
function runKeyRenumber(){
  if(!can('key_renumber')){ toast('You don\u2019t have permission to renumber ticket keys'); return; }
  /* Two projects sharing a key would produce duplicate ticket numbers, so the
     keys have to be sorted out before any renumbering happens. */
  const used=store.projects().filter(p=>store.tasks().some(t=>t.project===p.id));
  const seen={}, dupes=[];
  used.forEach(p=>{ const k=String(p.key||'').toUpperCase()||'(none)';
    if(seen[k]) dupes.push({key:k, a:seen[k], b:p.name}); else seen[k]=p.name; });
  if(dupes.length){
    const rows=dupes.map(d=>`<div class="cfm-il"><span><b>${esc(d.key)}</b> \u2014 used by ${esc(d.a)} and ${esc(d.b)}</span></div>`).join('');
    confirmDelete({
      title:'Fix project keys first',
      lead:`Some projects share the same key, so renumbering would create duplicate ticket numbers.<br><br>Open <b>Projects</b>, use each project's <b>\u22ef</b> menu \u2192 <b>Edit name &amp; key</b>, and give each one its own key. Then run this again.`,
      confirmLabel:'Go to Projects',
      onConfirm:()=>{ setView('projects'); }
    });
    const box=document.getElementById('cfmImpact');
    if(box) box.innerHTML=`<div class="cfm-impact-h">Duplicate keys</div>${rows}`;
    return;
  }
  const {plan, changed, total}=planKeyRenumber();
  if(!total){ toast('No tickets to renumber'); return; }
  if(!changed){ toast('Every key already matches its project'); return; }
  const groups={};
  plan.forEach(r=>{ groups[r.project]=(groups[r.project]||0)+1; });
  const summary=Object.keys(groups).sort().map(g=>`<div class="cfm-il" style="color:var(--ink-2)"><span><b>${groups[g]}</b> in ${esc(g)}</span></div>`).join('');
  const sample=plan.filter(r=>r.from!==r.to).slice(0,6)
    .map(r=>`<div class="km-row"><span class="km-old">${esc(r.from)}</span><span class="km-arw">\u2192</span><span class="km-new">${esc(r.to)}</span><span class="km-ti">${esc(r.title||'')}</span></div>`).join('');
  confirmDelete({
    title:'Renumber ticket keys',
    lead:`Give every ticket a key based on its project, numbered in the order it was created.<br><br><b>${changed}</b> of <b>${total}</b> ticket${total===1?'':'s'} will get a new key. The old key is kept on each ticket, so existing references can still be traced.`,
    confirmLabel:'Renumber '+changed+' ticket'+(changed===1?'':'s'),
    onConfirm:()=>{
      let n=0;
      plan.forEach(r=>{ const t=store.task(r.id); if(!t||t.key===r.to) return;
        if(!t.legacyKey) t.legacyKey=t.key||null; t.key=r.to; n++; });
      store._persist(); refreshViews();
      toast(n+' ticket'+(n===1?'':'s')+' renumbered');
    }
  });
  const box=document.getElementById('cfmImpact');
  if(box) box.innerHTML=`<div class="cfm-impact-h" style="color:var(--ink-2)">By project</div>${summary}`
    + (sample?`<div class="km-sample">${sample}${changed>6?`<div class="km-more">+ ${changed-6} more</div>`:''}</div>`:'');
}
function computeNextKey(pid){
  const prefix=projPrefix(pid);
  const taken=new Set(store.data.tasks.map(t=>t.key).filter(Boolean));
  const re=new RegExp('^'+prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[-_ ]?(\\d+)$','i');
  let mx=0;
  store.data.tasks.forEach(t=>{ const m=(t.key||'').match(re); if(m) mx=Math.max(mx, parseInt(m[1],10)||0); });
  let n=mx+1, key;
  do { key=prefix+'-'+n; n++; } while(taken.has(key));
  return key;
}


function parseEstimate(str){
  if(str==null) return null; str=(''+str).trim().toLowerCase(); if(!str) return null;
  let mins=0, matched=false;
  const h=str.match(/(\d+(?:\.\d+)?)\s*h/); if(h){ mins+=parseFloat(h[1])*60; matched=true; }
  const m=str.match(/(\d+)\s*m/); if(m){ mins+=parseInt(m[1],10); matched=true; }
  if(!matched){ const n=parseFloat(str); if(!isNaN(n)) mins=n*60; else return null; }
  return mins>0?Math.round(mins):null;
}
function fmtEstimate(mins){ if(!mins) return ''; const h=Math.floor(mins/60),m=Math.round(mins%60); return ((h?h+'h':'')+(m?(h?' ':'')+m+'m':''))||'0m'; }
function ntNextKey(){ const pe=document.getElementById('ntProject'); if(!pe||!pe.value) return ''; return computeNextKey(pe.value); }
function typeNtKey(){
  const wrap=document.getElementById('ntKeyBadge'), out=document.getElementById('ntKeyText'); if(!wrap||!out) return;
  const full=ntNextKey();
  if(!full){ wrap.style.display='none'; return; }
  wrap.style.display='inline-flex';
  if(out._t) clearInterval(out._t); out.textContent=''; let i=0;
  out._t=setInterval(()=>{ out.textContent=full.slice(0,++i); if(i>=full.length){ clearInterval(out._t); out._t=null; } }, 55);
}
let _ntBoardOverride=null;
function openModal(presetType, presetParent, presetProject){
  if(!can('ticket_create')){ toast('You don\u2019t have permission to create tickets'); return; }
  _ntBoardOverride=null;                 // ticket adopts current board unless a project overrides it
  const setSel=(id,opts)=>document.getElementById(id).innerHTML=opts;
  const isEpic=presetType==='Epic';
  document.getElementById('ntCreate').textContent = isEpic?'Create epic':'Create ticket';
  // Strict model: a ticket can only use a project that belongs to its board.
  // The dropdown lists ONLY the current board's projects — no cross-board escape.
  (function(){
    const curBd=(ui.board && store.board(ui.board))?ui.board:null;
    const boardProjs=curBd?store.projectsForBoard(curBd):store.projects();
    let html=`<option value="">Select a project\u2026</option>`;
    html+=boardProjs.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
    if(!boardProjs.length){ html=`<option value="">No projects on this board yet</option>`; }
    setSel('ntProject', html);
  })();
  setSel('ntAssignee', `<option value="">Unassigned</option>`+store.activeUsers().map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join(''));
  if(curPrefs().autoAssign){ const mu=myUid(); if(mu&&store.user(mu)) document.getElementById('ntAssignee').value=mu; }
  setSel('ntReporter', `<option value="">Select a reporter\u2026</option>`+store.activeUsers().map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join(''));
  setSel('ntPriority', `<option value="">Select a priority\u2026</option>`+store.priorities().map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''));
  setSel('ntType', `<option value="">Select a type\u2026</option>`+store.types().map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''));
  // Status options are scoped to the CURRENT BOARD's columns, so a new ticket can only
  // start in a status that's actually a column on this board. Picking a global status
  // that isn't a board column is what created phantom duplicate columns before.
  (function(){
    const curBd=(ui.board && store.board(ui.board))?store.board(ui.board):null;
    const cols = curBd ? store.boardColumns(curBd) : STATUSES;
    const list = (cols && cols.length) ? cols : STATUSES;
    setSel('ntStatus', `<option value="">Select a status\u2026</option>`+list.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join(''));
  })();
  fillParentOptions();
  document.getElementById('ntProject').onchange=()=>{ fillParentOptions(); typeNtKey(); ntBtnDisplay('ntParent'); ntBtnDisplay('ntProject');
    // Auto-follow the project's home board (overridable): if the chosen project lives
    // on a different board than the one we're on, the ticket adopts that board.
    const pv=document.getElementById('ntProject').value;
    if(pv){ const hb=store.projectBoardId(store.project(pv)); if(hb) _ntBoardOverride=hb; }
  };
  document.getElementById('ntType').onchange=toggleEpicField;
  toggleEpicField();
  ['ntTitle','ntDesc','ntDue','ntStart','ntEstimate'].forEach(id=>document.getElementById(id).value='');
  ['ntType','ntPriority','ntStatus','ntProject','ntReporter'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
  if(presetProject){ document.getElementById('ntProject').value=presetProject; fillParentOptions();
    const hb=store.projectBoardId(store.project(presetProject)); if(hb) _ntBoardOverride=hb; }
  if(presetType){ document.getElementById('ntType').value=presetType; }
  if(presetParent){ const pp=document.getElementById('ntParent'); if(pp) pp.value=presetParent; }
  toggleEpicField();
  wireNtVals();
  ntWireDates();
  typeNtKey();
  document.getElementById('modalWrap').classList.add('on');
  document.getElementById('ntTitle').focus();
}
function fillParentOptions(){
  const opts=`<option value="">None</option>`+store.epics().map(e=>`<option value="${e.id}">${e.key} · ${esc(e.title)}</option>`).join('');
  document.getElementById('ntParent').innerHTML=opts;
}
function toggleEpicField(){ const isEpic=document.getElementById('ntType').value==='Epic';
  document.getElementById('ntParentField').style.display=isEpic?'none':'flex'; }
function closeModal(){ document.getElementById('modalWrap').classList.remove('on'); }

/* ---------- Jira-style Log time modal ---------- */
let logTaskId=null;
/* ---------- Settings: draft + explicit save ----------
   Every control used to call store.updateUser()/updateSettings() on change,
   which fired a persist + DB push per keystroke — hence the lag when changing
   several fields quickly. Now the edits stay local and go up in one write. */
let _setDirty=false;
let PENDING_ROLES={};   // staged role changes {authId: 'admin'|'user'}, persisted on Save
function setMarkDirty(){
  _setDirty=true;
  const p=document.getElementById('setDirty'); if(p) p.classList.add('on');
  const b=document.getElementById('setSave'); if(b) b.disabled=false;
}
async function setSaveNow(){
  const u=meUser();
  if(u) store.updateUser(u.id,{prefs:u.prefs});     // one write for prefs
  store.updateSettings({});                          // flush perms/field edits
  // persist any staged role changes through the admin-users Edge Function
  if(typeof sb!=='undefined' && sb && Object.keys(PENDING_ROLES).length){
    try{
      for(const [authId, role] of Object.entries(PENDING_ROLES)){
        await callAdmin('set_role', { user_id:authId, role: role==='admin' ? 'admin' : 'member' });
      }
      PENDING_ROLES={};
    }catch(err){ toast('Couldn’t save the role change: '+(err.message||err)); return; }
  }
  _setDirty=false;
  renderSettings(); applyPrefs(); renderAll();
  toast('Settings saved');
}
function setDiscard(){ _setDirty=false; PENDING_ROLES={}; if(REMOTE){ location.reload(); return; } renderSettings(); }

/* ---------- Subtask dialog ----------
   Captures assignee + estimate + done. The estimate rolls into the parent's
   original estimate by DELTA, so a manually-set estimate is never clobbered. */
let _sbTask=null, _sbId=null, _sbDone=false;
function openSubModal(taskId, subId){
  const t=store.task(taskId); if(!t) return;
  _sbTask=taskId; _sbId=subId||null;
  const sub=(t.subtasks||[]).find(x=>x.id===subId) || {title:'',assignee:'',estimate:0,done:false};
  _sbDone=!!sub.done;
  document.getElementById('subCtx').textContent=t.key+' \u00b7 '+t.title;
  document.getElementById('sbTitle').value=sub.title||'';
  document.getElementById('sbEst').value=sub.estimate?hm(sub.estimate):'';
  const who=document.getElementById('sbWho');
  who.innerHTML='<option value="">Unassigned</option>'+store.activeUsers(sub.assignee).map(u=>`<option value="${u.id}" ${sub.assignee===u.id?'selected':''}>${esc(u.name)}</option>`).join('');
  const dt=document.getElementById('sbDone'); dt.classList.toggle('on', _sbDone);
  dt.onclick=()=>{ _sbDone=!_sbDone; dt.classList.toggle('on', _sbDone); };
  document.getElementById('subWrap').classList.add('on');
  setTimeout(()=>document.getElementById('sbTitle').focus(),40);
}
function closeSubModal(){ const w=document.getElementById('subWrap'); if(w) w.classList.remove('on'); }
function saveSubModal(){
  const t=store.task(_sbTask); if(!t) return;
  const title=document.getElementById('sbTitle').value.trim();
  if(!title){ toast('Give the subtask a title'); return; }
  const who=document.getElementById('sbWho').value||'';
  const estStr=document.getElementById('sbEst').value.trim();
  const est=estStr?(parseDur(estStr)||0):0;
  if(estStr && !parseDur(estStr)){ toast('Could not read that estimate — try 2h 30m'); return; }
  const subs=(t.subtasks||[]).slice();
  let prevEst=0;
  if(_sbId){
    const i=subs.findIndex(x=>x.id===_sbId);
    if(i<0){ closeSubModal(); return; }
    prevEst=subs[i].estimate||0;
    subs[i]=Object.assign({}, subs[i], {title, assignee:who, estimate:est, done:_sbDone});
  } else {
    subs.push({id:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), title, assignee:who, estimate:est, done:_sbDone});
  }
  // roll the change into the parent's original estimate
  const delta=est-prevEst;
  const patch={subtasks:subs};
  if(delta) patch.estimate=Math.max(0,(t.estimate||0)+delta);
  store.updateTask(_sbTask, patch);
  closeSubModal(); openPanel(_sbTask,true);
  toast(_sbId?'Subtask updated':'Subtask added');
}

function openLogModal(taskId, presetCat){
  if(!can('time_log_own')&&!can('time_log_others')){ toast('You don\u2019t have permission to log time'); return; }
  logTaskId=taskId;
  const t=store.task(taskId); const tot=taskTotals(taskId);
  const est=t.estimate||0; const logged=tot.total; const remaining=Math.max(0, est-logged);
  const denom=Math.max(est, logged, 1);
  document.getElementById('logCtx').textContent=`${t.key} · ${t.title}`;
  document.getElementById('lpFill').style.width=Math.min(100, logged/denom*100)+'%';
  document.getElementById('lpLogged').textContent=`${hm(logged)} logged`;
  document.getElementById('lpRemain').textContent= est? `${hm(remaining)} remaining` : 'no estimate';
  document.getElementById('logEst').innerHTML= est
    ? `The original estimate for this work item was <b>${jiraDur(est)}</b>.`
    : `No original estimate set — you can enter time remaining below to set one.`;
  { const defCat=presetCat||curPrefs().logCat||'Development'; document.getElementById('logCat').innerHTML=CATS.map(c=>`<option value="${c.id}" ${c.id===defCat?'selected':''}>${c.id}</option>`).join(''); }
  // Default to the person doing the logging — NOT the ticket's assignee. Defaulting
  // to the assignee meant logging time on someone else's ticket silently recorded
  // it against THEM. Every tracker defaults to "me"; you must opt in to log for others.
  const _logMe=myUid();
  const _logList=((can('time_log_others')||curPrefs().logOthers)?store.users():store.users().filter(u=>u.id===_logMe));
  const _logSel=document.getElementById('logWho');
  _logSel.innerHTML=_logList.map(u=>`<option value="${u.id}" ${u.id===_logMe?'selected':''}>${esc(u.name)}${u.role!=='Developer'?' · '+esc(u.role):''}</option>`).join('');
  if(_logList.some(u=>u.id===_logMe)) _logSel.value=_logMe;   // belt and braces
  document.getElementById('logSpent').value='';
  document.getElementById('logRem').value= est? jiraDur(remaining) : '';
  document.getElementById('logDate').value=today();
  document.getElementById('logNote').value='';
  document.getElementById('logWrap').classList.add('on');
  setTimeout(()=>document.getElementById('logSpent').focus(),50);
}
function closeLogModal(){ document.getElementById('logWrap').classList.remove('on'); logTaskId=null; }
function saveLog(){
  const id=logTaskId; if(!id) return;
  const spent=parseDur(document.getElementById('logSpent').value);
  if(!spent||spent<=0){ toast('Enter time spent (e.g. 3h 30m)'); return; }
  const cat=document.getElementById('logCat').value;
  const uid=document.getElementById('logWho').value;
  const date=document.getElementById('logDate').value||today();
  const note=document.getElementById('logNote').value.trim();
  const _preLogged=taskTotals(id).total; const _hadEst=(store.task(id).estimate||0)>0;
  store.addWorklog({id:'w'+Date.now().toString(36)+Math.random().toString(36).slice(2,7), task:id, user:uid, cat, min:spent, date, note, loggedAt:new Date().toISOString()});
  // Jira behaviour: entered "time remaining" resets the estimate relative to new logged total
  const remStr=document.getElementById('logRem').value.trim();
  // original estimate is only settable on the very first log of a ticket that has none; it never changes afterwards
  if(remStr!=='' && _preLogged===0 && !_hadEst){ const rem=parseDur(remStr); if(rem!=null){ store.updateTask(id,{estimate:taskTotals(id).total+rem}); } }
  closeLogModal(); openPanel(id,true); refreshViews(); toast(`Logged ${hm(spent)} · ${cat}`);
}
async function createTask(){
  /* Mandatory fields — enforced in one place so every creation flow behaves
     the same: focus the offending control, flash it, say what's missing. */
  if(!reqCheck([
    ['ntTitle',   'Give the ticket a title'],
    ['ntProject', 'Pick a project for this ticket'],
    ['ntType',    'Pick a ticket type'],
    ['ntStatus',  'Pick a starting status'],
    ['ntPriority','Pick a priority'],
    ['ntReporter','Pick a reporter'],
  ])) return;
  const title=document.getElementById('ntTitle').value.trim();
  if(!title){ toast('Give the ticket a title'); return; }
  const pid=document.getElementById('ntProject').value;
  const estMin=parseEstimate(document.getElementById('ntEstimate').value);
  const statusId=document.getElementById('ntStatus').value;
  const type=document.getElementById('ntType').value;
  const isEpic=type==='Epic';
  const btn=document.getElementById('ntCreate');
  if(btn) btn.disabled=true;                       // no double-allocating on a double click
  let allocated;
  try{ allocated=await allocateKey(pid); }
  finally{ if(btn) btn.disabled=false; }
  // Board a ticket lands on: in the strict model a project belongs to one board, so
  // the project's home board is the source of truth. Fall back to the board override,
  // then the board currently in view.
  const _projBoard = (!isEpic && pid) ? store.projectBoardId(store.project(pid)) : null;
  const _tkBoard = isEpic ? null : (_projBoard || _ntBoardOverride || ui.board || null);
  const t={ id:newTaskId(isEpic?'e':'t'), ws:(ui.space||'ws_main'), board:_tkBoard, project:pid, key:allocated, title,
    type, status:statusId,
    priority:document.getElementById('ntPriority').value, assignee:document.getElementById('ntAssignee').value||null,
    reporter:document.getElementById('ntReporter').value||null,
    parent:isEpic?null:(document.getElementById('ntParent').value||null),
    color:isEpic?SWATCHES[2+(store.epics().length%6)]:undefined,
    due:document.getElementById('ntDue').value||null, start:document.getElementById('ntStart').value||null,
    estimate: estMin,
    resolution:'Unresolved', createdAt:today(), createdTs:new Date().toISOString(), updatedAt:today(), resolvedAt:null,
    desc:document.getElementById('ntDesc').value.trim() };
  store._applyResolution(t);
  store.addTask(t);
  // Part B — if this ticket was created on a board and its status isn't yet one of
  // that board's columns, add it so the ticket is immediately visible there. A new
  // board thus grows to fit the work put on it, instead of hiding off-column tickets.
  if(t.board){ const bd=store.board(t.board);
    if(bd && t.status && !(bd.columns||[]).includes(t.status)){ store.toggleBoardColumn(bd, t.status, true); }
  }
  // Make sure the new ticket is actually visible: if it landed on a board other than
  // the one in view, follow it there so it never "disappears" after creation.
  if(!isEpic && t.board && ui.board && t.board!==ui.board && store.board(t.board)){ ui.board=t.board; }
  closeModal(); refreshViews(); toast(`${t.key} created`); openPanel(t.id);
}
