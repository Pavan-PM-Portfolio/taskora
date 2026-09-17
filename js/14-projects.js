/* Taskora — 14-projects.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ---------- Backlog / Sprint planning ---------- */
function _blInit(){ if(document.getElementById('blCss')) return; const st=document.createElement('style'); st.id='blCss'; st.textContent=`
.bl-group{background:var(--surface);border:1px solid var(--line);border-radius:6px;margin-bottom:16px;overflow:hidden}
.bl-group.sprint .bl-ghead{background:var(--surface-2)}
.bl-ghead{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line);gap:12px;flex-wrap:wrap}
.bl-gt{font-weight:700;font-size:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.bl-count{font-size:11px;font-weight:600;color:var(--muted);background:var(--surface-3);border-radius:6px;padding:1px 8px}
.bl-goal{font-weight:400;font-size:12px;color:var(--muted)}
.bl-state{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:2px 8px;border-radius:6px;background:var(--surface-3);color:var(--muted)}
.bl-state.active{background:#0E8F5A22;color:#0E8F5A}
.bl-gctrls{display:flex;align-items:center;gap:10px}
.bl-meta{font-size:12px;color:var(--muted)}
.bl-del{border:0;background:none;color:var(--muted);cursor:pointer;padding:4px;border-radius:6px}
.bl-del:hover{background:var(--surface-3);color:#CE2F26}
.bl-list{padding:4px 0}
.bl-row{display:grid;grid-template-columns:auto 1fr auto auto auto auto;gap:12px;align-items:center;padding:9px 16px;border-bottom:1px solid var(--surface-2)}
.bl-row:last-child{border-bottom:0}
.bl-row:hover{background:var(--surface-2)}
.bl-key{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--muted);cursor:pointer;white-space:nowrap}
.bl-title{font-size:13px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bl-badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:6px;white-space:nowrap}
.bl-est{font-size:11px;color:var(--muted);font-family:ui-monospace,Menlo,monospace;min-width:34px;text-align:right}
.bl-ava{width:24px;display:flex;justify-content:center}
.mini-ava{width:22px;height:22px;border-radius:6px;display:inline-grid;place-items:center;font-size:10px;font-weight:700}
.bl-move{font-size:11px;border:1px solid var(--line);border-radius:6px;padding:4px 6px;background:var(--surface);color:var(--ink)}
.bl-empty{padding:14px 16px;color:var(--faint,#9AA1AC);font-size:12px}`; document.head.appendChild(st); }
function _ini(n){ const p=(n||'?').trim().split(/\s+/); return ((p[0]||'?')[0]+(p[1]?p[1][0]:'')).toUpperCase(); }
/* ---------- Projects (dedicated tab) ---------- */
function projectStats(pid){
  const kids=store.standardTasks().filter(t=>t.project===pid);
  const done=kids.filter(k=>{const st=store.status(k.status);return st&&st.cat==='done';}).length;
  const minutes=kids.reduce((a,k)=>a+taskTotals(k.id).total,0);
  const pct=kids.length?Math.round(done/kids.length*100):0;
  let cat='todo';
  if(kids.length){ if(done===kids.length) cat='done'; else if(kids.some(k=>{const st=store.status(k.status);return st&&(st.cat==='inprogress'||st.cat==='done');})) cat='inprogress'; }
  return {total:kids.length, done, pct, minutes, cat, kids};
}
function projectHealth(st){
  if(!st.total) return {k:'ok', t:'Not started'};
  if(st.done===st.total) return {k:'ok', t:'Complete'};
  return {k:'ok', t:'On track'};
}
/* ---- shared helpers for the two-pane (rail + detail) sections ---- */
function tskSt(status){                       // status chip, tinted from the status' own colour
  const st=store.status(status);
  const c=(st&&st.color)||'#71717A';
  return `<span class="tsk-st" style="background:${c}1a;color:${c}">${esc(st?st.name:status)}</span>`;
}
function tskAge(t){
  const d=t.createdAt||t.createdTs; if(!d) return '';
  const n=Math.max(0,Math.round((new Date(today())-new Date(String(d).slice(0,10)))/864e5));
  return n+'d';
}
function tskOvCell(n,l,zero,cls,pop){
  return `<div class="tsk-ov-cell${zero?' is-zero':''}${cls?' '+cls:''}"${pop?` data-pop="${pop}"`:''}><span class="tsk-ov-n">${n}</span><span class="tsk-ov-l">${esc(l)}</span></div>`;
}

function depInRangeAn(d){ if(!d) return true; const ds=String(d).slice(0,10);
  const pr=periodRange(ui.anPeriod);
  if(pr) return ds>=pr.from && ds<=pr.to;
  if(ui.anPeriod==='custom'){ if(ui.anFrom && ds<ui.anFrom) return false; if(ui.anTo && ds>ui.anTo) return false; }
  return true; }

/* ---------- hover popovers for the dashboard strips ----------
   Each entry: {title, def, tasks}. The popover lists Ticket + Status only,
   and carries a one-line definition so the metric isn't a guess. */
