/* Taskora — 09-workflow-editor.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ================== Workflow editor ==================
   Full-screen, and empty until you add statuses — a board's workflow is
   something you build, not something it inherits. Edits stage in _flowDraft
   and only land on Update.  */
let _wfBoard=null, _wfLabels=true, _wfAddSw=null, _wfEdSw=null, _wfEdit=null;
const WFW=168, WFH=38;

function openWorkflow(bid){
  _wfBoard = bid || ui.board;
  const b=store.board(_wfBoard); if(!b) return;
  _flowSel=null; _flowLink=null; flowDraftReset();
  document.getElementById('wfScreen').classList.add('on');
  renderWorkflow();
}
function closeWorkflow(){
  const proceed=()=>{ flowDraftReset(); document.getElementById('wfScreen').classList.remove('on'); renderAll(); };
  if(_flowDirty){ confirmDelete({ title:'Unsaved changes', lead:'You have unsaved workflow changes.',
    confirmLabel:'Close without updating', warn:'', onConfirm:proceed }); return; }
  proceed();
}

const WF_IC={
  st:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="8.5" width="18" height="7" rx="3.5"/></svg>',
  tr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4v8a4 4 0 0 0 4 4h8"/><path d="M14 12l4 4-4 4"/></svg>',
  cl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  fit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>'
};

/* Right-angle routing: leave the source, run the corridor, enter the target. */
function wfPath(p1,p2){
  const a={x:p1.x+WFW/2, y:p1.y+WFH/2}, b={x:p2.x+WFW/2, y:p2.y+WFH/2};
  const dx=b.x-a.x, dy=b.y-a.y;
  let s,e,mid;
  if(Math.abs(dx)>Math.abs(dy)){
    s={x:p1.x+(dx>0?WFW:0), y:a.y}; e={x:p2.x+(dx>0?0:WFW), y:b.y};
    mid=(s.x+e.x)/2;
    return { d:`M${s.x} ${s.y} H${mid} V${e.y} H${e.x}`, lx:mid, ly:(s.y+e.y)/2 };
  }
  s={x:a.x, y:p1.y+(dy>0?WFH:0)}; e={x:b.x, y:p2.y+(dy>0?0:WFH)};
  mid=(s.y+e.y)/2;
  return { d:`M${s.x} ${s.y} V${mid} H${e.x} V${e.y}`, lx:(s.x+e.x)/2, ly:mid };
}

function wfCols(b){ return store.boardColumns(b); }

