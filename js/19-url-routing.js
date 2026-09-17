/* Taskora — 19-url-routing.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ================== URL routing ==================
   Every meaningful bit of state lives in the hash, so a refresh, a back button
   or a pasted link all land on exactly the same screen with the same filters.
   Shape:  #/<space>/<view>[/<tab|board>]?<filters>
   e.g.    #/ws_tpm/analytics/productivity?period=today&ag=u4,u5
           #/ws_tpm/board?period=week&assignee=u4&t=t123
*/
let _urlApplying=false, _urlReady=false;
function urlBuild(){
  const q=new URLSearchParams();
  const put=(k,v,def)=>{ if(v!==undefined && v!==null && v!=='' && String(v)!==String(def)) q.set(k,String(v)); };
  const f=ui.filters||{};
  const v=ui.view||'overview';
  const seg=[ui.space||'', v];
  if(v==='analytics') seg.push(ui.analyticsTab||'productivity');
  if(v==='board' && ui.board) seg.push(ui.board);
  else if(typeof boardScopeOn==='function' && boardScopeOn()) seg.push('b:'+ui.board);

  if(v==='board'||v==='list'){
    put('period', f.period, 'all'); put('from', f.from); put('to', f.to);
    put('project', ui.project, 'all');
    // FILTER_DEFS is the source of truth for which filters are multi-select.
    // Those hold arrays — join them, and rebuild them as arrays on the way back,
    // or the multi-select menus stop recognising what is already picked.
    (typeof FILTER_DEFS!=='undefined'?FILTER_DEFS:[]).forEach(d=>{
      const val=f[d.key];
      if(val===undefined || val===null || val==='all') return;
      if(Array.isArray(val)){ if(val.length) q.set(d.key, val.join(',')); }
      else q.set(d.key, String(val));
    });
    put('q', f.search);
  } else if(v==='overview'){
    put('period', ui.ovRange, 'all'); put('from', ui.ovFrom); put('to', ui.ovTo);
    put('project', ui.project, 'all');
  } else if(v==='analytics'){
    put('period', ui.anPeriod, 'all'); put('from', ui.anFrom); put('to', ui.anTo);
    put('project', ui.project, 'all');
    if(ui.analyticsTab==='productivity' && (ui.prSel||[]).length) q.set('ag', ui.prSel.join(','));
    if(ui.analyticsTab==='delivery' && ui.dlSel) q.set('st', ui.dlSel);
    if(ui.analyticsTab==='priority' && ui.piSel) q.set('pr', ui.piSel);
  } else if(v==='projects'){
    if(ui.pjSel) q.set('p', ui.pjSel);
  } else if(v==='settings'){
    if(ui.setSel) q.set('sec', ui.setSel);
  } else if(v==='deployments'){
    const d=ui.depFilter||{};
    put('period', d.mode, 'all'); put('from', d.from); put('to', d.to);
    put('project', d.project, 'all'); put('assignee', d.assignee, 'all');
    put('priority', d.priority, 'all'); put('group', d.group, 'none');
  }
  if(ui.openTask) q.set('t', ui.openTask);
  const qs=q.toString();
  return '#/'+seg.filter(Boolean).join('/')+(qs?('?'+qs):'');
}
function urlSync(){
  if(GUEST) return;
  if(_urlApplying || !_urlReady) return;
  const u=urlBuild();
  if(location.hash===u) return;
  try{ history.replaceState(null,'',u); }catch(e){ location.hash=u; }
}
function urlPush(){
  if(GUEST) return;
  if(_urlApplying || !_urlReady) return;
  const u=urlBuild();
  if(location.hash===u) return;
  try{ history.pushState(null,'',u); }catch(e){ location.hash=u; }
}
// read the hash back into ui. returns true if it drove navigation.
function urlApply(){
  if(GUEST) return false;
  const raw=(location.hash||'').replace(/^#\/?/,'');
  if(!raw) return false;
  const [path,qs]=raw.split('?');
  const seg=path.split('/').filter(Boolean);
  const q=new URLSearchParams(qs||'');
  if(!seg.length) return false;

  _urlApplying=true;
  try{
    // 1. workspace
    const spId=seg[0];
    const sp=store.space(spId);
    if(!sp || !canAccessSpace(sp)){ _urlApplying=false; return false; }
    ui.space=spId;
    hideSpaces();

    // 2. view
    let v=seg[1]||'overview';
    if(v!=='settings' && typeof canView==='function' && !canView(v)) v='overview';
    ui.view=v;

    // 3. sub-segment: dashboard tab, or which board
    if(v==='analytics'){ const tab=seg[2]; if(['productivity','delivery','priority'].includes(tab)) ui.analyticsTab=tab; }
    if(v==='board'){ const bd=seg[2]; if(bd && store.board(bd)){ ui.board=bd; ui.boardChosen=true; } }
    { const bs=seg.find(x=>/^b:/.test(x||'')); if(bs && store.board(bs.slice(2))){ ui.board=bs.slice(2); ui.boardChosen=true; ui.allBoards=false; } }
    if(!store.board(ui.board) || (store.board(ui.board).ws||'ws_main')!==ui.space){ const bds=store.boards(); ui.board=bds.length?bds[0].id:ui.board; }

    // 4. filters
    const g=(k,d)=>q.has(k)?q.get(k):d;
    ui.filters=ui.filters||{};
    if(v==='board'||v==='list'){
      ui.filters.period=g('period','all'); ui.filters.from=g('from',''); ui.filters.to=g('to','');
      ui.project=g('project','all');
      (typeof FILTER_DEFS!=='undefined'?FILTER_DEFS:[]).forEach(d=>{
        if(!q.has(d.key)){ ui.filters[d.key]='all'; return; }
        const raw=q.get(d.key);
        ui.filters[d.key] = d.multi ? raw.split(',').filter(Boolean) : raw;
      });
      ui.filters.search=g('q','');
    } else if(v==='overview'){
      ui.ovRange=g('period','all'); ui.ovFrom=g('from',''); ui.ovTo=g('to',''); ui.project=g('project','all');
    } else if(v==='analytics'){
      ui.anPeriod=g('period','all'); ui.anFrom=g('from',''); ui.anTo=g('to',''); ui.project=g('project','all');
      ui.prSel = q.has('ag') ? q.get('ag').split(',').filter(Boolean) : [];
      ui.dlSel = q.get('st')||null;
      ui.piSel = q.get('pr')||null;
    } else if(v==='projects'){
      ui.pjSel = q.get('p')||null;
    } else if(v==='settings'){
      ui.setSel = q.get('sec')||null;
    } else if(v==='deployments'){
      ui.depFilter=ui.depFilter||{};
      ui.depFilter.mode=g('period','all'); ui.depFilter.from=g('from',''); ui.depFilter.to=g('to','');
      ui.depFilter.project=g('project','all'); ui.depFilter.assignee=g('assignee','all');
      ui.depFilter.priority=g('priority','all'); ui.depFilter.group=g('group','none');
    }
    _urlApplying=false; _urlReady=true;
    setView(v);
    // 5. an open ticket
    const tid=q.get('t');
    if(tid && store.task(tid)) openPanel(tid); else if(!tid) closePanel();
    return true;
  }catch(e){ __dbg.warn('[url] could not apply', e); _urlApplying=false; return false; }
}
window.addEventListener('hashchange', ()=>{ if(!_urlApplying) urlApply(); });
window.addEventListener('popstate',  ()=>{ if(!_urlApplying) urlApply(); });

function saveSpot(){ try{ localStorage.setItem('tsk_spot', JSON.stringify({space:ui.space||null, view:ui.view||'overview', board:ui.board||null})); }catch(e){} }
function restoreSpot(){
  // A hash wins over the remembered spot: refresh, back/forward and pasted
  // links must all land exactly where the URL says.
  try{ if(location.hash && location.hash.length>2 && urlApply()) return; }catch(e){}
  let sp=null; try{ sp=JSON.parse(localStorage.getItem('tsk_spot')||'null'); }catch(e){}
  // Fresh entry (a new tab — e.g. just launched/logged in) has empty sessionStorage;
  // a reload of an ongoing session keeps it. Reload → same screen; fresh → honour Start-screen pref.
  let fresh=true; try{ fresh=!sessionStorage.getItem('tsk_booted'); sessionStorage.setItem('tsk_booted','1'); }catch(e){}
  if(sp && sp.space && store.space(sp.space) && canAccessSpace(store.space(sp.space))){
    ui.space=sp.space;
    const p=curPrefs();
    // Default project filter
    ui.project = (p.defaultProject==='all') ? 'all' : (p.defaultProject && store.project(p.defaultProject) ? p.defaultProject : 'all');
    // Default board (must belong to this space), else restore last board, else first
    const bds=store.boards();
    const wantBd = (p.defaultBoard && store.board(p.defaultBoard) && (store.board(p.defaultBoard).ws||'ws_main')===sp.space) ? p.defaultBoard : null;
    ui.board = wantBd || ((sp.board && store.board(sp.board) && (store.board(sp.board).ws||'ws_main')===sp.space) ? sp.board : (bds.length?bds[0].id:store.addBoard('Board')));
    hideSpaces();
    // Landing view
    let v;
    if(!fresh){ v = sp.view||'overview'; }                          // reload → exactly where you were
    else { const ss=p.startScreen||'last';
      if(ss==='board') v='board';
      else if(ss==='overview') v='overview';
      else v = (sp.view && sp.view!=='settings') ? sp.view : (p.defaultView||'overview');   // 'last visited'
    }
    setView(v);
    const el=document.getElementById('scroll'); if(el) el.scrollTop=0;
    return true;
  }
  showSpaces(); return false;
}
async function manualRefresh(btn){
  if(btn){ btn.classList.add('spinning'); btn.disabled=true; }
  try{
    if(typeof REMOTE!=='undefined' && REMOTE && typeof WS!=='undefined' && WS && typeof fetchAll==='function'){
      await fetchAll(); if(typeof buildSnap==='function') buildSnap();
    }
    renderAll(); toast('Refreshed');
  }catch(e){ toast('Couldn\u2019t refresh — check connection'); }
  if(btn){ setTimeout(()=>{ btn.classList.remove('spinning'); btn.disabled=false; }, 350); }
}
function hideSpaces(){ const el=document.getElementById('spacesScreen'); if(el) el.classList.remove('on'); }
function renderSpaces(){
  const grid=document.getElementById('spGrid'); if(!grid) return;
  const q='';
  const list=store.spaces().filter(canAccessSpace);
  const DOTS='<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>';
  const CHV='<svg class="sp-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>';
  grid.innerHTML=list.map(sp=>{
    const mem=(sp.members||[]).length;
    return `<div class="sp-card" data-space="${sp.id}">
      <div class="sp-card-top"><div class="sp-ic">${SP_ICON[sp.icon]||SP_ICON.layers}</div>
        ${(typeof IS_ADMIN!=='undefined'&&IS_ADMIN)?`<button class="sp-manage" data-space="${sp.id}" title="Manage workspace">${DOTS}</button>`:''}</div>
      <div class="sp-nm">${esc(sp.name||'')}</div>
      <div class="sp-desc">${esc(sp.desc||'')}</div>
      <div class="sp-foot"><span class="sp-cnt">${mem} member${mem!==1?'s':''}</span>${CHV}</div>
    </div>`;
  }).join('') + (q?'':(( (typeof IS_ADMIN!=='undefined'&&IS_ADMIN) )?`<button class="sp-card sp-new" id="spNewCard"><div class="sp-plus">+</div><div class="sp-nm">Create workspace</div><div class="sp-desc">Start fresh and choose who can access it.</div></button>`:''));
  if(!list.length && q) grid.innerHTML=`<div class="sp-empty">No workspaces match &ldquo;${esc(q)}&rdquo;.</div>`;
  else if(!list.length && !(typeof IS_ADMIN!=='undefined'&&IS_ADMIN)) grid.innerHTML=`<div class="sp-empty">You don\u2019t have access to any workspace yet.<br><span style="font-size:12.5px;color:var(--faint)">Ask an admin to add you to one.</span></div>`;
  grid.querySelectorAll('.sp-card[data-space]').forEach(c=>{ c.onclick=e=>{ if(e.target.closest('.sp-manage')) return; enterSpace(c.dataset.space); }; });
  grid.querySelectorAll('.sp-manage').forEach(b=>b.onclick=e=>{ e.stopPropagation(); openSpaceModal(b.dataset.space); });
  const nc=document.getElementById('spNewCard'); if(nc) nc.onclick=()=>openSpaceModal(null);
}
function enterSpace(id){ const sp=store.space(id); if(!sp) return;
  const _first=!ui.space;
  if(!canAccessSpace(sp)){ toast('You don\u2019t have access to that workspace'); showSpaces(); return; }
  ui.space=id; const p=curPrefs(); const bds=store.boards();
  const wantBd = (p.defaultBoard && store.board(p.defaultBoard) && (store.board(p.defaultBoard).ws||'ws_main')===id) ? p.defaultBoard : null;
  if(wantBd){ ui.board=wantBd; } else if(!bds.length){ ui.board=store.addBoard('Board'); } else if(!store.board(ui.board) || (store.board(ui.board).ws||'ws_main')!==id){ ui.board=bds[0].id; }
  ui.project = (p.defaultProject==='all') ? 'all' : (p.defaultProject && store.project(p.defaultProject) ? p.defaultProject : 'all');
  const ss=p.startScreen||'last'; ui.view = ss==='board' ? 'board' : ss==='overview' ? 'overview' : (p.defaultView||'overview');
  hideSpaces(); renderAll(); saveSpot(); try{ _first?urlSync():urlPush(); }catch(e){} const el=document.getElementById('scroll'); if(el) el.scrollTop=0; }
function backToSpaces(){ showSpaces(); }
function openSpaceModal(id){
  _spEdit=id||null; const sp=id?store.space(id):null;
  document.getElementById('spModalTitle').textContent=sp?'Manage workspace':'Create workspace';
  document.getElementById('spModalSave').textContent=sp?'Save changes':'Create workspace';
  document.getElementById('spmName').value=sp?(sp.name||''):'';
  document.getElementById('spmDesc').value=sp?(sp.desc||''):'';
  const icon=(sp&&sp.icon)||SP_ICONS[0].id;
  document.getElementById('spmIcons').innerHTML=SP_ICONS.map(o=>
    `<button type="button" class="sp-icb ${o.id===icon?'on':''}" data-i="${o.id}" title="${o.name}" aria-label="${o.name}">${SP_ICON[o.id]}</button>`).join('');
  document.querySelectorAll('#spmIcons .sp-icb').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('#spmIcons .sp-icb').forEach(x=>x.classList.toggle('on', x===b)); });
  const mem=sp?(sp.members||[]):store.users().map(u=>u.id);
  document.getElementById('spmMembers').innerHTML=store.users().map(u=>`<label class="sp-mrow"><input type="checkbox" value="${u.id}" ${mem.includes(u.id)?'checked':''}>${avatar(u,24)}${esc(u.name)}<span class="sp-mrole">${esc(u.role||'')}</span></label>`).join('');
  const upd=()=>{ const n=document.querySelectorAll('#spmMembers input:checked').length; document.getElementById('spmCount').textContent='· '+n+' selected'; };
  document.querySelectorAll('#spmMembers input').forEach(i=>i.onchange=upd); upd();
  const del=document.getElementById('spModalDelete'); if(del){ del.style.display=sp?'':'none'; del.textContent='Delete workspace'; del.classList.remove('armed'); _spDelArm=false; if(_spDelTimer) clearTimeout(_spDelTimer); }
  document.getElementById('spModalScrim').classList.add('on');
}
function closeSpaceModal(){ document.getElementById('spModalScrim').classList.remove('on'); }
function saveSpace(){
  if(!reqCheck([['spmName','Give the workspace a name']])) return;
  const name=document.getElementById('spmName').value.trim();
  const desc=document.getElementById('spmDesc').value.trim();
  const on=document.querySelector('#spmIcons .sp-icb.on'); const icon=on?on.dataset.i:SP_ICONS[0].id;
  const members=[...document.querySelectorAll('#spmMembers input:checked')].map(i=>i.value);
  if(_spEdit){ store.updateSpace(_spEdit,{name,desc,icon,members}); toast('Workspace updated'); }
  else { store.addSpace({id:'ws_'+Date.now(),name,desc,icon,members,createdAt:today()}); toast('Workspace created'); }
  closeSpaceModal(); renderSpaces();
}
let _spDelArm=false, _spDelTimer=null;
function deleteSpace(){
  if(!_spEdit) return; const sp=store.space(_spEdit); if(!sp) return;
  if(store.spaces().length<=1){ toast('You need at least one workspace'); return; }
  const btn=document.getElementById('spModalDelete');
  if(!_spDelArm){ _spDelArm=true; btn.textContent='Click again to delete'; btn.classList.add('armed'); _spDelTimer=setTimeout(()=>{ _spDelArm=false; btn.textContent='Delete workspace'; btn.classList.remove('armed'); },3000); return; }
  clearTimeout(_spDelTimer); _spDelArm=false;
  const wasCurrent=(ui.space===_spEdit);
  store.removeSpace(_spEdit); if(wasCurrent) ui.space=null;
  toast('Workspace deleted'); closeSpaceModal(); renderSpaces();
}
let _pjEdit=null, _pjDelArm=false, _pjDelTimer=null;
function openProjectModal(id){
  if(!can('project_edit')){ toast('You don\u2019t have permission to edit projects'); return; }
  const p=store.project(id); if(!p) return; _pjEdit=id;
  document.getElementById('pjmName').value=p.name||'';
  { const k=document.getElementById('pjmKey'); if(k){ k.value=p.key||'';
      k.oninput=()=>{ k.value=k.value.toUpperCase().replace(/[^A-Z0-9]/g,''); }; } }
  const del=document.getElementById('pjModalDelete'); del.textContent='Delete project'; del.classList.remove('armed'); _pjDelArm=false; if(_pjDelTimer) clearTimeout(_pjDelTimer);
  document.getElementById('pjModalScrim').classList.add('on');
}
function closeProjectModal(){ document.getElementById('pjModalScrim').classList.remove('on'); }
function saveProject(){
  if(!_pjEdit) return; if(!reqCheck([['pjmName','Give the project a name'],['pjmKey','Give the project a key']])) return;
  const name=document.getElementById('pjmName').value.trim();
  const key=(document.getElementById('pjmKey').value||'').trim().toUpperCase();
  { const clash=store.projects().find(x=>x.id!==_pjEdit && String(x.key||'').toUpperCase()===key);
    if(clash){ toast('\u201c'+key+'\u201d is already used by '+clash.name); return; } }
  const patch={name, key};
  store.updateProject(_pjEdit, patch); toast('Project updated'); closeProjectModal(); renderProjects(); if(window.renderProjectSwitch) renderProjectSwitch();
}
/* Shared project deletion — same keep-or-cascade choice as epics, used by every
   entry point so tickets can never be left pointing at a project that's gone. */
