/* Taskora — 04-dropdowns.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ---- Custom light dropdowns: replace native <select> across the page ---- */
function _selxLabel(sel,btn){ const o=sel.options[sel.selectedIndex]; btn.querySelector('.selx-t').textContent=o?o.textContent:''; }
/* Re-sync the visible label after a <select>'s options are rebuilt — setting
   innerHTML doesn't fire 'change', so the custom button would sit blank. */
function syncSelx(root){
  (root||document).querySelectorAll('select[data-enh]').forEach(sel=>{
    if(sel._selxBtn) _selxLabel(sel, sel._selxBtn);
  });
}
function enhanceSelects(root){
  (root||document).querySelectorAll('select:not([data-enh])').forEach(sel=>{
    sel.setAttribute('data-enh','1');
    const cs=getComputedStyle(sel); sel.style.display='none';
    const wrap=document.createElement('span'); wrap.className='selx';
    const btn=document.createElement('button'); btn.type='button'; btn.className='selx-btn';
    btn.style.fontSize=cs.fontSize; btn.style.fontWeight=cs.fontWeight; btn.style.color=cs.color;
    btn.innerHTML='<span class="selx-t"></span><svg class="selx-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
    sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(sel); wrap.appendChild(btn);
    _selxLabel(sel,btn); sel._selxBtn=btn;
    sel.addEventListener('change',()=>{ _selxLabel(sel,btn); btn.style.color=getComputedStyle(sel).color; });
    btn.onclick=e=>{ e.stopPropagation(); openSelxMenu(sel,btn); };
  });
}
function closeSelx(){ const m=document.getElementById('selxMenu'); if(m) m.remove(); }
function openSelxMenu(sel,btn){
  if(document.getElementById('selxMenu')){ closeSelx(); return; }
  const menu=document.createElement('div'); menu.className='selx-menu'; menu.id='selxMenu';
  menu.innerHTML=[...sel.options].map((o,i)=>`<button class="selx-opt${i===sel.selectedIndex?' on':''}" data-i="${i}">${esc(o.textContent)}</button>`).join('');
  document.body.appendChild(menu);
  const r=btn.getBoundingClientRect(); menu.style.position='fixed'; menu.style.minWidth=Math.max(r.width,150)+'px';
  let top=r.bottom+4, left=r.left; const mh=menu.offsetHeight, mw=menu.offsetWidth;
  if(top+mh>window.innerHeight-8) top=Math.max(8, r.top-4-mh);
  if(left+mw>window.innerWidth-8) left=Math.max(8, window.innerWidth-mw-8);
  menu.style.top=top+'px'; menu.style.left=left+'px';
  menu.querySelectorAll('.selx-opt').forEach(o=>o.onclick=ev=>{ ev.stopPropagation(); sel.selectedIndex=+o.dataset.i; sel.dispatchEvent(new Event('change',{bubbles:true})); closeSelx(); });
}
document.addEventListener('click',closeSelx);
window.addEventListener('resize',closeSelx);
document.getElementById('scroll')&&document.getElementById('scroll').addEventListener('scroll',closeSelx,true);
let _selxRaf=null;
function _scheduleEnhance(){ if(_selxRaf) return; _selxRaf=requestAnimationFrame(()=>{ _selxRaf=null; enhanceSelects(document); }); }
/* Only re-scan when a <select> actually appears. Every render mutates the DOM,
   and a full-document querySelectorAll on each one is wasted work. */
