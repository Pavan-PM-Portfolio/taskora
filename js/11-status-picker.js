/* Taskora — 11-status-picker.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ---------- Add a status ---------- */
function openStatusPicker(){
  const w=document.getElementById('stPickWrap');
  const inp=document.getElementById('stPickIn');
  inp.value=''; _stPickSel=null;
  document.getElementById('stPickMsg').textContent='';
  document.getElementById('stPickAdd').disabled=true;
  stPickDraw('');
  w.classList.add('on');
  setTimeout(()=>inp.focus(),40);
}
let _stPickSel=null;
function stPickDraw(raw){
  const typed=(raw||'').trim();          // what they actually typed, for display
  const q=typed.toLowerCase();           // lowercased, for matching only
  const onBoard=new Set(_fxBoard.columns||[]);
  const all=store.statuses();
  const hits=all.filter(s=>!q||s.name.toLowerCase().includes(q));
  const list=document.getElementById('stPickList');
  const msg=document.getElementById('stPickMsg');
  const dupe=q && all.find(s=>s.name.toLowerCase()===q && onBoard.has(s.id));
  if(dupe){
    msg.innerHTML=`Your workflow already contains a status called <b>${esc(dupe.name)}</b>`;
    list.innerHTML=''; document.getElementById('stPickAdd').disabled=true; return;
  }
  msg.textContent='';
  const rows=hits.filter(s=>!onBoard.has(s.id)).map(s=>
    `<button type="button" class="stp-row ${_stPickSel===s.id?'on':''}" data-s="${s.id}">
      <span class="fxs-cat cat-${s.cat||'todo'}"></span><span class="stp-n">${esc(s.name)}</span>
      <span class="stp-c">${(s.cat==='inprogress'?'In progress':s.cat==='done'?'Done':'To do')}</span></button>`).join('');
  const canNew = q && !all.some(s=>s.name.toLowerCase()===q);
  list.innerHTML = (rows||'') + (canNew?`<button type="button" class="stp-row stp-new ${_stPickSel==='__new'?'on':''}" data-s="__new">
      <span class="stp-plus">+</span><span class="stp-n">Create <b>${esc(typed)}</b></span></button>`:'')
    || '<p class="stp-none">Every status is already on this workflow.</p>';
  list.querySelectorAll('.stp-row').forEach(r=>r.onclick=()=>{
    _stPickSel=r.dataset.s; stPickDraw(document.getElementById('stPickIn').value);
    document.getElementById('stPickAdd').disabled=false; });
}
function stPickAdd(){
  const q=document.getElementById('stPickIn').value.trim();
  if(!_stPickSel) return;
  let id=_stPickSel;
  if(id==='__new'){
    if(!q){ toast('Give the status a name'); return; }
    if(!can('board_columns')){ toast('You don\u2019t have permission to edit columns'); return; }
    store.addStatus(q); id=store.statuses()[store.statuses().length-1].id;
  }
  store.toggleBoardColumn(_fxBoard, id, true);
  _fxSel=id; fxDirty();
  document.getElementById('stPickWrap').classList.remove('on');
  fxRender();
}

/* ---------- Edit a status ---------- */
let _stEditId=null;
function openStatusEdit(id){
  const st=store.status(id); if(!st) return;
  _stEditId=id;
  document.getElementById('stEdName').value=st.name;
  document.getElementById('stEdCat').value=st.cat||'todo';
  document.getElementById('stEdWrap').classList.add('on');
  setTimeout(()=>document.getElementById('stEdName').focus(),40);
}
function stEditSave(){
  const nm=document.getElementById('stEdName').value.trim();
  const cat=document.getElementById('stEdCat').value;
  if(!nm){ toast('Give the status a name'); return; }
  const dupe=store.statuses().find(s=>s.id!==_stEditId && s.name.toLowerCase()===nm.toLowerCase());
  if(dupe){ toast('Another status is already called that'); return; }
  if(!can('board_columns')){ toast('You don\u2019t have permission to edit columns'); return; }
  store.updateStatus(_stEditId,{name:nm, cat});
  document.getElementById('stEdWrap').classList.remove('on');
  fxRender(); renderAll();
  toast('Status updated');
}

/* ================== Workflow builder (inline) ==================
   Per board: statuses are nodes, transitions are labelled edges. Everything is
   edited against _flowDraft and only written on Save, same as before.
   Draft shape: { enforce, transitions:{from:[to]}, labels:{'from>to':name}, pos:{id:{x,y}} }
*/
let _flowMode='diagram';      // 'diagram' | 'text'
let _flowSel=null;            // selected status id
let _flowLink=null;           // when connecting: the source status id
let _flowZoom=1, _flowPan={x:0,y:0}, _flowAutoFit=true;
const FLOW_W=196, FLOW_H=44, FLOW_GAPX=250, FLOW_GAPY=104;

