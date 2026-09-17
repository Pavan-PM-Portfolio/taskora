/* Taskora — 15-analytics.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ---------- Analytics ---------- */
const SLA_RULES={Highest:3, High:5, Medium:10, Low:15};
let _anRef=null;
function anInPeriod(ds){
  const per=ui.anPeriod;
  if(per==='all'||!per) return true;
  if(per==='custom'){ if(!ui.anFrom||!ui.anTo) return true; return !!ds && ds>=ui.anFrom && ds<=ui.anTo; }
  if(!ds) return false;
  const pr=periodRange(per, _anRef);
  if(pr) return ds>=pr.from && ds<=pr.to;
  return true;
}
function anActive(t){ return anInPeriod(t.createdAt) || anInPeriod(t.resolvedAt) || store.worklogs(t.id).some(w=>anInPeriod(w.date)); }

function renderAnalytics(){
  if(!_inRenderAll){ try{ urlSync(); }catch(e){} }   // in-page tab/selection change → reflect in URL
  const el=document.getElementById('analyticswrap');
  const scope = ui.project==='all' ? store.standardTasks() : store.standardTasks().filter(t=>t.project===ui.project);
  const ids=scope.map(t=>t.id);
  const logs=store.data.worklogs.filter(w=>ids.includes(w.task));
  // Reference "now" is the REAL today. It used to be the latest activity date in the
  // dataset, so a single future-dated ticket silently moved "Today" to that future
  // day and hid everything actually logged today.
  _anRef = today();
  const resolved=scope.filter(t=>t.resolvedAt);

  // period-scoped figures
  const plogs=logs.filter(w=>anInPeriod(w.date));
  const timeLogged=plogs.reduce((a,w)=>a+w.min,0);
  const active=scope.filter(anActive);
  const closed=active.filter(t=>(store.status(t.status)||{}).cat==='done');
  const pending=active.filter(t=>(store.status(t.status)||{}).cat!=='done');

  // period control
  const periods=[['all','All'],['today','Today'],['week','Week'],['month','Month'],['custom','Custom']];
  const periodBar=`<div class="period-box">
    <div class="period-seg">${periods.map(([k,l])=>`<button data-period="${k}" class="${ui.anPeriod===k?'on':''}">${l}</button>`).join('')}</div>
    ${ui.anPeriod==='custom'?periodCustomRow('an', ui.anFrom, ui.anTo):''}</div>`;

  const kpis=`<div class="kpis">
    <div class="kpi"><div class="l">Time logged</div><div class="v num">${(timeLogged/60).toFixed(0)}<span style="font-size:15px;color:var(--muted)">h</span></div><div class="d">${plogs.length} entries</div></div>
    <div class="kpi"><div class="l">Total tickets</div><div class="v num">${active.length}</div><div class="d">active in period</div></div>
    <div class="kpi"><div class="l">Tickets pending</div><div class="v num">${pending.length}</div><div class="d">not yet done</div></div>
    <div class="kpi"><div class="l">Tickets closed</div><div class="v num">${closed.length}</div><div class="d"><span class="up">${active.length?Math.round(closed.length/active.length*100):0}%</span> of total</div></div>
  </div>`;

  let section='';
  if(ui.analyticsTab==='delivery') section=anDelivery(scope, resolved);
  else if(ui.analyticsTab==='priority') section=anPriority(scope, resolved, today());
  else section=anProductivity(scope, logs);

  el.innerHTML=`<div class="ov-h" style="align-items:flex-start;justify-content:flex-end;margin-bottom:14px">${periodBar}</div>
    <div id="anSection">${section}</div>`;
  el.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{ ui.anPeriod=b.dataset.period; renderAnalytics(); });
  if(ui.analyticsTab==='productivity') wireStatPops('#analyticswrap');
  // two-pane rails: Delivery (by status) and Priority (by level)
  el.querySelectorAll('#dlRail .tsk-li').forEach(b=>b.onclick=()=>{ ui.dlSel=b.dataset.id||null; renderAnalytics(); });
  const _dlS=document.getElementById('dlSearch');
  if(_dlS) _dlS.oninput=()=>{ ui.dlQuery=_dlS.value; const at=_dlS.selectionStart; renderAnalytics();
    const n=document.getElementById('dlSearch'); if(n){ n.focus(); try{ n.setSelectionRange(at,at); }catch(e){} } };
  el.querySelectorAll('#piRail .tsk-li').forEach(b=>b.onclick=()=>{ ui.piSel=b.dataset.id||null; renderAnalytics(); });
  const _piS=document.getElementById('piSearch');
  if(_piS) _piS.oninput=()=>{ ui.piQuery=_piS.value; const at=_piS.selectionStart; renderAnalytics();
    const n=document.getElementById('piSearch'); if(n){ n.focus(); try{ n.setSelectionRange(at,at); }catch(e){} } };
  // two-pane rail (Productivity): All users / pick one / tick several
  el.querySelectorAll('#prRail .tsk-li[data-all]').forEach(b=>b.onclick=()=>{ ui.prSel=[]; renderAnalytics(); });
  el.querySelectorAll('#prRail .tsk-li[data-id]').forEach(b=>b.onclick=e=>{
    if(e.target.classList.contains('tsk-li-cb')) return;      // checkbox handles itself
    ui.prSel=[b.dataset.id]; renderAnalytics(); });
  el.querySelectorAll('#prRail .tsk-li-cb').forEach(cb=>cb.onclick=e=>{
    e.stopPropagation();
    const id=cb.dataset.cb; const cur=Array.isArray(ui.prSel)?ui.prSel.slice():[];
    const i=cur.indexOf(id); if(i>=0) cur.splice(i,1); else cur.push(id);
    ui.prSel=cur; renderAnalytics(); });
  wireTskTable(el, renderAnalytics);
  const _clr=document.getElementById('prClearSel');
  if(_clr) _clr.onclick=()=>{ ui.prSel=[]; renderAnalytics(); };
  const _prS=document.getElementById('prSearch');
  if(_prS) _prS.oninput=()=>{ ui.prQuery=_prS.value; const at=_prS.selectionStart; renderAnalytics();
    const n=document.getElementById('prSearch'); if(n){ n.focus(); try{ n.setSelectionRange(at,at); }catch(e){} } };
  if(ui.anPeriod==='custom') wirePeriodCustom('an', ui.anFrom, ui.anTo, v=>{ ui.anFrom=v; renderAnalytics(); }, v=>{ ui.anTo=v; renderAnalytics(); });
  el.querySelectorAll('[data-open]').forEach(r=>r.onclick=()=>openPanel(r.dataset.open));
}
function barRows(items, colorFn, valFn){ const max=Math.max(...items.map(i=>i.v),1);
  return items.map(i=>`<div class="hbar-row"><span class="nm">${esc(i.label)}</span><span class="track"><span class="fill" style="width:${Math.max(i.v/max*100,i.v>0?3:0)}%;background:${colorFn(i)}"></span></span><span class="val">${valFn(i.v)}</span></div>`).join(''); }

