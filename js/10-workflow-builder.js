/* Taskora — 10-workflow-builder.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ================== Workflow builder (full screen) ================== */
let _fxBoard=null, _fxSel=null, _fxLink=null, _fxLabels=true, _fxMode='diagram', _fxSideOpen=true;
let _fxPick=null;   // null | 'from' | 'to' | 'into' — the connect steps
let _fxInto=null;   // in 'into' mode, the status being moved INTO
let _fxDragged=false;
let _fxZoom=1, _fxPanX=0, _fxPanY=0, _fxAutoFit=true;
const FXW=150, FXH=34, FXGX=210, FXGY=86;   // FXW is the minimum; nodes grow to fit
/* Width that actually fits the label — a fixed box cropped "Ready for Development". */
function fxW(name){ return Math.max(FXW, Math.min(300, Math.round((name||'').length*7.1)+38)); }
function fxNodeW(id){ const st=store.status(id); return fxW(st?st.name:''); }
// Real pixel width of a transition label at its own font, so the pill fits the
// full name instead of being clipped to a fixed box.
let _fxLblCtx=null;
function fxLblW(s){
  if(!_fxLblCtx){ try{ _fxLblCtx=document.createElement('canvas').getContext('2d'); }catch(e){} }
  if(_fxLblCtx){ _fxLblCtx.font='600 8.5px Inter, system-ui, sans-serif'; return _fxLblCtx.measureText(s||'').width; }
  return (s||'').length*4.9;
}

function fxKey(a,b){ return a+'>'+b; }
function fxLbl(d,a,b){ return (d.labels&&d.labels[fxKey(a,b)])||''; }
function fxDraft(){ return flowDraftFor(_fxBoard); }
function fxCols(){ return store.boardColumns(_fxBoard); }

function fxAutoPos(cols){
  const p={}; cols.forEach((st,i)=>{ const r=Math.floor(i/4), c=i%4;
    p[st.id]={ x:150+c*FXGX, y:70+r*FXGY }; }); return p;
}
function fxPos(){
  const d=fxDraft(), cols=fxCols(); d.pos=d.pos||{};
  const a=fxAutoPos(cols);
  cols.forEach(s=>{ if(!d.pos[s.id]) d.pos[s.id]=a[s.id]; });
  return d.pos;
}

/* Orthogonal routing — Jira's edges turn at right angles, never curve. */
function fxRoute(p1,p2,w1,w2){
  w1=w1||FXW; w2=w2||FXW;
  const x1=p1.x+w1/2, y1=p1.y+FXH/2, x2=p2.x+w2/2, y2=p2.y+FXH/2;
  const dx=x2-x1, dy=y2-y1;
  let sx,sy,ex,ey,d,lx,ly;
  if(Math.abs(dx)>Math.abs(dy)){
    sx = x1 + (dx>0?w1/2:-w1/2); sy = y1;
    ex = x2 - (dx>0?w2/2+8:-(w2/2+8)); ey = y2;
    const mx=(sx+ex)/2;
    d = `M${sx} ${sy} H${mx} V${ey} H${ex}`;
    lx=mx; ly=(sy+ey)/2;
  } else {
    sx = x1; sy = y1 + (dy>0?FXH/2:-FXH/2);
    ex = x2; ey = y2 - (dy>0?FXH/2+8:-(FXH/2+8));
    const my=(sy+ey)/2;
    d = `M${sx} ${sy} V${my} H${ex} V${ey}`;
    lx=(sx+ex)/2; ly=my;
  }
  return {d,lx,ly};
}

