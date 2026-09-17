/* Taskora — 13-velocity-and-burndown.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ---------- Velocity & Burndown ---------- */
function renderVelocity(){
  _dashInit(); _blInit();
  const el=document.getElementById('velocitywrap');
  const usePts=(ts)=>ts.some(t=>t.estimate);
  const sum=(ts,doneOnly)=>{ const up=usePts(ts); return ts.filter(t=>!doneOnly||t.status==='done').reduce((a,t)=>a+(up?(t.estimate||0):1),0); };
  const shown=store.sprints().filter(s=>store.tasksInSprint(s.id).length);
  const gmax=Math.max(1,...shown.map(x=>sum(store.tasksInSprint(x.id),false)));
  const velRows=shown.map(s=>{ const ts=store.tasksInSprint(s.id); const comm=sum(ts,false), comp=sum(ts,true); const up=usePts(ts);
    return `<div class="dash-brow"><span class="dash-bl">${esc(s.name)}</span>
      <div class="dash-bt" style="height:14px;position:relative">
        <i style="position:absolute;left:0;top:0;height:100%;width:${comm/gmax*100}%;background:#C7D2FE"></i>
        <i style="position:absolute;left:0;top:0;height:100%;width:${comp/gmax*100}%;background:#0C5A9E"></i>
      </div><span class="dash-bn" style="width:64px">${comp}/${comm}${up?' pts':' t'}</span></div>`; }).join('');
  const active=store.sprints().find(s=>s.state==='active');
  let burn='<div class="bl-empty">No active sprint with a date range.</div>';
  if(active && active.start && active.end){ const ts=store.tasksInSprint(active.id); const up=usePts(ts); const val=t=>up?(t.estimate||0):1;
    const totalV=ts.reduce((a,t)=>a+val(t),0)||1;
    const days=[]; for(let d=new Date(active.start+'T00:00:00'), _e=new Date(active.end+'T00:00:00'); d<=_e; d.setDate(d.getDate()+1)) days.push(_isoLocal(d));
    const n=days.length||1;
    const rem=days.map(iso=>totalV-ts.filter(t=>t.status==='done'&&t.resolvedAt&&t.resolvedAt<=iso).reduce((a,t)=>a+val(t),0));
    const W=600,H=210,PL=34,PB=20; const x=i=>PL+(W-PL-8)*(n<=1?0:i/(n-1)); const y=v=>8+(H-8-PB)*(1-v/totalV);
    const ideal=days.map((_,i)=>`${x(i).toFixed(1)},${y(totalV*(1-i/((n-1)||1))).toFixed(1)}`).join(' ');
    const actual=rem.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const ti=days.indexOf(today());
    burn=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:220px">
      <line x1="${PL}" y1="${y(0)}" x2="${W-8}" y2="${y(0)}" stroke="var(--line)"/>
      <line x1="${PL}" y1="8" x2="${PL}" y2="${y(0)}" stroke="var(--line)"/>
      <text x="4" y="14" font-size="9" fill="var(--muted)">${totalV}${up?'p':'t'}</text>
      <text x="16" y="${(y(0)+4).toFixed(0)}" font-size="9" fill="var(--muted)">0</text>
      <polyline points="${ideal}" fill="none" stroke="var(--muted)" stroke-dasharray="4 4" stroke-width="1.5"/>
      <polyline points="${actual}" fill="none" stroke="#0C5A9E" stroke-width="2.2"/>
      ${ti>=0?`<line x1="${x(ti).toFixed(1)}" y1="8" x2="${x(ti).toFixed(1)}" y2="${y(0)}" stroke="#CE2F26" stroke-dasharray="3 3"/>`:''}
    </svg><div class="dash-kpi-l">Ideal (grey dashed) vs remaining ${up?'points':'tickets'} (blue). Red line = today.</div>`;
  }
  el.innerHTML=`<div class="ov-h"><h2>Velocity &amp; Burndown</h2><span class="range">Sprint delivery metrics</span></div>
    <div class="dash-grid">
      <div class="dash-card"><h3>Velocity \u2014 completed vs committed</h3>${velRows||'<div class="bl-empty">Assign tickets to sprints to see velocity.</div>'}<div class="dash-kpi-l" style="margin-top:8px">Light bar = committed \u00b7 solid = completed</div></div>
      <div class="dash-card"><h3>Burndown \u2014 active sprint</h3>${burn}</div>
    </div>`;
}

/* ---------- Dashboard ---------- */
function _dashInit(){ if(document.getElementById('dashCss')) return; const st=document.createElement('style'); st.id='dashCss'; st.textContent=`
.dash-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.dash-kpi{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:16px}
.dash-kpi-v{font-size:28px;font-weight:800;line-height:1}
.dash-kpi-l{font-size:12px;color:var(--muted);margin-top:6px}
.dash-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.dash-card{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:16px}
.dash-card h3{font-size:13px;font-weight:700;margin:0 0 12px}
.dash-brow{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:12px}
.dash-bl{width:150px;min-width:150px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:6px}
.dash-bt{flex:1;height:8px;background:var(--surface-3);border-radius:6px;overflow:hidden}
.dash-bt i{display:block;height:100%;border-radius:6px}
.dash-bn{width:28px;text-align:right;font-weight:600}
.dash-prog{height:8px;border-radius:6px;background:var(--surface-3);overflow:hidden}
.dash-prog i{display:block;height:100%;background:#0E8F5A;border-radius:6px}
.dash-due{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--surface-2);cursor:pointer;font-size:12px}
.dash-due:last-child{border-bottom:0}
.dash-due-t{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dash-due-d{color:var(--muted);font-family:ui-monospace,Menlo,monospace;font-size:11px}
@media(max-width:900px){.dash-kpis{grid-template-columns:repeat(2,1fr)}.dash-grid{grid-template-columns:1fr}}`; document.head.appendChild(st); }
function renderDashboard(){
  _blInit(); _dashInit();
  const el=document.getElementById('dashboardwrap');
  const scope=ui.project==='all'?store.standardTasks():store.standardTasks().filter(t=>t.project===ui.project);
  const todayISO=today();
  const done=scope.filter(t=>t.status==='done'); const open=scope.filter(t=>t.status!=='done');
  const overdue=open.filter(t=>t.due&&t.due<todayISO);
  const in7=new Date(); in7.setDate(in7.getDate()+7); const in7ISO=_isoLocal(in7);
  const dueSoon=open.filter(t=>t.due&&t.due>=todayISO&&t.due<=in7ISO).sort((a,b)=>a.due<b.due?-1:1);
  const kpi=(l,v,c)=>`<div class="dash-kpi"><div class="dash-kpi-v" style="color:${c||'var(--ink)'}">${v}</div><div class="dash-kpi-l">${l}</div></div>`;
  const brow=(label,n,max,color)=>`<div class="dash-brow"><span class="dash-bl">${label}</span><div class="dash-bt"><i style="width:${max?n/max*100:0}%;background:${color}"></i></div><span class="dash-bn">${n}</span></div>`;
  const statuses=store.statuses(); const maxS=Math.max(1,...statuses.map(s=>scope.filter(t=>t.status===s.id).length));
  const statusBars=statuses.map(s=>{ const n=scope.filter(t=>t.status===s.id).length; return n?brow(esc(s.name),n,maxS,s.color):''; }).join('');
  const users=store.users(); const maxU=Math.max(1,...users.map(u=>open.filter(t=>t.assignee===u.id).length));
  const workBars=users.map(u=>{ const n=open.filter(t=>t.assignee===u.id).length; return n?brow(`${avatar(u,22)} ${esc(u.name)}`,n,maxU,u.color):''; }).join('');
  const prios=['Highest','High','Medium','Low','Lowest']; const pc={Highest:'#CE2F26',High:'#E8590C',Medium:'#B96A00',Low:'#0E8F5A',Lowest:'#6B7280'};
  const maxP=Math.max(1,...prios.map(pr=>open.filter(t=>t.priority===pr).length));
  const prioBars=prios.map(pr=>{ const n=open.filter(t=>t.priority===pr).length; return n?brow(pr,n,maxP,pc[pr]):''; }).join('');
  const active=store.sprints().find(s=>s.state==='active'); let sprintCard='';
  if(active){ const ts=store.tasksInSprint(active.id); const sd=ts.filter(t=>t.status==='done').length; const pct=ts.length?Math.round(sd/ts.length*100):0;
    sprintCard=`<div class="dash-card"><h3>Active sprint \u00b7 ${esc(active.name)}</h3><div class="dash-prog"><i style="width:${pct}%"></i></div><div class="dash-kpi-l" style="margin-top:8px">${sd} of ${ts.length} done \u00b7 ${pct}%</div></div>`; }
  const dueList=dueSoon.slice(0,8).map(t=>`<div class="dash-due" onclick="openPanel('${t.id}')"><span class="bl-key">${esc(t.key)}</span><span class="dash-due-t">${esc(t.title)}</span><span class="dash-due-d">${fdate(t.due)}</span></div>`).join('')||'<div class="bl-empty">Nothing due in the next 7 days</div>';
  el.innerHTML=`<div class="ov-h"><h2>Dashboard</h2><span class="range">${ui.project==='all'?'All projects':esc(store.project(ui.project).name)} \u00b7 at a glance</span></div>
    <div class="dash-kpis">${kpi('Open',open.length)}${kpi('Done',done.length,'#0E8F5A')}${kpi('Overdue',overdue.length,'#CE2F26')}${kpi('Total',scope.length)}</div>
    <div class="dash-grid">
      <div class="dash-card"><h3>By status</h3>${statusBars||'<div class="bl-empty">No tickets</div>'}</div>
      <div class="dash-card"><h3>Workload (open)</h3>${workBars||'<div class="bl-empty">No open work</div>'}</div>
      <div class="dash-card"><h3>By priority (open)</h3>${prioBars||'<div class="bl-empty">None</div>'}</div>
      ${sprintCard||'<div class="dash-card"><h3>Active sprint</h3><div class="bl-empty">No active sprint</div></div>'}
      <div class="dash-card" style="grid-column:1/-1"><h3>Due in the next 7 days</h3>${dueList}</div>
    </div>`;
}

/* ---------- Calendar (by due date) ---------- */
let _calRef=null, _calSel=null;

/* ---------- Notes ----------
   Day-scoped scribbles. Stored on the author's own person record (prefs.notes),
   which already syncs — no new table. `people` rows are readable across the
   workspace, so notes linked to a ticket surface on that ticket for everyone,
   and @mentions can be picked up by the mentioned user's own client. */
function allNotes(){
  const out=[];
  store.users().forEach(u=>{
    const arr=(u.prefs&&Array.isArray(u.prefs.notes))?u.prefs.notes:[];
    arr.forEach(n=>out.push(Object.assign({}, n, {user:u.id})));
  });
  return out.sort((a,b)=>(b.at||'').localeCompare(a.at||''));
}
function notesOnDate(iso){ return allNotes().filter(n=>n.date===iso); }
function notesOnTicket(id){ return allNotes().filter(n=>n.ticket===id); }
function myNotes(){ const u=meUser(); if(!u) return []; u.prefs=u.prefs||{};
  if(!Array.isArray(u.prefs.notes)) u.prefs.notes=[]; return u.prefs.notes; }
function saveNotes(){ const u=meUser(); if(!u) return; store.updateUser(u.id,{prefs:u.prefs}); }

// find @Name references and resolve them to real people
function parseMentions(text){
  const ids=[];
  store.users().forEach(u=>{
    const first=(u.name||'').trim().split(/\s+/)[0];
    if(!first) return;
    const re=new RegExp('@\\s*'+first.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
    if(re.test(text) && !ids.includes(u.id)) ids.push(u.id);
  });
  return ids;
}
function addNote(text, ticket, date){
  const t=String(text||'').trim(); if(!t) return null;
  const n={ id:'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
            date: date||today(), text:t, ticket:ticket||null,
            at:new Date().toISOString(), mentions:parseMentions(t) };
  myNotes().unshift(n); saveNotes();
  return n;
}
function delNote(id){ const u=meUser(); if(!u) return;
  u.prefs.notes=myNotes().filter(x=>x.id!==id); saveNotes(); }

// highlight @Name inside a note
function noteHtml(text){
  let out=esc(text);
  store.users().forEach(u=>{
    const first=(u.name||'').trim().split(/\s+/)[0]; if(!first) return;
    const e=esc(first).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    out=out.replace(new RegExp('@\\s*'+e+'\\b','gi'), m=>`<span class="note-at-u">${esc(m)}</span>`);
  });
  return out;
}
function noteStamp(at){
  const d=new Date(at);
  return fdate(_isoLocal(d))+' \u00b7 '+d.toLocaleTimeString('en-US',{hour:'numeric', minute:'2-digit'});
}
// Notifications are per-device (localStorage), so a mention can only be raised
// by the mentioned person's own client. Scan on boot and after any sync.
function scanNoteMentions(){
  try{
    const me=myUid(); if(!me) return;
    allNotes().forEach(n=>{
      if(n.user===me) return;
      if(!(n.mentions||[]).includes(me)) return;
      const a=store.user(n.user);
      const snip=n.text.length>70?n.text.slice(0,70)+'\u2026':n.text;
      addNotif({ type:'mention', taskId:n.ticket||null, actorId:n.user,
                 text:`mentioned you in a note: "${snip}"`, at:n.at, dedup:'note:'+n.id });
    });
  }catch(e){}
}

function notesPanel(){
  const iso=_calSel||today();
  const d=new Date(iso+'T00:00:00');
  const notes=notesOnDate(iso);
  const me=myUid();
  const tickets=store.standardTasks()
    .filter(t=>ui.project==='all'||t.project===ui.project)
    .sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,300);
  const opts=['<option value="">Link a ticket (optional)</option>']
    .concat(tickets.map(t=>`<option value="${t.id}">${esc(t.key)} \u00b7 ${esc((t.title||'').slice(0,54))}</option>`)).join('');
  const rows=notes.map(n=>{
    const t=n.ticket?store.task(n.ticket):null;
    const au=store.user(n.user);
    return `<div class="note-card">
      ${n.user===me?`<button class="note-x" data-del="${n.id}" title="Delete note">\u2715</button>`:''}
      <div class="note-tx">${noteHtml(n.text)}</div>
      <div class="note-m">${t?`<span class="note-tk" data-open="${t.id}">${esc(t.key)}</span>`:''}
        ${au&&n.user!==me?`<span class="note-au">${esc(au.name)}</span>`:''}
        <span class="note-at">${esc(noteStamp(n.at))}</span></div>
    </div>`;
  }).join('');
  const nice=d.toLocaleString('en-US',{weekday:'long', day:'numeric', month:'long'});
  return `<div class="notes-h"><h2>Notes</h2><span class="notes-n">${notes.length}</span></div>
    <p class="notes-sub">${esc(nice)}${iso===today()?' \u00b7 today':''}</p>
    <div class="notes-new">
      <textarea id="noteText" rows="3" placeholder="Jot something down\u2026 use @name to notify someone"></textarea>
      <select id="noteTicket" class="notes-sel">${opts}</select>
      <button class="tsk-btn tsk-btn--sm" id="noteAdd" type="button">Add note</button>
    </div>
    <div class="notes-list">${rows||'<p class="notes-none">Nothing noted for this day.</p>'}</div>`;
}

function wireNotes(){
  const wrap=document.getElementById('calNotes'); if(!wrap) return;
  const add=document.getElementById('noteAdd');
  const ta=document.getElementById('noteText');
  const sel=document.getElementById('noteTicket');
  const commit=()=>{
    const v=(ta.value||'').trim();
    if(!v){ toast('Write something first'); ta.focus(); return; }
    const n=addNote(v, sel.value||null, _calSel||today());
    wrap.innerHTML=notesPanel(); wireNotes();
    const box=document.getElementById('noteText'); if(box) box.focus();
    const m=(n&&n.mentions||[]).filter(x=>x!==myUid());
    toast(m.length ? `Note added \u00b7 ${m.length} mentioned` : 'Note added');
    if(ui.openTask) openPanel(ui.openTask,true);
  };
  if(add) add.onclick=commit;
  if(ta) ta.onkeydown=e=>{ if((e.metaKey||e.ctrlKey) && e.key==='Enter'){ e.preventDefault(); commit(); } };
  wrap.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
    delNote(b.dataset.del); wrap.innerHTML=notesPanel(); wireNotes(); });
  wrap.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openPanel(b.dataset.open));
}

function renderCalendar(){
  const el=document.getElementById('calendarwrap'); if(!el) return;
  if(!_calRef){ _calRef=new Date(); _calRef.setDate(1); }
  const now=new Date(_calRef); now.setDate(1);
  const y=now.getFullYear(), m=now.getMonth();
  const _td=today();
  const scope=store.standardTasks().filter(t=>ui.project==='all'||t.project===ui.project);
  const _open=t=>(store.status(t.status)||{}).cat!=='done';
  const PRANK=(function(){ const m={}; store.priorities().forEach((p,i)=>m[p.id]=i+1); return m; })();
  const PCOL={Highest:'var(--crit)', High:'#B96A00', Medium:'var(--accent)', Low:'var(--faint)'};

  const metrics=iso=>{
    const past = iso < _td;
    const due  = scope.filter(t=>t.due===iso);
    return {
      deployed: scope.filter(t=>t.deployedAt && String(t.deployedAt).slice(0,10)===iso),
      created:  scope.filter(t=>(t.createdAt||'').slice(0,10)===iso),
      overdue:  past ? due.filter(_open) : [],
      due,
      top: due.length ? due.reduce((a,b)=>((PRANK[b.priority]||4) < (PRANK[a.priority]||4) ? b : a)) : null
    };
  };

  const lead=new Date(y,m,1).getDay();
  const startD=new Date(y,m,1-lead);
  let cells=[];
  for(let i=0;i<42;i++){
    const d=new Date(startD.getFullYear(), startD.getMonth(), startD.getDate()+i);
    cells.push({ d, iso:_isoLocal(d), out:d.getMonth()!==m, weekend:d.getDay()===0||d.getDay()===6 });
  }
  if(cells.slice(35).every(c=>c.out)) cells=cells.slice(0,35);

  if(!_calSel || !cells.find(c=>c.iso===_calSel && !c.out)) _calSel = cells.find(c=>c.iso===_td) ? _td : cells.find(c=>!c.out).iso;

  // hover sets: everything that touches that date, deduped
  _calPops={};
  const dowNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const head=dowNames.map(n=>`<div>${n}</div>`).join('');

  const grid=cells.map(c=>{
    // Dates from the neighbouring month read as noise — the pad is just blank.
    if(c.out) return '<div class="cal-day is-pad" aria-hidden="true"></div>';
    const x=metrics(c.iso);
    const seen=new Set(); const all=[];
    [...x.overdue, ...x.due, ...x.deployed, ...x.created].forEach(t=>{ if(!seen.has(t.id)){ seen.add(t.id); all.push(t); } });
    if(all.length) _calPops[c.iso]={ date:c.d, tasks:all,
      counts:{dep:x.deployed.length, cre:x.created.length, ovd:x.overdue.length} };

    const rows=[];
    if(x.deployed.length) rows.push(`<span class="cal-f"><span class="l">Deployments</span><span class="v">${x.deployed.length}</span></span>`);
    if(x.created.length)  rows.push(`<span class="cal-f"><span class="l">Tickets created</span><span class="v">${x.created.length}</span></span>`);
    if(x.overdue.length)  rows.push(`<span class="cal-f is-hot"><span class="l">Overdue</span><span class="v">${x.overdue.length}</span></span>`);
    if(x.top)             rows.push(`<span class="cal-f" style="--fc:${PCOL[x.top.priority]||'var(--faint)'}"><span class="l">Highest due</span><span class="v" style="color:var(--fc)">${esc(x.top.priority||'\u2014')}</span></span>`);

    const nN=notesOnDate(c.iso).length;
    const cls=['cal-day', c.weekend?'is-weekend':'', c.iso===_td?'is-today':'', c.iso===_calSel?'is-sel':''].filter(Boolean).join(' ');
    return `<div class="${cls}" data-cal="${c.iso}" role="button" tabindex="0">
      <div class="cal-dtop"><span class="cal-dnum">${c.d.getDate()}</span>
        ${nN?`<span class="cal-nb" title="${nN} note${nN===1?'':'s'}">${nN}</span>`:''}</div>
      <div class="cal-fields">${rows.join('')}</div></div>`;
  }).join('');

  el.innerHTML=`<div class="cal-monthbar">
      <div class="cal-nav">
        <button type="button" id="calPrev" aria-label="Previous month"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg></button>
        <button type="button" id="calNext" aria-label="Next month"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3.5 10.5 8 6 12.5"/></svg></button>
      </div>
      <h2 class="cal-month">${now.toLocaleString('en-US',{month:'long'})} ${y}</h2>
      ${_isoLocal(new Date()).slice(0,7)!==_isoLocal(now).slice(0,7)?'<button class="tsk-btn tsk-btn--ghost tsk-btn--sm" id="calToday" type="button">Today</button>':''}
      <span style="flex:1"></span>
      <span class="cal-hint">Click a date for its tickets \u00b7 notes attach to the day you pick</span></div>
    <div class="cal-layout">
      <div>
        <div class="cal-grid">
          <div class="cal-grid-head">${head}</div>
          <div class="cal-grid-body" id="calGrid">${grid}</div>
        </div>
        <p class="cal-note"><b>What the numbers mean:</b> <b>Deployments</b> = tickets marked deployed on that date.
          <b>Tickets created</b> = raised that day. <b>Overdue</b> = due that day and still open, counted only on dates already past.
          <b>Highest due</b> = the top priority falling due that day.</p>
      </div>
      <aside class="cal-notes" id="calNotes">${notesPanel()}</aside>
    </div>`;

  wireCalPops();
  wireNotes();
  document.getElementById('calPrev').onclick=()=>{ _calRef=new Date(y,m-1,1); renderCalendar(); };
  document.getElementById('calNext').onclick=()=>{ _calRef=new Date(y,m+1,1); renderCalendar(); };
  const _ct=document.getElementById('calToday');
  if(_ct) _ct.onclick=()=>{ _calRef=new Date(); _calRef.setDate(1); _calSel=today(); renderCalendar(); };
  // Day selection + the ticket popover are BOTH wired in wireCalPops(). A second
  // cell.onclick here silently replaced that handler, which is why clicking a
  // date picked the day but never opened the popover.
  el.querySelectorAll('#calGrid [data-cal]').forEach(cell=>{
    cell.tabIndex=0;
    cell.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); cell.click(); } };
  });
}

/* Hover popover for a date — same pattern as the dashboard strips, but with a
   Ticket / Status / Due date column set. */
let _calPops={};
function wireCalPops(){
  const pop=document.getElementById('ovPop'); if(!pop) return;
  pop.onmouseenter=null; pop.onmouseleave=null;
  const hide=()=>pop.classList.remove('on');
  // one delegated closer: clicking anywhere else, or Esc, dismisses it
  if(!window._calPopWired){ window._calPopWired=true;
    document.addEventListener('click',e=>{ const p=document.getElementById('ovPop');
      if(p && p.classList.contains('on') && !e.target.closest('#ovPop') && !e.target.closest('[data-cal]')) p.classList.remove('on'); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ const p=document.getElementById('ovPop'); if(p) p.classList.remove('on'); } });
  }
  document.querySelectorAll('#calGrid [data-cal]').forEach(cell=>{
    cell.onclick=(ev)=>{
      ev.stopPropagation();
      // a click also makes this the day new notes attach to
      _calSel=cell.dataset.cal;
      document.querySelectorAll('#calGrid [data-cal]').forEach(x=>x.classList.toggle('is-sel', x.dataset.cal===_calSel));
      const nw=document.getElementById('calNotes'); if(nw){ nw.innerHTML=notesPanel(); wireNotes(); }
      const set=_calPops[cell.dataset.cal];
      if(!set){ hide(); return; }                     // nothing on that day
      const _td=today();
      const rows=set.tasks.slice(0,12).map(t=>{
        const over = t.due && t.due<_td && (store.status(t.status)||{}).cat!=='done';
        return `<div class="ovpr cal-pr" data-id="${t.id}">
          <span class="ovtk">${esc(t.key||'')}</span>
          ${tskSt(t.status)}
          <span class="cal-pdue ${over?'over':''}">${t.due?fdate(t.due):'\u2014'}</span></div>`; }).join('');
      const more=set.tasks.length>12?`<div class="ovpop-more">+${set.tasks.length-12} more</div>`:'';
      const c=set.counts;
      const bits=[]; if(c.dep) bits.push(c.dep+' deployed'); if(c.cre) bits.push(c.cre+' created');
      if(c.ovd) bits.push('<b style="color:var(--crit)">'+c.ovd+' overdue</b>');
      pop.innerHTML=`<div class="ovpop-h"><span class="t">${esc(set.date.toLocaleString('en-US',{weekday:'short', day:'numeric', month:'short'}))}</span>
          <span class="c">${set.tasks.length}</span></div>
        ${bits.length?`<div class="ovpop-def">${bits.join(' \u00b7 ')}</div>`:''}
        <div class="cal-pop-head"><span>Ticket</span><span>Status</span><span>Due date</span></div>
        <div class="ovpop-list">${rows}${more}</div>`;
      pop.querySelectorAll('.ovpr').forEach(r=>r.onclick=()=>{ pop.classList.remove('on'); openPanel(r.dataset.id); });
      pop.classList.add('on');
      const r=cell.getBoundingClientRect(); const pw=340; const ph=pop.offsetHeight;
      let left=r.left+r.width/2-pw/2;
      if(left+pw>window.innerWidth-12) left=window.innerWidth-pw-12;
      left=Math.max(12,left);
      let top=r.bottom+8; if(top+ph>window.innerHeight-12) top=Math.max(12, r.top-ph-8);
      pop.style.left=left+'px'; pop.style.top=top+'px';
    };
  });
}

/* ---------- Timeline / Roadmap ---------- */
function _tlInit(){ if(document.getElementById('tlCss')) return; const st=document.createElement('style'); st.id='tlCss'; st.textContent=`
.tl-wrap{border:1px solid var(--line);border-radius:6px;overflow-x:auto;background:var(--surface)}
.tl-row{display:flex;align-items:stretch;min-height:34px;border-bottom:1px solid var(--surface-2)}
.tl-row.tl-head{position:sticky;top:0;background:var(--surface-2);z-index:2;font-size:10px;color:var(--muted)}
.tl-lbl{width:270px;min-width:270px;padding:8px 12px;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;border-right:1px solid var(--line);display:flex;align-items:center;gap:6px}
.tl-key{font-family:ui-monospace,Menlo,monospace;font-size:10px;color:var(--muted)}
.tl-track{position:relative;flex:1;min-width:680px}
.tl-head .tl-track{display:flex}
.tl-wk{border-left:1px solid var(--line);padding:6px 4px;box-sizing:border-box;white-space:nowrap;overflow:hidden;font-size:10px}
.tl-bar{position:absolute;top:7px;height:20px;border-radius:6px;cursor:pointer;color:#fff;font-size:10px;font-weight:600;padding:0 6px;line-height:20px;overflow:hidden;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,.18)}
.tl-bar.epic{top:5px;height:24px;line-height:24px;font-weight:700}
.tl-sec{padding:8px 12px;font-weight:700;font-size:12px;background:var(--surface-2);border-bottom:1px solid var(--line)}`; document.head.appendChild(st); }
function renderTimeline(){
  _tlInit();
  const el=document.getElementById('timelinewrap');
  const scope=ui.project==='all'?store.tasks():store.tasks().filter(t=>t.project===ui.project);
  const endOf=(t)=>{ if(t.due) return new Date(t.due); const s=new Date(t.start); const days=t.estimate?Math.max(1,Math.round(t.estimate/480)):2; s.setDate(s.getDate()+days); return s; };
  const all=scope.filter(t=>t.start);
  if(!all.length){ el.innerHTML=`<div class="ov-h"><h2>Timeline</h2><span class="range">Roadmap of epics and dated tickets</span></div><div class="bl-empty" style="padding:20px">No dated tickets. Add a start date to a ticket to see it here.</div>`; return; }
  const dts=[]; all.forEach(t=>{ dts.push(new Date(t.start)); dts.push(endOf(t)); });
  let min=new Date(Math.min(...dts)), max=new Date(Math.max(...dts));
  min.setDate(min.getDate()-min.getDay()); max.setDate(max.getDate()+(7-max.getDay()));
  const totalMs=max-min||1;
  const weeks=[]; for(let d=new Date(min); d<max; d.setDate(d.getDate()+7)) weeks.push(new Date(d));
  const pos=(s,e)=>({l:(new Date(s)-min)/totalMs*100, w:Math.max((e-new Date(s))/totalMs*100,1.3)});
  const bar=(t)=>{ const stt=store.status(t.status); const p=pos(t.start,endOf(t));
    const c=t.type==='Epic'?(t.color||'#0C5A9E'):(stt?stt.color:'#8A8F98');
    return `<div class="tl-row"><div class="tl-lbl" onclick="openPanel('${t.id}')"><span class="tl-key">${esc(t.key)}</span>${esc(t.title)}</div>
      <div class="tl-track"><div class="tl-bar ${t.type==='Epic'?'epic':''}" style="left:${p.l}%;width:${p.w}%;background:${c}" onclick="openPanel('${t.id}')" title="${esc(t.title)}">${t.type==='Epic'?esc(t.title):''}</div></div></div>`; };
  const epics=all.filter(t=>t.type==='Epic');
  const grouped=new Set(); const rows=[];
  epics.forEach(e=>{ grouped.add(e.id); rows.push(bar(e)); scope.filter(t=>t.parent===e.id&&t.start).forEach(ch=>{ grouped.add(ch.id); rows.push(bar(ch)); }); });
  const orphans=all.filter(t=>!grouped.has(t.id)&&t.type!=='Epic');
  const wcolW=100/weeks.length;
  const header=`<div class="tl-row tl-head"><div class="tl-lbl">${epics.length} epics \u00b7 ${all.length} dated</div><div class="tl-track">${weeks.map(w=>`<div class="tl-wk" style="width:${wcolW}%">${fdate(_isoLocal(w))}</div>`).join('')}</div></div>`;
  el.innerHTML=`<div class="ov-h"><h2>Timeline</h2><span class="range">Roadmap of epics and dated tickets</span></div>
    <div class="tl-wrap">${header}${rows.join('')}${orphans.length?`<div class="tl-sec">Other dated tickets</div>`+orphans.map(bar).join(''):''}</div>`;
}

/* ---------- Releases / Versions ---------- */
function _relInit(){ if(document.getElementById('relCss')) return; const st=document.createElement('style'); st.id='relCss'; st.textContent=`
.rel-goal{font-weight:400;font-size:12px;color:var(--muted)}
.rel-date{font-size:11px;color:var(--muted);font-family:ui-monospace,Menlo,monospace}
.rel-prog{height:6px;border-radius:6px;background:var(--surface-3);overflow:hidden;width:120px}
.rel-prog i{display:block;height:100%;background:#0E8F5A;border-radius:6px}
.rel-pct{font-size:11px;color:var(--muted);min-width:70px}
.bl-state.rel{background:#0C5A9E22;color:#0C5A9E}
.bl-state.done{background:#0E8F5A22;color:#0E8F5A}`; document.head.appendChild(st); }
function renderReleases(){
  _blInit(); _relInit();
  const el=document.getElementById('releaseswrap');
  const rels=store.releases();
  const relOpts=(cur)=>`<option value="">No release</option>`+rels.filter(r=>r.status!=='released').map(r=>`<option value="${r.id}" ${cur===r.id?'selected':''}>${esc(r.name)}</option>`).join('');
  const row=(t)=>{ const u=store.user(t.assignee); const st=store.status(t.status);
    return `<div class="bl-row" data-id="${t.id}">
      <span class="bl-key" onclick="openPanel('${t.id}')">${esc(t.key)}</span>
      <span class="bl-title" onclick="openPanel('${t.id}')">${esc(t.title)}</span>
      <span class="bl-badge" style="background:${st?st.color+'22':'#eee'};color:${st?st.color:'#666'}">${st?esc(st.name):esc(t.status)}</span>
      <span class="bl-est">${t.estimate?hm(t.estimate):''}</span>
      <span class="bl-ava">${u?avatar(u,22):''}</span>
      <select class="rel-move" data-id="${t.id}">${relOpts(t.release||'')}</select>
    </div>`; };
  const group=(title,tasks,ctrls,cls)=>`<div class="bl-group ${cls||''}">
      <div class="bl-ghead"><div class="bl-gt">${title} <span class="bl-count">${tasks.length}</span></div><div class="bl-gctrls">${ctrls||''}</div></div>
      <div class="bl-list">${tasks.length?tasks.map(row).join(''):'<div class="bl-empty">No tickets</div>'}</div></div>`;
  const relGroups=rels.map(r=>{ const ts=store.tasksInRelease(r.id); const done=ts.filter(t=>t.status==='done').length; const pct=ts.length?Math.round(done/ts.length*100):0;
    const badge=r.status==='released'?'<span class="bl-state done">Released</span>':'<span class="bl-state rel">Unreleased</span>';
    const ctrls=`<div class="rel-prog"><i style="width:${pct}%"></i></div><span class="rel-pct">${done}/${ts.length} done</span>`
      +`<input type="date" class="rel-date-in" data-id="${r.id}" value="${r.date||''}" style="font-size:11px;border:1px solid var(--line);border-radius:6px;padding:3px 6px;background:var(--surface);color:var(--ink)">`
      +(r.status!=='released'?`<button class="btn sm" onclick="doMarkReleased('${r.id}')">Mark released</button>`:'')
      +`<button class="bl-del" title="Delete release" onclick="doRemoveRelease('${r.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>`;
    return group(`${esc(r.name)} ${badge}${r.desc?`<span class="rel-goal">${esc(r.desc)}</span>`:''}`, ts, ctrls, 'sprint');
  }).join('');
  const none=store.noRelease();
  el.innerHTML=`<div class="ov-h"><h2>Releases</h2><span class="range">Group tickets into versions and track release progress</span></div>
    ${relGroups}
    ${group('No release', none, `<button class="btn sm" id="relAdd"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>Create release</button>`, 'backlog')}`;
  const add=document.getElementById('relAdd'); if(add) add.onclick=()=>{ const id=store.addRelease(); renderReleases();
    const g=document.querySelector(`.rel-date-in[data-id="${id}"]`); if(g) g.focus(); };
  el.querySelectorAll('.rel-move').forEach(sel=>sel.onchange=()=>{ store.setTaskRelease(sel.dataset.id, sel.value||null); renderReleases(); });
  el.querySelectorAll('.rel-date-in').forEach(inp=>inp.onchange=()=>{ store.updateRelease(inp.dataset.id,{date:inp.value||null}); });
}
function doMarkReleased(id){
  confirmDelete({ title:'Release version', lead:'Mark this version as <b>released</b>? Its open tickets stay linked and it moves to the released list.',
    confirmLabel:'Mark released', tone:'primary', warn:'',
    onConfirm:()=>{ store.markReleased(id); renderReleases(); toast('Released'); } }); }
function doRemoveRelease(id){
  confirmDelete({ title:'Delete release', lead:'Delete this release? Its tickets are <b>unassigned</b> from it (the tickets themselves stay).',
    confirmLabel:'Delete release',
    onConfirm:()=>{ store.removeRelease(id); renderReleases(); toast('Release deleted'); } }); }