let _statPops={};
function wireStatPops(scopeSel){
  const pop=document.getElementById('ovPop'); if(!pop) return;
  const hide=()=>{ pop.classList.remove('on'); pop.dataset.src=''; };
  pop.onmouseenter=null; pop.onmouseleave=null;
  document.querySelectorAll(scopeSel+' [data-pop]').forEach(elm=>{
    elm.onmouseenter=null; elm.onmouseleave=null;      // click-only, no hover peek
    elm.onclick=(ev)=>{ ev.stopPropagation();
      const set=_statPops[elm.dataset.pop]; if(!set){ hide(); return; }
      if(pop.classList.contains('on') && pop.dataset.src===elm.dataset.pop){ hide(); return; }
      pop.dataset.src=elm.dataset.pop;
      const list=(set.tasks||[]);
      const rows=list.slice(0,14).map(t=>`<div class="ovpr" data-id="${t.id}">
          <span class="ovtk">${esc(t.key||'')}</span>${tskSt(t.status)}</div>`).join('')
        || '<div class="ovpop-none">No tickets.</div>';
      const more=list.length>14?`<div class="ovpop-more">+${list.length-14} more</div>`:'';
      pop.innerHTML=`<div class="ovpop-h"><span class="t">${esc(set.title)}</span><span class="c">${list.length}</span></div>
        <div class="ovpop-def">${esc(set.def||'')}</div>
        <div class="ovpop-list">${rows}${more}</div>`;
      pop.querySelectorAll('.ovpr').forEach(r=>r.onclick=()=>{ pop.classList.remove('on'); openPanel(r.dataset.id); });
      pop.classList.add('on');
      const r=elm.getBoundingClientRect(); const pw=322, ph=pop.offsetHeight;
      let left=r.left+r.width/2-pw/2;
      if(left+pw>window.innerWidth-12) left=window.innerWidth-pw-12;
      left=Math.max(12,left);
      let top=r.bottom+8; if(top+ph>window.innerHeight-12) top=Math.max(12, r.top-ph-8);
      pop.style.left=left+'px'; pop.style.top=top+'px';
    };
  });
  if(!wireStatPops._doc){ wireStatPops._doc=true;
    document.addEventListener('click', e=>{ const p=document.getElementById('ovPop');
      if(p && p.classList.contains('on') && !e.target.closest('#ovPop') && !e.target.closest('[data-pop]')){ p.classList.remove('on'); p.dataset.src=''; } });
  }
}
function tskSearchBox(id,ph,val){
  return `<div class="tsk-rail-top"><div class="tsk-search">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3" stroke-linecap="round"/></svg>
    <input id="${id}" type="search" placeholder="${esc(ph)}" value="${esc(val||'')}"/></div></div>`;
}