function fxDiagram(){
  const d=fxDraft(), cols=fxCols(), pos=fxPos();
  if(!cols.length) return `<div class="fxs-blank">
      <div class="fxs-blank-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M12 10v4"/></svg></div>
      <h3>No statuses yet</h3>
      <p>A workflow starts empty. Add the stages your team actually works through \u2014 then connect them.</p>
      <button class="tsk-btn tsk-btn--sm" id="fxBlankAdd" type="button">Add your first status</button>
    </div>`;

  const byId={}; cols.forEach(s=>byId[s.id]=s);
  const edges=[]; const labels=[];
  Object.keys(d.transitions||{}).forEach(from=>{
    (d.transitions[from]||[]).forEach(to=>{
      if(!byId[from]||!byId[to]) return;
      const g=fxRoute(pos[from],pos[to],fxNodeW(from),fxNodeW(to));
      const on=_fxSel&&(from===_fxSel||to===_fxSel);
      edges.push(`<g class="fxe ${on?'on':''}" data-e="${fxKey(from,to)}">
        <path d="${g.d}" marker-end="url(#fxa${on?'On':''})"/></g>`);
      if(_fxLabels){
        const txt=fxLbl(d,from,to)||byId[to].name;
        const w=Math.round(fxLblW(txt))+18;                 // full name, snug pill
        // A two-way link (A->B and B->A) routes both labels to the same elbow.
        // Nudge the pair apart up front so neither sits on top of the other.
        let lx=g.lx, ly=g.ly;
        if((d.transitions[to]||[]).includes(from)){
          const horiz=Math.abs(pos[to].x-pos[from].x)>=Math.abs(pos[to].y-pos[from].y);
          const s=(from<to)?-1:1;
          if(horiz) ly+=s*13; else lx+=s*(w/2+10);
        }
        labels.push({on, text:txt, x:lx, y:ly, w, h:20, key:fxKey(from,to)});
      }
    });
  });

  // START -> the first status, the way Jira anchors a workflow
  let start='';
  if(cols.length){
    const first=cols[0], f=pos[first.id];
    d.pos.__start = d.pos.__start || { x:24, y:f.y+FXH/2-13 };
    const sp=d.pos.__start, cx=sp.x+13, cy=sp.y+13;
    // A parallelogram's left edge sits ~5px inside its box at mid-height, so a
    // line stopped at the box leaves a visible gap. Land on the shape itself.
    const inset = (first.cat||'todo')==='todo' ? 5 : 0;
    const nx = f.x + inset, ny = f.y + FXH/2;
    const sxp = cx + 13;
    // START is draggable — route round the corner when it is not level.
    const dPath = Math.abs(cy-ny) < 2
      ? `M${sxp} ${ny} H${nx}`
      : `M${sxp} ${cy} H${(sxp+nx)/2} V${ny} H${nx}`;
    const lx = (sxp+nx)/2, ly = Math.abs(cy-ny) < 2 ? ny : (cy+ny)/2;
    start=`<g class="fxe"><path d="${dPath}" marker-end="url(#fxa)"/>
        ${_fxLabels?`<g class="fxe-l" transform="translate(${lx},${ly})">
          <rect x="-26" y="-9" width="52" height="18" rx="9"/><text text-anchor="middle" dy="3.5">Create</text></g>`:''}</g>
      <g class="fxs-start" data-n="__start" transform="translate(${sp.x},${sp.y})">
        <circle cx="13" cy="13" r="12.5"/><text x="13" y="13" dy="3" text-anchor="middle">START</text></g>`;
  }

  // Classic flowchart language: the outline colour and the silhouette carry the
  // meaning, on a white fill — a terminator is a stadium, a process is a box,
  // a wait/hold is a parallelogram.
  const shape=(cat,w,h)=>{
    if(cat==='done')       return `<rect class="fxn-bg" width="${w}" height="${h}" rx="${h/2}"/>`;               // terminator
    if(cat==='inprogress') return `<rect class="fxn-bg" width="${w}" height="${h}" rx="2"/>`;                     // process
    return `<path class="fxn-bg" d="M11 0 H${w} L${w-11} ${h} H0 Z"/>`;                                           // data / waiting
  };
  const nodes=cols.map(st=>{
    const p=pos[st.id], sel=st.id===_fxSel, src=_fxLink===st.id;
    const pick=!!_fxPick && !src && st.id!==_fxInto;
    const cat=(st.cat||'todo');
    const w=fxW(st.name);
    return `<g class="fxn ${sel?'sel':''} ${src?'src':''} ${pick?'pick':''} cat-${cat}" data-n="${st.id}" transform="translate(${p.x},${p.y})">
      ${shape(cat,w,FXH)}
      <text x="${w/2}" y="${FXH/2}" dy="3.6" text-anchor="middle">${esc(st.name)}</text>
    </g>`;
  }).join('');

  // Separate any labels that still overlap each other or a status box. A small
  // iterative push along the axis of least penetration — bounded, deterministic.
  let labelSVG='';
  if(labels.length){
    const boxes=cols.map(s=>({cx:pos[s.id].x+fxW(s.name)/2, cy:pos[s.id].y+FXH/2, w:fxW(s.name), h:FXH}));
    const GAP=7;
    for(let it=0; it<48; it++){
      let moved=false;
      for(let i=0;i<labels.length;i++){
        const A=labels[i];
        for(let j=i+1;j<labels.length;j++){
          const B=labels[j];
          const ox=(A.w+B.w)/2+GAP-Math.abs(A.x-B.x);
          const oy=(A.h+B.h)/2+GAP-Math.abs(A.y-B.y);
          if(ox>0&&oy>0){
            if(oy<=ox){ const s=((A.y<=B.y)?-1:1)*oy/2; A.y+=s; B.y-=s; }
            else { const s=((A.x<=B.x)?-1:1)*ox/2; A.x+=s; B.x-=s; }
            moved=true;
          }
        }
        for(const nb of boxes){
          const ox=(A.w+nb.w)/2+GAP-Math.abs(A.x-nb.cx);
          const oy=(A.h+nb.h)/2+GAP-Math.abs(A.y-nb.cy);
          if(ox>0&&oy>0){
            if(oy<=ox) A.y+=((A.y<=nb.cy)?-1:1)*oy;
            else       A.x+=((A.x<=nb.cx)?-1:1)*ox;
            moved=true;
          }
        }
      }
      if(!moved) break;
    }
    labelSVG=labels.map(L=>`<g class="fxe-l ${L.on?'on':''}" data-e="${L.key}" transform="translate(${Math.round(L.x)},${Math.round(L.y)})">
        <rect x="${-L.w/2}" y="-10" width="${L.w}" height="20" rx="10"/>
        <text text-anchor="middle" dy="4">${esc(L.text)}</text></g>`).join('');
  }

  const maxX=Math.max(...cols.map(s=>pos[s.id].x+fxW(s.name)))+120;
  const maxY=Math.max(...cols.map(s=>pos[s.id].y))+FXH+120;
  const vw=Math.max(1200,maxX), vh=Math.max(560,maxY);

  const mini=cols.map(st=>{ const p=pos[st.id];
    return `<rect x="${p.x/vw*100}%" y="${p.y/vh*100}%" width="${fxW(st.name)/vw*100}%" height="${FXH/vh*100}%" rx="1"
      class="mm-n ${st.id===_fxSel?'on':''}"/>`; }).join('');

  return `<svg id="fxSvg" class="fxs-svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="xMinYMin meet" style="width:${Math.round(vw*_fxZoom)}px;height:${Math.round(vh*_fxZoom)}px">
      <defs>
        <marker id="fxa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#9AA1AC"/></marker>
        <marker id="fxaOn" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker>
      </defs>
      <g transform="translate(${_fxPanX},${_fxPanY})">
        ${edges.join('')}${start}${nodes}${labelSVG}
        <g id="fxGuides"></g>
      </g></svg>
    <div class="fxs-mini"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${mini}</svg>
      <div class="fxs-zoomrow">
        <button type="button" id="fxZo" aria-label="Zoom out"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-4-4"/></svg></button>
        <input type="range" id="fxZr" min="40" max="160" value="${Math.round(_fxZoom*100)}"/>
        <button type="button" id="fxZi" aria-label="Zoom in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M20 20l-4-4"/></svg></button>
      </div></div>`;
}

