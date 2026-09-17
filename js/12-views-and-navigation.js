/* Taskora — 12-views-and-navigation.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ============================================================
   GLUE
============================================================ */
function refreshViews(){ const v=ui.view;
  if(v==='board') renderBoard(); else if(v==='list') renderList(); else if(v==='epics') renderEpics();
  else if(v==='overview') renderOverview(); else if(v==='team') renderTeam(); else if(v==='analytics') renderAnalytics();
  else if(v==='boardsettings') renderBoardSettings();
  else if(v==='backlog') renderBacklog(); else if(v==='sprint') renderSprintBoard(); else if(v==='sprintreports') renderSprintReports(); else if(v==='flow') renderFlow();
  renderProjectSwitch(); renderSideCard(); updateCount(); }
function updateCount(){ return; }

const VIEW_TITLE={flow:'Flow reports',sprint:'Active sprint',sprintreports:'Sprint reports',overview:'Overview',boardsettings:'Board & workflow',projects:'Projects',backlog:'Backlog',releases:'Releases',timeline:'Timeline',calendar:'Calendar',dashboard:'Dashboard',velocity:'Velocity & Burndown',board:'Board',list:'List View',epics:'Epics',team:'Team',deployments:'Deployment tracker',qa:'QA & Testing',
  analytics:'Analytics',reports:'Reports',settings:'Settings'};
const SOON_VIEWS={};
function setHeadHeight(){ const h=document.querySelector('.stickyhead'); if(h) document.documentElement.style.setProperty('--head-h', h.offsetHeight+'px'); }
window.addEventListener('resize', setHeadHeight);
// True only while renderAll() is dispatching to a view renderer, so those views
// can tell a navigation render (URL already synced here at the tail) apart from a
// direct in-page re-render (e.g. an analytics rail click) that must sync itself.
let _inRenderAll=false;
function renderAll(){ _inRenderAll=true; document.body.classList.toggle('view-board', ui.view==='board'); document.body.dataset.view=ui.view; renderProjectSwitch(); fillFilters(); renderSideCard(); applyBrand(); try{ renderEnvBanner(); }catch(e){} try{ applyMyPhoto(); }catch(e){}
  renderChatFab(); updateChatFab();
  const v=ui.view;
  const _dashTitle={productivity:'Productivity Dashboard', delivery:'Delivery Dashboard', priority:'Priority Tasks Dashboard'};
  document.getElementById('pageTitle').textContent =
    v==='board'     ? ((activeBoard()&&activeBoard().name)||'Board') :
    v==='analytics' ? (_dashTitle[ui.analyticsTab]||'Dashboards') :
                      (VIEW_TITLE[v]||'Taskora');
  document.querySelectorAll('.nav-item[data-view]').forEach(b=>b.classList.toggle('on', b.dataset.view===v));
  const onAn=v==='analytics';
  const anTog=document.getElementById('navAnalyticsToggle');
  if(onAn) anTog.classList.add('open');
  anTog.classList.toggle('on', onAn);
  document.querySelectorAll('#navAnalytics .sub-item').forEach(it=>it.classList.toggle('on', onAn && it.dataset.atab===ui.analyticsTab));
  const show=(id,on,disp='block')=>document.getElementById(id).style.display=on?disp:'none';
  show('board', v==='board', 'flex');
  show('listwrap', v==='list');
  show('epicswrap', v==='epics');
  show('overviewwrap', v==='overview');
  show('qawrap', v==='qa');
  show('deploymentswrap', v==='deployments');
  show('analyticswrap', v==='analytics');
  show('reportswrap', v==='reports');
  show('projectswrap', v==='projects');
  show('backlogwrap', v==='backlog');
  show('sprintwrap', v==='sprint');
  show('sprintreportswrap', v==='sprintreports');
  show('flowwrap', v==='flow');
  show('releaseswrap', v==='releases');
  show('timelinewrap', v==='timeline');
  show('calendarwrap', v==='calendar');
  show('dashboardwrap', v==='dashboard');
  show('velocitywrap', v==='velocity');
  show('settingswrap', v==='settings');
  show('boardsettingswrap', v==='boardsettings');
  show('teamwrap', v==='team');
  show('usersedwrap', v==='users');
  try{ document.querySelector('.stickyhead').style.display = (v==='users')?'none':''; }catch(e){}
  show('soonwrap', !!SOON_VIEWS[v]);
  document.getElementById('filterbar').style.display = (v==='board'||v==='list'||v==='overview')?'flex':'none';
  if(v==='overview'){ try{ renderFilterChips(); fillFilters(); }catch(e){} }
  document.querySelector('.search').style.display = (v==='board'||v==='list'||v==='epics')?'block':'none';
  document.getElementById('boardSwitch').style.display = v==='board'?'flex':'none';
  renderBoardSwitch();
  if(v==='board') renderBoard(); else if(v==='list') renderList(); else if(v==='epics') renderEpics();
  else if(v==='overview') renderOverview(); else if(v==='team') renderTeam(); else if(v==='analytics') renderAnalytics();
  else if(v==='boardsettings') renderBoardSettings();
  else if(v==='reports') renderReports();
  else if(v==='deployments') renderDeployments();
  else if(v==='qa') renderQA();
  else if(v==='projects') renderProjects();
  else if(v==='backlog') renderBacklog();
  else if(v==='sprint') renderSprintBoard();
  else if(v==='sprintreports') renderSprintReports();
  else if(v==='flow') renderFlow();
  else if(v==='releases') renderReleases();
  else if(v==='timeline') renderTimeline();
  else if(v==='calendar') renderCalendar();
  else if(v==='dashboard') renderDashboard();
  else if(v==='velocity') renderVelocity();
  else if(v==='settings') renderSettings();
  else if(v==='users') renderUsers();
  else if(SOON_VIEWS[v]) renderSoon(SOON_VIEWS[v]);
  updateCount(); setHeadHeight(); openTicketFromURL(); if(window.enhanceSelects) enhanceSelects(document);
  _inRenderAll=false;
  try{ urlSync(); }catch(e){} }

function setView(v){ if(!IS_ADMIN){ if(v!=='settings' && !canView(v)){ v = canView('overview')?'overview':(['board','list','epics','reports','team'].find(canView)||'overview'); } }
  // Entering List View: scope it to the board you were just looking at, so the list
  // is board-specific by default (switchable via its own Board selector).
  if(v==='list' && ui.view!=='list'){ if(ui.board && store.board(ui.board)) ui.listBoard=ui.board; }
  // Same for Projects: default its board scope to the board you're on.
  if(v==='projects' && ui.view!=='projects'){ if(ui.board && store.board(ui.board)) ui.projBoard=ui.board; }
  ui.view=v; document.body.classList.toggle('view-board', v==='board'); renderAll(); document.getElementById('scroll').scrollTop=0; saveSpot(); }

/* ---------- Side card ---------- */
function renderSideCard(){
  const el=document.getElementById('sideCard'); if(!el) return;
  const scope = ui.project==='all' ? store.standardTasks() : store.standardTasks().filter(t=>t.project===ui.project);
  const open = scope.filter(t=>{ const s=store.status(t.status); return !s||s.cat!=='done'; }).length;
  const ids = scope.map(t=>t.id);
  const wk = store.data.worklogs.filter(w=>ids.includes(w.task)).reduce((a,w)=>a+w.min,0);
  document.getElementById('sideCard').innerHTML=`
    <div class="sc-t">This week <span class="sc-badge">Live</span></div>
    <div class="sc-row"><span>Open tickets</span><b>${open}</b></div>
    <div class="sc-row"><span>Hours logged</span><b>${hm(wk)}</b></div>
    <button class="sc-btn" id="scNew"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>New ticket</button>`;
  const nb=document.getElementById('scNew'); if(nb) nb.onclick=openModal;
}

/* ---------- period maths — ONE definition, used by every period filter ----------
   Today = today.  Week = Monday .. Sunday of the current week.  Month = 1st .. last
   of the current calendar month. (Week/Month used to be rolling "last 7/30 days".)
   Dates are built from local parts, never toISOString(), which would shift the day
   for anyone east/west of UTC — Asia/Kolkata included. */