new MutationObserver(muts=>{
  for(let i=0;i<muts.length;i++){
    const added=muts[i].addedNodes;
    for(let j=0;j<added.length;j++){
      const n=added[j];
      if(n.nodeType!==1) continue;
      if(n.tagName==='SELECT' || (n.querySelector && n.querySelector('select'))){ _scheduleEnhance(); return; }
    }
  }
}).observe(document.body,{childList:true,subtree:true});
window.enhanceSelects=enhanceSelects;
enhanceSelects(document);
setTimeout(()=>{ try{ __dbg.log('[PM] custom light dropdowns active — enhanced '+document.querySelectorAll('select[data-enh]').length+' selects'); }catch(e){} }, 800);
function openDateMenu(anchor, taskId, cur, field){
  field = field||'due';
  const menu=document.getElementById('cfMenu');
  const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const base = cur? new Date(cur+'T00:00:00') : new Date();
  let vy=base.getFullYear(), vm=base.getMonth();
  const render=()=>{
    const startDow=(new Date(vy,vm,1).getDay()-WEEK_START+7)%7; const days=new Date(vy,vm+1,0).getDate();
    let cells=''; for(let i=0;i<startDow;i++) cells+='<span class="dm-cell dm-empty"></span>';
    for(let d=1;d<=days;d++){ const ds=`${vy}-${String(vm+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells+=`<button class="dm-cell${cur===ds?' sel':''}" data-d="${ds}">${d}</button>`; }
    menu.innerHTML=`<div class="dm">
      <div class="dm-head"><button class="dm-nav" data-nav="-1">‹</button><span class="dm-title">${months[vm]} ${vy}</span><button class="dm-nav" data-nav="1">›</button></div>
      <div class="dm-dow">${(WEEK_START===1?['Mo','Tu','We','Th','Fr','Sa','Su']:['Su','Mo','Tu','We','Th','Fr','Sa']).map(x=>`<span>${x}</span>`).join('')}</div>
      <div class="dm-grid">${cells}</div>
      <div class="dm-foot"><button class="dm-today">Today</button><button class="dm-clear">Clear</button></div></div>`;
    menu.querySelectorAll('.dm-nav').forEach(b=>b.onclick=e=>{ e.stopPropagation(); vm+=+b.dataset.nav; if(vm<0){vm=11;vy--;} if(vm>11){vm=0;vy++;} render(); });
    const after=()=>{ menu.classList.remove('on'); refreshViews(); if(ui.openTask===taskId && document.getElementById('panel').classList.contains('on')) openPanel(taskId, true); };
    menu.querySelectorAll('.dm-cell[data-d]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); store.updateTask(taskId,{[field]:b.dataset.d}); after(); });
    menu.querySelector('.dm-today').onclick=e=>{ e.stopPropagation(); store.updateTask(taskId,{[field]:today()}); after(); };
    menu.querySelector('.dm-clear').onclick=e=>{ e.stopPropagation(); store.updateTask(taskId,{[field]:null}); after(); };
  };
  render();
  const r=anchor.getBoundingClientRect(); posMenu(menu, r, 6, 260, false);
}
function openDatePicker(anchor, cur, onPick){
  const menu=document.getElementById('cfMenu');
  const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const base = cur? new Date(cur+'T00:00:00') : new Date();
  let vy=base.getFullYear(), vm=base.getMonth();
  const render=()=>{
    const startDow=(new Date(vy,vm,1).getDay()-WEEK_START+7)%7; const days=new Date(vy,vm+1,0).getDate();
    let cells=''; for(let i=0;i<startDow;i++) cells+='<span class="dm-cell dm-empty"></span>';
    for(let d=1;d<=days;d++){ const ds=`${vy}-${String(vm+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells+=`<button class="dm-cell${cur===ds?' sel':''}" data-d="${ds}">${d}</button>`; }
    menu.innerHTML=`<div class="dm">
      <div class="dm-head"><button class="dm-nav" data-nav="-1">‹</button><span class="dm-title">${months[vm]} ${vy}</span><button class="dm-nav" data-nav="1">›</button></div>
      <div class="dm-dow">${(WEEK_START===1?['Mo','Tu','We','Th','Fr','Sa','Su']:['Su','Mo','Tu','We','Th','Fr','Sa']).map(x=>`<span>${x}</span>`).join('')}</div>
      <div class="dm-grid">${cells}</div>
      <div class="dm-foot"><button class="dm-today">Today</button><button class="dm-clear">Clear</button></div></div>`;
    menu.querySelectorAll('.dm-nav').forEach(b=>b.onclick=e=>{ e.stopPropagation(); vm+=+b.dataset.nav; if(vm<0){vm=11;vy--;} if(vm>11){vm=0;vy++;} render(); });
    const pick=v=>{ menu.classList.remove('on'); onPick(v); };
    menu.querySelectorAll('.dm-cell[data-d]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); pick(b.dataset.d); });
    menu.querySelector('.dm-today').onclick=e=>{ e.stopPropagation(); pick(today()); };
    menu.querySelector('.dm-clear').onclick=e=>{ e.stopPropagation(); pick(null); };
  };
  render();
  const r=anchor.getBoundingClientRect(); posMenu(menu, r, 6, 260, false);
}
const CAL_SVG='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
function periodCustomRow(pfx, from, to){ return `<div class="pcustom"><button class="pdate ${from?'set':''}" id="${pfx}FromBtn">${CAL_SVG}<span>${from?fdate(from):'From'}</span></button><span class="pcustom-to">to</span><button class="pdate ${to?'set':''}" id="${pfx}ToBtn">${CAL_SVG}<span>${to?fdate(to):'To'}</span></button></div>`; }
function wirePeriodCustom(pfx, curFrom, curTo, onFrom, onTo){
  const fb=document.getElementById(pfx+'FromBtn'), tb=document.getElementById(pfx+'ToBtn');
  if(fb) fb.onclick=e=>{ e.stopPropagation(); openDatePicker(fb, curFrom, onFrom); };
  if(tb) tb.onclick=e=>{ e.stopPropagation(); openDatePicker(tb, curTo, onTo); };
}
function chipMenu(btn, opts, cur, onPick){
  document.querySelectorAll('.chip.open').forEach(c=>c.classList.remove('open'));
  btn.classList.add('open');
  openSelMenu(btn, opts, cur, v=>{ btn.classList.remove('open'); onPick(v); });
  const off=e=>{ if(!e.target.closest('#cfMenu')){ btn.classList.remove('open'); document.removeEventListener('click', off, true); } };
  setTimeout(()=>document.addEventListener('click', off, true), 0);
}
function openSelMenu(anchor, opts, cur, onPick){
  const menu=document.getElementById('cfMenu'); const searchable=opts.length>8;
  const draw=(q)=>{ const items=opts.filter(o=>!q||o.t.toLowerCase().includes(q.toLowerCase()));
    menu.querySelector('.fmenu-list').innerHTML = items.length?items.map(o=>`<div class="fmenu-item ${o.v===cur?'sel':''}" data-v="${esc(o.v)}">${o.v===cur?'<svg class="fchk" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>':'<span class="fchk"></span>'}${o.ava||''}<span style="overflow:hidden;text-overflow:ellipsis">${esc(o.t)}</span></div>`).join(''):'<div class="fmenu-empty">No matches</div>';
    menu.querySelectorAll('.fmenu-item').forEach(it=>it.onclick=e=>{ e.stopPropagation(); onPick(it.dataset.v); menu.classList.remove('on'); }); };
  menu.innerHTML=(searchable?`<div class="fmenu-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input type="text" autocomplete="off" placeholder="Search"/></div>`:'')+`<div class="fmenu-list"></div>`;
  draw('');
  const r=anchor.getBoundingClientRect(); posMenu(menu, r, 6, 260, false);
  const si=menu.querySelector('.fmenu-search input'); if(si){ si.oninput=()=>draw(si.value); setTimeout(()=>si.focus(),0); }
}
function openCfMulti(taskId, fid, anchor, after){
  const menu=document.getElementById('cfMenu'); const f=store.fields().find(x=>x.id===fid);
  const cur=((store.task(taskId)||{}).custom||{})[fid]||[];
  menu.innerHTML=`<div class="fmenu-list">${(f.options||[]).map(o=>`<div class="fmenu-item ${cur.includes(o)?'sel':''}" data-o="${esc(o)}">${cur.includes(o)?'<svg class="fchk" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>':'<span class="fchk"></span>'}<span>${esc(o)}</span></div>`).join('')||'<div class="fmenu-empty">No options — add some in Board settings › Fields</div>'}</div>`;
  const r=anchor.getBoundingClientRect(); posMenu(menu, r, 6, 260, false);
  menu.querySelectorAll('.fmenu-item').forEach(it=>it.onclick=ev=>{ ev.stopPropagation(); const o=it.dataset.o;
    let arr=(((store.task(taskId)||{}).custom||{})[fid]||[]).slice(); if(arr.includes(o)) arr=arr.filter(x=>x!==o); else arr.push(o);
    store.setCustom(taskId,fid,arr); if(after) after(); menu.classList.remove('on'); });
}
document.addEventListener('click',e=>{ if(!e.target.closest('#cfMenu')&&!e.target.closest('.cfmulti')&&!e.target.closest('.projbtn')&&!e.target.closest('.asgbtn')&&!e.target.closest('.cdate')&&!e.target.closest('.p-sel')) document.getElementById('cfMenu').classList.remove('on'); });

function epicHealth(e,st){ const _today=today();
  if(st.total && st.done===st.total) return {k:'ok',t:'Complete'};
  if(e.due && e.due<_today) return {k:'late',t:'Behind'};
  if(e.due){ const d=(new Date(e.due)-new Date(_today))/86400000; if(d<=7 && st.pct<60) return {k:'risk',t:'At risk'}; }
  return {k:'ok',t:'On track'};
}
function renderEpics(){
  const wrap=document.getElementById('epicswrap');
  const epics=store.epics().filter(e=>ui.project==='all'||e.project===ui.project);
  const head=`<div class="ov-h"><h2>Epics</h2><button class="btn primary" id="epCreate" style="margin-left:auto">Create epic</button></div><div class="ep-sep"></div>`;
  if(!epics.length){
    wrap.innerHTML=head+`<div class="tsk-empty"><p>No epics yet. Group related work into one.</p><button class="tsk-btn tsk-btn--sm" id="epCreate2" type="button">Create epic</button></div>`;
    document.getElementById('epCreate').onclick=openEpicModal;
    const b2=document.getElementById('epCreate2'); if(b2) b2.onclick=openEpicModal;
    return;
  }
  const catOf=k=>{ const x=store.status(k.status); return x?x.cat:'todo'; };
  const rank=(a,b)=>{ const ra=t=>{ const c=(store.status(t.status)||{}).cat||'todo';
      if(t.status==='blocked') return 0; if(c==='inprogress') return 1; if(c==='todo') return 2; return 3; };
    return ra(a)-ra(b)||(b.updatedAt||'').localeCompare(a.updatedAt||''); };

  // one card per epic: top block untouched, ticket table underneath
  const cards=epics.map(e=>{
    const st=epicStats(e.id); const kids=st.kids;
    const proj=(store.project(e.project)||{}).name||'';
    const inprog=kids.filter(k=>catOf(k)==='inprogress').length;
    const health=epicHealth(e,st); const dueTxt=e.due?fdate(e.due):'\u2014';
    const tbl=tskTicketTable('ep:'+e.id, kids, rank);   // its own filter state per card
    return `<div class="ep-card" data-epic="${e.id}" style="position:relative">
      <button class="ep-kebab" data-epic="${e.id}" title="Epic options"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button>
      <div class="ep-left">
        <div class="ep-head"><div class="ep-ti ep-ti-edit" contenteditable="true" spellcheck="false" data-epic="${e.id}">${esc(e.title)}</div><div class="ep-sub">${esc(e.key)}${proj?' \u00b7 '+esc(proj):''} \u00b7 ${e.estimate?e.estimate+' pts':(st.total+' ticket'+(st.total!==1?'s':''))}</div></div>
        <div class="ep-mid"><div class="ep-ring" style="background:conic-gradient(var(--accent) ${st.pct}%, var(--surface-3) 0)"><b>${st.pct}%</b></div>
          <div><div class="ep-state">${st.total?(st.done===st.total?'Complete':'On the way'):'Not started'}</div><div class="ep-statesub">${st.done} of ${st.total} tickets \u00b7 ${hm(st.minutes)} logged</div><span class="ep-health ${health.k}">${health.t}</span></div></div>
        <div class="ep-cards"><div class="ep-sc"><div class="v">${st.done}</div><div class="l">Done</div></div><div class="ep-sc"><div class="v">${inprog}</div><div class="l">In progress</div></div><div class="ep-sc"><div class="v">${dueTxt}</div><div class="l">Due date</div></div></div>
      </div>
      <div class="ep-right">
        <div class="tsk-sec-head" style="margin-bottom:10px"><span class="tsk-eyebrow">Tickets</span>
          <span style="display:flex;align-items:center;gap:10px"><span class="tsk-eyebrow">${tbl.shown}${tbl.shown!==tbl.total?' of '+tbl.total:''}</span>
          <button class="tsk-btn tsk-btn--ghost tsk-btn--sm" data-addtk="${e.id}" type="button">Add ticket</button></span></div>
        ${kids.length?tbl.html:'<p class="tsk-rail-none" style="padding:6px 0">No tickets yet. Add one to start.</p>'}
      </div>
    </div>`;
  }).join('');

  wrap.innerHTML=head+`<div class="ep-wrap">${cards}</div>`;
  document.getElementById('epCreate').onclick=openEpicModal;
  wireTskTable(wrap, renderEpics);
  wrap.querySelectorAll('[data-addtk]').forEach(b=>b.onclick=ev=>{ ev.stopPropagation();
    const ep=store.task(b.dataset.addtk); openModal(null, b.dataset.addtk, ep?ep.project:null); });
  wrap.querySelectorAll('.ep-ti-edit').forEach(ti=>{
    const save=()=>{ const eid=ti.dataset.epic; const nv=ti.textContent.trim(); const ep=store.task(eid);
      if(ep && nv && nv!==ep.title){ store.updateTask(eid,{title:nv}); toast('Epic renamed'); }
      else if(ep && !nv){ ti.textContent=ep.title; } };
    ti.onblur=save;
    ti.onkeydown=ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); ti.blur(); }
      if(ev.key==='Escape'){ const ep=store.task(ti.dataset.epic); if(ep) ti.textContent=ep.title; ti.blur(); } };
  });
  wrap.querySelectorAll('.ep-kebab').forEach(b=>b.onclick=ev=>{ ev.stopPropagation(); openEpicMenu(b.dataset.epic, b); });
}