function fxSide(){
  const d=fxDraft();
  const st=_fxSel?store.status(_fxSel):null;
  if(!st) return `<div class="fxs-side-empty"><h3>Nothing selected</h3>
    <p>Pick a status to see how work moves in and out of it.</p></div>`;
  const nm=n=>((store.status(n)||{}).name)||n;
  const inc=[], out=[];
  Object.keys(d.transitions||{}).forEach(f=>(d.transitions[f]||[]).forEach(t=>{
    if(t===st.id) inc.push({f,t}); if(f===st.id) out.push({f,t}); }));
  const CATL={todo:'To do', inprogress:'In progress', done:'Done'};
  const row=x=>`<div class="fxs-tr">
      <input class="fxs-tr-n" value="${esc(fxLbl(d,x.f,x.t)||nm(x.t))}" data-lbl="${fxKey(x.f,x.t)}" placeholder="Name this transition"/>
      <div class="fxs-tr-p"><span class="fxs-pill">${esc(nm(x.f))}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h13M13 6l6 6-6 6"/></svg>
        <span class="fxs-pill on">${esc(nm(x.t))}</span>
        <button class="fxs-tr-x" data-del="${fxKey(x.f,x.t)}" title="Remove">\u2715</button></div></div>`;
  return `<div class="fxs-side-h"><h2>Status</h2>
      <p>Statuses capture the stages of your working process.</p></div>
    <div class="fxs-f"><div class="fxs-f-h"><span>Name</span>
      <button class="fxs-edit" id="fxEditSt" title="Edit status"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button></div>
      <div class="fxs-f-v">${esc(st.name)}</div></div>
    <div class="fxs-danger"><button class="fxs-rm" id="fxRemove" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
        Remove from workflow</button></div>
    <div class="fxs-side-h2"><h3>Transitions</h3>
      <p>Transitions connect statuses. They represent actions people take to move work through your workflow.</p></div>
    <div class="fxs-grp"><div class="fxs-grp-h"><span>Incoming</span><span class="fxs-n">${inc.length}</span>
      <button class="fxs-plus" id="fxAddIn" title="Add an incoming transition">+</button></div>
      ${inc.length?inc.map(row).join(''):'<p class="fxs-none">Nothing moves into this status yet.</p>'}</div>
    <div class="fxs-grp"><div class="fxs-grp-h"><span>Outgoing</span><span class="fxs-n">${out.length}</span>
      <button class="fxs-plus" id="fxAddOut" title="Add an outgoing transition">+</button></div>
      ${out.length?out.map(row).join(''):'<p class="fxs-none">This status is a dead end \u2014 nothing leaves it.</p>'}</div>`;
}