function flowKey(a,b){ return a+'>'+b; }
function flowLabel(d,a,b){ return (d.labels&&d.labels[flowKey(a,b)]) || ''; }

/* Lay statuses out in the board's own column order when nothing is saved:
   left-to-right in rows of four, which reads like a pipeline. */
function flowAutoPos(cols){
  const pos={};
  cols.forEach((st,i)=>{ const r=Math.floor(i/4), c=i%4;
    pos[st.id]={ x:60+c*FLOW_GAPX, y:60+r*FLOW_GAPY + (c%2?26:0) }; });
  return pos;
}
function flowPos(d, cols){
  d.pos=d.pos||{};
  const auto=flowAutoPos(cols);
  cols.forEach(st=>{ if(!d.pos[st.id]) d.pos[st.id]=auto[st.id]; });
  return d.pos;
}

/* Edge from the edge of one box to the edge of the next, not centre to centre. */
function flowEdge(p1,p2){
  const x1=p1.x+FLOW_W/2, y1=p1.y+FLOW_H/2, x2=p2.x+FLOW_W/2, y2=p2.y+FLOW_H/2;
  const dx=x2-x1, dy=y2-y1;
  const hx=FLOW_W/2+7, hy=FLOW_H/2+7;
  const clip=(dx,dy)=>{ if(!dx&&!dy) return {x:0,y:0};
    const sx=dx?hx/Math.abs(dx):Infinity, sy=dy?hy/Math.abs(dy):Infinity;
    const s=Math.min(sx,sy); return {x:dx*s, y:dy*s}; };
  const a=clip(dx,dy), bq=clip(-dx,-dy);
  const sx=x1+a.x, sy=y1+a.y, ex=x2+bq.x, ey=y2+bq.y;
  const mx=(sx+ex)/2, my=(sy+ey)/2;
  const nx=-(ey-sy), ny=(ex-sx);
  const len=Math.hypot(nx,ny)||1;
  const bow=Math.min(38, Math.hypot(ex-sx,ey-sy)*0.18);
  const cx=mx+(nx/len)*bow, cy=my+(ny/len)*bow;
  return { d:`M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}`, lx:(sx+2*cx+ex)/4, ly:(sy+2*cy+ey)/4 };
}

function flowDiagram(b){
  const cols=store.boardColumns(b);
  const d=flowDraftFor(b);
  const pos=flowPos(d, cols);
  const byId={}; cols.forEach(s=>byId[s.id]=s);

  const edges=[];
  Object.keys(d.transitions||{}).forEach(from=>{
    (d.transitions[from]||[]).forEach(to=>{
      if(!byId[from]||!byId[to]) return;
      const g=flowEdge(pos[from], pos[to]);
      const on = _flowSel && (from===_flowSel || to===_flowSel);
      edges.push(`<g class="fx-edge ${on?'is-on':''}" data-from="${from}" data-to="${to}">
        <path d="${g.d}" marker-end="url(#fxArrow${on?'On':''})"/>
        <g class="fx-lbl" transform="translate(${g.lx},${g.ly})">
          <rect x="-52" y="-10" width="104" height="20" rx="10"/>
          <text text-anchor="middle" dy="4">${esc((flowLabel(d,from,to)||byId[to].name).slice(0,17))}</text>
        </g></g>`);
    });
  });

  const nodes=cols.map(st=>{
    const p=pos[st.id];
    const sel = st.id===_flowSel, src = _flowLink===st.id;
    return `<g class="fx-node ${sel?'is-sel':''} ${src?'is-src':''}" data-node="${st.id}" transform="translate(${p.x},${p.y})">
      <rect width="${FLOW_W}" height="${FLOW_H}" rx="9"/>
      <rect class="fx-band" width="4" height="${FLOW_H}" rx="2" fill="${st.color||'var(--faint)'}"/>
      <text x="16" y="${FLOW_H/2}" dy="4.5">${esc(st.name.length>20?st.name.slice(0,19)+'\u2026':st.name)}</text>
    </g>`;
  }).join('');

  const maxX=Math.max(...cols.map(s=>pos[s.id].x))+FLOW_W+80;
  const maxY=Math.max(...cols.map(s=>pos[s.id].y))+FLOW_H+80;

  return `<div class="fx-wrap">
    <div class="fx-canvas" id="fxCanvas">
      <svg id="fxSvg" width="100%" height="100%" viewBox="0 0 ${Math.max(1000,maxX)} ${Math.max(460,maxY)}" preserveAspectRatio="xMinYMin meet">
        <defs>
          <marker id="fxArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--faint)"/></marker>
          <marker id="fxArrowOn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker>
        </defs>
        <g id="fxZoom" transform="scale(${_flowZoom}) translate(${_flowPan.x},${_flowPan.y})">
          ${edges.join('')}
          ${nodes}
        </g>
      </svg>
      ${_flowLink?`<div class="fx-hint">Pick the status this moves to \u2014 <button type="button" id="fxCancelLink">cancel</button></div>`:''}
      <div class="fx-zoom">
        <button type="button" id="fxOut" aria-label="Zoom out">\u2212</button>
        <span id="fxPct">${Math.round(_flowZoom*100)}%</span>
        <button type="button" id="fxIn" aria-label="Zoom in">+</button>
        <button type="button" id="fxFit" class="fx-fit">Fit</button>
      </div>
    </div>
    <aside class="fx-side" id="fxSide">${flowInspector(b)}</aside>
  </div>`;
}