/* ---------- Epic options menu ---------- */
function openEpicMenu(eid, btn){
  const e=store.task(eid); if(!e) return;
  const m=document.getElementById('epCMenu');
  m.innerHTML=`<button data-a="open"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>Open details</button>
    <button data-a="rename"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>Rename</button>
    <button data-a="due"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>Set due date</button>
    <button data-a="addtask"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>Add task</button>
    <div class="sep"></div>
    <button class="danger" data-a="delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>Delete epic</button>`;
  const r=btn.getBoundingClientRect();
  m.style.left=Math.min(r.right-176, window.innerWidth-186)+'px'; m.style.top=(r.bottom+6)+'px'; m.classList.add('on');
  m.querySelectorAll('button').forEach(b=>b.onclick=ev=>{ ev.stopPropagation(); const a=b.dataset.a; m.classList.remove('on');
    if(a==='open') openEpicPanel(store.task(eid));
    else if(a==='rename'){ const ti=document.querySelector('.ep-ti-edit[data-epic="'+eid+'"]'); if(ti){ ti.focus(); document.getSelection().selectAllChildren(ti); } }
    else if(a==='due') openDateMenu(btn, eid, e.due, 'due');
    else if(a==='addtask') openModal(null, eid, e.project);
    else if(a==='delete') deleteEpic(eid);
  });
}
/* ---- Global confirmation dialog ------------------------------------------
   One dialog for every consequential action, so the user always sees exactly
   what will happen before it fires. Destructive actions get the red button;
   pass tone:'primary' for non-destructive confirms (blue button).
     confirmDelete({title, lead, impact:[{n,label}], confirmLabel, onConfirm,
                    tone:'danger'|'primary', warn:string|'' (''=hide line)}) */