function fxText(){
  const d=fxDraft(), cols=fxCols();
  if(!cols.length) return '<p class="fxs-none" style="padding:20px">No statuses yet.</p>';
  return `<div class="fxs-text">`+cols.map(st=>{
    const al=(d.transitions&&d.transitions[st.id])||[];
    return `<div class="fxs-trow"><div class="fxs-trow-h"><span class="fxs-cat cat-${st.cat||'todo'}"></span>
        <b>${esc(st.name)}</b><span>can move to</span><span class="fxs-n">${al.length||'none'}</span></div>
      <div class="fxs-chips">${cols.filter(x=>x.id!==st.id).map(x=>
        `<button class="fxs-chip ${al.includes(x.id)?'on':''}" data-from="${st.id}" data-to="${x.id}">${esc(x.name)}</button>`).join('')}</div></div>`;
  }).join('')+`</div>`;
}

function openFlowScreen(boardId){
  _fxBoard=store.board(boardId)||activeBoard();
  _fxSel=null; _fxLink=null; _fxZoom=1; _fxPanX=0; _fxPanY=0;
  flowDraftReset();
  const sc=document.getElementById('fxScreen');
  sc.classList.add('on');
  document.body.style.overflow='hidden';
  fxRender();
}
function closeFlowScreen(){
  const proceed=()=>{
    flowDraftReset();
    document.getElementById('fxScreen').classList.remove('on');
    document.body.style.overflow='';
    if(ui.view==='boardsettings') renderBoardSettings();
    renderAll();
  };
  if(_flowDirty){ confirmDelete({ title:'Unsaved changes', lead:'You have unsaved workflow changes.',
    confirmLabel:'Leave without saving', warn:'', onConfirm:proceed }); return; }
  proceed();
}
function fxSave(){
  const d=fxDraft();
  store.updateBoard(_fxBoard.id, { enforce:d.enforce,
    transitions:JSON.parse(JSON.stringify(d.transitions)),
    tlabels:JSON.parse(JSON.stringify(d.labels||{})),
    flowPos:JSON.parse(JSON.stringify(d.pos||{})) });
  _flowDirty=false; fxRender(); renderBoardSwitch(); refreshViews();
  toast('Workflow updated');
}
function fxDirty(){ _flowDirty=true; const b=document.getElementById('fxSaveBtn'); if(b) b.disabled=false;
  const p=document.getElementById('fxDirtyPill'); if(p) p.classList.add('on'); }