function flowInspector(b){
  const d=flowDraftFor(b);
  const st=_flowSel?store.status(_flowSel):null;
  if(!st) return `<div class="fx-empty"><h3>Nothing selected</h3>
    <p>Pick a status in the diagram to see how work moves in and out of it.</p></div>`;
  const cols=store.boardColumns(b);
  const name=n=>((store.status(n)||{}).name)||n;
  const inc=[], out=[];
  Object.keys(d.transitions||{}).forEach(from=>{
    (d.transitions[from]||[]).forEach(to=>{
      if(to===st.id) inc.push({from,to});
      if(from===st.id) out.push({from,to});
    });
  });
  const row=(t,dir)=>`<div class="fx-tr" data-tr="${flowKey(t.from,t.to)}">
      <input class="fx-tr-n" value="${esc(flowLabel(d,t.from,t.to)||name(t.to))}" data-lbl="${flowKey(t.from,t.to)}" placeholder="Name this transition"/>
      <div class="fx-tr-p"><span class="fx-pill">${esc(name(t.from))}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        <span class="fx-pill">${esc(name(t.to))}</span>
        <button class="fx-tr-x" data-del="${flowKey(t.from,t.to)}" title="Remove">\u2715</button></div>
    </div>`;
  const cat=(store.status(st.id)||{}).cat||'todo';
  const CATL={todo:'To do', inprogress:'In progress', done:'Done'};
  return `<div class="fx-side-h"><h2>Status</h2>
      <p>Statuses capture the stages of your working process.</p></div>
    <div class="fx-actrow"><button class="tsk-btn tsk-btn--ghost tsk-btn--sm" id="fxEdit" type="button">Edit</button>
      <button class="tsk-btn tsk-btn--ghost tsk-btn--sm fx-rm" id="fxRemove" type="button">Remove</button></div>
    <label class="fx-lbl2">Name</label>
    <input class="fx-inp" id="fxName" value="${esc(st.name)}"/>
    <label class="fx-lbl2">Category</label>
    <div class="fx-cat"><span class="fx-cat-dot" style="background:${st.color}"></span>${CATL[cat]||cat}</div>
    <div class="fx-side-h2"><h3>Transitions</h3>
      <p>Transitions connect statuses. They are the moves people can make.</p></div>
    <div class="fx-grp"><div class="fx-grp-h"><span>Incoming</span><span class="fx-n">${inc.length}</span></div>
      ${inc.length?inc.map(t=>row(t,'in')).join(''):'<p class="fx-none">Nothing moves into this status yet.</p>'}</div>
    <div class="fx-grp"><div class="fx-grp-h"><span>Outgoing</span><span class="fx-n">${out.length}</span>
        <button class="tsk-btn tsk-btn--ghost tsk-btn--sm" id="fxAddTr" type="button">Add</button></div>
      ${out.length?out.map(t=>row(t,'out')).join(''):'<p class="fx-none">This status is a dead end \u2014 nothing leaves it.</p>'}</div>`;
}