function _isoLocal(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function periodRange(per, ref){
  const base = ref ? new Date(ref+'T00:00:00') : new Date();
  if(per==='today'){ const t=_isoLocal(base); return {from:t, to:t, label:'Today'}; }
  if(per==='week'){
    const s=new Date(base); const dow=(s.getDay()+6)%7;      // 0=Mon … 6=Sun
    s.setDate(s.getDate()-dow);
    const e=new Date(s); e.setDate(s.getDate()+6);
    return {from:_isoLocal(s), to:_isoLocal(e), label:'This week'};
  }
  if(per==='month'){
    const s=new Date(base.getFullYear(), base.getMonth(), 1);
    const e=new Date(base.getFullYear(), base.getMonth()+1, 0);
    return {from:_isoLocal(s), to:_isoLocal(e), label:'This month'};
  }
  return null;
}
/* ---------- Overview dashboard ---------- */
function ovWindow(){
  const iso=d=>_isoLocal(d); const today=new Date(); const to=iso(today);
  const per=ui.ovRange||'all';
  const pr=periodRange(per); if(pr) return pr;
  if(per==='custom'){ const f=ui.ovFrom||to, t=ui.ovTo||to; return {from:f<t?f:t,to:f<t?t:f,label:fdate(f<t?f:t)+' \u2013 '+fdate(f<t?t:f)}; }
  // 'all' — span from the earliest ticket/worklog we have
  const ds=[]; (store.data.tasks||[]).forEach(t=>{ if(t.createdAt) ds.push(t.createdAt); });
  (store.data.worklogs||[]).forEach(w=>{ if(w.date) ds.push(w.date); }); ds.sort();
  const from=ds.length?ds[0]:iso(new Date(today.getTime()-29*864e5));
  return {from, to, label:'All time'};
}
function _ovWindowOld(){
  const iso=d=>_isoLocal(d); const today=new Date(); const to=iso(today);
  const per=(ui.filters&&ui.filters.period)||'all';
  if(per==='today') return {from:to,to,label:'Today'};
  if(per==='week'){ const d=new Date(today); d.setDate(d.getDate()-6); return {from:iso(d),to,label:'Last 7 days'}; }
  if(per==='month'){ const d=new Date(today); d.setDate(d.getDate()-29); return {from:iso(d),to,label:'Last 30 days'}; }
  if(per==='custom'){ const f=ui.filters.from||to, t=ui.filters.to||to; return {from:f<t?f:t,to:f<t?t:f,label:fdate(f<t?f:t)+' – '+fdate(f<t?t:f)}; }
  const ds=[]; (store.data.tasks||[]).forEach(t=>{ if(t.createdAt)ds.push(t.createdAt); }); (store.data.worklogs||[]).forEach(w=>{ if(w.date)ds.push(w.date); }); ds.sort();
  const from=ds.length?ds[0]:iso(new Date(today.getTime()-29*86400000));
  return {from, to, label:'All time'};
}
function ovTasks(){
  const f=ui.filters||{};
  return store.standardTasks().filter(t=>{
    if(t.archived) return false;
    if(ui.project!=='all' && t.project!==ui.project) return false;
    if(f.epic&&f.epic!=='all'){ if(f.epic==='none'){ if(t.parent) return false; } else if(t.parent!==f.epic) return false; }
    if(f.assignee&&f.assignee!=='all' && t.assignee!==f.assignee) return false;
    if(f.status&&f.status!=='all' && t.status!==f.status) return false;
    if(f.priority&&f.priority!=='all' && t.priority!==f.priority) return false;
    if(f.type&&f.type!=='all' && t.type!==f.type) return false;
    if(f.time&&f.time!=='all'){ const has=store.worklogs(t.id).length>0; if(f.time==='yes'&&!has) return false; if(f.time==='no'&&has) return false; }
    if(f.search){ const q=f.search.toLowerCase(); if(!((t.title||'').toLowerCase().includes(q)||(t.key||'').toLowerCase().includes(q))) return false; }
    return true;
  });
}
function ovSpark(vals,color){ if(!vals||!vals.length) vals=[0,0]; const w=120,h=26,max=Math.max(...vals,1),min=Math.min(...vals,0),rng=(max-min)||1;
  const pts=vals.map((v,i)=>`${(vals.length>1?i/(vals.length-1)*w:0).toFixed(1)},${(h-3-((v-min)/rng)*(h-7)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:22px;margin:3px 0"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
function ovArea(vals,color,h){ h=h||130; if(!vals||!vals.length) vals=[0,0]; const w=900,max=Math.max(...vals,1),step=vals.length>1?w/(vals.length-1):w;
  const pts=vals.map((v,i)=>[+(i*step).toFixed(1), +(h-8-(v/max)*(h-16)).toFixed(1)]);
  const line=pts.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join(' '); const id='ag'+Math.random().toString(36).slice(2,7);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".2"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${line} L${w},${h} L0,${h} Z" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
function ovDonut(parts,top,bot,size){ size=size||120; const total=parts.reduce((a,p)=>a+p.v,0)||1; let acc=0;
  const segs=parts.filter(p=>p.v>0).map(p=>{ const pct=p.v/total*100; const off=25-acc; acc+=pct; return `<circle cx="21" cy="21" r="15.9" fill="none" stroke="${p.color}" stroke-width="5.5" stroke-dasharray="${pct.toFixed(2)} ${(100-pct).toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>`; }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--surface-3)" stroke-width="5.5"/>${segs}<text x="21" y="20.5" text-anchor="middle" font-size="6.6" font-weight="800" fill="var(--ink)">${top}</text><text x="21" y="25.5" text-anchor="middle" font-size="3.1" fill="var(--muted)">${bot}</text></svg>`; }
function ovDelta(cur,prev){ if(!prev) return cur>0?{t:'New',c:'up'}:{t:'—',c:''}; const d=Math.round((cur-prev)/prev*100); return {t:(d>=0?'↑ ':'↓ ')+Math.abs(d)+'%', c:d>=0?'up':'dn'}; }
let _ovSets={};
function wireOvPops(){
  const pop=document.getElementById('ovPop'); if(!pop) return;
  const hide=()=>{ pop.classList.remove('on'); pop.dataset.src=''; };
  pop.onmouseenter=null; pop.onmouseleave=null;
  document.querySelectorAll('#overviewwrap [data-pop]').forEach(elm=>{
    elm.onmouseenter=null; elm.onmouseleave=null;      // click-only, no hover peek
    elm.onclick=(ev)=>{ ev.stopPropagation();
      const key=elm.dataset.pop; const set=_ovSets[key];
      if(!set||!set.tasks.length){ hide(); return; }
      if(pop.classList.contains('on') && pop.dataset.src===key){ hide(); return; }  // toggle
      pop.dataset.src=key;
      const rows=set.tasks.slice(0,12).map(x=>`<div class="ovpr" data-id="${x.t.id}"><span class="ovti">${esc(x.t.title)}</span>${x.right||''}</div>`).join('');
      pop.innerHTML=`<div class="ovpop-h"><span class="t">${esc(set.title)}</span><span class="c">${set.tasks.length}</span></div><div class="ovpop-list">${rows}</div>${set.tasks.length>12?`<div class="ovpop-f">+ ${set.tasks.length-12} more</div>`:''}`;
      pop.querySelectorAll('.ovpr').forEach(r=>r.onclick=()=>{ hide(); openPanel(r.dataset.id); });
      pop.classList.add('on');
      const r=elm.getBoundingClientRect(); const pw=322, ph=pop.offsetHeight;
      let left=r.left; if(left+pw>window.innerWidth-12) left=Math.max(12, window.innerWidth-pw-12);
      let top=r.bottom+8; if(top+ph>window.innerHeight-12) top=Math.max(12, r.top-ph-8);
      pop.style.left=left+'px'; pop.style.top=top+'px';
    };
  });
  if(!wireOvPops._doc){ wireOvPops._doc=true;
    document.addEventListener('click', e=>{ const p=document.getElementById('ovPop');
      if(p && p.classList.contains('on') && !e.target.closest('#ovPop') && !e.target.closest('[data-pop]')){ p.classList.remove('on'); p.dataset.src=''; } });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ const p=document.getElementById('ovPop'); if(p){ p.classList.remove('on'); p.dataset.src=''; } } });
  }
}
function renderOverview(){
  const el=document.getElementById('overviewwrap');
  const win=ovWindow(); const inWin=d=>!!d && d>=win.from && d<=win.to;
  const lenDays=Math.max(1,Math.round((new Date(win.to)-new Date(win.from))/86400000)+1);
  const pf=new Date(win.from); pf.setDate(pf.getDate()-lenDays); const pt=new Date(win.from); pt.setDate(pt.getDate()-1);
  const pFrom=_isoLocal(pf), pTo=_isoLocal(pt); const inPrev=d=>!!d && d>=pFrom && d<=pTo;
  const all = ovTasks();
  const created=all.filter(t=>inWin(t.createdAt)).length, pCreated=all.filter(t=>inPrev(t.createdAt)).length;
  const solved=all.filter(t=>inWin(t.resolvedAt)).length, pSolved=all.filter(t=>inPrev(t.resolvedAt)).length;
  const ids=all.map(t=>t.id);
  const logs=store.data.worklogs.filter(w=>ids.includes(w.task) && inWin(w.date));
  const pLogs=store.data.worklogs.filter(w=>ids.includes(w.task) && inPrev(w.date));
  const totalMin=logs.reduce((a,w)=>a+w.min,0), pMin=pLogs.reduce((a,w)=>a+w.min,0);
  const inprog=all.filter(t=>{ const s=store.status(t.status); return s&&s.cat==='inprogress'; }).length;
  const doneNow=all.filter(t=>{ const s=store.status(t.status); return s&&s.cat==='done'; }).length;
  const openNow=all.filter(t=>{ const s=store.status(t.status); return s&&s.cat==='todo'; }).length;
  const resPct=created?Math.round(solved/created*100):0, pResPct=pCreated?Math.round(pSolved/pCreated*100):0;
  const byUser={}; logs.forEach(w=>byUser[w.user]=(byUser[w.user]||0)+w.min);
  const topUsers=Object.keys(byUser).map(u=>({u,m:byUser[u]})).sort((a,b)=>b.m-a.m).slice(0,6);
  const umax=Math.max(...topUsers.map(x=>x.m),1);
  const projScope = ui.project==='all' ? store.projects() : store.projects().filter(p=>p.id===ui.project);
  const byProj=projScope.map(p=>({p, n:all.filter(t=>t.project===p.id).length})).sort((a,b)=>b.n-a.n);
  const pmax=Math.max(...byProj.map(x=>x.n),1);
  const byCat={}; logs.forEach(w=>byCat[w.cat]=(byCat[w.cat]||0)+w.min);
  const days=[]; { let d=new Date(win.from+'T00:00:00'); const end=new Date(win.to+'T00:00:00'); let g=0; while(d<=end && g<800){ days.push(_isoLocal(d)); d.setDate(d.getDate()+1); g++; } }
  const dHours=days.map(day=>logs.filter(w=>w.date===day).reduce((a,w)=>a+w.min,0)/60);
  const dCreated=days.map(day=>all.filter(t=>t.createdAt===day).length);
  const dSolved=days.map(day=>all.filter(t=>t.resolvedAt===day).length);
  const dDeployed=days.map(day=>all.filter(t=>t.deployedAt===day).length);
  const dDue=days.map(day=>all.filter(t=>t.due===day).length);
  const dOverdue=days.map(day=>all.filter(t=>t.due && t.due<day && (store.status(t.status)||{}).cat!=='done').length);
  // trailing 14-day series for KPI sparklines (independent of period, so the line always shows)
  const spDays=[]; { const _e=new Date(); for(let i=13;i>=0;i--){ const d=new Date(_e); d.setDate(d.getDate()-i); spDays.push(_isoLocal(d)); } }
  const spCreated=spDays.map(day=>all.filter(t=>t.createdAt===day).length);
  const spDeployed=spDays.map(day=>all.filter(t=>t.deployedAt===day).length);
  const spDue=spDays.map(day=>all.filter(t=>t.due===day).length);
  const spOverdue=spDays.map(day=>all.filter(t=>t.due && t.due<day && (store.status(t.status)||{}).cat!=='done').length);
  const AC='#2563EB';
  const RANGES=[['today','Today'],['week','Week'],['month','Month'],['custom','Custom']];
  const CATCLR={Development:'#D6264F','Code Review':'#B96A00',QA:'#CE2F26',Deployment:'#0E8F5A',Other:'#71717A'};
  const dH=ovDelta(totalMin,pMin), dC=ovDelta(created,pCreated), dS=ovDelta(solved,pSolved), dR=ovDelta(resPct,pResPct);
  const _today=new Date();
  const openTix=all.filter(t=>{const s=store.status(t.status); return s && s.cat!=='done';})
    .map(t=>({t, age: t.createdAt? Math.max(0,Math.floor((_today-new Date(t.createdAt))/86400000)):0}))
    .sort((a,b)=>b.age-a.age);
  const oldest=openTix.slice(0,6);
  const ageColor=a=> a>=14?'#CE2F26' : a>=7?'#B96A00' : '#0E8F5A';
  let workDays=0; { let d=new Date(win.from); const end=new Date(win.to); let g=0; while(d<=end && g<800){ const dw=d.getDay(); if(dw!==0&&dw!==6) workDays++; d.setDate(d.getDate()+1); g++; } }
  const capMin=Math.max(1, workDays*8*60);
  const capRows=topUsers.map(x=>{ const u=store.user(x.u); const util=x.m/capMin; const pct=Math.min(100,Math.round(util*100)); const c= util>1.05?'#CE2F26' : util>=.7?'#0E8F5A' : '#B96A00'; return {u,m:x.m,util,pct,c}; });
  const engBars=topUsers.length?topUsers.map(x=>{const u=store.user(x.u);return `<div class="hbar-row"><span class="nm">${avatar(u,20)}${u?esc(u.name):'—'}</span><span class="track"><span class="fill" style="width:${x.m/umax*100}%;background:${TSK_BAR}"></span></span><span class="val">${hm(x.m)}</span></div>`;}).join(''):'<p class="ov-cap">No time logged in this period.</p>';
  const _todayISO=today();
  const _nd=t=>(store.status(t.status)||{}).cat!=='done';
  const createdTix=all.filter(t=>inWin(t.createdAt)).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const overdueTix=all.filter(t=>t.due && _nd(t) && t.due<_todayISO).sort((a,b)=>a.due.localeCompare(b.due));
  const dueTodayTix=all.filter(t=>t.due===_todayISO && _nd(t));
  const deployedTix=all.filter(t=>t.deployedAt && inWin(t.deployedAt)).sort((a,b)=>(b.deployedAt||'').localeCompare(a.deployedAt||''));
  const solvedTix=all.filter(t=>(store.status(t.status)||{}).cat==='done');
  const activeTix=all.filter(t=>(store.status(t.status)||{}).cat==='inprogress');
  const openTixCat=all.filter(t=>(store.status(t.status)||{}).cat==='todo');
  const _d7=new Date(); _d7.setDate(_d7.getDate()+7); const _to7=_isoLocal(_d7);
  const upcoming=all.filter(t=>t.due && t.due>=_todayISO && t.due<=_to7 && _nd(t)).sort((a,b)=>a.due.localeCompare(b.due));
  const _asgAv=t=>{ const u=store.user(t.assignee); return u?avatar(u,22):'<span class="ov-un">Unassigned</span>'; };
  const _late=t=>Math.max(1,Math.round((new Date(_todayISO)-new Date(t.due))/86400000));
  const PRICLS={Highest:'high',High:'high',Medium:'med',Low:'low',Lowest:'low'};
  const _dueLabel=d=>{ if(d===_todayISO) return 'Today · '+fdate(d); const tm=new Date(_todayISO+'T00:00:00'); tm.setDate(tm.getDate()+1); if(d===_isoLocal(tm)) return 'Tomorrow · '+fdate(d); const wd=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(d+'T00:00:00').getDay()]; return wd+' · '+fdate(d); };

  el.innerHTML=`
    <div class="sb-hero">
      <div class="sb-lbl">Hours logged · ${win.label.toLowerCase()}</div>
      <div class="sb-big">${(totalMin/60).toFixed(0)}<span class="u">h</span></div>
      ${(dH.t!=='—'&&ui.ovRange&&ui.ovRange!=='all')?`<span class="sb-pill">${dH.t}${(dH.c==='up'||dH.c==='dn')?' vs prev '+({today:'day',week:'week',month:'month'}[ui.ovRange]||'period'):''}</span>`:''}
      <div class="sb-hero-chart">${ovArea(dHours,AC,84)}</div>
    </div>
    <div class="sb-kpis">
      <div class="sb-kpi" data-pop="created"><div class="top"><span class="l">Tickets created</span><span class="sb-dl ${dC.c}">${dC.t}</span></div><div class="v">${created}</div>${ovSpark(spCreated,'#D6264F')}</div>
      <div class="sb-kpi" data-pop="overdue"><div class="top"><span class="l">Overdue</span>${overdueTix.length?`<span class="sb-dl dn">${overdueTix.length}</span>`:'<span class="sb-dl">—</span>'}</div><div class="v" style="color:${overdueTix.length?'var(--crit)':'var(--ink)'}">${overdueTix.length}</div>${ovSpark(spOverdue,'#CE2F26')}</div>
      <div class="sb-kpi" data-pop="duetoday"><div class="top"><span class="l">Due Today</span>${dueTodayTix.length?`<span class="sb-dl" style="color:var(--warn)">${dueTodayTix.length}</span>`:'<span class="sb-dl">—</span>'}</div><div class="v" style="color:${dueTodayTix.length?'var(--warn)':'var(--ink)'}">${dueTodayTix.length}</div>${ovSpark(spDue,'#B96A00')}</div>
      <div class="sb-kpi" data-pop="deployed"><div class="top"><span class="l">Deployments</span><span class="sb-dl">—</span></div><div class="v">${deployedTix.length}</div>${ovSpark(spDeployed,'#0E8F5A')}</div>
    </div>
    <div class="sb-2">
      <div class="ov-tile"><div class="ov-gh">Aging tickets</div><p class="ov-cap">Oldest open · needs attention</p>
        ${oldest.length?oldest.map(o=>{const u=store.user(o.t.assignee);const ac=ageColor(o.age);return `<div class="age-row"><a class="age-nm" onclick="openPanel('${o.t.id}')">${esc(o.t.title)}</a><span class="age-as">${u?avatar(u,18):'<span class="age-un">Unassigned</span>'}</span><span class="age-badge" style="background:${ac}18;color:${ac}">${o.age}d</span></div>`;}).join(''):'<p class="ov-cap">No open tickets.</p>'}
      </div>
      <div class="ov-tile"><div class="ov-gh">Ticket status</div><p class="ov-cap">${all.length} tickets</p>
        <div class="ov-donut-row">${ovDonut([{v:doneNow,color:'#0E8F5A'},{v:inprog,color:'#D6264F'},{v:openNow,color:'#E7E8EC'}],all.length,'tickets',108)}
          <div class="ov-legs"><div class="ov-leg" data-pop="solved"><span class="d" style="background:#0E8F5A"></span>Solved<span class="v">${doneNow}</span></div><div class="ov-leg" data-pop="active"><span class="d" style="background:#D6264F"></span>Active<span class="v">${inprog}</span></div><div class="ov-leg" data-pop="open"><span class="d" style="background:#E7E8EC"></span>Open<span class="v">${openNow}</span></div></div></div>
      </div>
    </div>
    <div class="sb-eq">
      <div class="ov-tile"><div class="ov-gh">Upcoming due dates</div><p class="ov-cap">Next 7 days · ${upcoming.length} ticket${upcoming.length!==1?'s':''}</p>
        ${upcoming.length?(()=>{ let out=''; let cur=''; upcoming.forEach(t=>{ if(t.due!==cur){ cur=t.due; out+=`<div class="ov-due-day">${_dueLabel(t.due)}</div>`; } const pc=PRICLS[t.priority]||'low'; const pcol=pc==='high'?'var(--crit)':pc==='med'?'var(--warn)':'var(--muted)'; const pbg=pc==='high'?'var(--crit-soft)':pc==='med'?'var(--warn-soft)':'var(--surface-3)'; out+=`<div class="ov-due-row" onclick="openPanel('${t.id}')"><span class="ovkey">${esc(t.key)}</span><span class="ov-due-t">${esc(t.title)}</span><span class="ov-due-pri" style="color:${pcol};background:${pbg}">${esc(t.priority||'—')}</span></div>`; }); return out; })():'<p class="ov-cap">Nothing due in the next 7 days.</p>'}
      </div>
      <div class="ov-tile"><div class="ov-gh">Hours by category</div><p class="ov-cap">Where effort is going</p>
        <div class="ov-donut-row">${ovDonut(CATS.map(c=>({v:byCat[c.id]||0,color:CATCLR[c.id]||'#71717A'})),(totalMin/60).toFixed(0)+'h','logged',108)}
          <div class="ov-legs">${CATS.map(c=>`<div class="ov-leg"><span class="d" style="background:${CATCLR[c.id]||'#71717A'}"></span>${c.id}<span class="v">${hm(byCat[c.id]||0)}</span></div>`).join('')}</div></div>
      </div>
    </div>
    <div class="ov-tile"><div class="ov-gh">Tickets by project</div><p class="ov-cap">Volume in scope</p>
      ${byProj.map(x=>`<div class="hbar-row"><span class="nm">${esc(x.p.name)}</span><span class="track"><span class="fill" style="width:${x.n?Math.max(6,x.n/pmax*100):0}%;background:${TSK_BAR}"></span></span><span class="val">${x.n}</span></div>`).join('')||'<p class="ov-cap">No projects in scope.</p>'}
    </div>`;
  _ovSets={};
  const _mk=(title,tasks,rt)=>({title, tasks:tasks.map(t=>({t, right: rt?rt(t):''}))});
  _ovSets.created=_mk('Tickets created',createdTix,_asgAv);
  _ovSets.overdue=_mk('Overdue tickets',overdueTix,t=>`<span class="ovrt crit">${_late(t)}d late</span>`);
  _ovSets.duetoday=_mk('Due today',dueTodayTix,_asgAv);
  _ovSets.deployed=_mk('Recent deployments',deployedTix,t=>`<span class="ovrt mut">${t.deployedAt?fdate(t.deployedAt):''}</span>`);
  _ovSets.solved=_mk('Solved',solvedTix,_asgAv);
  _ovSets.active=_mk('Active',activeTix,_asgAv);
  _ovSets.open=_mk('Open',openTixCat,_asgAv);
  byProj.forEach(x=>{ _ovSets['proj:'+x.p.id]=_mk(x.p.name,all.filter(t=>t.project===x.p.id),_asgAv); });
  wireOvPops();
}

/* ---------- Team ---------- */
function renderTeam(){
  const el=document.getElementById('teamwrap');
  const teams=store.teams();
  if(!teams.length){
    el.innerHTML=`<div class="tsk-empty"><p>No teams yet. Group people together to see their workload in one place.</p>
      <button class="tsk-btn tsk-btn--sm" id="teamEmptyAdd" type="button">Create team</button></div>`;
    const mk=()=>{ const id=store.addTeam('New team'); renderTeam();
      const inp=document.querySelector(`.team-card[data-team="${id}"] .tc-name`); if(inp){ inp.focus(); inp.select(); } };
    const b1=document.getElementById('teamEmptyAdd'); if(b1) b1.onclick=mk;
    const b2=document.getElementById('newTeamBtn'); if(b2) b2.onclick=mk;
    return;
  }
  el.innerHTML=`<div class="teams-list">`+teams.map(tm=>{
    const members=store.teamMembers(tm); const ids=tm.members;
    const tasks=store.standardTasks().filter(t=>ids.includes(t.assignee));
    const open=tasks.filter(t=>(store.status(t.status)||{}).cat!=='done').length;
    const mins=store.data.worklogs.filter(w=>ids.includes(w.user)).reduce((a,w)=>a+w.min,0);
    const epics=store.epicsForTeam(tm.id);
    const avail=store.users().filter(u=>!ids.includes(u.id));
    return `<div class="team-card" data-team="${tm.id}">
      <div class="tc-head">
        <input class="tc-name" value="${esc(tm.name)}"/>
        <span class="tc-meta">${members.length} member${members.length!==1?'s':''}</span>
        <button class="tc-del" title="Delete team"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
      </div>
      <div class="tc-members">
        ${members.map(u=>`<span class="tm-chip ${tm.lead===u.id?'lead':''}" data-user="${u.id}" title="Click to set as lead">${avatar(u,20)}<span class="tm-nm">${esc(u.name)}</span>${tm.lead===u.id?'<span class="tm-lead">Lead</span>':''}<button class="tm-x" data-user="${u.id}" title="Remove from team">✕</button></span>`).join('')||'<span class="tc-empty">No members yet</span>'}
        ${avail.length?`<select class="tm-add"><option value="">+ Add developer</option>${avail.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select>`:''}
      </div>
      <div class="tc-cols">
        <div class="tc-stats">
          <div class="tc-stat"><div class="v num">${tasks.length}</div><div class="l">Tickets</div></div>
          <div class="tc-stat"><div class="v num">${open}</div><div class="l">Open</div></div>
          <div class="tc-stat"><div class="v num">${hm(mins)}</div><div class="l">Logged</div></div>
        </div>
        <div class="tc-epics">
          <div class="tc-epics-lbl">Assigned epics</div>
          <div class="tc-epics-list">${epics.length?epics.map(e=>`<button class="tc-epic" data-epic="${e.id}"><span class="col-dot" style="background:${e.color}"></span>${esc(e.title)}</button>`).join(''):'<span class="tc-empty">No epics assigned</span>'}</div>
        </div>
      </div>
    </div>`;
  }).join('')+`</div>`;
  // Create team now lives in the sticky bar (replacing Create ticket on this view)
  const _tAdd=document.getElementById('newTeamBtn');
  if(_tAdd) _tAdd.onclick=()=>{ const id=store.addTeam('New team'); renderTeam();
    const inp=document.querySelector(`.team-card[data-team="${id}"] .tc-name`); if(inp){ inp.focus(); inp.select(); } };
  el.querySelectorAll('.team-card').forEach(card=>{ const id=card.dataset.team;
    card.querySelector('.tc-name').onchange=e=>{ const v=e.target.value.trim(); if(v) store.updateTeam(id,{name:v}); else e.target.value=store.team(id).name; };
    card.querySelector('.tc-del').onclick=()=>{ store.removeTeam(id); renderTeam(); toast('Team deleted'); };
    const add=card.querySelector('.tm-add'); if(add) add.onchange=e=>{ if(e.target.value){ store.addTeamMember(id,e.target.value); renderTeam(); } };
    card.querySelectorAll('.tm-x').forEach(x=>x.onclick=e=>{ e.stopPropagation(); store.removeTeamMember(id,x.dataset.user); renderTeam(); });
    card.querySelectorAll('.tm-chip').forEach(ch=>ch.onclick=e=>{ if(e.target.closest('.tm-x')) return; store.setTeamLead(id, ch.dataset.user); renderTeam(); });
    card.querySelectorAll('.tc-epic').forEach(ep=>ep.onclick=()=>openPanel(ep.dataset.epic));
  });
}

/* ---------- Settings ---------- */
function applyBrand(){ const el=document.getElementById('wsBrand'); if(el) el.textContent='Taskora'; }
function downloadJSON(name, str){ try{ const blob=new Blob([str],{type:'application/json'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},100); toast('Data exported'); }
  catch(e){ navigator.clipboard&&navigator.clipboard.writeText(str); toast('Download blocked here — copied to clipboard'); } }
function armDanger(btn, action){ if(btn._armed){ action(); return; } btn._armed=true; const t=btn.textContent; btn.textContent='Click again to confirm'; btn.classList.add('armed');
  setTimeout(()=>{ btn._armed=false; btn.textContent=t; btn.classList.remove('armed'); },3000); }
const PERMS=['Admin','Developer','User','Viewer'];
const ROLE_DESC={
  Admin:'Full control over everything. This role can’t be restricted.',
  Developer:'Limited access — tick exactly which modules and actions developers get.',
  User:'Limited access — tick exactly which modules and actions users get.',
  Viewer:'Read-only. Tick which modules they can view; they can’t make changes.'
};
const CAP_GROUPS=[
  {g:'Views', items:[['view_board','Board'],['view_list','List'],['view_epics','Epics'],['view_overview','Overview'],['view_qa','QA & Testing'],['view_analytics','Analytics'],['view_reports','Reports'],['view_team','Team'],['view_operations','Deployments']]},
  {g:'Tickets', items:[['ticket_create','Create tickets'],['ticket_delete','Delete tickets'],['ticket_archive','Archive tickets'],['ticket_flag','Flag / unflag'],['ticket_move','Move across columns'],['ticket_copy','Copy key / link'],['ticket_link_epic','Link to epic'],['ticket_bulk','Bulk actions']]},
  {g:'Sprints & backlog', items:[['view_backlog','View backlog'],['view_sprint','View active sprint'],['view_sprint_reports','View sprint reports']].concat([['sprint_manage','Create, start & complete sprints'],['backlog_rank','Rank tickets & move them between sprints'],['field_points','Edit story points'],['field_sprint','Change a ticket\u2019s sprint']])},
  {g:'Edit ticket fields', items:[['field_title','Title'],['field_desc','Description'],['field_status','Status'],['field_priority','Priority'],['field_project','Project'],['field_start','Start date'],['field_due','Due date'],['field_estimate','Estimate'],['field_epic','Epic'],['field_resolution','Resolution'],['field_custom','Custom field values']]},
  {g:'Assign people', items:[['role_developer','Set Developer'],['role_qa','Set Quality Analyst'],['role_reviewer','Set Code Reviewer'],['role_deployer','Set Deployer'],['role_reporter','Set Reporter']]},
  {g:'View sensitive fields', items:[['see_estimate','Estimates'],['see_logged','Logged / remaining'],['see_contributors','Contributors'],['see_dates','Dates'],['see_reporter','Reporter'],['see_desc','Description'],['see_custom','Custom fields']]},
  {g:'QA & Testing', items:[['qa_manage','Add / edit test & use cases'],['qa_status','Set case Pass / Fail'],['qa_verify','QA sign-off (verify)'],['qa_attach','Upload QA attachments'],['qa_bug','Send bugs / fixes to developer'],['qa_clear','Clear QA cases & fixes']]},
  {g:'Release & environments', items:[['pr_raise','Mark PR raised'],['deploy_verify','Verify deployment'],['deploy_manage','Manage deployment tracker'],['env_block','Block a test environment'],['env_release','Release / manage environments']]},
  {g:'Time tracking', items:[['time_log_own','Log own time'],['time_log_others','Log time for others'],['time_edit','Edit time logs'],['time_delete','Delete time logs'],['time_view','View time logs']]},
  {g:'Types & priorities', items:[['type_manage','Add / edit ticket types'],['prio_manage','Add / edit priorities']]},
  {g:'Boards & workflow', items:[['board_create','Create boards'],['board_columns','Edit columns'],['board_workflow','Edit workflow rules'],['board_rename','Rename boards'],['board_delete','Delete boards']]},
  {g:'Projects', items:[['project_create','Create projects'],['project_edit','Rename / recolor'],['project_delete','Delete projects']]},
  {g:'Custom fields', items:[['cf_create','Create custom fields'],['cf_edit','Edit custom fields'],['cf_delete','Delete custom fields']]},
  {g:'Members & access', items:[['member_invite','Add / invite members'],['member_remove','Remove members'],['member_role','Change member roles'],['member_password','Reset passwords'],['access_approve','Approve / reject requests']]},
  {g:'Data & workspace', items:[['export_csv','Export CSV'],['export_json','Export JSON'],['import_data','Import data'],['key_renumber','Renumber ticket keys'],['ws_settings','Edit workspace settings'],['ws_roles','Edit roles & permissions'],['ws_danger','Danger zone (clear / reset)']]}
];
const ALL_CAPS=CAP_GROUPS.reduce((a,x)=>a.concat(x.items.map(i=>i[0])),[]);
const _setOf=(arr)=>arr.reduce((o,c)=>(o[c]=true,o),{});
const DEFAULT_ROLE_PERMS={
  Admin: _setOf(ALL_CAPS),
  Developer: _setOf(['view_backlog','view_sprint','view_sprint_reports','backlog_rank','field_points','field_sprint','mod_pm','view_board','view_list','view_epics','view_overview','view_analytics','view_reports','view_team','ticket_create','ticket_archive','ticket_flag','ticket_move','ticket_copy','ticket_link_epic','field_title','field_desc','field_status','field_priority','field_project','field_start','field_due','field_estimate','field_epic','field_resolution','field_custom','role_developer','role_qa','role_reviewer','role_deployer','role_reporter','see_estimate','see_logged','see_contributors','see_dates','see_reporter','see_desc','see_custom','time_log_own','time_log_others','time_edit','time_view','view_qa','qa_manage','qa_status','qa_verify','qa_attach','qa_bug','qa_clear','pr_raise','deploy_verify','deploy_manage','env_block','env_release','type_manage','prio_manage']),
  User: _setOf(['view_backlog','view_sprint','field_points','mod_pm','view_board','view_list','view_overview','ticket_create','ticket_flag','ticket_copy','field_status','field_custom','see_dates','see_desc','see_reporter','see_contributors','see_custom','time_log_own','time_view','view_qa','env_block']),
  Viewer: _setOf(['view_backlog','view_sprint','view_sprint_reports','mod_pm','mod_delivery','mod_products','mod_ops','view_board','view_list','view_epics','view_overview','view_analytics','view_reports','view_team','view_operations','see_estimate','see_logged','see_contributors','see_dates','see_reporter','see_desc','see_custom','time_view','view_qa'])
};
let editRole='Developer';
const DEFAULT_PROFILES=[
  {id:'pf_admin', name:'Admin', perms:_setOf(ALL_CAPS)},
  {id:'pf_users', name:'Users', perms:JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMS.Developer))}
];
const DESIGNATIONS=['Developer','QA','Designer','Lead','Analyst','PM'];
function getProfiles(){ const s=store.settings(); if(!s.profiles){ s.profiles=JSON.parse(JSON.stringify(DEFAULT_PROFILES)); store.updateSettings({profiles:s.profiles}); } return s.profiles; }
function getProfile(id){ return getProfiles().find(p=>p.id===id); }
function userProfileId(u){ if(u&&u.profile&&getProfile(u.profile)) return u.profile; return (permOf(u)==='Admin')?'pf_admin':'pf_users'; }
let permView='people';
let editProfile='pf_users';
let editUser=null;
let settingsTab='general';
let umLastMsg=null;
function permOf(u){
  if(!u) return 'User';
  if(u.master) return 'Admin';                                   // owners
  if(u.toolRole) return u.toolRole==='admin' ? 'Admin' : 'User'; // mirrored from profiles.role
  return u.perm || (u.role==='PM'?'Admin' : u.role==='Developer'?'Developer' : u.role==='Viewer'?'Viewer' : 'User');
}
function resetPassword(email){ if(!email){ toast('No email on file for this member'); return; }
  if(typeof sb!=='undefined' && sb && sb.auth && sb.auth.resetPasswordForEmail){
    sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin+location.pathname }).then(()=>toast('Password reset link sent to '+email)).catch(()=>toast('Couldn’t send reset link')); }
  else { toast('Password reset link sent to '+email); } }
/* Owner comes from profiles.role — the database is the only source of truth,
   and the admin-users Edge Function is the only way to set it.
   This list is a bootstrap escape hatch for a brand-new deployment where no
   profile carries the flag yet; leave it empty in normal operation. */
const MASTER_EMAILS=[];   // unused bootstrap hook, kept so older callers don't break
function isMasterUser(u){ if(!u) return false; if(u.master===true||u.masterAdmin===true) return true; const e=(u.email||'').toLowerCase(); return MASTER_EMAILS.indexOf(e)!==-1; }
function pmRole(u){ if(isMasterUser(u)) return {label:'Owner', cls:'r-master'}; if(userProfileId(u)==='pf_admin') return {label:'Admin', cls:'r-admin'}; return {label:'User', cls:'r-user'}; }
const STX_FGROUPS=[
  {g:'Ticket fields', note:'Core issue attributes on the card and detail panel.', items:[
    ['summary','Summary / title','shown on every card'],['desc','Description',''],['type','Type','Task, Bug, Story, Epic'],
    ['status','Status','move across columns'],['priority','Priority',''],['resolution','Resolution',''],
    ['project','Project',''],['epic','Epic / parent','']]},
  {g:'Schedule & effort', note:'', items:[
    ['start','Start date',''],['due','Due date',''],['estimate','Original estimate',''],['points','Story points',''],['sprint','Sprint',''],['logged','Logged / remaining','time tracked']]},
  {g:'People & roles', note:'', items:[
    ['assignee','Assignee (Developer)',''],['reporter','Reporter',''],['qa','Quality Analyst',''],['reviewer','Code Reviewer',''],['deployer','Deployer','']]},
  {g:'Collaboration & meta', note:'', items:[
    ['comments','Comments',''],['subtasks','Subtasks',''],['worklogs','Worklogs','time entries'],['contributors','Contributors',''],['attachments','Attachments',''],['custom','Custom fields','all custom values']]},
];
const STX_FALL=STX_FGROUPS.reduce((a,g)=>a.concat(g.items.map(i=>i[0])),[]);
const STX_MODS=[['view_board','Board'],['view_backlog','Backlog'],['view_sprint','Active sprint'],['view_sprint_reports','Sprint reports'],['view_list','List'],['view_epics','Epics'],['view_overview','Overview'],['view_qa','QA & Testing'],['view_analytics','Analytics'],['view_reports','Reports'],['view_team','Team'],['view_operations','Deployments']];
const STX_ACTIONS=[
  {g:'Sprints & backlog', items:[['sprint_manage','Create, start & complete sprints'],['backlog_rank','Rank tickets & move them between sprints'],['field_points','Edit story points'],['field_sprint','Change a ticket\u2019s sprint']]},
  {g:'Tickets', items:[['ticket_create','Create tickets'],['ticket_delete','Delete tickets'],['ticket_archive','Archive tickets'],['ticket_flag','Flag / unflag'],['ticket_move','Move across columns'],['ticket_copy','Copy key / link'],['ticket_link_epic','Link to epic'],['ticket_bulk','Bulk actions']]},
  {g:'Assign people', items:[['role_developer','Set Developer'],['role_qa','Set Quality Analyst'],['role_reviewer','Set Code Reviewer'],['role_deployer','Set Deployer'],['role_reporter','Set Reporter']]},
  {g:'QA & Testing', items:[['qa_manage','Add / edit test & use cases'],['qa_status','Set case Pass / Fail'],['qa_verify','QA sign-off (verify)'],['qa_attach','Upload QA attachments'],['qa_bug','Send bugs / fixes to developer'],['qa_clear','Clear QA cases & fixes']]},
  {g:'Release & environments', items:[['pr_raise','Mark PR raised'],['deploy_verify','Verify deployment'],['deploy_manage','Manage deployment tracker'],['env_block','Block a test environment'],['env_release','Release / manage environments']]},
  {g:'Time tracking', items:[['time_log_own','Log own time'],['time_log_others','Log time for others'],['time_edit','Edit time logs'],['time_delete','Delete time logs'],['time_view','View time logs']]},
  {g:'Types & priorities', items:[['type_manage','Add / edit ticket types'],['prio_manage','Add / edit priorities']]},
  {g:'Boards & workflow', items:[['board_create','Create boards'],['board_columns','Edit columns'],['board_workflow','Edit workflow rules'],['board_rename','Rename boards'],['board_delete','Delete boards']]},
  {g:'Projects', items:[['project_create','Create projects'],['project_edit','Rename / recolour'],['project_delete','Delete projects']]},
  {g:'Custom fields', items:[['cf_create','Create custom fields'],['cf_edit','Edit custom fields'],['cf_delete','Delete custom fields']]},
  {g:'Members & access', items:[['member_invite','Add / invite members'],['member_remove','Remove members'],['member_role','Change member roles'],['member_password','Reset passwords'],['access_approve','Approve / reject requests']]},
  {g:'Data & workspace', items:[['export_csv','Export CSV'],['export_json','Export JSON'],['import_data','Import data'],['key_renumber','Renumber ticket keys'],['ws_settings','Edit workspace settings'],['ws_roles','Edit roles & permissions'],['ws_danger','Danger zone (clear / reset)']]},
];
const STX_EYE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const STX_EYEOFF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.44M6.6 6.6C3.6 8.3 2 11 2 11s3.5 7 10 7a9 9 0 0 0 3.9-.88M1 1l22 22"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
const STX_PEN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
function stxSeg(fk, st){ const b=(v,cls,ic,l)=>`<button class="${st===v?'on '+cls:''}" data-fp="${fk}" data-v="${v}">${ic}${l}</button>`;
  return `<div class="stx-seg">${b('hide','hide',STX_EYEOFF,'Hide')}${b('read','read',STX_EYE,'Read')}${b('edit','edit',STX_PEN,'Edit')}</div>`; }

/* Accounts live in `profiles`; the board works with `people`. A member added
   under Members would otherwise be missing from Access & permissions until
   they first sign in. Mirror them across so an admin can set someone's
   permissions — and assign them tickets — before they ever log in. */
let _suiteSynced=false;
async function syncSuitePeople(){
  if(!(typeof sb!=='undefined' && sb) || typeof IS_ADMIN==='undefined' || !IS_ADMIN) return false;
  try{
    const [pr] = await Promise.all([
      sb.from('profiles').select('id, full_name, first_name, last_name, email, role, avatar_url, status')
    ]);
    if(pr.error) return false;
    const have=store.users(); const rows=[];
    (pr.data||[]).forEach(p=>{
      const master=p.role==='owner', r=(p.role==='member'?'user':'admin');
      const deactivated=(p.status==='deactivated');
      const em=(p.email||'').toLowerCase();
      if(typeof ME!=='undefined' && ME && p.id===ME.id){ ME_AVATAR = p.avatar_url||null; if(p.avatar_url){ try{ dpSet(p.email, p.avatar_url); }catch(e){} } }
      const existing=have.find(u=>u.authId===p.id || (u.email && em && u.email.toLowerCase()===em));
      // Deactivated (offboarded): keep them on tickets they already own, but mark them
      // so the assignee/reporter pickers hide them. Never create a new row for them.
      if(deactivated){
        if(existing && existing.status!=='deactivated'){ existing.status='deactivated'; rows.push({workspace_id:WS, id:existing.id, doc:existing}); }
        return;
      }
      if(existing){
        // Re-sync the role from profiles. Without this, a person carrying the old
        // perm:'Admin' would keep admin capabilities even after being set to User.
        const want=(r||(master?'admin':'user'));
        const wantPhoto = p.avatar_url || null;
        const wasDeact = existing.status==='deactivated';
        if(existing.toolRole!==want || !!existing.master!==master || (existing.photo||null)!==wantPhoto || wasDeact){
          existing.toolRole=want; existing.master=master;
          existing.perm = (master||want==='admin') ? 'Admin' : 'User';
          existing.profile = (master||want==='admin') ? 'pf_admin' : 'pf_users';
          if(wantPhoto) existing.photo=wantPhoto; else delete existing.photo;
          if(wasDeact) existing.status='active';
          rows.push({workspace_id:WS, id:existing.id, doc:existing});
        }
        return;
      }
      const nm=p.full_name || (p.email||'').split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) || 'Teammate';
      const isAdmin = master || r==='admin';
      const doc={ id:'u_'+String(p.id).slice(0,8), name:nm, first_name:p.first_name||'', last_name:p.last_name||'', email:p.email||'', authId:p.id,
        role:isAdmin?'PM':'Developer', perm:isAdmin?'Admin':'User', toolRole:(r||(master?'admin':'user')),
        profile:isAdmin?'pf_admin':'pf_users', master:master, status:'active',
        color:SWATCHES[((have.length+rows.length)*2)%SWATCHES.length], prefs:{} };
      if(p.avatar_url) doc.photo=p.avatar_url;
      rows.push({workspace_id:WS, id:doc.id, doc});
      store.data.users.push(doc);
    });
    if(!rows.length) return false;
    const {error}=await pmdb.from('people').upsert(rows);
    if(error){ __dbg.warn('people sync failed', error.message); return false; }
    buildSnap();
    return true;
  }catch(e){ __dbg.warn('people sync failed', e); return false; }
}

/* ---------- Copy a teammate's setup ----------
   Field permissions + capabilities + workspace access, staged like every other
   Settings edit so nothing lands until Save. The PM role is deliberately NOT
   copied: cloning from an admin should never silently make someone an admin. */
function cloneUserSetup(fromId, toId){
  const s=store.settings();
  const src=store.user(fromId), dst=store.user(toId);
  if(!src||!dst) return null;

  // 1. field permissions — fall back to the source's role defaults if unset
  const sf=(s.fieldPerms&&s.fieldPerms[fromId])||{};
  const fp=Object.assign({}, s.fieldPerms||{});
  const rec={}; STX_FALL.forEach(k=>{ rec[k]=sf[k]||'edit'; });
  fp[toId]=rec;

  // 2. capabilities
  const su=(s.userPerms&&s.userPerms[fromId]) || DEFAULT_ROLE_PERMS[permOf(src)] || {};
  const up=Object.assign({}, s.userPerms||{});
  up[toId]=JSON.parse(JSON.stringify(su));

  Object.assign(s, {fieldPerms:fp, userPerms:up});

  // 3. workspace access — match the source, space by space
  let wsAdd=0, wsRem=0;
  store.spaces().forEach(sp=>{
    const m=new Set(sp.members||[]);
    const srcIn=m.has(fromId), dstIn=m.has(toId);
    if(srcIn && !dstIn){ m.add(toId); wsAdd++; }
    else if(!srcIn && dstIn){ m.delete(toId); wsRem++; }
    else return;
    store.updateSpace(sp.id,{members:[...m]});
  });

  setMarkDirty();
  return { fields:Object.keys(rec).length, caps:Object.keys(up[toId]).length, wsAdd, wsRem };
}

function renderSettings(){
  if(!_inRenderAll){ try{ urlSync(); }catch(e){} }   // in-page section change → reflect in URL
  if(IS_ADMIN && !_suiteSynced){ _suiteSynced=true;
    syncSuitePeople().then(added=>{ if(added && ui.view==='settings') renderSettings(); }); }
  const el=document.getElementById('settingswrap'); const s=store.settings();
  const umUsers=store.users(); const muser=meUser()||{}; const pr=muser.prefs||{}; const notif=pr.notify||{}; const N=Object.assign({},NOTIF_DEFAULTS,notif);
  if(editUser && !umUsers.some(u=>u.id===editUser)) editUser=null;   // start on None; never auto-select

  const opt=(v,l,cur)=>`<option value="${v}" ${String(cur)===String(v)?'selected':''}>${esc(l)}</option>`;
  const psel=(id,label,pairs,cur)=>`<div class="stx-row"><div class="fn">${esc(label)}</div><select class="stx-sel" data-pref="${id}">${pairs.map(([v,l])=>opt(v,l,cur)).join('')}</select></div>`;
  const ptgl=(id,label,on)=>`<div class="stx-row"><div class="fn">${esc(label)}</div><button class="stx-tgl ${on?'on':''}" data-pref="${id}"></button></div>`;
  const ptglS=(id,label,sub,on)=>`<div class="stx-row"><div><div class="fn">${esc(label)}</div>${sub?`<div class="fs">${esc(sub)}</div>`:''}</div><button class="stx-tgl ${on?'on':''}" data-pref="${id}"></button></div>`;
  const ptime=(id,cur)=>`<input type="time" class="stx-time" data-pref="${id}" value="${esc(cur||'')}"/>`;
  const boardPairs=store.boards().map(b=>[b.id,b.name]);
  const projPairs=[['all','All projects']].concat(store.projects().map(p=>[p.id,p.name]));
  const catPairs=CATS.map(c=>[c.id,c.id]);

  const secPrefs=`
    <div class="stx-sec">
      <div class="stx-card"><div class="stx-card-h">Defaults</div>
        ${psel('defaultView','Default view on open',[['board','Board'],['overview','Overview'],['list','List'],['epics','Epics'],['analytics','Analytics'],['reports','Reports']], pr.defaultView||s.defaultView||'board')}
        ${psel('defaultBoard','Default board', boardPairs, pr.defaultBoard||s.defaultBoard||(boardPairs[0]||[''])[0])}
        ${psel('defaultProject','Default project filter', projPairs, pr.defaultProject||'all')}
        ${psel('startScreen','Start screen',[['last','Last visited'],['board','Board'],['overview','Overview']], pr.startScreen||'last')}
      </div>
      <div class="stx-card"><div class="stx-card-h">Display</div>
        ${psel('dateFmt','Date format',[['dmy','31 Jul 2026'],['mdy','Jul 31, 2026'],['iso','2026-07-31']], pr.dateFmt||'dmy')}
        ${psel('density','Density',[['comfortable','Comfortable'],['compact','Compact']], pr.density||'comfortable')}
        ${psel('weekStart','First day of week',[['sun','Sunday'],['mon','Monday']], pr.weekStart||'sun')}
        ${psel('pageSize','List rows per page',[['25','25'],['50','50'],['100','100']], pr.pageSize||'25')}
        ${ptgl('showWeekends','Show weekends on calendar', pr.showWeekends!==false)}
        ${ptgl('hlOverdue','Highlight overdue tickets', pr.hlOverdue!==false)}
      </div>
      </div>`;

  const secNotif=`
    <div class="stx-sec">
      <div id="notifPrefAnchor" class="stx-card"><div class="stx-card-h">General</div>
        ${ptglS('notify.enabled','Enable notifications','Master switch for the bell and all alerts below', N.enabled!==false)}
        ${ptgl('notify.badge','Show unread count on bell', N.badge!==false)}
        ${ptglS('notify.sound','Play a sound for new alerts','Only while the app is open', !!N.sound)}
        ${ptgl('notify.desktop','Desktop pop-up (browser)', !!N.desktop)}
      </div>
      <div class="stx-card"><div class="stx-card-h">Notify me about</div>
        ${ptgl('notify.assigned','Assigned to me', N.assigned!==false)}
        ${ptgl('notify.unassigned','Unassigned / reassigned from me', N.unassigned!==false)}
        ${ptgl('notify.roles','Added as QA / Reviewer / Deployer', N.roles!==false)}
        ${ptgl('notify.mentions','Mentions (@me)', N.mentions!==false)}
        ${ptglS('notify.replies','Comment replies',"On tickets I'm on or reported", N.replies!==false)}
        ${ptglS('notify.status','Status changes',"On tickets I'm involved in", N.status!==false)}
        ${ptgl('notify.priority','Priority changes', !!N.priority)}
        ${ptgl('notify.flagged','Ticket flagged / blocked', N.flagged!==false)}
        ${ptgl('notify.resolved','My ticket resolved / closed', N.resolved!==false)}
        ${ptgl('notify.newInProject','New ticket in my project', !!N.newInProject)}
      </div>
      <div class="stx-card"><div class="stx-card-h">Due dates</div>
        ${ptgl('notify.dueSoon','Due-soon reminders', N.dueSoon!==false)}
        ${psel('notify.remindBefore','Remind me',[['1','1 day before'],['2','2 days before'],['3','3 days before'],['7','1 week before']], String(N.remindBefore||2))}
        ${ptgl('notify.overdue','Overdue alerts', N.overdue!==false)}
      </div>
      <div class="stx-card"><div class="stx-card-h">Scope</div>
        ${ptglS('notify.onlyAssigned','Only tickets assigned to me',"Off = anything I'm involved in", !!N.onlyAssigned)}
        ${ptgl('notify.onlyMyProjects','Only my projects', !!N.onlyMyProjects)}
        ${ptglS('notify.quiet','Quiet hours','Mute alerts during this window', !!N.quiet)}
        <div class="stx-row"><div class="fn">Quiet from → to</div><div style="display:flex;align-items:center;gap:8px">${ptime('notify.quietFrom',N.quietFrom)}<span style="color:var(--faint)">→</span>${ptime('notify.quietTo',N.quietTo)}</div></div>
        ${ptgl('notify.weekends','Notify on weekends', N.weekends!==false)}
      </div>
      <div class="stx-card"><div class="stx-card-h">Housekeeping</div>
        ${ptglS('notify.autoRead','Auto-mark read on open','Clear a notification when I open its ticket', N.autoRead!==false)}
        ${ptgl('notify.group','Group into New / Earlier', N.group!==false)}
        ${psel('notify.keepDays','Keep notifications for',[['7','7 days'],['30','30 days'],['90','90 days']], String(N.keepDays||30))}
      </div>
      <div class="stx-card"><div class="stx-card-h">Email</div>
        ${ptglS('notify.digest','Daily digest email','Saved only — no email backend to send it', !!N.digest)}
      </div>
      </div>`;

  const secTime=`
    <div class="stx-sec">
      <div class="stx-card"><div class="stx-card-h">Time &amp; tracking</div>
        ${psel('logCat','Default log category', catPairs, pr.logCat||'Development')}
        ${psel('hoursPerDay','Working hours per day',[['8','8h'],['7','7h'],['6','6h']], pr.hoursPerDay||'8')}
        ${psel('tz','Time zone',[['Asia/Kolkata','Asia/Kolkata (IST)'],['UTC','UTC'],['America/New_York','America/New_York']], pr.tz||'Asia/Kolkata')}
        ${ptgl('autoAssign','Auto-assign me on create', !!pr.autoAssign)}
        ${ptgl('logOthers','Can log time for others', !!pr.logOthers)}
      </div>
    </div>`;

  let access='';
  if(IS_ADMIN){
    const eu=editUser?store.user(editUser):null;
    if(!eu){
      access=`<div class="stx-sec">
        <div class="stx-head empty"><div class="stx-av-none"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></div>
          <div class="stx-id"><div class="ph">No teammate selected</div><div class="ph-s">Choose someone to manage their access &amp; field permissions</div></div>
          <div class="stx-pick pulse"><select id="stxUser"><option value="" selected>Select a teammate…</option>${umUsers.filter(u=>u.id!==CURRENT_UID).map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div></div>
        <div class="stx-notice"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>Select a teammate above to manage their access and field-level Read / Edit / Hide permissions.</div>
        <div class="stx-empty"><div class="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          <h3>Pick a teammate to begin</h3><p>Their field-level Read / Edit / Hide permissions and workspace access will appear here.</p></div>
      </div>`;
    } else {
      // Their role comes from profiles.role (mirrored onto the person record by
      // syncSuitePeople). Owners are managed under Members.
      const euMaster=isMasterUser(eu)||!!eu.master;
      const isAdm=euMaster||eu.toolRole==='admin'||permOf(eu)==='Admin';
      const roleLbl=euMaster?'Owner':(isAdm?'Admin':'Member');
      const fp=Object.assign({}, (s.fieldPerms&&s.fieldPerms[editUser])||{}); STX_FALL.forEach(k=>{ if(!fp[k]) fp[k]='edit'; });
      // seed this teammate's capability record from their role defaults on first view (so toggles reflect a sensible baseline and merges are safe)
      let up=(s.userPerms&&s.userPerms[editUser]);
      if(!up){ up=JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMS[permOf(eu)]||{})); const base=Object.assign({}, s.userPerms||{}); base[editUser]=up; store.updateSettings({userPerms:base}); }
      const sps=store.spaces();
      const dim=isAdm?' style="opacity:.5;pointer-events:none"':'';
      const fieldBlocks=STX_FGROUPS.map(g=>`<div class="stx-lbl">${g.g}</div>${g.note?`<div class="stx-note">${g.note}</div>`:''}<div class="stx-card">${g.items.map(([k,l,sub])=>`<div class="stx-row"><div><div class="fn">${esc(l)}</div>${sub?`<div class="fs">${sub}</div>`:''}</div>${stxSeg(k,fp[k])}</div>`).join('')}</div>`).join('');
      const actionBlocks=STX_ACTIONS.map(g=>`<div class="stx-lbl">${g.g}</div><div class="stx-card"><div class="stx-mods">${g.items.map(([cap,l])=>`<div class="stx-row"><div class="fn">${l}</div><button class="stx-tgl stx-mod ${up[cap]?'on':''}" data-cap="${cap}"></button></div>`).join('')}</div></div>`).join('');
      const modBlocks=`<div class="stx-lbl">Views &amp; modules</div><div class="stx-note">Which tabs this teammate can open.</div><div class="stx-card"><div class="stx-mods">${STX_MODS.map(([cap,l])=>`<div class="stx-row"><div class="fn">${l}</div><button class="stx-tgl stx-mod ${up[cap]?'on':''}" data-cap="${cap}"></button></div>`).join('')}</div></div>`;
      const wsBlocks=`<div class="stx-lbl">Visible workspaces</div><div class="stx-card">${sps.length?sps.map(sp=>`<div class="stx-row"><div class="fn">${esc(sp.name)}</div><button class="stx-tgl stx-ws ${(sp.members||[]).includes(editUser)?'on':''}" data-ws="${sp.id}"></button></div>`).join(''):'<div class="stx-note" style="padding:12px 0">No workspaces yet.</div>'}</div>`;
      access=`<div class="stx-sec">
        <div class="stx-head">${avatar(eu,48)}<div class="stx-id"><div class="nm">${esc(eu.name)}</div><div class="em">${esc(eu.email||'—')}</div></div><span class="stx-role">${roleLbl}</span>
          <div class="stx-pick"><select id="stxUser"><option value="">Select a teammate…</option>${umUsers.filter(u=>u.id!==CURRENT_UID).map(u=>`<option value="${u.id}" ${u.id===editUser?'selected':''}>${esc(u.name)}</option>`).join('')}</select></div></div>
        <div class="stx-card pad"><div style="display:flex;align-items:center;justify-content:space-between;gap:14px"><div><div class="stx-acc-t">Workspace role</div><div class="stx-acc-d">${euMaster
          ? 'This teammate is an <b>Owner</b>. They see and manage everything, including other admins. Change owners under Members.'
          : '<b>Admin</b> manages every workspace here and bypasses the limits below. <b>User</b> gets exactly what you grant. Owners are set under Members.'}</div></div>
        ${euMaster?'<span class="stx-rolechip master">Owner</span>'
          :`<div class="stx-roleseg"><button type="button" class="${isAdm?'':'on'}" data-role="user">User</button><button type="button" class="${isAdm?'on':''}" data-role="admin">Admin</button></div>`}</div></div>
        ${euMaster?'':`<div class="stx-card pad stx-clone">
          <div class="stx-clone-l"><div class="stx-acc-t">Copy setup from a teammate</div>
            <div class="stx-acc-d">Brings across their <b>field permissions</b>, <b>actions</b> and <b>workspace access</b> in one go.
              The workspace role above is left alone \u2014 set that deliberately.</div></div>
          <div class="stx-clone-r">
            <select id="stxCloneFrom"><option value="">Choose a teammate\u2026</option>${
              umUsers.filter(u=>u.id!==editUser).map(u=>`<option value="${u.id}">${esc(u.name)}${isMasterUser(u)||u.master?' (Owner)':(u.toolRole==='admin'?' (Admin)':'')}</option>`).join('')}</select>
            <button class="tsk-btn tsk-btn--sm" id="stxCloneGo" type="button">Copy</button>
          </div></div>`}
        <div${dim}>${wsBlocks}
          ${modBlocks}
          <div class="stx-lbl" style="margin-top:20px">Actions</div><div class="stx-note">What this teammate can do across the Hub.</div>${actionBlocks}
          <div class="stx-lbl" style="margin-top:20px">Field permissions</div><div class="stx-note">Per-field visibility on the card and detail panel.</div>
          <div class="stx-bulk"><span class="lbl">Quick set all fields</span><button class="stx-mini" data-bulk="hide">Hide</button><button class="stx-mini" data-bulk="read">Read</button><button class="stx-mini" data-bulk="edit">Edit</button><span class="sp"></span><button class="stx-ghost" data-bulk="edit">Reset to full access</button></div>
          ${fieldBlocks}</div>
        ${isAdm?'<div class="stx-note" style="margin-top:12px">Admins bypass every limit below — set the role to <b>User</b> to restrict specific fields.</div>':''}
      </div>`;
    }
  }

  const secData=IS_ADMIN?`
    <div class="stx-sec">
      <div class="set-actions" style="margin-top:10px">
        <button class="btn" id="setExport">Export data (JSON)</button>
        <button class="btn" id="setExportCsv">Export tickets (CSV)</button>
        <button class="btn" id="setImport">Import data (JSON)</button>
        <input type="file" id="setImportFile" accept="application/json" style="display:none"/>
      </div>
      <div class="stx-card stx-pad" style="margin-top:18px"><div class="stx-card-h">Ticket keys</div>
        <p class="bs-note" style="margin:0 0 12px">Keys are per project \u2014 <b>LMS-1</b>, <b>PAY-1</b>. If older tickets were numbered another way, renumber them to match. Export a backup first.</p>
        <button class="tsk-btn tsk-btn--sm" id="setRenumber" type="button">Renumber ticket keys\u2026</button>
      </div>
      <div class="stx-card stx-pad" style="margin-top:14px"><div class="stx-card-h">Workflow</div>
        <p class="bs-note" style="margin:0 0 12px">Adds the default delivery flow \u2014 Backlog, Ready, In Development, Code Review, QA Testing, Ready to Deploy, Done \u2014 and a board showing all of them. Use this on a workspace that has no columns yet. Existing statuses are left alone.</p>
        <button class="tsk-btn tsk-btn--sm" id="setProvision" type="button">Set up default workflow</button>
      </div>
    </div>`:'';

  const secDanger=IS_ADMIN?`
    <div class="stx-sec">
      <div class="set-danger" style="margin-top:10px">
        <div class="sd-row"><div><div class="sd-t">Clear all tickets</div><div class="sd-d">Removes every ticket and worklog. Keeps projects, statuses, boards and teams.</div></div><button class="btn danger" id="setClear">Clear tickets</button></div>
        <div class="sd-row"><div><div class="sd-t">Reset to sample data</div><div class="sd-d">Restores the original demo dataset. Everything you changed is lost.</div></div><button class="btn danger" id="setReset">Reset</button></div>
        ${(typeof sb!=='undefined' && sb)?`<div class="sd-row"><div><div class="sd-t">Wipe workspace (server)</div><div class="sd-d">Permanently deletes every ticket, worklog, project, team and user from the database, then rebuilds an empty workspace with just you. Cannot be undone.</div></div><button class="btn danger" id="setWipe">Wipe all</button></div>`:''}
      </div>
    </div>`:'';

  // One long scroll was hard to navigate — same rail + detail shape as
  // Projects / Epics / the dashboards, one section at a time.
  const _me=meUser()||{};
  const _mePhoto=_me.photo||'';
  const secProfile=`
    <div class="stx-sec">
      <div class="stx-card stx-pad"><div class="stx-card-h">Profile photo</div>
        <div class="pf-photo">
          <div class="pf-av" id="pfAv">${_mePhoto?`<img src="${_mePhoto}" alt="${esc(_me.name||'')}">`:ACCT_GLYPH}</div>
          <div class="pf-pmeta">
            <div class="pf-pt">${esc(_me.name||'Your photo')}</div>
            <div class="pf-ps">Shown on your tickets, board cards, comments and across the workspace.<br>JPG or PNG, square works best \u00b7 up to 2 MB.</div>
            <div class="pf-pact">
              <button class="tsk-btn tsk-btn--sm" id="pfUpload" type="button">${_mePhoto?'Change photo':'Upload photo'}</button>
              ${_mePhoto?'<button class="pf-rm" id="pfRemove" type="button">Remove</button>':''}
            </div>
          </div>
        </div>
      </div>
      <div class="stx-card"><div class="stx-card-h">Your details</div>
        <div class="stx-row"><div class="fn">Display name</div><input class="stx-inp" id="pfName" value="${esc(_me.name||'')}" placeholder="Your name"></div>
        <div class="stx-row"><div class="fn">Email</div><div class="stx-ro">${esc(_me.email||'\u2014')}</div></div>
        <div class="stx-row"><div class="fn">Role</div><div class="stx-ro">${esc((typeof pmRole==='function'&&pmRole(_me).label)||_me.role||'Member')}</div></div>
      </div>
    </div>`;
  const SETSECS=[
    {k:'profile', n:'My profile',   d:'Your photo, name and account details',  html:secProfile},
    {k:'prefs',  n:'Preferences',   d:'Defaults, display and time tracking', html:secPrefs+secTime},
    {k:'notif',  n:'Notifications', d:'What you get told about',             html:secNotif},
  ];
  if(IS_ADMIN){
    SETSECS.push({k:'access', n:'Access & permissions', d:'Per-teammate access and field control', html:access});
    SETSECS.push({k:'data',   n:'Data',                 d:'Export and import',                     html:secData});
    SETSECS.push({k:'danger', n:'Danger zone',          d:'Destructive actions \u2014 these cannot be undone', html:secDanger, danger:true});
  }
  if(!ui.setSel || !SETSECS.find(x=>x.k===ui.setSel)) ui.setSel=SETSECS[0].k;
  const curSec=SETSECS.find(x=>x.k===ui.setSel);
  const setRail=SETSECS.map(x=>`<button type="button" class="tsk-li${x.danger?' is-danger':''}" data-sec="${x.k}" aria-current="${ui.setSel===x.k}">
      <span class="tsk-li-n">${esc(x.n)}</span></button>`).join('');

  const canSave = curSec.k!=='data' && curSec.k!=='danger';
  el.innerHTML=`<div class="tsk-page-head"><h1>Settings</h1></div>
    <div class="tsk-pane">
      <aside class="tsk-rail"><nav class="tsk-rail-list" id="setRail" style="padding-top:10px">${setRail}</nav></aside>
      <section class="tsk-detail">
        <div class="tsk-d-head"><div><h2${curSec.danger?' style="color:var(--crit)"':''}>${esc(curSec.n)}</h2>
          <p class="tsk-d-sub">${esc(curSec.d)}</p></div>
          ${canSave?`<div style="display:flex;align-items:center;gap:8px">
            <span class="bs-dirty ${_setDirty?'on':''}" id="setDirty">Unsaved changes</span>
            <button class="tsk-btn tsk-btn--ghost tsk-btn--sm" id="setDiscard" type="button" ${_setDirty?'':'style="display:none"'}>Discard</button>
            <button class="tsk-btn tsk-btn--sm" id="setSave" type="button" ${_setDirty?'':'disabled'}>Save changes</button>
          </div>`:''}</div>
        ${curSec.html}
      </section>
    </div>`;
  el.querySelectorAll('#setRail .tsk-li').forEach(b=>b.onclick=()=>{ ui.setSel=b.dataset.sec; renderSettings(); });
  { const up=document.getElementById('pfUpload'); if(up) up.onclick=()=>openPhotoPicker();
    const rm=document.getElementById('pfRemove'); if(rm) rm.onclick=()=>{ const u=meUser(); if(!u) return;
      confirmDelete({ title:'Remove photo', lead:'Remove your profile photo? Your initials will show instead.',
        confirmLabel:'Remove photo', warn:'',
        onConfirm:async()=>{
          try{
            if(typeof sb!=='undefined' && sb && ME) await removeAvatar();
          }catch(err){ toast('Couldn\u2019t remove the photo: '+((err&&err.message)||'error')); return; }
          try{ dpSet(u.email, null); }catch(e){}
          store.setUserPhoto(u.id,null); applyMyPhoto(); renderSettings(); refreshViews(); toast('Photo removed');
        } }); };
    const nmi=document.getElementById('pfName'); if(nmi) nmi.onchange=()=>{ const u=meUser(); if(!u) return; const v=nmi.value.trim();
      if(!v){ nmi.value=u.name||''; return; } store.updateUser(u.id,{name:v}); applyMyPhoto(); renderSettings(); refreshViews(); toast('Name updated'); }; }
  const _cg=document.getElementById('stxCloneGo');
  if(_cg) _cg.onclick=()=>{
    const from=document.getElementById('stxCloneFrom').value;
    if(!from){ toast('Pick who to copy from'); return; }
    const src=store.user(from), dst=store.user(editUser);
    confirmDelete({ title:'Copy setup',
      lead:`Copy <b>${esc(src.name)}</b>\u2019s field permissions, actions and workspace access onto <b>${esc(dst.name)}</b>? This replaces ${esc(dst.name)}\u2019s current setup. Their workspace role is not changed.`,
      confirmLabel:'Copy & replace', tone:'primary',
      warn:'Nothing is applied until you press Save \u2014 you can still Discard.',
      onConfirm:()=>{
        const r=cloneUserSetup(from, editUser);
        if(!r){ toast('Could not copy that setup'); return; }
        renderSettings();
        const bits=[r.fields+' fields', r.caps+' actions'];
        if(r.wsAdd||r.wsRem) bits.push((r.wsAdd?'+'+r.wsAdd:'')+(r.wsAdd&&r.wsRem?'/':'')+(r.wsRem?'-'+r.wsRem:'')+' workspaces');
        toast('Copied from '+src.name+' \u00b7 '+bits.join(', ')+' \u2014 Save to apply');
      } });
  };
  const _ss=document.getElementById('setSave'); if(_ss) _ss.onclick=setSaveNow;
  const _sd=document.getElementById('setDiscard'); if(_sd) _sd.onclick=()=>confirmDelete({ title:'Discard changes',
    lead:'Discard your unsaved changes? Everything goes back to the last saved state.',
    confirmLabel:'Discard changes', warn:'', onConfirm:setDiscard });

  const _g=id=>document.getElementById(id);
  // preferences wiring (current user)
  el.querySelectorAll('[data-pref]').forEach(node=>{
    const path=node.dataset.pref;
    const setVal=v=>{ const u=meUser(); if(!u) return; u.prefs=u.prefs||{}; const parts=path.split('.'); let o=u.prefs; for(let i=0;i<parts.length-1;i++){ o[parts[i]]=o[parts[i]]||{}; o=o[parts[i]]; }
      o[parts[parts.length-1]]=v; setMarkDirty(); };   /* saved on Save, not on every keystroke */
    if(node.classList.contains('stx-tgl')){ node.onclick=()=>{ node.classList.toggle('on'); setVal(node.classList.contains('on')); applyPrefs(); renderAll(); }; }
    else if(node.tagName==='SELECT'){ node.onchange=()=>{ setVal(node.value); applyPrefs(); renderAll(); }; }
    else if(node.tagName==='INPUT'){ node.onchange=()=>{ setVal(node.value); applyPrefs(); if(typeof updateBell==='function') updateBell(); }; }
  });
  // teammate picker
  if(_g('stxUser')) _g('stxUser').onchange=e=>{ editUser=e.target.value||null; renderSettings(); };
  // Workspace role. Staged here, written by the admin-users Edge Function on
  // Save — it can set 'admin' or 'member' from this screen, never Owner.
  el.querySelectorAll('.stx-roleseg button').forEach(b=>b.onclick=async()=>{
    const role=b.dataset.role, eu=store.user(editUser);
    if(!eu) return;
    if(isMasterUser(eu)||eu.master){ toast('Owners are managed under Members'); return; }
    if(!IS_ADMIN){ toast('Only an admin can change roles'); return; }
    const prev=eu.toolRole||(permOf(eu)==='Admin'?'admin':'user');
    if(prev===role) return;
    // reflect locally and STAGE the grant — it persists only on "Save changes"
    store.updateUser(editUser,{ toolRole:role, perm: role==='admin'?'Admin':'User',
                                profile: role==='admin'?'pf_admin':'pf_users' });
    if(eu.authId) PENDING_ROLES[eu.authId]=role;
    setMarkDirty();
    renderSettings();
  });
  // field Read/Edit/Hide
  el.querySelectorAll('.stx-seg button').forEach(btn=>btn.onclick=()=>{ const fk=btn.dataset.fp, v=btn.dataset.v; const fpm=Object.assign({}, s.fieldPerms||{}); const rec=Object.assign({}, fpm[editUser]||{}); rec[fk]=v; fpm[editUser]=rec; Object.assign(store.settings(),{fieldPerms:fpm}); setMarkDirty(); const seg=btn.parentElement; seg.querySelectorAll('button').forEach(b=>b.className=''); btn.className='on '+v; });
  // bulk set
  el.querySelectorAll('[data-bulk]').forEach(b=>b.onclick=()=>{ const v=b.dataset.bulk; const fpm=Object.assign({}, s.fieldPerms||{}); const rec={}; STX_FALL.forEach(k=>rec[k]=v); fpm[editUser]=rec; Object.assign(store.settings(),{fieldPerms:fpm}); setMarkDirty(); renderSettings(); toast('Fields set to '+v); });
  // module visibility (existing cap system)
  el.querySelectorAll('.stx-mod').forEach(node=>node.onclick=()=>{ const cap=node.dataset.cap; const base=Object.assign({}, s.userPerms||{}); const rec=Object.assign({}, base[editUser]||{}); const on=!node.classList.contains('on'); rec[cap]=on; base[editUser]=rec; Object.assign(store.settings(),{userPerms:base}); setMarkDirty(); node.classList.toggle('on'); });
  // visible workspaces
  el.querySelectorAll('.stx-ws').forEach(node=>node.onclick=()=>{ const sp=store.space(node.dataset.ws); if(!sp) return; const m=new Set(sp.members||[]); const on=!node.classList.contains('on'); on?m.add(editUser):m.delete(editUser); store.updateSpace(sp.id,{members:[...m]}); node.classList.toggle('on'); toast('Workspace access updated'); });
  // data + danger (unchanged handlers)
  if(_g('setRenumber')) _g('setRenumber').onclick=()=>runKeyRenumber();
  if(_g('setProvision')) _g('setProvision').onclick=async()=>{
    if(!can('board_columns')){ toast('You don\u2019t have permission to edit columns'); return; }
    const run=async()=>{ try{ await provisionWorkflow(); renderAll(); toast('Default workflow added'); }
      catch(e){ toast('Couldn\u2019t set up the workflow: '+((e&&e.message)||'error')); } };
    if(store.statuses().length){
      confirmDelete({ title:'Add default workflow',
        lead:'This workspace already has <b>'+store.statuses().length+' statuses</b>. Add the default flow anyway? Existing statuses are kept.',
        confirmLabel:'Add default flow', tone:'primary', warn:'', onConfirm:run });
      return;
    }
    run();
  };
  if(_g('setExport')) _g('setExport').onclick=()=>downloadJSON('taskora-data.json', store.exportData());
  if(_g('setExportCsv')) _g('setExportCsv').onclick=()=>{ const flds=Object.keys(REPORT_FIELDS);
    downloadCSV('all-tickets.csv', flds.map(f=>REPORT_FIELDS[f]), store.standardTasks().map(t=>flds.map(f=>reportFieldVal(t,f)))); };
  if(_g('setImport')) _g('setImport').onclick=()=>_g('setImportFile').click();
  if(_g('setImportFile')) _g('setImportFile').onchange=ev=>{ const f=ev.target.files[0]; if(!f) return; const r=new FileReader();
    r.onload=()=>{ try{ store.importData(r.result); ui.project='all'; if(!store.board(ui.board)) ui.board=store.boards()[0].id; toast('Data imported'); renderAll(); renderSettings(); applyBrand(); }
      catch(err){ toast('That file is not a valid export'); } }; r.readAsText(f); ev.target.value=''; };
  if(_g('setClear')) _g('setClear').onclick=e=>armDanger(e.currentTarget,()=>{ store.clearTickets(); toast('All tickets cleared'); renderAll(); renderSettings(); });
  if(_g('setReset')) _g('setReset').onclick=e=>armDanger(e.currentTarget,()=>{ store.reset(); ui.project='all'; ui.board='main'; toast('Reset to sample data'); renderAll(); renderSettings(); applyBrand(); });
  { const wb=_g('setWipe'); if(wb) wb.onclick=e=>armDanger(e.currentTarget, wipeWorkspace); }
}