function applyFxView(){
  const el=document.getElementById('fxSvg'); if(!el) return;
  const vb=el.viewBox.baseVal;
  el.style.width=Math.round(vb.width*_fxZoom)+'px';
  el.style.height=Math.round(vb.height*_fxZoom)+'px';
  const g=el.querySelector('g'); if(g) g.setAttribute('transform',`translate(${_fxPanX},${_fxPanY})`);
}
function fxFitWidth(){
  const cv=document.getElementById('fxCanvas'), el=document.getElementById('fxSvg'); if(!cv||!el) return;
  const vb=el.viewBox.baseVal, avail=cv.clientWidth-48;
  if(avail>200){ _fxZoom=Math.min(1.6, Math.max(0.4, avail/vb.width)); }
  _fxPanX=0; _fxPanY=0; applyFxView();
  const zr=document.getElementById('fxZr'); if(zr) zr.value=Math.round(_fxZoom*100);
}
function fxRender(){
  const d=fxDraft(), cols=fxCols();
  const nT=Object.values(d.transitions||{}).reduce((a,x)=>a+x.length,0);
  const others=store.boards().filter(x=>x.id!==_fxBoard.id);
  const IC={
    st:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2.5" y="9" width="19" height="6.5" rx="3.2"/></svg>',
    tr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 3v10a4 4 0 0 0 4 4h8"/><path d="M14 13.5 18.5 17 14 20.5"/></svg>',
    cl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>'
  };
  document.getElementById('fxScreen').innerHTML=`
    <header class="fxs-top">
      <div class="fxs-title"><span>Workflow for</span><b>${esc(_fxBoard.name)}</b>
        <span class="fxs-meta">${cols.length} status${cols.length===1?'':'es'} \u00b7 ${nT} transition${nT===1?'':'s'}</span></div>
      <div class="fxs-tools">
        <button class="fxs-tool" id="fxTAdd" type="button">${IC.st}<span>Add status</span></button>
        ${others.length?`<button class="fxs-tool" id="fxTClone" type="button">${IC.cl}<span>Clone workflow</span></button>`:''}
      </div>
      <div class="fxs-right">
        <span class="fxs-dirty" id="fxDirtyPill">Unsaved</span>
        <button class="tsk-btn tsk-btn--sm" id="fxSaveBtn" type="button" ${_flowDirty?'':'disabled'}>Update workflow</button>
        <button class="tsk-btn tsk-btn--ghost tsk-btn--sm" id="fxCloseBtn" type="button">Close</button>
      </div>
    </header>
    <div class="fxs-body ${_fxSideOpen?'':'closed'}">
      <div class="fxs-main">
        <div class="fxs-bar">
          <div class="fxs-seg">
            <button type="button" class="${_fxMode==='diagram'?'on':''}" data-m="diagram">Diagram</button>
            <button type="button" class="${_fxMode==='text'?'on':''}" data-m="text">Text</button>
          </div>
          <span style="flex:1"></span>
          <label class="fxs-enf"><button type="button" class="stx-tgl ${d.enforce?'on':''}" id="fxEnf" role="switch" aria-checked="${d.enforce}"></button>
            <span>Enforce this workflow</span></label>
          ${_fxMode==='diagram'?`<label class="fxs-cb"><input type="checkbox" id="fxLblCb" ${_fxLabels?'checked':''}/><span>Show transition labels</span></label>`:''}
        </div>
        <div class="fxs-canvas" id="fxCanvas">${_fxMode==='diagram'?fxDiagram():fxText()}
          ${_fxPick?`<div class="fxs-hint">
            ${_fxPick==='from'?'<b>1/2</b> Click the status it moves FROM'
             :_fxPick==='into'?`Click the status that moves <b>into ${esc((store.status(_fxInto)||{}).name||'')}</b>`
             :'<b>2/2</b> Now click the status it moves TO'}
            \u2014 <button type="button" id="fxCancel">cancel</button></div>`:''}
        </div>
      </div>
      <aside class="fxs-side">
        <button class="nav-toggle fxs-collapse" id="fxSideBtn" type="button" title="${_fxSideOpen?'Hide panel':'Show panel'}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>
        </button>
        <div class="fxs-side-in">${fxSide()}</div>
      </aside>
    </div>`;
  wireFx();
}