function wireFlow(b){
  const d=flowDraftFor(b);
  const dirty=()=>{ _flowDirty=true;
    const p=document.getElementById('bsDirty'); if(p) p.classList.add('on');
    const s=document.getElementById('bsSave'); if(s) s.disabled=false; };
  const redraw=()=>{ const body=document.getElementById('bsBody');
    if(body){ body.innerHTML=bsFlow(b); wireBoardSettings(b); } };

  // --- node click: select, or complete a link ---
  document.querySelectorAll('#fxSvg .fx-node').forEach(n=>{
    n.onclick=e=>{
      e.stopPropagation();
      const id=n.dataset.node;
      if(_flowLink && _flowLink!==id){
        d.transitions[_flowLink]=d.transitions[_flowLink]||[];
        if(!d.transitions[_flowLink].includes(id)){ d.transitions[_flowLink].push(id); dirty(); }
        _flowSel=_flowLink; _flowLink=null; redraw(); return;
      }
      if(_flowLink===id){ _flowLink=null; redraw(); return; }
      _flowSel=id; redraw();
    };
  });
  const cancel=document.getElementById('fxCancelLink');
  if(cancel) cancel.onclick=()=>{ _flowLink=null; redraw(); };

  // --- drag a status around ---
  let drag=null;
  const svg=document.getElementById('fxSvg');
  if(svg){
    svg.addEventListener('pointerdown', e=>{
      const g=e.target.closest('.fx-node'); if(!g) return;
      const id=g.dataset.node; const r=svg.getBoundingClientRect();
      const vb=svg.viewBox.baseVal; const sc=vb.width/r.width;
      drag={ id, sx:e.clientX, sy:e.clientY, ox:d.pos[id].x, oy:d.pos[id].y, sc, moved:false };
      g.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', e=>{
      if(!drag) return;
      const dx=(e.clientX-drag.sx)*drag.sc/_flowZoom, dy=(e.clientY-drag.sy)*drag.sc/_flowZoom;
      if(Math.abs(dx)>2||Math.abs(dy)>2) drag.moved=true;
      d.pos[drag.id]={ x:Math.max(0,Math.round(drag.ox+dx)), y:Math.max(0,Math.round(drag.oy+dy)) };
      const g=svg.querySelector(`.fx-node[data-node="${drag.id}"]`);
      if(g) g.setAttribute('transform', `translate(${d.pos[drag.id].x},${d.pos[drag.id].y})`);
    });
    svg.addEventListener('pointerup', ()=>{ if(drag && drag.moved){ dirty(); redraw(); } drag=null; });
  }

  // --- inspector ---
  const nm=document.getElementById('fxName');
  if(nm) nm.onchange=()=>{ if(!can('board_workflow')){ toast('You don\u2019t have permission to edit the workflow'); return; }
    const v=nm.value.trim(); if(v && _flowSel){ store.updateStatus(_flowSel,{name:v}); redraw(); renderAll(); } };
  document.querySelectorAll('.fx-tr-n').forEach(i=>i.onchange=()=>{
    d.labels=d.labels||{}; const v=i.value.trim();
    if(v) d.labels[i.dataset.lbl]=v; else delete d.labels[i.dataset.lbl];
    dirty(); redraw();
  });
  document.querySelectorAll('[data-del]').forEach(x=>x.onclick=()=>{
    const [from,to]=x.dataset.del.split('>');
    d.transitions[from]=(d.transitions[from]||[]).filter(t=>t!==to);
    if(d.labels) delete d.labels[x.dataset.del];
    dirty(); redraw();
  });
  const add=document.getElementById('fxAddTr');
  if(add) add.onclick=()=>{ _flowLink=_flowSel; redraw(); };

  // --- zoom ---
  const setZ=z=>{ _flowZoom=Math.min(1.6, Math.max(.4, Math.round(z*10)/10)); redraw(); };
  const zi=document.getElementById('fxIn'), zo=document.getElementById('fxOut'), zf=document.getElementById('fxFit');
  if(zi) zi.onclick=()=>setZ(_flowZoom+0.1);
  if(zo) zo.onclick=()=>setZ(_flowZoom-0.1);
  if(zf) zf.onclick=()=>{ _flowZoom=1; _flowPan={x:0,y:0}; redraw(); };
}

/* ---------- Transitions: edit a draft, save on demand ----------
   Every chip click used to write straight to the store and _persist(). With a
   grid of chips that meant a burst of pushes, and boards have no self-push
   guard, so a realtime echo could land on top of edits you had just made —
   which is why only one row appeared to stick. Now nothing is written until
   Save. */