function renderProjects(){
  if(!_inRenderAll){ try{ urlSync(); }catch(e){} }   // in-page project selection → reflect in URL
  const el=document.getElementById('projectswrap');
  if(ui.projBoard!=='all' && !store.board(ui.projBoard)) ui.projBoard='all';

  // Board-first: with no board chosen, Projects opens on a grid of BOARDS. Each board
  // owns a set of projects, so you pick the board first, then drill into its projects.
  if(ui.projBoard==='all'){
    const boards=store.boards();
    const projOf=bid=>store.projectsForBoard(bid);
    const tksOf=bid=>store.standardTasks().filter(t=>taskBoardId(t)===bid);
    const cards=boards.map(b=>{ const ps=projOf(b.id); const tk=tksOf(b.id);
      return `<button class="pjb-card" data-board="${b.id}" type="button">
        <div class="pjb-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="11" rx="1"/></svg></div>
        <div class="pjb-body"><div class="pjb-name">${esc(b.name)}</div>
          <div class="pjb-meta">${ps.length} project${ps.length!==1?'s':''} \u00b7 ${tk.length} ticket${tk.length!==1?'s':''}</div></div>
        <svg class="pjb-arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>
      </button>`; }).join('');
    el.innerHTML=`<div class="tsk-page-head"><h1>Projects</h1></div>
      <div class="pjb-intro">Pick a board to see the projects that belong to it.</div>
      <div class="pjb-grid">${cards||'<div class="tsk-empty"><p>No boards yet.</p></div>'}</div>`;
    el.querySelectorAll('.pjb-card').forEach(c=>c.onclick=()=>{ ui.projBoard=c.dataset.board; ui.pjSel=null; renderProjects(); });
    return;
  }

  // A board is selected → show that board's projects (with a back link to the board grid).
  const projects=store.projectsForBoard(ui.projBoard);
  const allK=store.standardTasks().filter(t=>taskBoardId(t)===ui.projBoard);
  const kidsOf=pid=>allK.filter(t=>t.project===pid);
  const orphans=allK.filter(t=>!t.project || !store.project(t.project));
  const addFn=()=>openProjModal();

  const _bkLink=`<button class="pjb-back" id="prBackBtn" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg>All boards</button>`;
  const _bdName=(store.board(ui.projBoard)||{}).name||'Board';
  const head=`<div class="tsk-page-head"><div><div>${_bkLink}</div><h1 style="margin-top:4px">${esc(_bdName)} \u2014 Projects</h1></div><button class="tsk-btn" id="prAddProj" type="button">Add project</button></div>`;
  if(!projects.length && !orphans.length){
    el.innerHTML=head+`<div class="tsk-empty"><p>No projects on this board yet. Add one to start tracking work.</p><button class="tsk-btn tsk-btn--sm" id="prAddCard" type="button">Add project</button></div>`;
    document.getElementById('prAddProj').onclick=addFn; document.getElementById('prAddCard').onclick=addFn;
    { const bk=document.getElementById('prBackBtn'); if(bk) bk.onclick=()=>{ ui.projBoard='all'; ui.pjSel=null; renderProjects(); }; }
    return;
  }

  // ---- selection: null = every project, '__none' = the unfiled bucket ----
  if(ui.pjSel && ui.pjSel!=='__none' && !store.project(ui.pjSel)) ui.pjSel=null;
  if(ui.pjSel==='__none' && !orphans.length) ui.pjSel=null;
  const isAll = !ui.pjSel;
  const scoped = isAll ? allK : (ui.pjSel==='__none' ? orphans : kidsOf(ui.pjSel));

  // ---- overview strip — scoped to whatever the rail has selected ----
  const cnt=st=>scoped.filter(k=>k.status===st).length;
  const sReview=scoped.filter(k=>k.status==='review'||k.status==='qa'||k.status==='pmreview').length;
  const sHp=scoped.filter(k=>k.priority==='Highest').length;
  // Strip = volume by status. Detail grid = what needs attention.
  // Blocked / High priority moved to the detail, so nothing is counted twice.
  const cells=[];
  if(isAll) cells.push([scoped.length,'Total tickets']);
  cells.push([cnt('backlog'),'Backlog'],[cnt('indev'),'In development'],
             [sReview,'In review'],[cnt('done'),'Completed']);
  const ov=`<section class="tsk-overview">
    <div class="tsk-ov-lead">
      <span class="tsk-ov-n">${isAll?projects.length:scoped.length}</span>
      <span class="tsk-ov-l">${isAll?'Total projects':'Tickets'}</span></div>
    <div class="tsk-ov-cells">${cells.map(c=>tskOvCell(c[0],c[1],c.length>2?c[2]:c[0]===0,c[3])).join('')}</div>
  </section>`;

  // ---- rail ----
  const q=(ui.pjQuery||'').trim().toLowerCase();
  const match=projects.filter(p=>p.name.toLowerCase().includes(q));
  const active=match.filter(p=>kidsOf(p.id).length>0);
  const empty=match.filter(p=>kidsOf(p.id).length===0);
  const row=p=>`<button type="button" class="tsk-li${kidsOf(p.id).length?'':' is-empty'}" data-id="${p.id}" aria-current="${ui.pjSel===p.id}">
    <span class="tsk-li-n">${esc(p.name)}</span><span class="tsk-li-c">${kidsOf(p.id).length}</span></button>`;
  const allRow=`<button type="button" class="tsk-li tsk-li-all" data-id="" aria-current="${isAll}">
      <span class="tsk-li-n">All projects</span><span class="tsk-li-c">${allK.length}</span></button><div class="tsk-rail-sep"></div>`;
  const noneRow=orphans.length?`<div class="tsk-rail-sep"></div>
      <button type="button" class="tsk-li" data-id="__none" aria-current="${ui.pjSel==='__none'}" title="Tickets not filed under any project">
      <span class="tsk-li-n">No project</span><span class="tsk-li-c">${orphans.length}</span></button>`:'';
  const railList = !match.length && q
    ? `<p class="tsk-rail-none">No project matches \u201c${esc(ui.pjQuery||'')}\u201d.</p>`
    : allRow + active.map(row).join('') + ((empty.length&&active.length)?'<div class="tsk-rail-sep"></div>':'') + empty.map(row).join('') + noneRow;

  // ---- detail ----
  const pj = (!isAll && ui.pjSel!=='__none') ? store.project(ui.pjSel) : null;
  const dTitle = isAll ? 'All projects' : (pj?pj.name:'No project');
  const hp = scoped.filter(k=>k.priority==='Highest').length;
  const _tdP=today();
  const _openP=t=>(store.status(t.status)||{}).cat!=='done';
  const _blkP=t=>{ const st=store.status(t.status)||{}; return st.id==='blocked'||/blocked/i.test(st.name||''); };
  const _7agoP=_isoLocal(new Date(Date.parse(_tdP+'T00:00:00')-7*864e5));
  const sOverdue = scoped.filter(t=>t.due && t.due<_tdP && _openP(t)).length;
  const sBlocked = scoped.filter(t=>_blkP(t) && _openP(t)).length;
  const sUnassig = scoped.filter(t=>!t.assignee && _openP(t)).length;
  const sStale   = scoped.filter(t=>_openP(t) && (t.updatedAt||t.createdAt||'') < _7agoP).length;
  const sHigh    = scoped.filter(t=>t.priority==='Highest' && _openP(t)).length;
  const stats=[
    ['Overdue',        sOverdue, sOverdue?'is-hot':''],
    ['Blocked',        sBlocked, sBlocked?'is-hot':''],
    ['Unassigned',     sUnassig, ''],
    ['Untouched >7d',  sStale,   ''],
    ['High priority',  sHigh,    sHigh?'is-hot':'']
  ].map(([l,v,cls])=>`<div class="tsk-d-stat${v?'':' is-zero'}${cls?' '+cls:''}"><b>${v}</b><span>${l}</span></div>`).join('');
  const subBits=[`<b>${scoped.length}</b> ticket${scoped.length===1?'':'s'}`];
  if(hp) subBits.push(`<b class="hot">${hp}</b> high priority`);
  if(pj) subBits.push(`<b>${esc(pj.key)}</b>`);
  if(ui.pjSel==='__none') subBits.push('not filed under any project');
  const dHead=`<div class="tsk-d-head"><div><h2 id="pjDetailTitle">${esc(dTitle)}</h2>
      <p class="tsk-d-sub">${subBits.join(' \u00b7 ')}</p></div>
    <div style="display:flex;align-items:center;gap:8px">
      <button class="tsk-btn tsk-btn--ghost tsk-btn--sm" id="prNewTk" type="button">New ticket</button>
      ${pj?`<div class="pp-menu-wrap"><button class="tsk-kebab" id="pjKebab" type="button" title="Project options"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
        <div class="pp-menu" id="pjMenu"><button data-act="open">Open ticket list</button><button data-act="rename">Rename project</button><button data-act="edit">Edit name &amp; key</button><button data-act="delete" class="danger">Delete project</button></div></div>`:''}
    </div></div>`;
  let detail;
  if(!scoped.length){
    detail=dHead+`<div class="tsk-empty" style="margin-top:20px"><p>No tickets in ${esc(dTitle)} yet. Add the first one to start tracking work here.</p>
      <button class="tsk-btn tsk-btn--sm" id="prFirstTk" type="button">Add the first ticket</button></div>`;
  } else {
    const rank=t=>{ const c=(store.status(t.status)||{}).cat||'todo';
      if(t.status==='blocked') return 0; if(c==='inprogress') return 1; if(c==='todo') return 2; return 3; };
    const tbl=tskTicketTable('pj', scoped, (a,b)=>rank(a)-rank(b)||(b.createdAt||'').localeCompare(a.createdAt||''));
    detail=dHead+`<div class="tsk-d-stats tsk-d-stats--5">${stats}</div>
      <div class="tsk-sec-head"><span class="tsk-eyebrow">Tickets</span><span class="tsk-eyebrow">${tbl.shown}${tbl.shown!==tbl.total?' of '+tbl.total:''}</span></div>
      ${tbl.html}`;
  }

  el.innerHTML=head+ov+`<div class="tsk-pane">
    <aside class="tsk-rail">${tskSearchBox('pjSearch','Find a project',ui.pjQuery)}<nav class="tsk-rail-list" id="pjRail">${railList}</nav></aside>
    <section class="tsk-detail" id="pjDetail">${detail}</section></div>`;

  document.getElementById('prAddProj').onclick=addFn;
  { const bk=document.getElementById('prBackBtn'); if(bk) bk.onclick=()=>{ ui.projBoard='all'; ui.pjSel=null; renderProjects(); }; }
  wireTskTable(el, renderProjects);
  el.querySelectorAll('#pjRail .tsk-li').forEach(b=>b.onclick=()=>{ ui.pjSel=b.dataset.id||null; renderProjects(); });
  const sIn=document.getElementById('pjSearch');
  if(sIn) sIn.oninput=()=>{ ui.pjQuery=sIn.value; const at=sIn.selectionStart; renderProjects();
    const n=document.getElementById('pjSearch'); if(n){ n.focus(); try{ n.setSelectionRange(at,at); }catch(e){} } };
  const nt=document.getElementById('prNewTk')||document.getElementById('prFirstTk');
  if(nt) nt.onclick=()=>openModal(null,null,(pj?pj.id:null));
  const kb=document.getElementById('pjKebab'), mn=document.getElementById('pjMenu');
  if(kb&&mn){
    kb.onclick=e=>{ e.stopPropagation(); mn.classList.toggle('on'); };
    // one delegated listener, not a new one per render
    if(!window._pjMenuWired){ window._pjMenuWired=true;
      document.addEventListener('click',e=>{ if(!e.target.closest('.pp-menu-wrap')){
        const m=document.getElementById('pjMenu'); if(m) m.classList.remove('on'); } }); }
    mn.querySelectorAll('button').forEach(btn=>btn.onclick=e=>{ e.stopPropagation(); mn.classList.remove('on');
      const act=btn.dataset.act, pid=ui.pjSel;
      if(act==='open') openProjectPop(pid);
      else if(act==='rename') renameProjectInline(pid);
      else if(act==='edit') openProjectModal(pid);
      else if(act==='delete'){ deleteProjectFlow(pid, ()=>renderProjects()); }
    });
  }
}
function projRowsHtml(pid){
  const st=projectStats(pid);
  return st.kids.map(k=>{ const s=store.status(k.status); const u=store.user(k.assignee);
    return `<div class="pp-row" data-st="${esc(k.status)}" data-asg="${esc(k.assignee||'')}" data-pri="${esc(k.priority||'')}" onclick="closeProjectPop();openPanel('${k.id}')">
      <div class="pp-rmid"><div class="pp-tnm">${esc(k.title)}</div><div class="pp-tasg">${u?esc(u.name):'Unassigned'}</div></div>
      <span class="pp-stat">${s?esc(s.name):esc(k.status)}</span>
    </div>`; }).join('')||'<div class="pp-empty">No tickets yet. Add one to start.</div>';
}
/* ---------- Create project dialog ---------- */
let _pjKeyTouched=false;
function openProjModal(){
  _pjKeyTouched=false;
  const nm=document.getElementById('pjName'), ky=document.getElementById('pjKey');
  nm.value=''; ky.value='';
  // board picker: list this workspace's boards, default to the board you're on
  const bsel=document.getElementById('pjBoard');
  if(bsel){ bsel.innerHTML=store.boards().map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
    // default to the board being viewed in Projects, else the current board
    const cur=(ui.view==='projects' && ui.projBoard && ui.projBoard!=='all' && store.board(ui.projBoard))?ui.projBoard
             :((ui.board && store.board(ui.board))?ui.board:(store.boards()[0]||{}).id);
    if(cur) bsel.value=cur; }
  // key follows the name until the user edits it themselves
  nm.oninput=()=>{ if(_pjKeyTouched) return;
    ky.value=(nm.value.replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase()); };
  ky.oninput=()=>{ _pjKeyTouched=true; ky.value=ky.value.toUpperCase().replace(/[^A-Z0-9]/g,''); };
  nm.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); saveProjModal(); } };
  ky.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); saveProjModal(); } };
  document.getElementById('projWrap').classList.add('on');
  setTimeout(()=>nm.focus(),40);
}
function closeProjModal(){ const w=document.getElementById('projWrap'); if(w) w.classList.remove('on'); }
function saveProjModal(){
  if(!can('project_create')){ toast('You don\u2019t have permission to create projects'); return; }
  if(!reqCheck([['pjName','Give the project a name'],['pjKey','Give the project a key']])) return;
  const name=document.getElementById('pjName').value.trim();
  if(store.projects().some(p=>p.name.toLowerCase()===name.toLowerCase())){ toast('A project called that already exists'); return; }
  const key=document.getElementById('pjKey').value.trim().toUpperCase();
  { const clash=store.projects().find(p=>String(p.key||'').toUpperCase()===key);
    if(clash){ return reqFail(document.getElementById('pjKey'), '\u201c'+key+'\u201d is already used by '+clash.name); } }
  const board=(document.getElementById('pjBoard')||{}).value||null;
  const id=store.addProject(name, board);
  store.updateProject(id,{key});
  closeProjModal();
  ui.pjSel=id;                       // land on the project you just made
  if(ui.view==='projects') renderProjects(); else renderAll();
  if(window.renderProjectSwitch) renderProjectSwitch();
  toast('Project created');
}