function deleteProjectFlow(pid, after){
  if(!can('project_delete')){ toast('You don\u2019t have permission to delete projects'); return; }
  const p=store.project(pid); if(!p) return;
  if(store.projects().length<=1){ toast('Keep at least one project'); return; }
  const tix=store.tasks().filter(t=>t.project===pid);
  const ids=tix.map(t=>t.id);
  const n=tix.length;
  const done=()=>{ if(ui.project===pid) ui.project='all'; if(ui.pjSel===pid) ui.pjSel=null;
    refreshViews(); if(window.renderProjectSwitch) renderProjectSwitch(); if(after) after(); };
  if(!n){
    confirmDelete({ title:'Delete project', lead:`Delete the project <b>${esc(p.name)}</b>?`,
      confirmLabel:'Delete project',
      onConfirm:()=>{ store.removeProject(pid); toast('Project deleted'); done(); } });
    return;
  }
  const logs=store.data.worklogs.filter(w=>ids.includes(w.task)).length;
  const cmts=tix.reduce((a,t)=>a+((t.comments||[]).length),0);
  const subs=tix.reduce((a,t)=>a+((t.subtasks||[]).length),0);
  const eps=tix.filter(t=>t.type==='Epic').length;
  confirmDelete({
    title:'Delete project',
    lead:`<b>${esc(p.name)}</b> has <b>${n}</b> ticket${n===1?'':'s'}. What should happen to ${n===1?'it':'them'}?`,
    choices:[
      {id:'keep', label:'Delete only the project',
       desc:`Keep ${n===1?'the ticket':'all '+n+' tickets'} with their comments, subtasks and time logs \u2014 they move to <b>No project</b>.`,
       impact:[]},
      {id:'cascade', label:'Delete the project and all its tickets',
       desc:'Removes every ticket in this project and all of their history permanently.',
       impact:[{n:n, label:'ticket'+(n===1?'':'s')},
               {n:eps, label:'epic'+(eps===1?'':'s')},
               {n:subs, label:'subtask'+(subs===1?'':'s')},
               {n:cmts, label:'comment'+(cmts===1?'':'s')},
               {n:logs, label:'time log'+(logs===1?'':'s')}]},
    ],
    defaultChoice:'keep',
    confirmLabel:'Delete project',
    onConfirm:(mode)=>{
      if(mode==='cascade' && !can('ticket_delete')){ toast('You don\u2019t have permission to delete tickets \u2014 choose \u201cDelete only the project\u201d'); return; }
      if(mode==='cascade'){ ids.forEach(id=>store.removeTask(id));
        if(ui.openTask && ids.includes(ui.openTask)) closePanel();
        store.removeProject(pid); toast(`Project and ${n} ticket${n===1?'':'s'} deleted`); }
      else { tix.forEach(t=>store.updateTask(t.id,{project:null}));
        store.removeProject(pid); toast(`Project deleted \u00b7 ${n} ticket${n===1?'':'s'} kept`); }
      done(); }
  });
}
function deleteProject(){
  if(!_pjEdit) return; const pid=_pjEdit; closeProjectModal();
  deleteProjectFlow(pid, ()=>renderProjects());
}
function wireSpaces(){
  const g=id=>document.getElementById(id);
  if(g('spModalX')) g('spModalX').onclick=closeSpaceModal;
  if(g('spModalCancel')) g('spModalCancel').onclick=closeSpaceModal;
  if(g('spModalSave')) g('spModalSave').onclick=saveSpace;
  if(g('spModalDelete')) g('spModalDelete').onclick=deleteSpace;
  if(g('spModalScrim')) g('spModalScrim').onclick=e=>{ if(e.target===g('spModalScrim')) closeSpaceModal(); };
  if(g('spSwitch')) g('spSwitch').onclick=backToSpaces;
  if(g('pjModalX')) g('pjModalX').onclick=closeProjectModal;
  if(g('pjModalCancel')) g('pjModalCancel').onclick=closeProjectModal;
  if(g('pjModalSave')) g('pjModalSave').onclick=saveProject;
  if(g('pjModalDelete')) g('pjModalDelete').onclick=deleteProject;
  if(g('pjModalScrim')) g('pjModalScrim').onclick=e=>{ if(e.target===g('pjModalScrim')) closeProjectModal(); };
}
function ensureSpaces(){
  if(!store.data.spaces) store.data.spaces=[];
}