let _flowDraft=null, _flowDirty=false;
function flowDraftFor(b){
  if(!_flowDraft || _flowDraft.__board!==b.id){
    _flowDraft={ __board:b.id, enforce:!!b.enforce,
                 transitions:JSON.parse(JSON.stringify(b.transitions||{})),
                 labels:JSON.parse(JSON.stringify(b.tlabels||{})),
                 pos:JSON.parse(JSON.stringify(b.flowPos||{})) };
    _flowDirty=false;
  }
  return _flowDraft;
}
function flowDraftReset(){ _flowDraft=null; _flowDirty=false; }
function flowSave(){
  const b = (_flowDraft && _flowDraft.__board) ? store.board(_flowDraft.__board) : activeBoard();
  if(!b||!_flowDraft) return;
  store.updateBoard(b.id, { enforce:_flowDraft.enforce,
                            transitions:JSON.parse(JSON.stringify(_flowDraft.transitions)),
                            tlabels:JSON.parse(JSON.stringify(_flowDraft.labels||{})),
                            flowPos:JSON.parse(JSON.stringify(_flowDraft.pos||{})) });
  flowDraftReset();
  renderBoardSettings(); renderBoardSwitch(); refreshViews();
  toast('Workflow saved');
}

function bsBoards(){
  const act=activeBoard();
  const kebab=`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>`;
  const cards=store.boards().map(bd=>{
    const active=bd.id===ui.board; const cols=(bd.columns||[]).length;
    return `<div class="brd-card ${active?'active':''}" data-board="${bd.id}" role="button" tabindex="0">
      <span class="brd-radio" aria-hidden="true"></span>
      <span class="brd-info"><span class="brd-nm">${esc(bd.name)}</span>
        <span class="brd-sub">${cols} column${cols===1?'':'s'} · ${bd.enforce?'Flow enforced':'Free moves'}</span></span>
      <span class="brd-actions">${active?'<span class="brd-badge">Active</span>':''}
        <button class="brd-kebab" type="button" title="Board options">${kebab}</button></span>
    </div>`;
  }).join('');

  let cfg='';
  if(act){
    const nc=(act.columns||[]).length;
    const nT=Object.values(act.transitions||{}).reduce((a,x)=>a+x.length,0);
    const nF=store.fields().length;
    const chev=`<svg class="brd-cfg-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>`;
    const icCols=`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/></svg>`;
    const icFlow=`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H15a3 3 0 0 1 3 3v6.5"/></svg>`;
    const icFld=`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h10"/></svg>`;
    const card=(go,ic,t,s)=>`<button class="brd-cfg" data-go="${go}" type="button">
        <span class="brd-cfg-ic">${ic}</span>
        <span class="brd-cfg-tx"><span class="brd-cfg-t">${t}</span><span class="brd-cfg-s">${s}</span></span>${chev}</button>`;
    cfg=`<div class="brd-config">
      <div class="brd-config-h">Configure <b>${esc(act.name)}</b></div>
      <div class="brd-cfg-grid">
        ${card('columns',icCols,'Columns', nc+' status'+(nc===1?'':'es'))}
        ${card('flow',icFlow,'Workflow', nT+' transition'+(nT===1?'':'s')+' · '+(act.enforce?'enforced':'free'))}
        ${card('fields',icFld,'Fields', nF+' field'+(nF===1?'':'s'))}
      </div></div>`;
  }
  return `<div class="brd-list">${cards}</div>
    <p class="brd-hint">The active board is what shows on the Board view. Selecting a board here makes it active.</p>
    ${cfg}`;
}
function bsPriorities(){
  const list=store.priorities();
  return list.map((p,i)=>{
    const used=store.priorityInUse(p.id);
    return `<div class="bsrow" data-prio="${esc(p.id)}">
      <div class="bsmove"><button data-dir="-1" ${i===0?'disabled':''}>▲</button><button data-dir="1" ${i===list.length-1?'disabled':''}>▼</button></div>
      <div class="bsswatch"><span class="dot" style="background:${p.color}"></span>
        <div class="bspal">${SWATCHES.map(c=>`<span style="background:${c}" data-color="${c}"></span>`).join('')}</div></div>
      <input class="bsname prname" value="${esc(p.name)}"/>
      <span class="bscount">${used} ${used===1?'ticket':'tickets'}</span>
      <button class="bsremove prremove" ${used?'disabled title="In use by '+used+' ticket'+(used===1?'':'s')+'"':''}>Remove</button>
    </div>`;
  }).join('')
  + `<p class="bs-note" style="margin-top:14px">Order sets urgency — the top row is the most urgent, and drives sorting, grouping and reports. A level can only be removed once no tickets use it.</p>`;
}
function bsTypes(){
  const list=store.types();
  return list.map(t=>{
    const used=store.typeInUse(t.id);
    return `<div class="bsrow" data-type="${esc(t.id)}">
      <div class="bsswatch"><span class="dot" style="background:${t.color}"></span>
        <div class="bspal">${SWATCHES.map(c=>`<span style="background:${c}" data-color="${c}"></span>`).join('')}</div></div>
      <input class="bsname tyname" value="${esc(t.name)}" ${t.locked?'readonly title="Epic is built into the app — it can\'t be renamed"':''}/>
      <span class="bscount">${used} ${used===1?'ticket':'tickets'}</span>
      ${t.locked
        ? '<span class="ty-lock" title="Built-in type">Built-in</span>'
        : `<button class="bsremove tyremove" ${used?'disabled title="In use by '+used+' ticket'+(used===1?'':'s')+'"':''}>Remove</button>`}
    </div>`;
  }).join('')
  + `<p class="bs-note" style="margin-top:14px">A type can only be removed once no tickets use it. <b>Epic</b> is built into the app, so it can't be renamed or removed.</p>`;
}
function bsFields(){
  const fs=store.fields();
  if(!fs.length) return `<p class="bs-note">No custom fields yet. Use <b>Add field</b> to create one — it appears on every ticket.</p>`;
  const TY=[['text','Text'],['number','Number'],['date','Date'],['select','Single select'],['multi','Multi select'],['checkbox','Checkbox']];
  return fs.map(f=>`<div class="bsrow" data-field="${f.id}">
      <input class="bsname cfname" value="${esc(f.name)}"/>
      <select class="bscat cftype">${TY.map(([v,l])=>`<option value="${v}" ${f.type===v?'selected':''}>${l}</option>`).join('')}</select>
      ${(f.type==='select'||f.type==='multi')
        ? `<input class="bsname cfopts" value="${esc((f.options||[]).join(', '))}" placeholder="Options, comma separated"/>`
        : '<span class="bscount"></span>'}
      <button class="bsremove cfremove">Remove</button>
    </div>`).join('');
}
function bsColumns(b){
  const onBoard=b.columns;
  const off=store.statuses().filter(s=>!onBoard.includes(s.id));
  const rows=onBoard.map((sid,i)=>{ const s=store.status(sid); if(!s) return ''; const n=store.tasksInStatus(sid);
    return `<div class="bsrow" data-id="${sid}">
      <div class="bsmove"><button data-dir="-1" ${i===0?'disabled':''}>▲</button><button data-dir="1" ${i===onBoard.length-1?'disabled':''}>▼</button></div>
      <div class="bsswatch"><span class="dot" style="background:${s.color}"></span>
        <div class="bspal">${SWATCHES.map(c=>`<span style="background:${c}" data-color="${c}"></span>`).join('')}</div></div>
      <input class="bsname" value="${esc(s.name)}"/>
      <select class="bscat">${Object.keys(CATLABEL).map(c=>`<option value="${c}" ${s.cat===c?'selected':''}>${CATLABEL[c]}</option>`).join('')}</select>
      <span class="bscount">${n}</span>
      <button class="bsremove" title="Remove from this board">Remove</button>
    </div>`;
  }).join('');
  const offHtml = off.length?`<div style="margin-top:14px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600;margin-bottom:8px">Add existing status</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${off.map(s=>`<button class="tchip" data-add="${s.id}"><span class="col-dot" style="background:${s.color};margin-right:5px"></span>${esc(s.name)}</button>`).join('')}</div>`:'';
  return rows+offHtml;
}
function bsFlow(b){
  const cols=store.boardColumns(b);
  const nT=Object.values(b.transitions||{}).reduce((a,x)=>a+x.length,0);
  return `<div class="tsk-empty" style="padding:34px 20px">
      <p style="margin-bottom:4px"><b>${cols.length} status${cols.length===1?'':'es'} \u00b7 ${nT} transition${nT===1?'':'s'}</b> on <b>${esc(b.name)}</b>.
        ${b.enforce?'Cards can only move along the allowed transitions.':'Cards can move anywhere \u2014 enforcement is off.'}</p>
      <p style="margin-bottom:14px">Every board has its own workflow. Build it on a full canvas.</p>
      <button class="tsk-btn tsk-btn--sm" id="bsOpenFlow" type="button">Open workflow builder</button>
    </div>`;
}