function confirmDelete(opt){
  const w=document.getElementById('cfmWrap'); if(!w){ if(confirm(opt.lead||'Delete?')) opt.onConfirm&&opt.onConfirm((opt.choices||[{}])[0].id); return; }
  const wr=document.getElementById('cfmWarn');
  if(wr){ const wt=(opt.warn===undefined)?"This can't be undone.":opt.warn;
    wr.textContent=wt; wr.style.display=wt?'':'none'; }
  const DOT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  document.getElementById('cfmHead').textContent=opt.title||'Delete';
  document.getElementById('cfmLead').innerHTML=opt.lead||'';
  const choices=opt.choices||null;
  let sel=choices?(opt.defaultChoice||choices[0].id):null;
  const impactBox=document.getElementById('cfmImpact');
  const paint=(rows)=>{ const r=(rows||[]).filter(x=>x&&x.n>0);
    impactBox.innerHTML = r.length
      ? '<div class="cfm-impact-h">Also deleted</div>'+r.map(x=>`<div class="cfm-il">${DOT}<span><b>${x.n}</b> ${esc(x.label)}</span></div>`).join('')
      : ''; };
  const chBox=document.getElementById('cfmChoices');
  if(choices){
    const draw=()=>{ chBox.innerHTML=choices.map(c=>`<div class="cfm-ch ${c.id===sel?'on':''}" data-ch="${esc(c.id)}">
        <span class="cfm-ch-r"></span><span class="cfm-ch-b"><span class="cfm-ch-t">${esc(c.label)}</span><span class="cfm-ch-d">${c.desc||''}</span></span></div>`).join('');
      chBox.querySelectorAll('[data-ch]').forEach(el=>el.onclick=()=>{ sel=el.dataset.ch; draw();
        paint((choices.find(c=>c.id===sel)||{}).impact); });
      paint((choices.find(c=>c.id===sel)||{}).impact); };
    draw();
  } else { chBox.innerHTML=''; paint(opt.impact); }
  const go=document.getElementById('cfmGo'); go.textContent=opt.confirmLabel||'Delete';
  go.classList.toggle('primary', opt.tone==='primary');
  const close=()=>w.classList.remove('on');
  go.onclick=()=>{ close(); try{ opt.onConfirm&&opt.onConfirm(sel); }catch(e){ __dbg.warn(e); } };
  document.getElementById('cfmCancel').onclick=close;
  w.onclick=e=>{ if(e.target===w) close(); };
  w.classList.add('on');
}
function deleteEpic(eid){
  if(!can('ticket_delete')){ toast('You don\u2019t have permission to delete tickets'); return; }
  const e=store.task(eid); if(!e) return;
  const kids=store.tasks().filter(t=>t.parent===eid);
  const ids=[eid].concat(kids.map(k=>k.id));
  const logs=store.data.worklogs.filter(w=>ids.includes(w.task)).length;
  const cmts=ids.reduce((n,id)=>n+(((store.task(id)||{}).comments)||[]).length,0);
  const subs=ids.reduce((n,id)=>n+(((store.task(id)||{}).subtasks)||[]).length,0);
  const n=kids.length;
  if(!n){   // nothing linked — no choice to make
    confirmDelete({ title:'Delete epic', lead:`Delete the epic <b>${esc(e.title)}</b>?`,
      confirmLabel:'Delete epic',
      onConfirm:()=>{ store.removeTask(eid); if(ui.openTask===eid) closePanel(); refreshViews(); toast('Epic deleted'); } });
    return;
  }
  confirmDelete({
    title:'Delete epic',
    lead:`<b>${esc(e.title)}</b> has <b>${n}</b> linked ticket${n===1?'':'s'}. What should happen to ${n===1?'it':'them'}?`,
    choices:[
      {id:'keep', label:'Delete only the epic',
       desc:`Keep ${n===1?'the ticket':'all '+n+' tickets'} and their comments, subtasks and time logs \u2014 they simply stop belonging to this epic.`,
       impact:[]},
      {id:'cascade', label:'Delete the epic and everything in it',
       desc:'Removes the linked tickets and all of their history permanently.',
       impact:[{n:n, label:'linked ticket'+(n===1?'':'s')},
               {n:subs, label:'subtask'+(subs===1?'':'s')},
               {n:cmts, label:'comment'+(cmts===1?'':'s')},
               {n:logs, label:'time log'+(logs===1?'':'s')}]},
    ],
    defaultChoice:'keep',
    confirmLabel:'Delete epic',
    onConfirm:(mode)=>{
      if(mode==='cascade'){ ids.forEach(id=>store.removeTask(id));
        if(ui.openTask && ids.includes(ui.openTask)) closePanel();
        toast(`Epic and ${n} ticket${n===1?'':'s'} deleted`); }
      else { kids.forEach(k=>store.updateTask(k.id,{parent:null}));
        store.removeTask(eid); if(ui.openTask===eid) closePanel();
        toast(`Epic deleted \u00b7 ${n} ticket${n===1?'':'s'} kept`); }
      refreshViews(); }
  });
}
document.addEventListener('click',e=>{ const m=document.getElementById('epCMenu');
  if(m && m.classList.contains('on') && !e.target.closest('#epCMenu') && !e.target.closest('.ep-kebab')) m.classList.remove('on'); });