/* Bottom charts, shared by all three dashboards. Colours come from the entity
   itself; anything without one falls back to a palette slot, so bars are never
   all the same colour (production projects have no colour set). */
const TSK_BAR='#1A2333';   // solid black bars on all three dashboards
function tskBottomCharts(tasks, capA, capB){
  const projItems=store.projects().map(pr=>({label:pr.name, v:tasks.filter(t=>t.project===pr.id).length,
      color:TSK_BAR})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  const noProj=tasks.filter(t=>!t.project||!store.project(t.project)).length;
  if(noProj) projItems.push({label:'No project', v:noProj, color:TSK_BAR});
  const stItems=store.statuses().map(st=>({label:st.name, v:tasks.filter(t=>t.status===st.id).length,
      color:TSK_BAR})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  return `<div class="tsk-cols2">
    <div class="tsk-box"><div class="tsk-box-h"><h3>Tickets by project</h3><p>${esc(capA||'In scope')}</p></div>
      ${projItems.length?barRows(projItems,i=>i.color,v=>v):'<p class="tsk-rail-none">Nothing in this period.</p>'}</div>
    <div class="tsk-box"><div class="tsk-box-h"><h3>Tickets by status</h3><p>${esc(capB||'Current status of that work')}</p></div>
      ${stItems.length?barRows(stItems,i=>i.color,v=>v):'<p class="tsk-rail-none">Nothing in this period.</p>'}</div>
  </div>`;
}

function anDelivery(scope, resolved){
  const _td=today(), _wk=periodRange('week');
  const _open=t=>(store.status(t.status)||{}).cat!=='done';
  const _isBlk=t=>{ const st=store.status(t.status)||{}; return st.id==='blocked'||/blocked/i.test(st.name||''); };
  const leadOf=t=>daysBetween(t.resolvedAt,t.createdAt);

  // ---- overview strip: how fast, how punctual, what is at risk ----
  const leads=resolved.map(leadOf).filter(d=>d!=null);
  const avgLead=leads.length?(leads.reduce((a,d)=>a+d,0)/leads.length):0;
  const medLead=leads.length?median(leads):0;
  const withDue=scope.filter(t=>t.due&&t.resolvedAt);
  const onTime=withDue.length?Math.round(withDue.filter(t=>daysBetween(t.resolvedAt,t.due)<=0).length/withDue.length*100):0;
  const createdWk=scope.filter(t=>t.createdAt&&t.createdAt>=_wk.from&&t.createdAt<=_wk.to).length;
  const dueWk=scope.filter(t=>t.due&&t.due>=_wk.from&&t.due<=_wk.to&&_open(t)).length;
  const overdue=scope.filter(t=>t.due&&t.due<_td&&_open(t)).length;
  const blocked=scope.filter(t=>_isBlk(t)&&_open(t)).length;
  const cells=[[medLead?medLead.toFixed(1)+'d':'\u2014','Median lead',!medLead],
    [onTime+'%','On time',withDue.length===0],
    [resolved.length,'Resolved'],[createdWk,'Created this week'],[dueWk,'Due this week'],
    [overdue,'Overdue',overdue===0,overdue?'is-hot':''],
    [blocked,'Blocked',blocked===0,blocked?'is-hot':'']];
  const ov=`<section class="tsk-overview">
    <div class="tsk-ov-lead"><span class="tsk-ov-n">${avgLead?avgLead.toFixed(1):'0'}<span class="u">d</span></span><span class="tsk-ov-l">Avg lead time</span></div>
    <div class="tsk-ov-cells">${cells.map(c=>tskOvCell(c[0],c[1],c.length>2?c[2]:c[0]===0,c[3])).join('')}</div>
  </section>`;

  // ---- rail: the pipeline, one row per status ----
  if(ui.dlSel && !store.status(ui.dlSel)) ui.dlSel=null;
  const isAll=!ui.dlSel;
  const inStatus=id=>scope.filter(t=>t.status===id);
  const q=(ui.dlQuery||'').trim().toLowerCase();
  const sts=store.statuses().filter(x=>x.name.toLowerCase().includes(q));
  const railList = !sts.length && q
    ? `<p class="tsk-rail-none">No status matches \u201c${esc(ui.dlQuery||'')}\u201d.</p>`
    : `<button type="button" class="tsk-li tsk-li-all" data-id="" aria-current="${isAll}">
        <span class="tsk-li-n">All statuses</span><span class="tsk-li-c">${scope.length}</span></button><div class="tsk-rail-sep"></div>`
      + sts.map(x=>{ const n=inStatus(x.id).length;
          return `<button type="button" class="tsk-li${n?'':' is-empty'}" data-id="${x.id}" aria-current="${ui.dlSel===x.id}">
            <span class="tsk-li-n">${esc(x.name)}</span><span class="tsk-li-c">${n}</span></button>`; }).join('');

  // ---- detail ----
  const sel = isAll ? scope : inStatus(ui.dlSel);
  const selRes = sel.filter(t=>t.resolvedAt);
  const selLeads = selRes.map(leadOf).filter(d=>d!=null);
  const selAvg = selLeads.length?(selLeads.reduce((a,d)=>a+d,0)/selLeads.length):0;
  const selDue = sel.filter(t=>t.due&&t.resolvedAt);
  const selOn = selDue.length?Math.round(selDue.filter(t=>daysBetween(t.resolvedAt,t.due)<=0).length/selDue.length*100):0;
  const selOver = sel.filter(t=>t.due&&t.due<_td&&_open(t)).length;
  const selUn = sel.filter(t=>!t.assignee&&_open(t)).length;
  const dTitle = isAll ? 'All statuses' : (store.status(ui.dlSel)||{}).name;
  const stats=[['Tickets',sel.length],['Resolved',selRes.length],
    ['Avg lead',selAvg?selAvg.toFixed(1)+'d':'\u2014',!selAvg],
    ['On time',selOn+'%',selDue.length===0],
    ['Overdue',selOver,selOver===0,selOver?'is-hot':''],
    ['Unassigned',selUn]]
    .map(([l,v,zero,cls])=>`<div class="tsk-d-stat${(zero||v===0)?' is-zero':''}${cls?' '+cls:''}"><b>${v}</b><span>${l}</span></div>`).join('');
  const rank=(a,b)=>{ const ra=t=>{ const c=(store.status(t.status)||{}).cat||'todo';
      if(_isBlk(t)) return 0; if(c==='inprogress') return 1; if(c==='todo') return 2; return 3; };
    return ra(a)-ra(b)||(b.updatedAt||'').localeCompare(a.updatedAt||''); };
  const tbl=tskTicketTable('dl', sel, rank);
  const detail=`<div class="tsk-d-head"><div><h2>${esc(dTitle)}</h2>
      <p class="tsk-d-sub"><b>${sel.length}</b> ticket${sel.length===1?'':'s'}${selOver?` \u00b7 <b class="hot">${selOver}</b> overdue`:''}</p></div></div>
    <div class="tsk-d-stats tsk-d-stats--6">${stats}</div>
    <div class="tsk-sec-head"><span class="tsk-eyebrow">Tickets</span><span class="tsk-eyebrow">${tbl.shown}${tbl.shown!==tbl.total?' of '+tbl.total:''}</span></div>
    ${tbl.html}`;

  return ov+`<div class="tsk-pane">
    <aside class="tsk-rail">${tskSearchBox('dlSearch','Find a status',ui.dlQuery)}<nav class="tsk-rail-list" id="dlRail">${railList}</nav></aside>
    <section class="tsk-detail">${detail}</section></div>`
    + tskBottomCharts(sel, isAll?'In scope':'In '+esc(dTitle), 'Current status of that work');
}

function anPriority(scope, resolved, NOW){
  const PRI=['Highest','High','Medium','Low'];
  const _td=today();
  const _open=t=>(store.status(t.status)||{}).cat!=='done';
  const _isBlk=t=>{ const st=store.status(t.status)||{}; return st.id==='blocked'||/blocked/i.test(st.name||''); };
  const leadOf=t=>daysBetween(t.resolvedAt,t.createdAt);
  const metSla=t=>{ const d=leadOf(t); return d!=null && d<=SLA_RULES[t.priority]; };

  // ---- overview strip ----
  const overdueAll=scope.filter(t=>t.due&&t.due<_td&&_open(t)).length;
  const slaTot=resolved.length, slaMet=resolved.filter(metSla).length;
  const slaPct=slaTot?Math.round(slaMet/slaTot*100):0;
  const blocked=scope.filter(t=>_isBlk(t)&&_open(t)).length;
  const cells=PRI.map(pr=>{ const n=scope.filter(t=>t.priority===pr).length;
      return [n, pr, n===0, (pr==='Highest'&&n)?'is-hot':'']; });
  cells.push([overdueAll,'Overdue',overdueAll===0,overdueAll?'is-hot':'']);
  cells.push([blocked,'Blocked',blocked===0,blocked?'is-hot':'']);
  cells.push([slaPct+'%','SLA met',slaTot===0]);
  const ov=`<section class="tsk-overview">
    <div class="tsk-ov-lead"><span class="tsk-ov-n">${scope.length}</span><span class="tsk-ov-l">Total tickets</span></div>
    <div class="tsk-ov-cells">${cells.map(c=>tskOvCell(c[0],c[1],c[2],c[3])).join('')}</div>
  </section>`;

  // ---- rail: one row per priority ----
  if(ui.piSel && !PRI.includes(ui.piSel)) ui.piSel=null;
  const isAll=!ui.piSel;
  const q=(ui.piQuery||'').trim().toLowerCase();
  const list=PRI.filter(pr=>pr.toLowerCase().includes(q));
  const inPri=pr=>scope.filter(t=>t.priority===pr);
  const railList = !list.length && q
    ? `<p class="tsk-rail-none">No priority matches \u201c${esc(ui.piQuery||'')}\u201d.</p>`
    : `<button type="button" class="tsk-li tsk-li-all" data-id="" aria-current="${isAll}">
        <span class="tsk-li-n">All priorities</span><span class="tsk-li-c">${scope.length}</span></button><div class="tsk-rail-sep"></div>`
      + list.map(pr=>{ const n=inPri(pr).length;
          return `<button type="button" class="tsk-li${n?'':' is-empty'}" data-id="${pr}" aria-current="${ui.piSel===pr}">
            <span class="tsk-li-n">${esc(pr)}</span><span class="tsk-li-c">${n}</span></button>`; }).join('');

  // ---- detail ----
  const sel = isAll ? scope : inPri(ui.piSel);
  const selRes = sel.filter(t=>t.resolvedAt);
  const selOver = sel.filter(t=>t.due&&t.due<_td&&_open(t)).length;
  const selBlk = sel.filter(t=>_isBlk(t)&&_open(t)).length;
  const selLeads = selRes.map(leadOf).filter(d=>d!=null);
  const selAvg = selLeads.length?(selLeads.reduce((a,d)=>a+d,0)/selLeads.length):0;
  const selSla = selRes.length?Math.round(selRes.filter(metSla).length/selRes.length*100):0;
  const dTitle = isAll ? 'All priorities' : ui.piSel;
  const stats=[['Tickets',sel.length],['Open',sel.filter(_open).length],['Resolved',selRes.length],
    ['Avg lead',selAvg?selAvg.toFixed(1)+'d':'\u2014',!selAvg],
    ['Overdue',selOver,selOver===0,selOver?'is-hot':''],
    ['SLA met',selSla+'%',selRes.length===0]]
    .map(([l,v,zero,cls])=>`<div class="tsk-d-stat${(zero||v===0)?' is-zero':''}${cls?' '+cls:''}"><b>${v}</b><span>${l}</span></div>`).join('');
  // worst first: overdue, then blocked, then soonest due
  const rank=(a,b)=>{ const ra=t=>{ if(t.due&&t.due<_td&&_open(t)) return 0; if(_isBlk(t)) return 1; if(_open(t)) return 2; return 3; };
    return ra(a)-ra(b)||String(a.due||'9999').localeCompare(String(b.due||'9999')); };
  const tbl=tskTicketTable('pi', sel, rank);
  const detail=`<div class="tsk-d-head"><div><h2>${esc(dTitle)}</h2>
      <p class="tsk-d-sub"><b>${sel.length}</b> ticket${sel.length===1?'':'s'}${selOver?` \u00b7 <b class="hot">${selOver}</b> overdue`:''}${selBlk?` \u00b7 <b class="hot">${selBlk}</b> blocked`:''}</p></div></div>
    <div class="tsk-d-stats tsk-d-stats--6">${stats}</div>
    <div class="tsk-sec-head"><span class="tsk-eyebrow">Tickets</span><span class="tsk-eyebrow">${tbl.shown}${tbl.shown!==tbl.total?' of '+tbl.total:''}</span></div>
    ${tbl.html}`;

  return ov+`<div class="tsk-pane">
    <aside class="tsk-rail">${tskSearchBox('piSearch','Find a priority',ui.piQuery)}<nav class="tsk-rail-list" id="piRail">${railList}</nav></aside>
    <section class="tsk-detail">${detail}</section></div>`
    + tskBottomCharts(sel, isAll?'In scope':esc(dTitle)+' priority', 'Current status of that work');
}

/* ================= Filterable ticket table (shared: projects + dashboards) =================
   Namespaced so each section keeps its own sort/filter state. */
const _tblRows={};
function tblState(ns){ ui.tbl=ui.tbl||{}; if(!ui.tbl[ns]) ui.tbl[ns]={sort:{col:null,dir:'asc'}, filters:{}}; return ui.tbl[ns]; }
function tblVal(r,col){ return col==='due' ? r.dueTxt : String(r[col]||''); }
// rows passing every filter EXCEPT `skip`, so a menu only offers values still reachable
function tblApply(ns, rows, skip){
  const f=tblState(ns).filters;
  return rows.filter(r=>Object.keys(f).every(c=>{
    if(c===skip) return true;
    const allow=f[c]; if(!allow||!allow.length) return true;
    return allow.includes(tblVal(r,c));
  }));
}
function tblValues(ns,col){
  const seen=new Set();
  tblApply(ns,_tblRows[ns]||[],col).forEach(r=>seen.add(tblVal(r,col)));
  return [...seen].sort((a,b)=>a.localeCompare(b));
}
function tblMake(t){
  const u=store.user(t.assignee);
  return { t, id:t.id, key:t.key||'', title:t.title||'',
           due:t.due||'', dueTxt:t.due?fdate(t.due):'\u2014',
           assignee: u?u.name:'Unassigned',
           status:(store.status(t.status)||{}).name||t.status||'' };
}
function tskTicketTable(ns, tasks, rankFn){
  _tblRows[ns]=tasks.map(tblMake);
  const st=tblState(ns);
  const _td=today();
  const rows=tblApply(ns,_tblRows[ns]).sort((a,b)=>{
    if(st.sort&&st.sort.col){ const d=st.sort.dir==='desc'?-1:1;
      const av=(st.sort.col==='due')?(a.due||'9999'):String(a[st.sort.col]||'').toLowerCase();
      const bv=(st.sort.col==='due')?(b.due||'9999'):String(b[st.sort.col]||'').toLowerCase();
      return av<bv?-1*d:av>bv?1*d:0; }
    return rankFn?rankFn(a.t,b.t):0;
  });
  const th=(col,label,w)=>{ const on=(st.filters[col]&&st.filters[col].length)||(st.sort&&st.sort.col===col);
    return `<th style="width:${w}"><button class="tsk-th ${on?'is-on':''}" data-ns="${ns}" data-col="${col}" type="button"><span class="cap">${label}</span>
      <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3 5h18M6 12h12M10 19h4"/></svg></button></th>`; };
  const open=t=>(store.status(t.status)||{}).cat!=='done';
  const body=rows.map(r=>`<tr>
      <td><span class="tsk-td-k" onclick="openPanel('${r.id}')">${esc(r.key)}</span></td>
      <td><span class="tsk-td-t" title="${esc(r.title)}" onclick="openPanel('${r.id}')">${esc(r.title)}</span></td>
      <td><span class="tsk-td-as">${r.t.assignee?avatar(store.user(r.t.assignee),18):''}${esc(r.assignee)}</span></td>
      <td>${tskSt(r.t.status)}</td>
      <td><span class="tsk-td-due ${(r.due && r.due<_td && open(r.t))?'over':''}">${esc(r.dueTxt)}</span></td></tr>`).join('');
  const html=`<div class="tsk-tbl-wrap"><div class="tsk-tbl-scroll">
      <table class="tsk-tbl"><thead><tr>
        ${th('key','Ticket','128px')}${th('title','Title','auto')}${th('assignee','Assignee','168px')}${th('status','Status','150px')}${th('due','Due date','120px')}
      </tr></thead><tbody>${body||`<tr><td colspan="5" class="tsk-tbl-none">No tickets match these filters.</td></tr>`}</tbody></table>
    </div></div>`;
  return {html, shown:rows.length, total:_tblRows[ns].length};
}
function wireTskTable(el, rerender){
  el.querySelectorAll('.tsk-th').forEach(b=>b.onclick=ev=>{ ev.stopPropagation(); openTskFilter(b.dataset.ns, b.dataset.col, b, rerender); });
}
function positionFMenu(m, btn){
  // measure first, then clamp inside the viewport
  m.style.visibility='hidden'; m.classList.add('on');
  const r=btn.getBoundingClientRect(); const mw=m.offsetWidth||236, mh=m.offsetHeight||300;
  const pad=8;
  let left=Math.min(r.left, window.innerWidth-mw-pad); left=Math.max(pad,left);
  let top=r.bottom+4;
  if(top+mh > window.innerHeight-pad) top=Math.max(pad, r.top-mh-4);   // flip above
  if(top<pad) top=pad;
  m.style.left=left+'px'; m.style.top=top+'px'; m.style.visibility='';
}
function openTskFilter(ns, col, btn, rerender){
  const m=document.getElementById('prFMenu'); if(!m) return;
  const st=tblState(ns);
  const vals=tblValues(ns,col);
  const cur=(st.filters[col]&&st.filters[col].length)?st.filters[col].slice():vals.slice();
  const opt=v=>`<label class="tsk-fopt"><input type="checkbox" value="${esc(v)}" ${cur.includes(v)?'checked':''}/><span>${esc(v||'(blank)')}</span></label>`;
  m.innerHTML=`<button class="sortb" data-sort="asc"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>Sort A \u2192 Z</button>
    <button class="sortb" data-sort="desc"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>Sort Z \u2192 A</button>
    <div class="sep"></div>
    <div class="tsk-fsearch"><input id="prFSearch" placeholder="Search" autocomplete="off"/></div>
    <div class="tsk-flist" id="prFList">
      <label class="tsk-fopt" style="font-weight:700"><input type="checkbox" id="prFAll" ${cur.length===vals.length?'checked':''}/><span>(Select all)</span></label>
      ${vals.map(opt).join('')}
    </div>
    <div class="tsk-ffoot"><button type="button" id="prFClear">Clear</button><button type="button" class="ok" id="prFOk">Apply</button></div>`;
  positionFMenu(m, btn);
  const list=m.querySelector('#prFList');
  const boxes=()=>[...list.querySelectorAll('input[type=checkbox]:not(#prFAll)')];
  m.querySelector('#prFSearch').oninput=e=>{ const q=e.target.value.toLowerCase();
    list.querySelectorAll('.tsk-fopt').forEach(l=>{ if(l.querySelector('#prFAll')) return;
      l.style.display=l.textContent.toLowerCase().includes(q)?'':'none'; }); };
  m.querySelector('#prFAll').onchange=e=>{ boxes().forEach(b=>{ if(b.closest('.tsk-fopt').style.display!=='none') b.checked=e.target.checked; }); };
  const done=()=>{ m.classList.remove('on'); (rerender||renderAll)(); };
  m.querySelectorAll('.sortb').forEach(b=>b.onclick=()=>{ st.sort={col, dir:b.dataset.sort}; done(); });
  m.querySelector('#prFClear').onclick=()=>{ delete st.filters[col]; if(st.sort&&st.sort.col===col) st.sort={col:null,dir:'asc'}; done(); };
  m.querySelector('#prFOk').onclick=()=>{
    const picked=boxes().filter(b=>b.checked).map(b=>b.value);
    if(picked.length===vals.length) delete st.filters[col]; else st.filters[col]=picked;
    done();
  };
}
function closeFMenu(){ const m=document.getElementById('prFMenu'); if(m) m.classList.remove('on'); }
document.addEventListener('click',e=>{ const m=document.getElementById('prFMenu');
  if(m && m.classList.contains('on') && !e.target.closest('#prFMenu') && !e.target.closest('.tsk-th')) closeFMenu(); });
window.addEventListener('resize', closeFMenu);
document.addEventListener('scroll', closeFMenu, true);

function anProductivity(scope, logs){
  const plogs=logs.filter(w=>anInPeriod(w.date));
  const byUser={}, tasksBy={}, entries={};
  plogs.forEach(w=>{ byUser[w.user]=(byUser[w.user]||0)+w.min; (tasksBy[w.user]=tasksBy[w.user]||new Set()).add(w.task); entries[w.user]=(entries[w.user]||0)+1; });
  const isDone=id=>{ const t=store.task(id); return t&&(store.status(t.status)||{}).cat==='done'; };
  const ranked=store.users().filter(u=>byUser[u.id]).sort((a,b)=>(byUser[b.id]||0)-(byUser[a.id]||0));
  const totalMin=Object.values(byUser).reduce((x,m)=>x+m,0);
  const allTasks=new Set(); Object.values(tasksBy).forEach(set=>set.forEach(t=>allTasks.add(t)));
  const totalTasks=allTasks.size, totalClosed=[...allTasks].filter(isDone).length;
  const totalEntries=Object.values(entries).reduce((x,n)=>x+n,0);

  // selection first — the strip has to follow the rail, not ignore it
  if(!Array.isArray(ui.prSel)) ui.prSel=[];
  ui.prSel=ui.prSel.filter(id=>byUser[id]);
  const sel=ui.prSel;
  const activeIds=sel.length?sel:ranked.map(u=>u.id);

  // ---- overview strip ----
  // Follows BOTH filters: the period (via plogs / anInPeriod) and the rail
  // selection. "All users" = the whole scope; picking people narrows it to
  // exactly the tickets those people worked.
  const _td=today();
  const _open=t=>(store.status(t.status)||{}).cat!=='done';
  const _isBlocked=t=>{ const st=store.status(t.status)||{}; return st.id==='blocked'||/blocked/i.test(st.name||''); };
  const uMinAll=activeIds.reduce((a,id)=>a+(byUser[id]||0),0);
  const wSetAll=new Set(); activeIds.forEach(id=>(tasksBy[id]||new Set()).forEach(t=>wSetAll.add(t)));
  const workedSel=[...wSetAll].map(id=>store.task(id)).filter(Boolean);
  const baseTix = sel.length ? workedSel : scope;

  const selLogsAll=plogs.filter(w=>activeIds.includes(w.user));
  const daysSet=new Set(selLogsAll.map(w=>w.date));
  const avgDayMin = daysSet.size ? (uMinAll/daysSet.size/Math.max(1,sel.length||1)) : 0;

  const cycTix=baseTix.filter(t=>t.resolvedAt && t.createdAt);
  const _cyc=cycTix.map(t=>Math.max(0,Math.round((Date.parse(t.resolvedAt)-Date.parse(t.createdAt))/864e5)));
  const avgCycle=_cyc.length?Math.round(_cyc.reduce((a,d)=>a+d,0)/_cyc.length):0;
  const depTix=baseTix.filter(t=>t.deployedAt && depInRangeAn(t.deployedAt));
  const overdueTix=baseTix.filter(t=>t.due && t.due<_td && _open(t));
  const dueTodayTix=baseTix.filter(t=>t.due===_td && _open(t));

  _statPops={
    hrs:   {title:'Total hrs logged', def:'Every hour logged in this period by the people selected on the left. These are the tickets it went on.', tasks:workedSel},
    avg:   {title:'Avg hrs/day', def:'Hours logged \u00f7 the days those people actually logged. Days with no logs are ignored, so it is a working-day average.', tasks:workedSel},
    cycle: {title:'Avg cycle time', def:'Average days from a ticket being created to being resolved. Long-buried backlog items pull this up.', tasks:cycTix},
    dep:   {title:'Deployed', def:'Tickets marked deployed inside this period.', tasks:depTix},
    over:  {title:'Overdue', def:'Open tickets already past their due date.', tasks:overdueTix},
    today: {title:'Due today', def:'Open tickets due today \u2014 still time to land them.', tasks:dueTodayTix}
  };

  const cells=[
    [hm(Math.round(avgDayMin)),'Avg hrs/day', avgDayMin===0, '', 'avg'],
    [avgCycle?avgCycle+'d':'\u2014','Avg cycle time', avgCycle===0, '', 'cycle'],
    [depTix.length,'Deployed', depTix.length===0, '', 'dep'],
    [overdueTix.length,'Overdue', overdueTix.length===0, overdueTix.length?'is-hot':'', 'over'],
    [dueTodayTix.length,'Due today', dueTodayTix.length===0, dueTodayTix.length?'is-hot':'', 'today']
  ];
  const ov=`<section class="tsk-overview">
    <div class="tsk-ov-lead" data-pop="hrs"><span class="tsk-ov-n">${(uMinAll/60).toFixed(0)}<span class="u">h</span></span><span class="tsk-ov-l">Total hrs logged</span></div>
    <div class="tsk-ov-cells">${cells.map(c=>tskOvCell(c[0],c[1],c[2],c[3],c[4])).join('')}</div>
  </section>`;

  if(!ranked.length) return ov+`<div class="tsk-empty"><p>No activity logged in this period.</p></div>`;

  // ---- rail: All users + per-agent multi-select (ticket counts, no hours) ----
  const q=(ui.prQuery||'').trim().toLowerCase();
  const match=ranked.filter(u=>u.name.toLowerCase().includes(q));
  const allRow=`<button type="button" class="tsk-li tsk-li-all" data-all="1" aria-current="${sel.length===0}">
      <span class="tsk-li-n">All users</span><span class="tsk-li-c">${totalTasks}</span></button><div class="tsk-rail-sep"></div>`;
  const railList = !match.length
    ? `<p class="tsk-rail-none">No one matches \u201c${esc(ui.prQuery||'')}\u201d.</p>`
    : allRow + match.map(u=>`<button type="button" class="tsk-li" data-id="${u.id}" aria-current="${sel.includes(u.id)}">
        <input type="checkbox" class="tsk-li-cb" data-cb="${u.id}" ${sel.includes(u.id)?'checked':''}/>
        <span class="tsk-li-n">${esc(u.name)}</span><span class="tsk-li-c">${(tasksBy[u.id]||new Set()).size}</span></button>`).join('');

  // ---- detail: the selection's tickets. Stats live in the strip above, which
  //      already follows this selection — repeating them here was duplication.
  const uMin=uMinAll;
  const worked=workedSel;
  const title = sel.length===0 ? 'All users' : (sel.length===1 ? (store.user(sel[0])||{}).name : sel.length+' agents selected');
  const subWho = sel.length===0 ? ranked.length+' agents' : (sel.length===1 ? ((store.user(sel[0])||{}).role||'') : sel.map(id=>(store.user(id)||{}).name).join(', '));
  const closed=worked.filter(t=>(store.status(t.status)||{}).cat==='done').length;

  const rank=t=>{ const c=(store.status(t.status)||{}).cat||'todo';
    if(_isBlocked(t)) return 0; if(c==='inprogress') return 1; if(c==='todo') return 2; return 3; };
  const tbl=tskTicketTable('pr', worked, (a,b)=>rank(a)-rank(b)||(b.updatedAt||'').localeCompare(a.updatedAt||''));

  const detail=`<div class="tsk-d-head"><div><h2>${esc(title)}</h2>
      <p class="tsk-d-sub"><b>${hm(uMin)}</b> logged \u00b7 <b>${worked.length}</b> ticket${worked.length===1?'':'s'} \u00b7 <b>${closed}</b> closed${subWho?' \u00b7 '+esc(subWho):''}</p></div>
    ${sel.length?'<button class="tsk-btn tsk-btn--ghost tsk-btn--sm" id="prClearSel" type="button">Clear selection</button>':''}</div>
    <div class="tsk-sec-head"><span class="tsk-eyebrow">Tickets</span><span class="tsk-eyebrow">${tbl.shown}${tbl.shown!==tbl.total?' of '+tbl.total:''}</span></div>
    ${tbl.html}`;

  const bottom=tskBottomCharts(worked, 'Worked on in this period', 'Current status of that work');

  return ov+`<div class="tsk-pane">
    <aside class="tsk-rail">${tskSearchBox('prSearch','Find a person',ui.prQuery)}<nav class="tsk-rail-list" id="prRail">${railList}</nav></aside>
    <section class="tsk-detail">${detail}</section></div>`+bottom;
}