function wireFx(){
  const d=fxDraft();
  const R=()=>fxRender();
  const g=id=>document.getElementById(id);
  g('fxCloseBtn').onclick=closeFlowScreen;
  const sb=g('fxSideBtn'); if(sb) sb.onclick=()=>{ _fxSideOpen=!_fxSideOpen; R(); };
  if(_fxAutoFit) requestAnimationFrame(fxFitWidth); else requestAnimationFrame(applyFxView);
  (function(){ const cv=document.getElementById('fxCanvas');
    if(cv && !cv.__fxRO && 'ResizeObserver' in window){ cv.__fxRO=true; let w=cv.clientWidth, t=null;
      new ResizeObserver(()=>{ const nw=cv.clientWidth; if(Math.abs(nw-w)>4){ w=nw; if(_fxAutoFit){ clearTimeout(t); t=setTimeout(fxFitWidth,100); } } }).observe(cv);
    } })();
  g('fxSaveBtn').onclick=fxSave;
  const enf=g('fxEnf'); if(enf) enf.onclick=()=>{ d.enforce=!d.enforce; fxDirty(); R(); };
  const cb=g('fxLblCb'); if(cb) cb.onchange=()=>{ _fxLabels=cb.checked; R(); };
  document.querySelectorAll('.fxs-seg button').forEach(b=>b.onclick=()=>{ _fxMode=b.dataset.m; R(); });
  const add=()=>openStatusPicker();
  g('fxTAdd').onclick=add;
  const ba=g('fxBlankAdd'); if(ba) ba.onclick=add;
  const cl=g('fxTClone'); if(cl) cl.onclick=fxClone;
  const cn=g('fxCancel'); if(cn) cn.onclick=()=>{ _fxLink=null; _fxPick=null; _fxInto=null; R(); };
  const ed=g('fxEditSt'); if(ed) ed.onclick=()=>openStatusEdit(_fxSel);
  const rm=g('fxRemove');
  if(rm) rm.onclick=()=>{
    const st=store.status(_fxSel); if(!st) return;
    const id=_fxSel;
    const n=Object.keys(d.transitions||{}).reduce((a,f)=>a+((d.transitions[f]||[]).includes(id)?1:0),0)
          + ((d.transitions[id]||[]).length);
    askConfirm(`Remove \u201c${st.name}\u201d?`,
      (n?`Its ${n} transition${n===1?'':'s'} go with it.\n\n`:'')+'The status itself stays available for other boards.',
      'Remove').then(ok=>{ if(!ok) return; fxDoRemove(id); });
  };
  function fxDoRemove(id){
    store.toggleBoardColumn(_fxBoard, id, false);
    delete d.transitions[id];
    Object.keys(d.transitions).forEach(f=>{ d.transitions[f]=(d.transitions[f]||[]).filter(t=>t!==id); });
    Object.keys(d.labels||{}).forEach(k=>{ const [a,bq]=k.split('>'); if(a===id||bq===id) delete d.labels[k]; });
    if(d.pos) delete d.pos[id];
    _fxSel=null; fxDirty(); fxRender();
    toast('Removed \u2014 Update workflow to apply');
  }
  // Right-panel: define the whole transition here — pick the other status and
  // name it — rather than hunting for it on the canvas.
  const ai=g('fxAddIn');
  if(ai) ai.onclick=()=>{
    const to=_fxSel;
    openTrDialog({fixed:'to', toId:to}).then(r=>{
      if(!r) return;
      d.transitions[r.other]=d.transitions[r.other]||[];
      d.transitions[r.other].push(to);
      d.labels=d.labels||{}; d.labels[fxKey(r.other,to)]=r.name;
      fxDirty(); R();
    });
  };
  const ao=g('fxAddOut');
  if(ao) ao.onclick=()=>{
    const from=_fxSel;
    openTrDialog({fixed:'from', fromId:from}).then(r=>{
      if(!r) return;
      d.transitions[from]=d.transitions[from]||[];
      d.transitions[from].push(r.other);
      d.labels=d.labels||{}; d.labels[fxKey(from,r.other)]=r.name;
      fxDirty(); R();
    });
  };

  // nodes
  document.querySelectorAll('#fxSvg .fxn').forEach(n=>n.onclick=e=>{
    e.stopPropagation(); const id=n.dataset.n;
    if(_fxDragged){ _fxDragged=false; return; }        // that was a drag, not a click
    if(_fxPick==='from'){ _fxLink=id; _fxSel=id; _fxPick='to'; R(); return; }
    if(_fxPick==='into'){
      if(id===_fxInto){ toast('Pick a different status'); return; }
      if((d.transitions[id]||[]).includes(_fxInto)){ toast('Those are already connected'); _fxPick=null; _fxInto=null; R(); return; }
      const into=_fxInto, a=store.status(id), bq=store.status(into);
      askTransitionName(a.name, bq.name, bq.name).then(nm=>{
        if(nm===null){ _fxPick=null; _fxInto=null; R(); return; }
        d.transitions[id]=d.transitions[id]||[];
        d.transitions[id].push(into);
        d.labels=d.labels||{}; d.labels[fxKey(id,into)]=nm;
        fxDirty(); _fxSel=into; _fxPick=null; _fxInto=null; R();
      });
      return;
    }
    if(_fxLink && _fxLink!==id){
      const from=_fxLink, a=store.status(from), bq=store.status(id);
      if((d.transitions[from]||[]).includes(id)){ toast('Those are already connected'); _fxLink=null; _fxPick=null; R(); return; }
      askTransitionName(a.name, bq.name, bq.name).then(nm=>{
        if(nm===null){ _fxLink=null; _fxPick=null; R(); return; }
        d.transitions[from]=d.transitions[from]||[];
        d.transitions[from].push(id);
        d.labels=d.labels||{}; d.labels[fxKey(from,id)]=nm;
        fxDirty(); _fxSel=from; _fxLink=null; _fxPick=null; R();
      });
      return;
    }
    _fxSel=id; _fxLink=null; _fxPick=null; _fxInto=null; R();
  });
  // drag
  const svg=g('fxSvg'); let dr=null;
  if(svg){
    svg.addEventListener('pointerdown',e=>{ const n=e.target.closest('.fxn, .fxs-start'); if(!n) return;
      const id=n.dataset.n, r=svg.getBoundingClientRect(), vb=svg.viewBox.baseVal;
      if(!d.pos[id]) return;
      dr={id, sx:e.clientX, sy:e.clientY, ox:d.pos[id].x, oy:d.pos[id].y, sc:vb.width/r.width, moved:false};
      n.setPointerCapture(e.pointerId); });
    svg.addEventListener('pointermove',e=>{ if(!dr) return;
      const dx=(e.clientX-dr.sx)*dr.sc/_fxZoom, dy=(e.clientY-dr.sy)*dr.sc/_fxZoom;
      if(Math.abs(dx)>4||Math.abs(dy)>4) dr.moved=true;
      let nx=Math.max(0,Math.round(dr.ox+dx)), ny=Math.max(0,Math.round(dr.oy+dy));

      // Snap to anything already lined up, and show why. Several targets can be
      // in range at once, so take the NEAREST rather than whichever we checked
      // last — otherwise a node lands 1px off the row it snapped to.
      const SNAP=6;
      const meW = dr.id==='__start' ? 26 : fxNodeW(dr.id);
      const meH = dr.id==='__start' ? 26 : FXH;
      const others=fxCols().filter(x=>x.id!==dr.id).map(x=>({p:d.pos[x.id], w:fxW(x.name), h:FXH}));
      if(dr.id!=='__start' && d.pos.__start) others.push({p:d.pos.__start, w:26, h:26});

      const pickBest=(cands, cur)=>{
        let best=null;
        cands.forEach(c=>{ const dist=Math.abs(cur-c.at);
          if(dist<=SNAP && (!best || dist<best.dist)) best={...c, dist}; });
        return best;
      };
      const vCands=[], hCands=[];
      others.forEach(o=>{ if(!o.p) return;
        vCands.push({at:o.p.x, line:()=>nx},                       // left edges
                    {at:o.p.x+o.w/2-meW/2, line:()=>nx+meW/2},     // centres
                    {at:o.p.x+o.w-meW,     line:()=>nx+meW});      // right edges
        hCands.push({at:o.p.y, line:()=>ny},
                    {at:o.p.y+o.h/2-meH/2, line:()=>ny+meH/2},
                    {at:o.p.y+o.h-meH,     line:()=>ny+meH});
      });
      const guides=[];
      const bv=pickBest(vCands, nx);
      if(bv){ nx=Math.round(bv.at); guides.push({v:true, at:bv.line()}); }
      const bh=pickBest(hCands, ny);
      if(bh){ ny=Math.round(bh.at); guides.push({v:false, at:bh.line()}); }
      d.pos[dr.id]={x:nx, y:ny};
      const n=svg.querySelector(`[data-n="${dr.id}"]`);
      if(n) n.setAttribute('transform',`translate(${nx},${ny})`);
      const gl=document.getElementById('fxGuides');
      if(gl){
        const vb=svg.viewBox.baseVal;
        const seen=new Set();
        gl.innerHTML=guides.filter(g=>{ const k=(g.v?'v':'h')+g.at; if(seen.has(k)) return false; seen.add(k); return true; })
          .map(g=>g.v ? `<line class="fx-guide" x1="${g.at}" y1="0" x2="${g.at}" y2="${vb.height}"/>`
                      : `<line class="fx-guide" x1="0" y1="${g.at}" x2="${vb.width}" y2="${g.at}"/>`).join('');
      }
    });
    svg.addEventListener('pointerup',()=>{ const gl=document.getElementById('fxGuides'); if(gl) gl.innerHTML='';
      if(dr&&dr.moved){ _fxDragged=true; fxDirty(); R();
      setTimeout(()=>{ _fxDragged=false; },0); }            // never leave it latched
      dr=null; });
  }
  // ---- GLOBAL canvas pan + wheel zoom (drag empty space to move, scroll to zoom) ----
  (function(){
    const cv=g('fxCanvas'); if(!cv) return;
    // pan by dragging empty canvas (not on a node/label/control)
    let pan=null;
    cv.addEventListener('pointerdown',e=>{
      if(e.button!==0) return;
      if(e.target.closest('.fxn, .fxs-start, .fxs-lbl, .fxs-mini, .fxs-zoomrow, button, input, a, .fx-guide')) return;
      pan={sx:e.clientX, sy:e.clientY, px:_fxPanX, py:_fxPanY};
      cv.setPointerCapture(e.pointerId); cv.classList.add('fx-panning');
    });
    cv.addEventListener('pointermove',e=>{ if(!pan) return;
      _fxPanX=pan.px+(e.clientX-pan.sx)/_fxZoom;
      _fxPanY=pan.py+(e.clientY-pan.sy)/_fxZoom;
      applyFxView();
    });
    const endPan=()=>{ if(pan){ pan=null; cv.classList.remove('fx-panning'); } };
    cv.addEventListener('pointerup',endPan); cv.addEventListener('pointercancel',endPan); cv.addEventListener('pointerleave',endPan);
    // wheel zoom, centered on cursor
    cv.addEventListener('wheel',e=>{
      if(e.ctrlKey){} // trackpad pinch also sends ctrl+wheel; treat same
      e.preventDefault(); _fxAutoFit=false;
      const el=document.getElementById('fxSvg'); if(!el) return;
      const rect=el.getBoundingClientRect();
      // cursor position in svg-content coords (before zoom change)
      const cx=(e.clientX-rect.left)/_fxZoom - _fxPanX;
      const cy=(e.clientY-rect.top)/_fxZoom - _fxPanY;
      const dir=e.deltaY<0?1:-1;
      const nz=Math.min(1.6, Math.max(0.4, +(_fxZoom + dir*0.08*_fxZoom).toFixed(3)));
      if(nz===_fxZoom) return;
      // keep cursor point stable
      _fxPanX = (e.clientX-rect.left)/nz - cx;
      _fxPanY = (e.clientY-rect.top)/nz - cy;
      _fxZoom = nz; applyFxView();
      const zr=g('fxZr'); if(zr) zr.value=Math.round(_fxZoom*100);
    }, {passive:false});
  })();
  // inspector
  document.querySelectorAll('.fxs-tr-n').forEach(i=>i.onchange=()=>{
    d.labels=d.labels||{}; const v=i.value.trim();
    if(v) d.labels[i.dataset.lbl]=v; else delete d.labels[i.dataset.lbl];
    fxDirty(); R(); });
  // Click a transition's label on the diagram to rename it — same dialog as when
  // it was first created, prefilled with the current name.
  document.querySelectorAll('#fxSvg .fxe-l[data-e]').forEach(l=>l.onclick=e=>{
    e.stopPropagation();
    const key=l.dataset.e||''; const [f,t]=key.split('>');
    const a=store.status(f), bq=store.status(t); if(!a||!bq) return;
    askTransitionName(a.name, bq.name, fxLbl(d,f,t)||'').then(v=>{
      if(v===null) return;                       // cancelled — leave it as-is
      const nv=(v||'').trim();
      d.labels=d.labels||{};
      if(nv) d.labels[key]=nv; else delete d.labels[key];
      fxDirty(); R();
    });
  });
  document.querySelectorAll('[data-del]').forEach(x=>x.onclick=()=>{
    const [f,t]=x.dataset.del.split('>');
    d.transitions[f]=(d.transitions[f]||[]).filter(y=>y!==t);
    if(d.labels) delete d.labels[x.dataset.del];
    fxDirty(); R(); });
  // text mode chips
  document.querySelectorAll('.fxs-chip').forEach(c=>c.onclick=()=>{
    const f=c.dataset.from, t=c.dataset.to;
    d.transitions[f]=d.transitions[f]||[];
    if(d.transitions[f].includes(t)) d.transitions[f]=d.transitions[f].filter(x=>x!==t);
    else d.transitions[f].push(t);
    fxDirty(); R(); });
  // zoom
  const zr=g('fxZr');
  if(zr) zr.oninput=()=>{ _fxAutoFit=false; _fxZoom=Math.min(1.6,Math.max(0.4,parseInt(zr.value,10)/100)); applyFxView(); };
  const zi=g('fxZi'), zo=g('fxZo');
  if(zi) zi.onclick=()=>{ _fxAutoFit=false; _fxZoom=Math.min(1.6,+(_fxZoom+0.1).toFixed(2)); applyFxView(); const zr2=g('fxZr'); if(zr2) zr2.value=Math.round(_fxZoom*100); };
  if(zo) zo.onclick=()=>{ _fxAutoFit=false; _fxZoom=Math.max(0.4,+(_fxZoom-0.1).toFixed(2)); applyFxView(); const zr2=g('fxZr'); if(zr2) zr2.value=Math.round(_fxZoom*100); };
}