/* ---------- Create Epic modal ---------- */
function epmTaskRow(){
  const opts='<option value="">Unassigned</option>'+store.activeUsers().map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
  const row=document.createElement('div'); row.className='epm-task';
  row.innerHTML=`<input class="epm-tname" placeholder="Task title" autocomplete="off"/><select class="epm-tasg">${opts}</select><button class="epm-trm" type="button" title="Remove">\u2715</button>`;
  row.querySelector('.epm-trm').onclick=()=>row.remove();
  row.querySelector('.epm-tname').onkeydown=ev=>{ if(ev.key==='Enter'){ ev.preventDefault();
    const rows=[...document.querySelectorAll('#epmTasks .epm-task')];
    if(row===rows[rows.length-1]) epmAddTaskRow(true);
    else { const nx=rows[rows.indexOf(row)+1]; if(nx) nx.querySelector('.epm-tname').focus(); } } };
  return row;
}
function epmAddTaskRow(focus){ const box=document.getElementById('epmTasks'); const r=epmTaskRow(); box.appendChild(r);
  try{ enhanceSelects(r); syncSelx(r); }catch(e){}
  if(focus) r.querySelector('.epm-tname').focus(); }
function openEpicModal(){
  if(!can('ticket_create')){ toast('You don\u2019t have permission to create tickets'); return; }
  const pSel=document.getElementById('epmProject');
  pSel.innerHTML=`<option value="">Select a project\u2026</option>`+store.projects().map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  if(ui.project && ui.project!=='all') pSel.value=ui.project;
  document.getElementById('epmLead').innerHTML='<option value="">Unassigned</option>'+store.activeUsers().map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
  document.getElementById('epmTitle').value=''; document.getElementById('epmDesc').value=''; document.getElementById('epmDue').value='';
  document.getElementById('epmTasks').innerHTML=''; epmAddTaskRow(); epmAddTaskRow();
  document.getElementById('epicWrap').classList.add('on');
  try{ enhanceSelects(document.getElementById('epicWrap')); syncSelx(document.getElementById('epicWrap')); }catch(e){}
  setTimeout(()=>document.getElementById('epmTitle').focus(),40);
}
function closeEpicModal(){ document.getElementById('epicWrap').classList.remove('on'); }
async function submitEpic(){
  if(!reqCheck([
    ['epmTitle',   'Give the epic a name'],
    ['epmProject', 'Pick a project for this epic'],
  ])) return;
  const title=document.getElementById('epmTitle').value.trim();
  if(!title){ toast('Give the epic a name'); document.getElementById('epmTitle').focus(); return; }
  const pid=document.getElementById('epmProject').value||null;
  const lead=document.getElementById('epmLead').value||null;
  const due=document.getElementById('epmDue').value||null;
  const desc=document.getElementById('epmDesc').value.trim();
  const ws=(ui.space||'ws_main');
  const todoStatus=(STATUSES.find(s=>(s.cat||'todo')==='todo')||STATUSES[0]||{}).id;
  const eid='e'+Date.now();
  const epic={ id:eid, ws, project:pid, key:await allocateKey(pid), title, type:'Epic', status:todoStatus,
    priority:'Medium', assignee:lead, reporter:CURRENT_UID||lead, parent:null,
    color:SWATCHES[2+(store.epics().length%6)], due, start:null, estimate:0,
    resolution:'Unresolved', createdAt:today(), createdTs:new Date().toISOString(), updatedAt:today(), resolvedAt:null, desc };
  store._applyResolution(epic); store.addTask(epic);
  let n=0;
  // A real loop, not forEach: await inside forEach does not wait, so every
  // ticket would race for the same number — the bug we are removing.
  for(const row of [...document.querySelectorAll('#epmTasks .epm-task')]){
    const tt=row.querySelector('.epm-tname').value.trim(); if(!tt) continue;
    const t={ id:newTaskId('t'), ws, board:(ui.board||null), project:pid, key:await allocateKey(pid), title:tt, type:'Task', status:todoStatus,
      priority:'Medium', assignee:row.querySelector('.epm-tasg').value||null, reporter:CURRENT_UID||null, parent:eid,
      due:null, start:null, estimate:0, resolution:'Unresolved', createdAt:today(), createdTs:new Date().toISOString(),
      updatedAt:today(), resolvedAt:null, desc:'' };
    store._applyResolution(t); store.addTask(t); n++;
    // Part B — keep the board able to show every ticket created on it.
    if(t.board){ const bd=store.board(t.board);
      if(bd && t.status && !(bd.columns||[]).includes(t.status)) store.toggleBoardColumn(bd, t.status, true); }
  }
  closeEpicModal(); refreshViews();
  toast('Epic created'+(n?' with '+n+' task'+(n!==1?'s':''):''));
}
/* ---------- drag & drop ---------- */
let dragId=null, dragFrom=null;
function attachDnD(board){
  const bd=activeBoard();
  board.querySelectorAll('.card').forEach(card=>{
    card.addEventListener('dragstart',e=>{ if(!can('ticket_move')){ e.preventDefault(); return; } if(e.target.closest('.cedit')||e.target.closest('.clog')||e.target.closest('.cfedit')||e.target.closest('.cfmulti')||e.target.closest('.projbtn')||e.target.closest('.asgbtn')||e.target.closest('.cdate')||e.target.closest('.card-kebab')){ e.preventDefault(); return; }
      dragId=card.dataset.id; const t=store.task(dragId); dragFrom=t?t.status:null;
      card.classList.add('dragging'); e.dataTransfer.effectAllowed='move';
      if(bd.enforce){ board.querySelectorAll('.col').forEach(col=>{ const to=col.dataset.status;
        if(to && to!==dragFrom) col.classList.add(canMove(bd,dragFrom,to)?'drop-ok':'drop-no'); }); } });
    card.addEventListener('dragend',()=>{ dragId=null; dragFrom=null; card.classList.remove('dragging');
      board.querySelectorAll('.col').forEach(col=>col.classList.remove('drop-ok','drop-no','dragover')); });
  });
  board.querySelectorAll('.col').forEach(col=>{
    col.addEventListener('dragover',e=>{ const to=col.dataset.status; if(!to) return;
      if(bd.enforce && dragFrom && !canMove(bd,dragFrom,to)) return; // not a valid drop target
      e.preventDefault(); col.classList.add('dragover'); });
    col.addEventListener('dragleave',()=>col.classList.remove('dragover'));
    col.addEventListener('drop',e=>{ e.preventDefault(); col.classList.remove('dragover');
      const ns=col.dataset.status; if(!ns||!dragId) return;
      const t=store.task(dragId);
      if(t && t.status!==ns){
        if(bd.enforce && !canMove(bd, t.status, ns)){ toast(`${store.status(t.status).name} → ${store.status(ns).name} isn't an allowed transition`); return; }
        store.moveTask(dragId,ns); toast(`${t.key} → ${store.status(ns).name}`);
      }
      renderBoard(); if(ui.openTask===dragId) openPanel(dragId,true); });
  });
}