function renderWorkflow(){
  const b=store.board(_wfBoard); if(!b) return;
  const d=flowDraftFor(b);
  const cols=wfCols(b);

  document.getElementById('wfBoardName').textContent=b.name;
  document.getElementById('wfTools').innerHTML=`
    <button class="wf-tool" id="wfAdd" type="button">${WF_IC.st}Add status</button>
    <button class="wf-tool" id="wfLink" type="button" ${_flowSel?'':'disabled'}>${WF_IC.tr}Add transition</button>
    <button class="wf-tool" id="wfClone" type="button" ${store.boards().length>1?'':'disabled'}>${WF_IC.cl}Clone flow</button>
    <button class="wf-tool" id="wfFit" type="button">${WF_IC.fit}Fit</button>`;
  document.querySelectorAll('#wfMode button').forEach(x=>x.classList.toggle('on', x.dataset.fm===_flowMode));
  document.getElementById('wfLabels').checked=_wfLabels;
  document.getElementById('wfDirty').classList.toggle('on', _flowDirty);
  document.getElementById('wfSave').disabled=!_flowDirty;

  const canvas=document.getElementById('wfCanvas');
  if(canvas && !canvas.__wfRO && 'ResizeObserver' in window){
    canvas.__wfRO=true; let _wfW=canvas.clientWidth, _wfT=null;
    new ResizeObserver(()=>{ const w=canvas.clientWidth;
      if(Math.abs(w-_wfW)>4){ _wfW=w; clearTimeout(_wfT); _wfT=setTimeout(()=>{ if(document.getElementById('wfScreen') && document.getElementById('wfScreen').classList.contains('on')) renderWorkflow(); },140); }
    }).observe(canvas);
  }
  if(!cols.length){
    canvas.innerHTML=`<div class="wf-empty"><div>
      <h3>This workflow is empty</h3>
      <p>A board's workflow starts blank on purpose \u2014 add only the statuses this team actually uses, then connect them.</p>
      <button class="tsk-btn tsk-btn--sm" id="wfAdd2" type="button">Add your first status</button></div></div>`;
    document.getElementById('wfAdd2').onclick=openWfAdd;
    document.getElementById('wfSide').innerHTML=flowInspector(b);
    wireWorkflowChrome();
    return;
  }
  const tn=Object.values(d.transitions||{}).reduce((a,x)=>a+x.length,0);
  const open=`<div class="stx-card pad flow-enforce" style="margin-top:10px">
      <div><div class="stx-acc-t">Workflow editor</div>
        <div class="stx-acc-d">${cols.length
          ? `<b>${cols.length} statuses</b> and <b>${tn} transitions</b> on this board. Open the editor to lay them out and connect them.`
          : `This board has <b>no statuses yet</b>. Open the editor to build its workflow.`}</div></div>
      <button class="tsk-btn tsk-btn--sm" id="fxOpen" type="button">Open editor</button>
    </div>`;
  if(_flowMode==='text'){
    canvas.innerHTML=`<div style="padding:18px 20px">${bsFlow(b)}</div>`;
    document.getElementById('wfSide').innerHTML=flowInspector(b);
    wireWorkflowChrome(); wireBoardSettings(b);
    return;
  }

  const pos=flowPos(d, cols);
  const byId={}; cols.forEach(s=>byId[s.id]=s);
  const first=cols[0];

  const edges=[];
  Object.keys(d.transitions||{}).forEach(from=>{
    (d.transitions[from]||[]).forEach(to=>{
      if(!byId[from]||!byId[to]) return;
      const g=wfPath(pos[from], pos[to]);
      const on=_flowSel&&(from===_flowSel||to===_flowSel);
      const nm=flowLabel(d,from,to)||byId[to].name;
      const w=Math.min(150, 10+nm.length*5.4);
      edges.push(`<g class="wf-edge ${on?'is-on':''}" data-from="${from}" data-to="${to}">
        <path d="${g.d}" marker-end="url(#wfAr${on?'On':''})"/>
        <g class="wf-elbl" transform="translate(${g.lx},${g.ly})">
          <rect x="${-w/2}" y="-9" width="${w}" height="18" rx="9"/>
          <text text-anchor="middle" dy="3.5">${esc(nm.length>24?nm.slice(0,23)+'\u2026':nm)}</text></g></g>`);
    });
  });

  const nodes=cols.map(st=>{
    const p=pos[st.id];
    const cat=(st.cat||'todo');
    return `<g class="wf-node cat-${cat} ${st.id===_flowSel?'is-sel':''} ${_flowLink===st.id?'is-src':''}"
        data-node="${st.id}" transform="translate(${p.x},${p.y})">
      <rect class="bx" width="${WFW}" height="${WFH}" rx="5"/>
      <text x="${WFW/2}" y="${WFH/2}" dy="3.5" text-anchor="middle">${esc(st.name.toUpperCase().slice(0,20))}</text></g>`;
  }).join('');

  // START marker, pointing at whatever the first column is
  const fp=pos[first.id];
  const sx=Math.max(10, fp.x-92), sy=fp.y+WFH/2;
  const start=`<g class="wf-start"><circle cx="${sx}" cy="${sy}" r="13"/>
      <text x="${sx}" y="${sy}" dy="2.5" text-anchor="middle">START</text></g>
    <g class="wf-edge"><path d="M${sx+13} ${sy} H${fp.x}" marker-end="url(#wfAr)"/>
      <g class="wf-elbl" transform="translate(${(sx+13+fp.x)/2},${sy})">
        <rect x="-22" y="-9" width="44" height="18" rx="9"/><text text-anchor="middle" dy="3.5">Create</text></g></g>`;

  const maxX=Math.max(...cols.map(s=>pos[s.id].x))+WFW+120;
  const maxY=Math.max(...cols.map(s=>pos[s.id].y))+WFH+120;
  const W=Math.max(1200,maxX), H=Math.max(560,maxY);
  // auto fit-to-width: scale the diagram so it fills the available canvas width
  if(_flowAutoFit){
    const cv=document.getElementById('wfCanvas');
    const avail=cv? cv.clientWidth-40 : 0;   // minus a little padding
    if(avail>200){ _flowZoom=Math.min(1.6, Math.max(0.4, avail/W)); }
  }

  canvas.innerHTML=`<svg id="wfSvg" width="${Math.round(W*_flowZoom)}" height="${Math.round(H*_flowZoom)}"
      viewBox="0 0 ${W} ${H}" class="${_wfLabels?'':'wf-hide-lbl'}">
      <defs>
        <marker id="wfAr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#C8CCD4"/></marker>
        <marker id="wfArOn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker>
      </defs>
      ${start}${edges.join('')}${nodes}
    </svg>
    <div class="wf-mini"><div class="wf-mini-c">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
          ${cols.map(st=>`<rect class="wf-mini-n ${st.id===_flowSel?'on':''}" x="${pos[st.id].x}" y="${pos[st.id].y}" width="${WFW}" height="${WFH}" rx="6"/>`).join('')}
        </svg></div>
      <div class="wf-zoomrow"><button type="button" id="wfZo">\u2212</button>
        <input type="range" id="wfZr" min="40" max="160" value="${Math.round(_flowZoom*100)}"/>
        <button type="button" id="wfZi">+</button></div></div>`;

  document.getElementById('wfSide').innerHTML=flowInspector(b);
  wireWorkflowChrome();
  wireWfCanvas(b);
  wireFlowInspector(b);
}