function wireBoardSettings(b){
  const body=document.getElementById('bsBody');
  if(bsTab==='boards'){
    body.querySelectorAll('.brd-card').forEach(card=>{ const id=card.dataset.board;
      card.onclick=e=>{ if(e.target.closest('.brd-kebab')||e.target.closest('.brd-nm-edit')) return;
        ui.board=id; renderBoardSettings(); renderBoardSwitch(); };
      const keb=card.querySelector('.brd-kebab');
      if(keb) keb.onclick=e=>{ e.stopPropagation(); openBoardMenu(id, keb); };
    });
    body.querySelectorAll('.brd-cfg').forEach(c=>c.onclick=()=>{
      if(c.dataset.go==='flow'){ openFlowScreen(activeBoard().id); }
      else { bsTab=c.dataset.go; renderBoardSettings(); } });
  } else if(bsTab==='prios'){
    body.querySelectorAll('.bsrow[data-prio]').forEach(row=>{ const id=row.dataset.prio;
      row.querySelectorAll('.bsmove button').forEach(btn=>btn.onclick=()=>{ if(!can('prio_manage')){ toast('You don\u2019t have permission to manage priorities'); return; } store.movePriority(id,+btn.dataset.dir); renderBoardSettings(); refreshViews(); });
      row.querySelector('.prname').onchange=e=>{ const v=e.target.value.trim();
        if(!can('prio_manage')){ toast('You don\u2019t have permission to manage priorities'); e.target.value=(store.priority(id)||{}).name||''; return; }
        if(!v){ e.target.value=(store.priority(id)||{}).name||''; return; }
        store.updatePriority(id,{name:v}); renderBoardSettings(); refreshViews(); };
      const sw=row.querySelector('.bsswatch'), pal=sw.querySelector('.bspal');
      sw.querySelector('.dot').onclick=e=>{ e.stopPropagation(); document.querySelectorAll('.bspal').forEach(x=>{ if(x!==pal)x.classList.remove('on'); }); pal.classList.toggle('on'); };
      pal.querySelectorAll('[data-color]').forEach(c=>c.onclick=e=>{ e.stopPropagation(); if(!can('prio_manage')){ toast('You don\u2019t have permission to manage priorities'); return; } store.updatePriority(id,{color:c.dataset.color}); renderBoardSettings(); refreshViews(); });
      const rm=row.querySelector('.prremove');
      if(rm && !rm.disabled) rm.onclick=()=>{ if(!can('prio_manage')){ toast('You don\u2019t have permission to manage priorities'); return; }
        confirmDelete({ title:'Remove priority',
          lead:'Remove the <b>'+esc(id)+'</b> priority? It disappears from the picker for every ticket.',
          confirmLabel:'Remove priority', warn:'',
          onConfirm:()=>{ if(!store.removePriority(id)){ toast('That priority is still in use'); return; }
            renderBoardSettings(); refreshViews(); toast('Priority removed'); } }); };
    });
  } else if(bsTab==='types'){
    body.querySelectorAll('.bsrow[data-type]').forEach(row=>{ const id=row.dataset.type;
      const nm=row.querySelector('.tyname');
      if(nm && !nm.readOnly) nm.onchange=e=>{ const v=e.target.value.trim();
        if(!can('type_manage')){ toast('You don\u2019t have permission to manage ticket types'); e.target.value=(store.type(id)||{}).name||''; return; }
        if(!v){ e.target.value=(store.type(id)||{}).name||''; return; }
        store.updateType(id,{name:v}); renderBoardSettings(); refreshViews(); };
      const sw=row.querySelector('.bsswatch'), pal=sw.querySelector('.bspal');
      sw.querySelector('.dot').onclick=e=>{ e.stopPropagation(); document.querySelectorAll('.bspal').forEach(p=>{ if(p!==pal)p.classList.remove('on'); }); pal.classList.toggle('on'); };
      pal.querySelectorAll('[data-color]').forEach(c=>c.onclick=e=>{ e.stopPropagation(); if(!can('type_manage')){ toast('You don\u2019t have permission to manage ticket types'); return; } store.updateType(id,{color:c.dataset.color}); renderBoardSettings(); refreshViews(); });
      const rm=row.querySelector('.tyremove');
      if(rm && !rm.disabled) rm.onclick=()=>{ if(!can('type_manage')){ toast('You don\u2019t have permission to manage ticket types'); return; }
        confirmDelete({ title:'Remove ticket type',
          lead:'Remove the <b>'+esc(id)+'</b> type? It disappears from the picker for every ticket.',
          confirmLabel:'Remove type', warn:'',
          onConfirm:()=>{ if(!store.removeType(id)){ toast('That type is still in use'); return; }
            renderBoardSettings(); refreshViews(); toast('Type removed'); } }); };
    });
  } else if(bsTab==='fields'){
    body.querySelectorAll('.bsrow[data-field]').forEach(row=>{ const id=row.dataset.field;
      row.querySelector('.cfname').onchange=e=>{ if(!can('cf_edit')){ toast('You don\u2019t have permission to edit custom fields'); e.target.value=(store.fields().find(f=>f.id===id)||{}).name||''; return; } const v=e.target.value.trim();
        if(!v){ e.target.value=(store.fields().find(f=>f.id===id)||{}).name||''; return; }
        store.updateField(id,{name:v}); refreshViews(); };
      row.querySelector('.cftype').onchange=e=>{ if(!can('cf_edit')){ toast('You don\u2019t have permission to edit custom fields'); renderBoardSettings(); return; } store.updateField(id,{type:e.target.value}); renderBoardSettings(); refreshViews(); };
      const op=row.querySelector('.cfopts');
      if(op) op.onchange=e=>{ store.updateField(id,{options:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}); refreshViews(); };
      row.querySelector('.cfremove').onclick=()=>{ if(!can('cf_delete')){ toast('You don\u2019t have permission to delete custom fields'); return; }
        confirmDelete({ title:'Remove custom field',
          lead:'Remove this custom field? Its values are <b>removed from every ticket</b>.',
          confirmLabel:'Remove field',
          onConfirm:()=>{ store.removeField(id); renderBoardSettings(); refreshViews(); toast('Field removed'); } }); };
    });
  } else if(bsTab==='columns'){
    body.querySelectorAll('.bsrow').forEach(row=>{ const id=row.dataset.id;
      row.querySelectorAll('.bsmove button').forEach(btn=>btn.onclick=()=>{ store.moveBoardColumn(b,id,+btn.dataset.dir); renderBoardSettings(); });
      row.querySelector('.bsname').onchange=e=>{ if(!can('board_columns')){ toast('You don\u2019t have permission to edit columns'); e.target.value=store.status(id).name; return; }
        const v=e.target.value.trim(); if(v) store.updateStatus(id,{name:v}); else e.target.value=store.status(id).name; };
      row.querySelector('.bscat').onchange=e=>store.updateStatus(id,{cat:e.target.value});
      const sw=row.querySelector('.bsswatch'), pal=sw.querySelector('.bspal');
      sw.querySelector('.dot').onclick=e=>{ e.stopPropagation(); document.querySelectorAll('.bspal').forEach(p=>{ if(p!==pal)p.classList.remove('on'); }); pal.classList.toggle('on'); };
      pal.querySelectorAll('span').forEach(c=>c.onclick=()=>{ store.updateStatus(id,{color:c.dataset.color}); renderBoardSettings(); });
      row.querySelector('.bsremove').onclick=()=>{ if(b.columns.length<=2){ toast('Keep at least two columns'); return; } store.toggleBoardColumn(b,id,false); renderBoardSettings(); };
    });
    body.querySelectorAll('[data-add]').forEach(btn=>btn.onclick=()=>{ store.toggleBoardColumn(b,btn.dataset.add,true); renderBoardSettings(); });
  } else if(bsTab==='fields'){
    body.querySelectorAll('.fld-row').forEach(row=>{ const fid=row.dataset.fid;
      row.querySelector('.fld-name').onchange=e=>{ const v=e.target.value.trim(); if(v) store.updateField(fid,{name:v}); };
      row.querySelector('.fld-type').onchange=e=>{ store.updateField(fid,{type:e.target.value}); renderBoardSettings(); };
      row.querySelector('.fld-card').onchange=e=>store.updateField(fid,{onCard:e.target.checked});
      row.querySelector('.fld-del').onclick=()=>{ store.removeField(fid); renderBoardSettings(); };
      const add=row.querySelector('.fld-opt-add'); if(add) add.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); const v=add.value.trim(); if(v){ const f=store.fields().find(x=>x.id===fid); store.updateField(fid,{options:(f.options||[]).concat(v)}); renderBoardSettings(); const na=document.querySelector(`.fld-row[data-fid="${fid}"] .fld-opt-add`); if(na) na.focus(); } } };
      row.querySelectorAll('.fld-opt-del').forEach(x=>x.onclick=()=>{ const f=store.fields().find(y=>y.id===fid); const opts=(f.options||[]).slice(); opts.splice(+x.dataset.i,1); store.updateField(fid,{options:opts}); renderBoardSettings(); });
    });
  } else if(bsTab==='flow'){
    const ob=document.getElementById('bsOpenFlow');
    if(ob) ob.onclick=()=>openFlowScreen(b.id);
  }
}
document.addEventListener('click',()=>document.querySelectorAll('.bspal').forEach(p=>p.classList.remove('on')));