function fxClone(){
  const others=store.boards().filter(x=>x.id!==_fxBoard.id);
  const names=others.map((x,i)=>` ${i+1}. ${x.name}`).join('\n');
  const pick=prompt('Clone a workflow onto \u201c'+_fxBoard.name+'\u201d.\n\nThis replaces its transitions.\n'+names+'\n\nType a number:');
  if(!pick) return;
  const src=others[parseInt(pick,10)-1];
  if(!src){ toast('No board with that number'); return; }
  const mine=new Set(_fxBoard.columns||[]);
  const d=fxDraft(); const t={}; let kept=0, skip=0;
  Object.keys(src.transitions||{}).forEach(f=>{
    if(!mine.has(f)){ skip+=(src.transitions[f]||[]).length; return; }
    const to=(src.transitions[f]||[]).filter(x=>mine.has(x));
    skip+=(src.transitions[f]||[]).length-to.length;
    if(to.length){ t[f]=to; kept+=to.length; } });
  const lb={}; Object.keys(src.tlabels||{}).forEach(k=>{ const [a,b]=k.split('>');
    if(mine.has(a)&&mine.has(b)) lb[k]=src.tlabels[k]; });
  d.transitions=t; d.labels=lb; d.enforce=!!src.enforce;
  fxDirty(); fxRender();
  toast(`Cloned from ${src.name} \u00b7 ${kept} transitions${skip?` \u00b7 ${skip} skipped`:''} \u2014 Update to apply`);
}