function renameProjectInline(pid){
  // #ppTitle only exists inside the project pop-up. The Projects page now renders
  // a detail <h2> instead, so fall back to that — otherwise rename silently did
  // nothing from the page's own kebab.
  const t=document.getElementById('ppTitle') || document.getElementById('pjDetailTitle');
  const p=store.project(pid); if(!t||!p) return;
  const inPopup = t.id==='ppTitle';
  const inp=document.createElement('input'); inp.className=inPopup?'pp-name-inp':'pj-name-inp'; inp.id=t.id; inp.value=p.name; inp.spellcheck=false;
  t.replaceWith(inp); inp.focus(); inp.select(); let done=false;
  const save=commit=>{ if(done) return; done=true; const v=inp.value.trim();
    if(commit&&v&&v!==p.name){ store.updateProject(pid,{name:v}); if(ui.view==='projects') renderProjects(); if(window.renderProjectSwitch) renderProjectSwitch(); }
    if(!inPopup){ renderProjects(); return; }           // the page re-renders itself
    const nd=document.createElement('div'); nd.className='ti'; nd.id='ppTitle'; nd.textContent=(commit&&v)?v:p.name; inp.replaceWith(nd); };
  inp.onkeydown=e=>{ if(e.key==='Enter') save(true); else if(e.key==='Escape') save(false); };
  inp.onblur=()=>save(true);
}
function openProjectPop(pid){
  const p=store.project(pid); if(!p) return; const st=projectStats(pid); const kids=st.kids;
  const nIndev=kids.filter(k=>k.status==='indev').length;
  const nBlocked=kids.filter(k=>k.status==='blocked').length;
  const nDone=kids.filter(k=>k.status==='done').length;
  const asgIds=[...new Set(kids.map(k=>k.assignee).filter(Boolean))];
  const stIds=[...new Set(kids.map(k=>k.status))];
  const priVals=[...new Set(kids.map(k=>k.priority).filter(Boolean))];
  const priOrder=['Highest','High','Medium','Low','Lowest'];
  const asgOpts='<option value="">All assignees</option>'+asgIds.map(id=>{const u=store.user(id);return u?`<option value="${id}">${esc(u.name)}</option>`:'';}).join('');
  const stOpts='<option value="">All statuses</option>'+stIds.map(id=>{const s=store.status(id);return s?`<option value="${id}">${esc(s.name)}</option>`:'';}).join('');
  const priOpts='<option value="">All priorities</option>'+priOrder.filter(x=>priVals.includes(x)).map(x=>`<option value="${x}">${esc(x)}</option>`).join('');
  const pop=document.getElementById('projPop');
  pop.innerHTML=`
    <div class="pp-h"><div class="pp-htitle"><div class="ti" id="ppTitle">${esc(p.name)}</div><div class="k">${esc(p.key)}</div></div>
      <div class="pp-menu-wrap"><button class="pp-kebab" id="ppKebab" title="Project options"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button><div class="pp-menu" id="ppMenu"><button data-act="rename">Rename project</button><button data-act="delete" class="danger">Delete project</button></div></div>
      <button class="pp-openboard" onclick="ui.project='${pid}';if(window.renderProjectSwitch)renderProjectSwitch();closeProjectPop();setView('board')">Open board</button>
      <button class="pp-x" onclick="closeProjectPop()">\u2715</button></div>
    <div class="pp-tiles">
      <div class="pp-tile"><div class="v">${st.total}</div><div class="l">Total</div></div>
      <div class="pp-tile"><div class="v">${nIndev}</div><div class="l">In Dev</div></div>
      <div class="pp-tile"><div class="v">${nBlocked}</div><div class="l">Blocked</div></div>
      <div class="pp-tile"><div class="v">${nDone}</div><div class="l">Done</div></div>
    </div>
    <div class="pp-filters">
      <select class="pp-filter" id="ppfAsg">${asgOpts}</select>
      <select class="pp-filter" id="ppfSt">${stOpts}</select>
      <select class="pp-filter" id="ppfPri">${priOpts}</select>
      <button class="pp-add" onclick="closeProjectPop();openModal(null,null,'${pid}')">Add Ticket</button>
    </div>
    <div class="pp-body"><div class="pp-list">${projRowsHtml(pid)}</div></div>`;
  ['ppfAsg','ppfSt','ppfPri'].forEach(id=>{ const el=pop.querySelector('#'+id); if(el) el.onchange=()=>applyProjFilters(pop); });
  const _kb=pop.querySelector('#ppKebab'), _mn=pop.querySelector('#ppMenu');
  if(_kb&&_mn){ _kb.onclick=e=>{ e.stopPropagation(); _mn.classList.toggle('on'); };
    pop.addEventListener('click',e=>{ if(!e.target.closest('.pp-menu-wrap')) _mn.classList.remove('on'); });
    _mn.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{ _mn.classList.remove('on'); const act=btn.dataset.act;
      if(act==='rename'){ renameProjectInline(pid); }
      else if(act==='delete'){ closeProjectPop(); deleteProjectFlow(pid, ()=>{ if(ui.view==='projects') renderProjects(); }); }
    }); }
  const sc=document.getElementById('projPopScrim'); sc.classList.add('on'); sc.onclick=e=>{ if(e.target===sc) closeProjectPop(); };
}
function applyProjFilters(pop){
  const a=(pop.querySelector('#ppfAsg')||{}).value||'';
  const s=(pop.querySelector('#ppfSt')||{}).value||'';
  const pr=(pop.querySelector('#ppfPri')||{}).value||'';
  let shown=0;
  pop.querySelectorAll('.pp-row').forEach(row=>{
    const ok=(!a||row.dataset.asg===a)&&(!s||row.dataset.st===s)&&(!pr||row.dataset.pri===pr);
    row.style.display=ok?'':'none'; if(ok) shown++;
  });
  let empty=pop.querySelector('.pp-nomatch');
  if(!shown){ if(!empty){ empty=document.createElement('div'); empty.className='pp-empty pp-nomatch'; empty.textContent='No tickets match these filters.'; pop.querySelector('.pp-list').appendChild(empty); } empty.style.display=''; }
  else if(empty){ empty.style.display='none'; }
}
function closeProjectPop(){ const s=document.getElementById('projPopScrim'); if(s) s.classList.remove('on'); }