function wireWorkflowChrome(){
  const b=store.board(_wfBoard);
  const g=id=>document.getElementById(id);
  g('wfAdd').onclick=openWfAdd;
  g('wfFit').onclick=()=>{ _flowAutoFit=true; renderWorkflow(); };
  g('wfLink').onclick=()=>{ if(!_flowSel) return; _flowLink=_flowSel; renderWorkflow(); };
  g('wfClone').onclick=wfClone;
  g('wfLabels').onchange=e=>{ _wfLabels=e.target.checked; renderWorkflow(); };
  document.querySelectorAll('#wfMode button').forEach(x=>x.onclick=()=>{ _flowMode=x.dataset.fm; renderWorkflow(); });
  g('wfSave').onclick=()=>{ flowSave(); renderWorkflow(); };
  g('wfDiscard').onclick=closeWorkflow;
  g('wfBoardName').onclick=()=>{ closeWorkflow(); };
}

function wireWfCanvas(b){
  const d=flowDraftFor(b);
  const svg=document.getElementById('wfSvg'); if(!svg) return;
  const dirty=()=>{ _flowDirty=true; };

  svg.querySelectorAll('.wf-node').forEach(n=>{
    n.onclick=e=>{
      e.stopPropagation();
      const id=n.dataset.node;
      if(_flowLink && _flowLink!==id){
        d.transitions[_flowLink]=d.transitions[_flowLink]||[];
        if(!d.transitions[_flowLink].includes(id)){ d.transitions[_flowLink].push(id); dirty(); }
        _flowSel=_flowLink; _flowLink=null; renderWorkflow(); return;
      }
      if(_flowLink===id){ _flowLink=null; renderWorkflow(); return; }
      _flowSel=id; renderWorkflow();
    };
    n.ondblclick=e=>{ e.stopPropagation(); _flowSel=n.dataset.node; openWfEdit(); };
  });

  let drag=null;
  svg.addEventListener('pointerdown', e=>{
    const g=e.target.closest('.wf-node'); if(!g) return;
    const id=g.dataset.node; const r=svg.getBoundingClientRect();
    const sc=svg.viewBox.baseVal.width/r.width;
    drag={ id, sx:e.clientX, sy:e.clientY, ox:d.pos[id].x, oy:d.pos[id].y, sc, moved:false };
    g.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e=>{
    if(!drag) return;
    const dx=(e.clientX-drag.sx)*drag.sc, dy=(e.clientY-drag.sy)*drag.sc;
    if(Math.abs(dx)>2||Math.abs(dy)>2) drag.moved=true;
    d.pos[drag.id]={ x:Math.max(0,Math.round(drag.ox+dx)), y:Math.max(0,Math.round(drag.oy+dy)) };
    const g=svg.querySelector(`.wf-node[data-node="${drag.id}"]`);
    if(g) g.setAttribute('transform', `translate(${d.pos[drag.id].x},${d.pos[drag.id].y})`);
  });
  svg.addEventListener('pointerup', ()=>{ if(drag&&drag.moved){ _flowDirty=true; renderWorkflow(); } drag=null; });

  const zi=document.getElementById('wfZi'), zo=document.getElementById('wfZo'), zr=document.getElementById('wfZr');
  const setZ=v=>{ _flowAutoFit=false; _flowZoom=Math.min(1.6,Math.max(.4,v)); renderWorkflow(); };
  if(zi) zi.onclick=()=>setZ(_flowZoom+0.1);
  if(zo) zo.onclick=()=>setZ(_flowZoom-0.1);
  if(zr) zr.oninput=()=>setZ(parseInt(zr.value,10)/100);
}

function wireFlowInspector(b){
  const d=flowDraftFor(b);
  const nm=document.getElementById('fxName');
  if(nm) nm.onchange=()=>{ if(!can('board_workflow')){ toast('You don\u2019t have permission to edit the workflow'); renderWorkflow(); return; }
    const v=nm.value.trim(); if(v&&_flowSel){ store.updateStatus(_flowSel,{name:v}); renderWorkflow(); } };
  document.querySelectorAll('.fx-tr-n').forEach(i=>i.onchange=()=>{
    d.labels=d.labels||{}; const v=i.value.trim();
    if(v) d.labels[i.dataset.lbl]=v; else delete d.labels[i.dataset.lbl];
    _flowDirty=true; renderWorkflow();
  });
  document.querySelectorAll('#wfSide [data-del]').forEach(x=>x.onclick=()=>{
    const [f,t]=x.dataset.del.split('>');
    d.transitions[f]=(d.transitions[f]||[]).filter(y=>y!==t);
    if(d.labels) delete d.labels[x.dataset.del];
    _flowDirty=true; renderWorkflow();
  });
  const add=document.getElementById('fxAddTr');
  if(add) add.onclick=()=>{ _flowLink=_flowSel; renderWorkflow(); };
  const ed=document.getElementById('fxEdit'); if(ed) ed.onclick=openWfEdit;
  const rm=document.getElementById('fxRemove');
  if(rm) rm.onclick=()=>{
    const st=store.status(_flowSel); if(!st) return;
    confirmDelete({ title:'Remove from workflow',
      lead:`Remove <b>${esc(st.name)}</b> from this workflow? The status itself stays \u2014 it is just no longer part of <b>${esc(store.board(_wfBoard).name)}</b>.`,
      confirmLabel:'Remove status', warn:'',
      onConfirm:()=>{
        store.toggleBoardColumn(store.board(_wfBoard), _flowSel, false);
        delete d.transitions[_flowSel];
        Object.keys(d.transitions).forEach(k=>{ d.transitions[k]=(d.transitions[k]||[]).filter(x=>x!==_flowSel); });
        _flowSel=null; _flowDirty=true; renderWorkflow();
      } });
  };
}

/* ---------- Add a status ---------- */
function openWfAdd(){
  _wfAddSw=SWATCHES[0];
  const n=document.getElementById('wfAddName'); n.value='';
  document.getElementById('wfAddCat').value='todo';
  document.getElementById('wfAddSw').innerHTML=SWATCHES.map(c=>
    `<button type="button" class="pj-sw ${c===_wfAddSw?'on':''}" data-c="${c}" style="background:${c}"></button>`).join('');
  document.querySelectorAll('#wfAddSw .pj-sw').forEach(x=>x.onclick=()=>{ _wfAddSw=x.dataset.c;
    document.querySelectorAll('#wfAddSw .pj-sw').forEach(y=>y.classList.toggle('on', y===x)); });
  n.oninput=()=>wfAddSug(n.value);
  wfAddSug('');
  document.getElementById('wfAddWrap').classList.add('on');
  setTimeout(()=>n.focus(),40);
}
function wfAddSug(q){
  const b=store.board(_wfBoard);
  const mine=new Set(b.columns||[]);
  const term=(q||'').trim().toLowerCase();
  const free=store.statuses().filter(s=>!mine.has(s.id) && (!term||s.name.toLowerCase().includes(term)));
  const clash=store.statuses().find(s=>mine.has(s.id) && s.name.toLowerCase()===term);
  const box=document.getElementById('wfAddSug');
  let html='';
  if(clash) html+=`<div class="wf-sug-note">This workflow already contains a status called <b>${esc(clash.name)}</b>.</div>`;
  if(free.length) html+=free.slice(0,5).map(s=>`<div class="wf-sug-i" data-use="${s.id}">
      <span class="wf-sug-d" style="background:${s.color}"></span>${esc(s.name)}<span class="wf-sug-n">reuse</span></div>`).join('');
  else if(term && !clash) html+=`<div class="wf-sug-note">No existing status matches \u2014 <b>Add</b> creates \u201c${esc(q)}\u201d.</div>`;
  box.innerHTML=html;
  box.querySelectorAll('[data-use]').forEach(x=>x.onclick=()=>{
    store.toggleBoardColumn(store.board(_wfBoard), x.dataset.use, true);
    _flowSel=x.dataset.use; _flowDirty=true;
    document.getElementById('wfAddWrap').classList.remove('on');
    renderWorkflow();
  });
}
function wfAddGo(){
  const name=(document.getElementById('wfAddName').value||'').trim();
  if(!name){ toast('Name the status first'); return; }
  const b=store.board(_wfBoard);
  const mine=new Set(b.columns||[]);
  if(store.statuses().some(s=>mine.has(s.id) && s.name.toLowerCase()===name.toLowerCase())){
    toast('This workflow already has a status called '+name); return; }
  const ex=store.statuses().find(s=>s.name.toLowerCase()===name.toLowerCase());
  if(!can('board_workflow')){ toast('You don\u2019t have permission to edit the workflow'); return; }
  let id;
  if(ex){ id=ex.id; }
  else { store.addStatus(name); id=store.statuses()[store.statuses().length-1].id;
    store.updateStatus(id,{ cat:document.getElementById('wfAddCat').value, color:_wfAddSw||SWATCHES[0] }); }
  store.toggleBoardColumn(b, id, true);
  _flowSel=id; _flowDirty=true;
  document.getElementById('wfAddWrap').classList.remove('on');
  renderWorkflow();
  toast(ex?'Added '+ex.name+' to this workflow':'Created '+name);
}

/* ---------- Edit a status ---------- */
function openWfEdit(){
  const st=store.status(_flowSel); if(!st) return;
  _wfEdSw=st.color||SWATCHES[0];
  document.getElementById('wfEdName').value=st.name;
  document.getElementById('wfEdCat').value=st.cat||'todo';
  document.getElementById('wfEdSw').innerHTML=SWATCHES.map(c=>
    `<button type="button" class="pj-sw ${c===_wfEdSw?'on':''}" data-c="${c}" style="background:${c}"></button>`).join('');
  document.querySelectorAll('#wfEdSw .pj-sw').forEach(x=>x.onclick=()=>{ _wfEdSw=x.dataset.c;
    document.querySelectorAll('#wfEdSw .pj-sw').forEach(y=>y.classList.toggle('on', y===x)); });
  document.getElementById('wfEditWrap').classList.add('on');
}
function wfEditGo(){
  const v=(document.getElementById('wfEdName').value||'').trim();
  if(!v){ toast('Give the status a name'); return; }
  if(!can('board_workflow')){ toast('You don\u2019t have permission to edit the workflow'); return; }
  store.updateStatus(_flowSel, { name:v, cat:document.getElementById('wfEdCat').value, color:_wfEdSw });
  document.getElementById('wfEditWrap').classList.remove('on');
  renderWorkflow(); renderAll();
  toast('Status updated');
}

function wfClone(){
  const b=store.board(_wfBoard);
  const others=store.boards().filter(x=>x.id!==b.id);
  if(!others.length) return;
  const pick=prompt('Clone a workflow onto \u201c'+b.name+'\u201d.\n\nThis replaces its transitions.\n'
    +others.map((x,i)=>` ${i+1}. ${x.name} (${(x.columns||[]).length} statuses)`).join('\n')+'\n\nType a number:');
  if(!pick) return;
  const src=others[parseInt(pick,10)-1];
  if(!src){ toast('No board with that number'); return; }
  const d=flowDraftFor(b);
  // bring the statuses across too — a workflow is meaningless without them
  (src.columns||[]).forEach(id=>{ if(!(b.columns||[]).includes(id)) store.toggleBoardColumn(b, id, true); });
  d.transitions=JSON.parse(JSON.stringify(src.transitions||{}));
  d.labels=JSON.parse(JSON.stringify(src.tlabels||{}));
  d.pos=JSON.parse(JSON.stringify(src.flowPos||{}));
  d.enforce=!!src.enforce;
  _flowDirty=true; renderWorkflow();
  toast(`Cloned ${src.name} \u00b7 ${(src.columns||[]).length} statuses \u2014 Update to apply`);
}

/* ---------- In-page dialogs ----------
   prompt()/confirm() are blocked in sandboxed iframes — they return null/false,
   which this code read as "cancelled", so transitions silently never happened.
   These are real dialogs, so they work wherever the app is embedded. */
let _trNameCb=null, _cfCb=null;
function askTransitionName(fromName, toName, dflt){
  // both ends known (from the canvas) — just name it
  return openTrDialog({ fixed:'both', fromName, toName, dflt });
}
/* One dialog for every route in. opts:
   { fixed:'both' } | { fixed:'from', fromId } | { fixed:'to', toId }   */
function openTrDialog(opts){
  return new Promise(res=>{
    const pw=document.getElementById('trPickWrap');
    const sel=document.getElementById('trPick');
    const route=document.getElementById('trRoute');
    const nm=document.getElementById('trNameIn');
    const arrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
    const draw=(a,bq)=>{ route.innerHTML=`<b>${esc(a)}</b>${arrow}<b class="to">${esc(bq)}</b>`; };

    if(opts.fixed==='both'){
      pw.style.display='none';
      draw(opts.fromName, opts.toName);
      nm.value=opts.dflt||'';
      _trNameCb=v=>res(v);
    } else {
      pw.style.display='';
      const d=fxDraft();
      const fixedId = opts.fixed==='from' ? opts.fromId : opts.toId;
      const fixed=store.status(fixedId);
      document.getElementById('trPickLbl').textContent =
        opts.fixed==='from' ? 'Moves to' : 'Moves from';
      // only statuses on this workflow, minus the fixed one and anything already linked
      const taken = opts.fixed==='from'
        ? new Set(d.transitions[fixedId]||[])
        : new Set(Object.keys(d.transitions||{}).filter(f=>(d.transitions[f]||[]).includes(fixedId)));
      const opts2=fxCols().filter(x=>x.id!==fixedId && !taken.has(x.id));
      if(!opts2.length){
        toast(opts.fixed==='from' ? 'Already connected to every other status' : 'Every other status already moves into this one');
        res(null); return;
      }
      sel.innerHTML=opts2.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
      const sync=()=>{ const other=store.status(sel.value);
        if(opts.fixed==='from') draw(fixed.name, other.name); else draw(other.name, fixed.name);
        nm.value = opts.fixed==='from' ? other.name : fixed.name; };
      sel.onchange=sync; sync();
      _trNameCb=v=>res(v===null?null:{ name:v, other:sel.value });
    }
    document.getElementById('trNameWrap').classList.add('on');
    setTimeout(()=>{ nm.focus(); nm.select(); },40);
  });
}
function closeTrName(v){ document.getElementById('trNameWrap').classList.remove('on');
  const cb=_trNameCb; _trNameCb=null; if(cb) cb(v); }
function askConfirm(title, body, okLabel){
  return new Promise(res=>{
    document.getElementById('cfTitle').textContent=title;
    document.getElementById('cfBody').textContent=body||'';
    document.getElementById('cfYes').textContent=okLabel||'Confirm';
    document.getElementById('cfWrap').classList.add('on');
    _cfCb=res;
  });
}
function closeCf(v){ document.getElementById('cfWrap').classList.remove('on');
  const cb=_cfCb; _cfCb=null; if(cb) cb(v); }