/* ---------- Reports ---------- */
const REPORT_DIMS={status:'Status',assignee:'Assignee',project:'Project',epic:'Epic',priority:'Priority',type:'Type',resolution:'Resolution',reporter:'Reporter'};
const REPORT_MEASURES={count:'Ticket count',hours:'Hours logged',estimate:'Estimated hours',avgLead:'Avg lead time (days)',done:'Tickets closed',open:'Tickets open',overdue:'Overdue tickets',pctDone:'% closed'};
const REPORT_FIELDS={key:'Key',title:'Title',type:'Type',status:'Status',priority:'Priority',assignee:'Assignee',reporter:'Reporter',project:'Project',epic:'Epic',due:'Due date',start:'Start date',estimate:'Estimate',logged:'Logged',resolution:'Resolution',created:'Created',updated:'Updated',resolved:'Resolved'};
const REPORT_PRESETS=[
  {name:'Workload by assignee', d:'How many open and total tickets each person owns', s:{kind:'summary',groupBy:'assignee',measure:'count'}},
  {name:'Hours logged by assignee', d:'Effort spent per engineer', s:{kind:'summary',groupBy:'assignee',measure:'hours'}},
  {name:'Throughput by status', d:'Where tickets sit in the pipeline', s:{kind:'summary',groupBy:'status',measure:'count'}},
  {name:'Lead time by project', d:'Average days from created to resolved', s:{kind:'summary',groupBy:'project',measure:'avgLead'}},
  {name:'Priority breakdown', d:'Ticket count by priority', s:{kind:'summary',groupBy:'priority',measure:'count'}},
  {name:'Epic progress', d:'% closed for each epic', s:{kind:'summary',groupBy:'epic',measure:'pctDone'}},
  {name:'Overdue tickets', d:'Every open ticket past its due date', s:{kind:'detailed',f:{overdue:'yes'}}},
  {name:'Full ticket export', d:'Every ticket with all key fields', s:{kind:'detailed',fields:['key','title','type','status','priority','assignee','project','epic','due','estimate','logged','resolution','created','resolved']}},
];
function reportDimVal(t, dim){
  if(dim==='status') return (store.status(t.status)||{}).name||t.status;
  if(dim==='assignee') return t.assignee?(store.user(t.assignee)||{}).name:'Unassigned';
  if(dim==='reporter') return t.reporter?(store.user(t.reporter)||{}).name:'—';
  if(dim==='project') return (store.project(t.project)||{}).name||t.project;
  if(dim==='epic') return t.parent?(store.task(t.parent)||{}).title:'No epic';
  if(dim==='priority') return t.priority;
  if(dim==='type') return t.type;
  if(dim==='resolution') return t.resolution||'Unresolved';
  return '—';
}
function reportTasks(){
  const f=ui.report.f; const NOW=today();
  return store.standardTasks().filter(t=>{
    if(f.project!=='all' && t.project!==f.project) return false;
    if(f.assignee!=='all' && t.assignee!==f.assignee) return false;
    if(f.status!=='all' && t.status!==f.status) return false;
    if(f.priority!=='all' && t.priority!==f.priority) return false;
    if(f.type!=='all' && t.type!==f.type) return false;
    if(f.epic!=='all'){ if(f.epic==='none'){ if(t.parent) return false; } else if(t.parent!==f.epic) return false; }
    const tot=taskTotals(t.id).total;
    if(f.hasTime==='yes' && !tot) return false;
    if(f.hasTime==='no' && tot) return false;
    const done=(store.status(t.status)||{}).cat==='done';
    if(f.overdue==='yes' && !(t.due && !done && t.due<NOW)) return false;
    if(f.dateField!=='none'){ const dv = f.dateField==='created'?t.createdAt : f.dateField==='resolved'?t.resolvedAt : t.due;
      if(!dv) return false; if(f.from && dv<f.from) return false; if(f.to && dv>f.to) return false; }
    return true;
  });
}
function reportSummary(tasks){
  const dim=ui.report.groupBy, meas=ui.report.measure;
  const groups={};
  tasks.forEach(t=>{ const k=reportDimVal(t,dim); (groups[k]=groups[k]||[]).push(t); });
  const NOW=today();
  const rows=Object.keys(groups).map(k=>{ const ts=groups[k];
    const done=ts.filter(t=>(store.status(t.status)||{}).cat==='done');
    const leads=done.map(t=>daysBetween(t.resolvedAt,t.createdAt)).filter(d=>d!=null);
    let v;
    if(meas==='count') v=ts.length;
    else if(meas==='hours') v=ts.reduce((a,t)=>a+taskTotals(t.id).total,0)/60;
    else if(meas==='estimate') v=ts.reduce((a,t)=>a+(t.estimate||0),0)/60;
    else if(meas==='avgLead') v=leads.length?leads.reduce((a,d)=>a+d,0)/leads.length:0;
    else if(meas==='done') v=done.length;
    else if(meas==='open') v=ts.length-done.length;
    else if(meas==='overdue') v=ts.filter(t=>t.due&&(store.status(t.status)||{}).cat!=='done'&&t.due<NOW).length;
    else if(meas==='pctDone') v=ts.length?Math.round(done.length/ts.length*100):0;
    return {label:k, value:v, n:ts.length};
  }).sort((a,b)=>b.value-a.value);
  return rows;
}
function reportMeasureFmt(v){ const m=ui.report.measure;
  if(m==='hours'||m==='estimate') return v.toFixed(1)+'h';
  if(m==='avgLead') return v.toFixed(1)+'d';
  if(m==='pctDone') return Math.round(v)+'%';
  return Math.round(v).toString();
}
function reportFieldVal(t, fld){
  if(fld==='key') return t.key;
  if(fld==='title') return t.title;
  if(fld==='type') return t.type;
  if(fld==='status') return (store.status(t.status)||{}).name||t.status;
  if(fld==='priority') return t.priority;
  if(fld==='assignee') return t.assignee?(store.user(t.assignee)||{}).name:'Unassigned';
  if(fld==='reporter') return t.reporter?(store.user(t.reporter)||{}).name:'—';
  if(fld==='project') return (store.project(t.project)||{}).name||t.project;
  if(fld==='epic') return t.parent?(store.task(t.parent)||{}).title:'—';
  if(fld==='due') return t.due||'';
  if(fld==='start') return t.start||'';
  if(fld==='estimate') return t.estimate?hm(t.estimate):'';
  if(fld==='logged'){ const m=taskTotals(t.id).total; return m?hm(m):''; }
  if(fld==='resolution') return t.resolution||'';
  if(fld==='created') return t.createdAt||'';
  if(fld==='updated') return t.updatedAt||'';
  if(fld==='resolved') return t.resolvedAt||'';
  return '';
}
function csvCell(s){ s=(s==null?'':String(s)); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
function downloadCSV(name, headers, rows){
  const csv=[headers.map(csvCell).join(','), ...rows.map(r=>r.map(csvCell).join(','))].join('\n');
  try{ const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); },100); toast('CSV downloaded'); }
  catch(e){ navigator.clipboard&&navigator.clipboard.writeText(csv); toast('Download blocked here — CSV copied to clipboard'); }
}
function runReportExport(){
  const r=ui.report; const tasks=reportTasks();
  if(r.kind==='summary'){ const rows=reportSummary(tasks);
    downloadCSV(`report-${r.groupBy}-${r.measure}.csv`, [REPORT_DIMS[r.groupBy], REPORT_MEASURES[r.measure], 'Tickets'], rows.map(x=>[x.label, reportMeasureFmt(x.value), x.n])); }
  else { const flds=r.fields; downloadCSV('ticket-export.csv', flds.map(f=>REPORT_FIELDS[f]), tasks.map(t=>flds.map(f=>reportFieldVal(t,f)))); }
}
function renderReports(){
  const el=document.getElementById('reportswrap');
  const r=ui.report;
  const opt=(o,sel)=>Object.entries(o).map(([k,v])=>`<option value="${k}" ${sel===k?'selected':''}>${v}</option>`).join('');
  const usersOpt=`<option value="all">All</option>`+store.users().map(u=>`<option value="${u.id}" ${r.f.assignee===u.id?'selected':''}>${esc(u.name)}</option>`).join('');
  const projOpt=`<option value="all">All</option>`+store.projects().map(p=>`<option value="${p.id}" ${r.f.project===p.id?'selected':''}>${esc(p.name)}</option>`).join('');
  const statusOpt=`<option value="all">All</option>`+store.statuses().map(s=>`<option value="${s.id}" ${r.f.status===s.id?'selected':''}>${esc(s.name)}</option>`).join('');
  const epicOpt=`<option value="all">All</option><option value="none" ${r.f.epic==='none'?'selected':''}>No epic</option>`+store.epics().map(e=>`<option value="${e.id}" ${r.f.epic===e.id?'selected':''}>${esc(e.title)}</option>`).join('');
  const presets=REPORT_PRESETS.map((p,i)=>`<button class="rep-preset" data-preset="${i}"><div class="rp-nm">${p.name}</div><div class="rp-d">${p.d}</div></button>`).join('');

  const builder=`<div class="rep-builder">
    <div class="rep-kind">
      <button data-kind="summary" class="${r.kind==='summary'?'on':''}">Summary (grouped)</button>
      <button data-kind="detailed" class="${r.kind==='detailed'?'on':''}">Detailed (ticket list)</button>
    </div>
    ${r.kind==='summary'?`<div class="rep-fields">
      <label class="repf"><span>Group by</span><select id="rGroup">${opt(REPORT_DIMS,r.groupBy)}</select></label>
      <label class="repf"><span>Measure</span><select id="rMeasure">${opt(REPORT_MEASURES,r.measure)}</select></label>
    </div>`:`<div class="rep-cols"><div class="repf-lbl">Columns</div><div class="rep-checks">${Object.entries(REPORT_FIELDS).map(([k,v])=>`<label class="chk"><input type="checkbox" data-field="${k}" ${r.fields.includes(k)?'checked':''}/>${v}</label>`).join('')}</div></div>`}
    <div class="repf-lbl" style="margin-top:14px">Filters</div>
    <div class="rep-fields">
      <label class="repf"><span>Project</span><select id="rfProject">${projOpt}</select></label>
      <label class="repf"><span>Assignee</span><select id="rfAssignee">${usersOpt}</select></label>
      <label class="repf"><span>Status</span><select id="rfStatus">${statusOpt}</select></label>
      <label class="repf"><span>Priority</span><select id="rfPriority"><option value="all">All</option>${Object.keys(PRIORITIES).map(p=>`<option ${r.f.priority===p?'selected':''}>${p}</option>`).join('')}</select></label>
      <label class="repf"><span>Type</span><select id="rfType"><option value="all">All</option>${store.types().filter(x=>x.id!=='Epic').map(x=>`<option ${r.f.type===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="repf"><span>Epic</span><select id="rfEpic">${epicOpt}</select></label>
      <label class="repf"><span>Has time logged</span><select id="rfHasTime"><option value="any" ${r.f.hasTime==='any'?'selected':''}>Any</option><option value="yes" ${r.f.hasTime==='yes'?'selected':''}>Yes</option><option value="no" ${r.f.hasTime==='no'?'selected':''}>No</option></select></label>
      <label class="repf"><span>Overdue only</span><select id="rfOverdue"><option value="any" ${r.f.overdue==='any'?'selected':''}>Any</option><option value="yes" ${r.f.overdue==='yes'?'selected':''}>Yes</option></select></label>
      <label class="repf"><span>Date field</span><select id="rfDateField"><option value="none" ${r.f.dateField==='none'?'selected':''}>None</option><option value="created" ${r.f.dateField==='created'?'selected':''}>Created</option><option value="resolved" ${r.f.dateField==='resolved'?'selected':''}>Resolved</option><option value="due" ${r.f.dateField==='due'?'selected':''}>Due</option></select></label>
      ${r.f.dateField!=='none'?`<label class="repf"><span>From</span><input type="date" id="rfFrom" class="an-date" value="${r.f.from||''}"/></label><label class="repf"><span>To</span><input type="date" id="rfTo" class="an-date" value="${r.f.to||''}"/></label>`:''}
    </div>
    <div class="rep-actions"><button class="btn primary" id="rExport"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>Export CSV</button></div>
  </div>`;

  const tasks=reportTasks();
  let result='';
  if(r.kind==='summary'){ const rows=reportSummary(tasks); const max=Math.max(...rows.map(x=>x.value),1);
    result=`<div class="ov-card"><h3>${REPORT_MEASURES[r.measure]} by ${REPORT_DIMS[r.groupBy].toLowerCase()}</h3><p class="cap">${tasks.length} tickets · ${rows.length} groups</p>
      <table class="rep-table"><thead><tr><th>${REPORT_DIMS[r.groupBy]}</th><th style="text-align:right">${REPORT_MEASURES[r.measure]}</th><th style="width:34%">Distribution</th><th style="text-align:right">Tickets</th></tr></thead><tbody>
      ${rows.map(x=>`<tr><td>${esc(x.label)}</td><td class="num" style="text-align:right;font-weight:600">${reportMeasureFmt(x.value)}</td>
        <td><div class="rbar"><div class="rbar-f" style="width:${Math.max(x.value/max*100,2)}%"></div></div></td>
        <td class="num" style="text-align:right;color:var(--muted)">${x.n}</td></tr>`).join('')||'<tr><td colspan="4" style="color:var(--muted)">No tickets match.</td></tr>'}
      </tbody></table></div>`;
  } else { const flds=r.fields;
    result=`<div class="ov-card"><h3>Ticket export</h3><p class="cap">${tasks.length} tickets · ${flds.length} columns</p>
      <div style="overflow-x:auto"><table class="rep-table"><thead><tr>${flds.map(f=>`<th>${REPORT_FIELDS[f]}</th>`).join('')}</tr></thead>
      <tbody>${tasks.map(t=>`<tr data-open="${t.id}">${flds.map(f=>`<td>${esc(reportFieldVal(t,f))}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${flds.length}" style="color:var(--muted)">No tickets match.</td></tr>`}</tbody></table></div></div>`;
  }

  el.innerHTML=`<div class="ov-h"><h2>Reports</h2><span class="range">Build, preview and export</span></div>
    <div class="repf-lbl">Quick reports</div>
    <div class="rep-presets">${presets}</div>
    ${builder}
    <div id="repResult" style="margin-top:18px">${result}</div>`;

  el.querySelectorAll('.rep-preset').forEach(b=>b.onclick=()=>{ const p=REPORT_PRESETS[+b.dataset.preset];
    if(p.s.kind) r.kind=p.s.kind; if(p.s.groupBy) r.groupBy=p.s.groupBy; if(p.s.measure) r.measure=p.s.measure;
    if(p.s.fields) r.fields=p.s.fields.slice(); r.f={project:'all',assignee:'all',status:'all',priority:'all',type:'all',epic:'all',hasTime:'any',overdue:'any',dateField:'none',from:'',to:''};
    if(p.s.f) Object.assign(r.f, p.s.f); renderReports(); });
  el.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{ r.kind=b.dataset.kind; renderReports(); });
  const bind=(id,fn)=>{ const e=document.getElementById(id); if(e) e.onchange=ev=>{ fn(ev.target.value); renderReports(); }; };
  bind('rGroup',v=>r.groupBy=v); bind('rMeasure',v=>r.measure=v);
  bind('rfProject',v=>r.f.project=v); bind('rfAssignee',v=>r.f.assignee=v); bind('rfStatus',v=>r.f.status=v);
  bind('rfPriority',v=>r.f.priority=v); bind('rfType',v=>r.f.type=v); bind('rfEpic',v=>r.f.epic=v);
  bind('rfHasTime',v=>r.f.hasTime=v); bind('rfOverdue',v=>r.f.overdue=v); bind('rfDateField',v=>r.f.dateField=v);
  bind('rfFrom',v=>r.f.from=v); bind('rfTo',v=>r.f.to=v);
  el.querySelectorAll('[data-field]').forEach(c=>c.onchange=()=>{ const f=c.dataset.field;
    if(c.checked){ if(!r.fields.includes(f)) r.fields.push(f); } else r.fields=r.fields.filter(x=>x!==f);
    if(!r.fields.length) r.fields=['key']; renderReports(); });
  document.getElementById('rExport').onclick=runReportExport;
  el.querySelectorAll('tr[data-open]').forEach(tr=>tr.onclick=()=>openPanel(tr.dataset.open));
}
