/* Taskora — 22-sprint-dialogs.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ---------------- sprint dialogs ---------------- */
function sprDurationFields(s){
  const now=new Date(); now.setSeconds(0,0);
  const start = sprD(s.start) || now;
  const weeks = sprCfg().defaultWeeks || 2;
  const end = sprD(s.end) || new Date(start.getTime()+weeks*7*864e5);
  const span = Math.round((end-start)/864e5);
  const dur = [7,14,21,28].includes(span) ? String(span/7) : 'custom';
  return `<div class="spr-f"><label for="sfDur">Duration</label><select id="sfDur">
      ${['1','2','3','4'].map(w=>`<option value="${w}" ${dur===w?'selected':''}>${w} week${w==='1'?'':'s'}</option>`).join('')}<option value="custom" ${dur==='custom'?'selected':''}>Custom</option></select></div>
    <div class="spr-grid2">
      <div class="spr-f"><label for="sfStart">Start date</label><input id="sfStart" type="datetime-local" value="${sprInput(start)}"/></div>
      <div class="spr-f"><label for="sfEnd">End date</label><input id="sfEnd" type="datetime-local" value="${sprInput(end)}"/></div>
    </div>`;
}
function sprWireDuration(d){
  const dur=d.q('#sfDur'), st=d.q('#sfStart'), en=d.q('#sfEnd');
  const sync=()=>{ if(dur.value==='custom') return; const s=new Date(st.value); if(isNaN(s)) return; en.value=sprInput(new Date(s.getTime()+(+dur.value)*7*864e5)); };
  dur.onchange=sync; st.onchange=sync; en.onchange=()=>{ dur.value='custom'; };
}
function sprReadDates(d){
  const s=new Date(d.q('#sfStart').value), e=new Date(d.q('#sfEnd').value);
  if(isNaN(s)||isNaN(e)) return { error:'Pick a start and end date.' };
  if(e<=s) return { error:'The end date must be after the start date.' };
  return { start:s.toISOString(), end:e.toISOString() };
}
function sprOpenStart(sid){
  const s=store.sprint(sid); if(!s) return;
  const bid=sprOfBoard(s);
  const act=store.activeSprints(bid);
  const tasks=store.tasksInSprint(sid);
  const stat=sprStat();
  const noEst = stat==='count' ? 0 : tasks.filter(t=> stat==='points' ? (t.points==null||t.points==='') : !t.estimate).length;
  const blocked = act.length && !sprCfg().parallel;
  const d=tskModal('Start sprint', `
    ${blocked?`<div class="spr-note err"><b>${esc(act[0].name)}</b> is still active. Complete it first, or ask an admin to turn on parallel sprints.</div>`:''}
    <div class="spr-note"><b>${tasks.length}</b> ticket${tasks.length===1?'':'s'} will be included in this sprint.${noEst?` <br>${noEst} of them ${noEst===1?'has':'have'} no ${stat==='points'?'story points':'estimate'} — the burndown won’t count ${noEst===1?'it':'them'}.`:''}</div>
    ${!tasks.length?'<div class="spr-note warn">This sprint has no tickets yet. You can still start it and add tickets later — they’ll show as scope added after the start.</div>':''}
    <div class="spr-f"><label for="sfName">Sprint name</label><input id="sfName" value="${esc(s.name)}" maxlength="80"/></div>
    ${sprDurationFields(s)}
    <div class="spr-f"><label for="sfGoal">Sprint goal</label><textarea id="sfGoal" placeholder="What should this sprint achieve?">${esc(s.goal||'')}</textarea></div>
    <div class="pw-err" id="sfErr"></div>
    <div class="mem-foot"><button class="btn" id="sfCancel">Cancel</button><button class="btn primary" id="sfGo" ${blocked?'disabled':''}>Start sprint</button></div>`, 520);
  sprWireDuration(d);
  d.q('#sfCancel').onclick=d.close;
  d.q('#sfGo').onclick=()=>{
    const err=m=>{ const e=d.q('#sfErr'); e.textContent=m; e.classList.add('on'); };
    const name=d.q('#sfName').value.trim(); if(!name) return err('Give the sprint a name.');
    const dt=sprReadDates(d); if(dt.error) return err(dt.error);
    store.startSprint(sid, { name, goal:d.q('#sfGoal').value.trim(), start:dt.start, end:dt.end });
    d.close(); toast(name+' started'); SPR.boardSprint=sid; setView('sprint');
  };
}
function sprOpenEdit(sid){
  const s=store.sprint(sid); if(!s) return;
  const d=tskModal('Edit sprint', `
    <div class="spr-f"><label for="sfName">Sprint name</label><input id="sfName" value="${esc(s.name)}" maxlength="80"/></div>
    ${s.state!=='closed' ? sprDurationFields(s) : ''}
    <div class="spr-f"><label for="sfGoal">Sprint goal</label><textarea id="sfGoal">${esc(s.goal||'')}</textarea></div>
    <div class="pw-err" id="sfErr"></div>
    <div class="mem-foot"><button class="btn" id="sfCancel">Cancel</button><button class="btn primary" id="sfGo">Save</button></div>`, 520);
  if(s.state!=='closed') sprWireDuration(d);
  d.q('#sfCancel').onclick=d.close;
  d.q('#sfGo').onclick=()=>{
    const err=m=>{ const e=d.q('#sfErr'); e.textContent=m; e.classList.add('on'); };
    const name=d.q('#sfName').value.trim(); if(!name) return err('Give the sprint a name.');
    const patch={ name, goal:d.q('#sfGoal').value.trim() };
    if(s.state!=='closed'){
      const dt=sprReadDates(d); if(dt.error) return err(dt.error);
      patch.start=dt.start; patch.end=dt.end;
    }
    store.updateSprint(sid, patch); d.close(); toast('Sprint updated'); refreshViews();
  };
}
function sprOpenComplete(sid){
  const s=store.sprint(sid); if(!s) return;
  const bid=sprOfBoard(s);
  const tasks=store.tasksInSprint(sid);
  const done=tasks.filter(sprIsDone), open=tasks.filter(t=>!sprIsDone(t));
  const futures=store.openSprints(bid).filter(x=>x.state==='future');
  const d=tskModal('Complete '+s.name, `
    <div class="spr-stats"><div class="spr-stat"><b>${done.length}</b><span>completed</span></div><div class="spr-stat"><b>${open.length}</b><span>open</span></div>
      <div class="spr-stat"><b>${sprFmt(done.reduce((a,t)=>a+sprEst(t),0))}</b><span>${esc(SPR_STAT_LABEL[sprStat()].toLowerCase())} done</span></div></div>
    ${open.length?`<div class="spr-f"><label for="scDest">Move open tickets to</label><select id="scDest">
        <option value="backlog">Backlog</option>${futures.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('')}<option value="new">New sprint</option></select></div>
      <div class="spr-note">${open.slice(0,6).map(t=>`<div>${esc(t.key)} · ${esc(t.title)}</div>`).join('')}${open.length>6?`<div>and ${open.length-6} more</div>`:''}</div>`
      : '<div class="spr-note">Every ticket in this sprint is done.</div>'}
    <div class="mem-foot"><button class="btn" id="scCancel">Cancel</button><button class="btn primary" id="scGo">Complete sprint</button></div>`, 520);
  d.q('#scCancel').onclick=d.close;
  d.q('#scGo').onclick=()=>{
    const dest=open.length ? d.q('#scDest').value : 'backlog';
    const r=store.completeSprint(sid, dest);
    d.close();
    toast(`${s.name} completed — ${r.done} done${r.open?`, ${r.open} moved to ${dest==='backlog'?'the backlog':(store.sprint(r.dest)||{}).name||'the next sprint'}`:''}`);
    SPR.reportSprint=sid; SPR.reportTab='report'; setView('sprintreports');
  };
}
function sprOpenSettings(){
  const c=sprCfg();
  const d=tskModal('Sprint settings', `
    <label class="mem-check"><input type="checkbox" id="ssPar" ${c.parallel?'checked':''}/> Allow parallel sprints (more than one active sprint per board)</label>
    <div class="spr-f"><label for="ssWeeks">Default sprint length</label><select id="ssWeeks">${[1,2,3,4].map(w=>`<option value="${w}" ${c.defaultWeeks===w?'selected':''}>${w} week${w===1?'':'s'}</option>`).join('')}</select></div>
    <div class="mem-foot"><button class="btn" id="ssCancel">Cancel</button><button class="btn primary" id="ssGo">Save</button></div>`, 460);
  d.q('#ssCancel').onclick=d.close;
  d.q('#ssGo').onclick=()=>{ store.updateSettings({ sprintCfg:{ parallel:d.q('#ssPar').checked, defaultWeeks:+d.q('#ssWeeks').value } }); d.close(); toast('Sprint settings saved'); renderBacklog(); };
}

/* ---------------- active sprint board ---------------- */
function renderSprintBoard(){
  sprCss();
  const el=document.getElementById('sprintwrap');
  const board=activeBoard();
  if(!board){ el.innerHTML='<div class="sr-empty">Create a board first.</div>'; return; }
  const act=store.activeSprints(board.id);
  if(!act.length){
    el.innerHTML=`<div class="spr-page"><div class="spr-head"><div class="spr-title"><h2>Active sprint</h2>${sprBoardSelect('sbBoard')}</div></div>
      <div class="sr-card sr-empty"><p style="margin:0 0 12px">There’s no active sprint on this board.</p><button class="btn primary" id="sbGoBacklog">Plan a sprint in the backlog</button></div></div>`;
    sprWireBoardSelect('sbBoard', renderSprintBoard);
    document.getElementById('sbGoBacklog').onclick=()=>setView('backlog');
    return;
  }
  const s = act.find(x=>x.id===SPR.boardSprint) || act[0]; SPR.boardSprint=s.id;
  const all=store.tasksInSprint(s.id);
  const tasks=all.filter(t=>{
    if(SPR.boardQ){ const q=SPR.boardQ.toLowerCase(); if(!((t.title||'').toLowerCase().includes(q)||(t.key||'').toLowerCase().includes(q))) return false; }
    if(SPR.boardMine && t.assignee!==myUid()) return false;
    if(SPR.boardFlagged && !t.flagged) return false;
    if(SPR.boardAssignees.size && !SPR.boardAssignees.has(t.assignee||'__none')) return false;
    return true; });
  const cols=store.boardColumns(board);
  const stat=sprStat();
  const sum={todo:0,inprogress:0,done:0}; all.forEach(t=>{ const c=sprCat(t); sum[c in sum?c:'todo']+=sprEst(t,stat); });
  const total=sum.todo+sum.inprogress+sum.done || 1;
  const end=sprD(s.end); const daysLeft=end?Math.ceil((end-new Date())/864e5):null;
  const left = daysLeft==null ? '' : daysLeft>=0 ? `${daysLeft} day${daysLeft===1?'':'s'} left` : `${-daysLeft} day${daysLeft===-1?'':'s'} overdue`;
  const people=[...new Set(all.map(t=>t.assignee).filter(Boolean))].map(id=>store.user(id)).filter(Boolean).slice(0,8);
  let lanes;
  if(SPR.boardGroup==='assignee'){
    const keys=[...new Set(tasks.map(t=>t.assignee||''))].sort((a,b)=>(a===''?1:0)-(b===''?1:0) || ((store.user(a)||{}).name||'').localeCompare((store.user(b)||{}).name||''));
    lanes=keys.map(k=>({ label:k?((store.user(k)||{}).name||'Someone'):'Unassigned', av:k?store.user(k):null, tasks:tasks.filter(t=>(t.assignee||'')===k) }));
  } else if(SPR.boardGroup==='epic'){
    const keys=[...new Set(tasks.map(t=>t.parent||''))];
    lanes=keys.map(k=>{ const e=k?store.task(k):null; return { label:e?e.title:'No epic', color:e?(e.color||'#7C3AED'):null, tasks:tasks.filter(t=>(t.parent||'')===k) }; });
  } else lanes=[{ label:null, tasks }];
  const card=t=>{ const u=store.user(t.assignee);
    return `<div class="sb2-card" data-id="${t.id}" ${can('ticket_move')?'draggable="true"':''} style="border-left:3px solid ${sprTypeColor(t)}">
      <div class="t">${esc(t.title)}${sprAddedAfterStart(t,s)?'<span class="spr-star" title="Added after the sprint started">*</span>':''}</div>
      ${t.parent?`<div style="margin-bottom:7px">${sprEpicTag(t)}</div>`:''}
      <div class="f"><span class="spr-key">${esc(t.key)}</span>${t.flagged?`<span class="spr-flag">${SPR_IC.flag}</span>`:''}${sprPrioIcon(t.priority)}
        ${t.points!=null&&t.points!==''?`<span class="spr-pts" style="cursor:default">${esc(String(t.points))}</span>`:''}<span class="spr-av">${u?avatar(u,22):''}</span></div></div>`; };
  el.innerHTML=`<div class="spr-page">
    <div class="spr-head">
      <div class="spr-title"><h2>Active sprint</h2>${sprBoardSelect('sbBoard')}</div>
      <div class="spr-tools">
        <input class="spr-search" id="sbQ" type="search" placeholder="Search sprint" value="${esc(SPR.boardQ)}" aria-label="Search sprint"/>
        ${people.length?`<div class="spr-avs">${people.map(u=>`<button data-av="${u.id}" class="${SPR.boardAssignees.has(u.id)?'on':''}" title="${esc(u.name)}">${avatar(u,26)}</button>`).join('')}</div>`:''}
        <button class="spr-chip ${SPR.boardMine?'on':''}" data-chip="boardMine">Only my issues</button>
        <button class="spr-chip ${SPR.boardFlagged?'on':''}" data-chip="boardFlagged">Flagged</button>
        <select class="spr-sel" id="sbGroup" aria-label="Group by"><option value="none">No swimlanes</option><option value="assignee" ${SPR.boardGroup==='assignee'?'selected':''}>Swimlanes: assignee</option><option value="epic" ${SPR.boardGroup==='epic'?'selected':''}>Swimlanes: epic</option></select>
      </div>
    </div>
    ${act.length>1?`<div class="sb2-tabs">${act.map(x=>`<button class="spr-chip ${x.id===s.id?'on':''}" data-sprint="${x.id}">${esc(x.name)}</button>`).join('')}</div>`:''}
    <div class="sb2-top">
      <span class="nm">${esc(s.name)}</span><span class="meta">${esc(sprDates(s))}</span>
      ${left?`<span class="sb2-left ${daysLeft<0?'late':''}">${left}</span>`:''}
      <div class="sb2-prog" title="${esc(SPR_STAT_LABEL[stat])}: ${sprFmt(sum.done)} done of ${sprFmt(sum.todo+sum.inprogress+sum.done)}">
        <i style="width:${sum.done/total*100}%;background:#0E8F5A"></i><i style="width:${sum.inprogress/total*100}%;background:#0C5A9E"></i></div>
      <span class="meta">${sprFmt(sum.done)} / ${sprFmt(sum.todo+sum.inprogress+sum.done)} ${stat==='points'?'pts':stat==='count'?'issues':''}</span>
      <button class="btn" id="sbReport">Reports</button>
      ${sprCanManage()?`<button class="btn primary" id="sbComplete">Complete sprint</button>`:''}
      ${s.goal?`<div class="goal"><b>Goal:</b> ${esc(s.goal)}</div>`:''}
    </div>
    ${lanes.map(l=>`<div class="sb2-lane">${l.label!==null?`<div class="sb2-lane-h">${l.av?avatar(l.av,20):''}${l.color?`<i style="width:10px;height:10px;border-radius:3px;background:${l.color}"></i>`:''}${esc(l.label)} <span style="color:var(--muted);font-weight:500">${l.tasks.length}</span></div>`:''}
      <div class="sb2-cols">${cols.map(c=>{ const ts=l.tasks.filter(t=>t.status===c.id).sort(sprSortRank);
        return `<div class="sb2-col" data-status="${c.id}"><div class="sb2-ch"><span>${esc(c.name)}</span><span>${ts.length}</span></div>${ts.map(card).join('')}</div>`; }).join('')}</div></div>`).join('')}
    ${!tasks.length?`<div class="sr-card sr-empty">${all.length?'No tickets match these filters.':'This sprint has no tickets. Add some from the backlog.'}</div>`:''}
  </div>`;
  sprWireBoardSelect('sbBoard', renderSprintBoard);
  const q=document.getElementById('sbQ'); if(q) q.oninput=()=>{ SPR.boardQ=q.value; const p=q.selectionStart; renderSprintBoard(); const n=document.getElementById('sbQ'); if(n){ n.focus(); n.setSelectionRange(p,p); } };
  el.querySelectorAll('[data-av]').forEach(b=>b.onclick=()=>{ const v=b.dataset.av; SPR.boardAssignees.has(v)?SPR.boardAssignees.delete(v):SPR.boardAssignees.add(v); renderSprintBoard(); });
  el.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>{ SPR[b.dataset.chip]=!SPR[b.dataset.chip]; renderSprintBoard(); });
  el.querySelectorAll('[data-sprint]').forEach(b=>b.onclick=()=>{ SPR.boardSprint=b.dataset.sprint; renderSprintBoard(); });
  document.getElementById('sbGroup').onchange=e=>{ SPR.boardGroup=e.target.value; renderSprintBoard(); };
  document.getElementById('sbReport').onclick=()=>{ SPR.reportSprint=s.id; SPR.reportTab='burndown'; setView('sprintreports'); };
  const cb=document.getElementById('sbComplete'); if(cb) cb.onclick=()=>sprOpenComplete(s.id);
  let dragId=null;
  el.querySelectorAll('.sb2-card').forEach(c=>{
    c.onclick=()=>openPanel(c.dataset.id);
    c.addEventListener('dragstart', e=>{ dragId=c.dataset.id; c.classList.add('dragging'); try{ e.dataTransfer.setData('text/plain', dragId); }catch(_){}
      const t=store.task(dragId); const tr=(board.transitions||{})[t.status];
      if(Array.isArray(tr)) el.querySelectorAll('.sb2-col').forEach(col=>{ const to=col.dataset.status; if(to!==t.status && !tr.includes(to)) col.classList.add('blocked'); }); });
    c.addEventListener('dragend', ()=>{ dragId=null; c.classList.remove('dragging'); el.querySelectorAll('.sb2-col').forEach(x=>x.classList.remove('over','blocked')); });
  });
  el.querySelectorAll('.sb2-col').forEach(col=>{
    col.addEventListener('dragover', e=>{ if(!dragId || col.classList.contains('blocked')) return; e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', ()=>col.classList.remove('over'));
    col.addEventListener('drop', e=>{ if(!dragId) return; e.preventDefault(); col.classList.remove('over');
      const t=store.task(dragId); const to=col.dataset.status; if(!t || t.status===to || col.classList.contains('blocked')) return;
      store.updateTask(t.id, { status:to }); toast(`${t.key} moved to ${(store.status(to)||{}).name||to}`); renderSprintBoard(); });
  });
}

/* ---------------- reports ---------------- */
function sprBurndown(s, stat){
  const start=sprD(s.startedAt||s.start); if(!start) return null;
  const endPlanned=sprD(s.end) || new Date(start.getTime()+14*864e5);
  const closedAt = s.state==='closed' ? sprD(s.completedAt) : null;
  const now=new Date();
  const cutoff = closedAt || now;
  const snapVals=(s.committed&&s.committed.values)||{};
  const valOf=id=>{ if(snapVals[id]) return stat==='points'?(snapVals[id].p||0):stat==='hours'?(snapVals[id].h||0):1; const t=store.task(id); return t?sprEst(t,stat):0; };
  const inScope=new Set((s.committed&&s.committed.ids)||[]); const done=new Set();
  const events=[];
  store.data.tasks.forEach(t=>{
    let touched=inScope.has(t.id) || t.sprint===s.id;
    (t.sprintHistory||[]).forEach(h=>{ if(h.sprint!==s.id) return; touched=true; const at=sprD(h.at); if(at && at>start && at<=cutoff) events.push({ at, type:h.action, id:t.id }); });
    if(touched && t.resolvedTs){ const at=sprD(t.resolvedTs); if(at && at>start && at<=cutoff) events.push({ at, type:'completed', id:t.id }); }
  });
  events.sort((a,b)=>a.at-b.at || (a.type==='completed'?1:-1));
  let remaining=0;
  inScope.forEach(id=>{ const t=store.task(id); const r=t&&t.resolvedTs?sprD(t.resolvedTs):null; if(r && r<=start) done.add(id); else remaining+=valOf(id); });
  const committed=remaining;
  const series=[{ at:start, v:remaining }];
  const log=[{ at:start, type:'start', id:null, delta:0, v:remaining }];
  events.forEach(e=>{
    const t=store.task(e.id); const v=valOf(e.id); let d=0;
    if(e.type==='added'){ if(inScope.has(e.id)) return; inScope.add(e.id); const r=t&&t.resolvedTs?sprD(t.resolvedTs):null; if(r && r<=e.at) done.add(e.id); else d=v; }
    else if(e.type==='removed'){ if(!inScope.has(e.id)) return; inScope.delete(e.id); if(!done.has(e.id)) d=-v; }
    else if(e.type==='completed'){ if(!inScope.has(e.id) || done.has(e.id)) return; done.add(e.id); d=-v; }
    if(d===0 && e.type!=='added' && e.type!=='removed') return;
    remaining=Math.max(0, remaining+d);
    series.push({ at:e.at, v:remaining }); log.push({ ...e, delta:d, v:remaining });
  });
  const lineEnd = closedAt || (now<endPlanned ? now : now);
  series.push({ at:lineEnd, v:remaining });
  if(closedAt) log.push({ at:closedAt, type:'end', id:null, delta:0, v:remaining });
  return { start, end:endPlanned, closedAt, series, log, committed, remaining };
}
function sprBurndownSvg(bd, stat){
  const W=900, H=320, L=48, R=16, T=16, B=40;
  const x0=bd.start.getTime();
  const x1=Math.max(bd.end.getTime(), (bd.closedAt||new Date(0)).getTime(), bd.series[bd.series.length-1].at.getTime());
  const ymax=Math.max(1, bd.committed, ...bd.series.map(p=>p.v))*1.1;
  const X=t=>L+(W-L-R)*((t-x0)/Math.max(1,x1-x0));
  const Y=v=>T+(H-T-B)*(1-v/ymax);
  let g='';
  // weekends
  const day=new Date(bd.start); day.setHours(0,0,0,0);
  const days=[]; for(let d=new Date(day); d.getTime()<=x1; d=new Date(d.getTime()+864e5)) days.push(d);
  days.forEach(d=>{ const wd=d.getDay(); if(wd===0||wd===6){ const a=Math.max(L,X(d.getTime())), b=Math.min(W-R,X(d.getTime()+864e5)); if(b>a) g+=`<rect x="${a}" y="${T}" width="${b-a}" height="${H-T-B}" fill="#F3F4F6"/>`; } });
  // grid + y labels
  for(let i=0;i<=4;i++){ const v=ymax/1.1*i/4; const y=Y(v); g+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="#E7E8EC"/><text x="${L-8}" y="${y+4}" text-anchor="end" font-size="11" fill="#71717A">${esc(sprFmt(v,stat))}</text>`; }
  // x labels
  const every=Math.max(1, Math.ceil(days.length/10));
  days.forEach((d,i)=>{ if(i%every) return; const x=X(d.getTime()); if(x<L||x>W-R) return; g+=`<text x="${x}" y="${H-B+18}" text-anchor="middle" font-size="11" fill="#71717A">${esc(d.toLocaleDateString(undefined,{day:'numeric',month:'short'}))}</text>`; });
  // guideline
  g+=`<line x1="${X(x0)}" y1="${Y(bd.committed)}" x2="${X(bd.end.getTime())}" y2="${Y(0)}" stroke="#A1A1A6" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  // remaining (step)
  let p=`M${X(bd.series[0].at.getTime())},${Y(bd.series[0].v)}`;
  for(let i=1;i<bd.series.length;i++){ p+=` H${X(bd.series[i].at.getTime())} V${Y(bd.series[i].v)}`; }
  g+=`<path d="${p}" fill="none" stroke="#D6264F" stroke-width="2.2"/>`;
  // today / end markers
  if(!bd.closedAt){ const n=Date.now(); if(n>=x0 && n<=x1){ g+=`<line x1="${X(n)}" x2="${X(n)}" y1="${T}" y2="${H-B}" stroke="#0C0F18" stroke-width="1" stroke-dasharray="2 3"/><text x="${X(n)+4}" y="${T+11}" font-size="11" fill="#0C0F18">Today</text>`; } }
  g+=`<line x1="${L}" x2="${W-R}" y1="${H-B}" y2="${H-B}" stroke="#C8CCD4"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Burndown chart">${g}</svg>`;
}
function sprVelocitySvg(rows, stat){
  const W=900, H=300, L=48, R=16, T=16, B=56;
  const ymax=Math.max(1, ...rows.map(r=>Math.max(r.c,r.d)))*1.15;
  const bw=(W-L-R)/Math.max(1,rows.length);
  const Y=v=>T+(H-T-B)*(1-v/ymax);
  let g='';
  for(let i=0;i<=4;i++){ const v=ymax/1.15*i/4, y=Y(v); g+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="#E7E8EC"/><text x="${L-8}" y="${y+4}" text-anchor="end" font-size="11" fill="#71717A">${esc(sprFmt(v,stat))}</text>`; }
  rows.forEach((r,i)=>{ const cx=L+bw*i+bw/2, w=Math.min(34, bw/3);
    g+=`<rect x="${cx-w-2}" y="${Y(r.c)}" width="${w}" height="${H-B-Y(r.c)}" fill="#C8CCD4"><title>Commitment: ${esc(sprFmt(r.c,stat))}</title></rect>`;
    g+=`<rect x="${cx+2}" y="${Y(r.d)}" width="${w}" height="${H-B-Y(r.d)}" fill="#0E8F5A"><title>Completed: ${esc(sprFmt(r.d,stat))}</title></rect>`;
    g+=`<text x="${cx}" y="${H-B+18}" text-anchor="middle" font-size="11" fill="#3F3F3F">${esc(r.name.length>16?r.name.slice(0,15)+'…':r.name)}</text>`; });
  g+=`<line x1="${L}" x2="${W-R}" y1="${H-B}" y2="${H-B}" stroke="#C8CCD4"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Velocity chart">${g}</svg>`;
}
function sprSnapVal(snap, stat){ if(!snap) return 0; return stat==='points'?(snap.points||0):stat==='hours'?(snap.hours||0):(snap.count||0); }
function renderSprintReports(){
  sprCss();
  const el=document.getElementById('sprintreportswrap');
  const board=activeBoard();
  if(!board){ el.innerHTML='<div class="sr-empty">Create a board first.</div>'; return; }
  const stat=sprStat();
  const sprints=store.boardSprints(board.id).filter(s=>s.state!=='future')
    .sort((a,b)=>(sprD(b.startedAt||b.start)||0)-(sprD(a.startedAt||a.start)||0));
  let s=sprints.find(x=>x.id===SPR.reportSprint) || sprints[0] || null;
  if(s) SPR.reportSprint=s.id;
  const tab=SPR.reportTab;
  const head=`<div class="spr-head"><div class="spr-title"><h2>Sprint reports</h2>${sprBoardSelect('srBoard')}</div>
    <div class="spr-tools">
      ${tab!=='velocity' && sprints.length ? `<select class="spr-sel" id="srSprint" aria-label="Sprint">${sprints.map(x=>`<option value="${x.id}" ${s&&x.id===s.id?'selected':''}>${esc(x.name)}${x.state==='active'?' (active)':''}</option>`).join('')}</select>` : ''}
      <select class="spr-sel" id="srStat" aria-label="Estimation">${Object.entries(SPR_STAT_LABEL).map(([k,v])=>`<option value="${k}" ${stat===k?'selected':''}>${v}</option>`).join('')}</select>
    </div></div>
    <div class="sr-tabs" role="tablist">${[['burndown','Burndown chart'],['velocity','Velocity chart'],['report','Sprint report']].map(([k,v])=>`<button role="tab" aria-selected="${tab===k}" class="${tab===k?'on':''}" data-tab="${k}">${v}</button>`).join('')}</div>`;
  let body='';
  if(!sprints.length){
    body=`<div class="sr-card sr-empty">Start a sprint to see reports here.</div>`;
  } else if(tab==='burndown'){
    const bd=sprBurndown(s, stat);
    if(!bd){ body='<div class="sr-card sr-empty">This sprint has no start date.</div>'; }
    else {
      const typeLbl={start:'Sprint start',end:'Sprint end',added:'Scope change — added',removed:'Scope change — removed',completed:'Ticket completed'};
      body=`<div class="sr-card"><h3>${esc(s.name)} burndown</h3>
        <p class="sr-sub">${esc(SPR_STAT_LABEL[stat])} remaining · ${esc(sprDayTime(s.startedAt||s.start))} to ${esc(sprDayTime(s.end))}${s.goal?' · Goal: '+esc(s.goal):''}</p>
        <div class="spr-stats"><div class="spr-stat"><b>${sprFmt(bd.committed,stat)}</b><span>committed at start</span></div>
          <div class="spr-stat"><b>${sprFmt(bd.remaining,stat)}</b><span>remaining</span></div>
          <div class="spr-stat"><b>${bd.log.filter(e=>e.type==='added').length}</b><span>added after start</span></div>
          <div class="spr-stat"><b>${bd.log.filter(e=>e.type==='removed').length}</b><span>removed</span></div></div>
        <div class="sr-chart">${sprBurndownSvg(bd, stat)}</div>
        <div class="sr-legend"><span><i style="background:#D6264F"></i>Remaining</span><span><i style="background:#A1A1A6"></i>Guideline</span><span><i style="background:#F3F4F6;height:10px"></i>Non-working days</span></div></div>
        <div class="sr-card"><h3>Event log</h3><div style="overflow-x:auto"><table class="sr-tbl"><thead><tr><th>When</th><th>Ticket</th><th>Event</th><th class="num">Change</th><th class="num">Remaining</th></tr></thead><tbody>
        ${bd.log.map(e=>{ const t=e.id?store.task(e.id):null; return `<tr><td>${esc(sprDayTime(e.at.toISOString()))}</td>
          <td>${t?`<span class="spr-key" data-open="${t.id}">${esc(t.key)}</span> ${esc(t.title)}`:'—'}</td><td>${esc(typeLbl[e.type]||e.type)}</td>
          <td class="num ${e.delta>0?'inc':e.delta<0?'dec':''}">${e.delta?(e.delta>0?'+':'')+esc(sprFmt(e.delta,stat)):''}</td><td class="num">${esc(sprFmt(e.v,stat))}</td></tr>`; }).join('')}
        </tbody></table></div></div>`;
    }
  } else if(tab==='velocity'){
    const closed=store.boardSprints(board.id).filter(x=>x.state==='closed').sort((a,b)=>(sprD(a.completedAt)||0)-(sprD(b.completedAt)||0)).slice(-7);
    if(!closed.length){ body='<div class="sr-card sr-empty">Complete a sprint to start tracking velocity.</div>'; }
    else {
      const rows=closed.map(x=>({ id:x.id, name:x.name, c:sprSnapVal(x.committed,stat), d:sprSnapVal(x.completed,stat) }));
      const last3=rows.slice(-3); const avg=last3.reduce((a,r)=>a+r.d,0)/last3.length;
      body=`<div class="sr-card"><h3>Velocity</h3><p class="sr-sub">${esc(SPR_STAT_LABEL[stat])} committed at sprint start vs completed by sprint end, last ${rows.length} sprint${rows.length===1?'':'s'}.</p>
        <div class="spr-stats"><div class="spr-stat"><b>${sprFmt(avg,stat)}</b><span>average velocity (last ${last3.length})</span></div>
          <div class="spr-stat"><b>${Math.round(rows.reduce((a,r)=>a+(r.c?r.d/r.c:0),0)/rows.length*100)}%</b><span>average say/do ratio</span></div></div>
        <div class="sr-chart">${sprVelocitySvg(rows, stat)}</div>
        <div class="sr-legend"><span><i style="background:#C8CCD4;height:10px"></i>Commitment</span><span><i style="background:#0E8F5A;height:10px"></i>Completed</span></div></div>
        <div class="sr-card"><table class="sr-tbl"><thead><tr><th>Sprint</th><th>Completed on</th><th class="num">Commitment</th><th class="num">Completed</th><th class="num">Say/do</th></tr></thead><tbody>
        ${rows.slice().reverse().map(r=>{ const x=store.sprint(r.id); return `<tr><td><a href="#" data-rep="${r.id}">${esc(r.name)}</a></td><td>${esc(sprDay(x.completedAt))}</td><td class="num">${esc(sprFmt(r.c,stat))}</td><td class="num">${esc(sprFmt(r.d,stat))}</td><td class="num">${r.c?Math.round(r.d/r.c*100)+'%':'—'}</td></tr>`; }).join('')}
        </tbody></table></div>`;
    }
  } else {
    const start=sprD(s.startedAt||s.start);
    const committedIds=new Set((s.committed&&s.committed.ids)||[]);
    let doneT, openT;
    if(s.state==='closed'){ doneT=((s.completed&&s.completed.ids)||[]).map(id=>store.task(id)).filter(Boolean); openT=((s.incomplete&&s.incomplete.ids)||[]).map(id=>store.task(id)).filter(Boolean); }
    else { const ts=store.tasksInSprint(s.id); doneT=ts.filter(sprIsDone); openT=ts.filter(t=>!sprIsDone(t)); }
    const inIds=new Set(doneT.concat(openT).map(t=>t.id));
    const removedT=store.data.tasks.filter(t=>!inIds.has(t.id) && (t.sprintHistory||[]).some(h=>h.sprint===s.id && h.action==='removed' && start && sprD(h.at)>start && (!s.completedAt || sprD(h.at)<sprD(s.completedAt))));
    const added=t=>!committedIds.has(t.id) && (t.sprintHistory||[]).some(h=>h.sprint===s.id && h.action==='added' && start && sprD(h.at)>start);
    const tbl=(title, list, note)=>`<div class="sr-card"><h3>${esc(title)} <span style="color:var(--muted);font-weight:500">${list.length}</span></h3>${note?`<p class="sr-sub">${note}</p>`:''}
      ${list.length?`<div style="overflow-x:auto"><table class="sr-tbl"><thead><tr><th>Key</th><th>Summary</th><th>Type</th><th>Priority</th><th>Status</th><th class="num">${esc(SPR_STAT_LABEL[stat])}</th></tr></thead><tbody>
      ${list.map(t=>`<tr><td><span class="spr-key" data-open="${t.id}">${esc(t.key)}</span>${added(t)?'<span class="spr-star" title="Added after the sprint started">*</span>':''}</td><td>${esc(t.title)}</td><td>${esc(t.type||'')}</td><td>${esc(t.priority||'')}</td><td>${sprLozenge(t)}</td><td class="num">${esc(sprFmt(sprEst(t,stat),stat))}</td></tr>`).join('')}
      </tbody></table></div>`:'<p class="sr-sub" style="margin:0">None.</p>'}</div>`;
    const sum=l=>l.reduce((a,t)=>a+sprEst(t,stat),0);
    const commit=sprSnapVal(s.committed,stat);
    body=`<div class="sr-card"><h3>${esc(s.name)}</h3>
      <p class="sr-sub">${s.state==='closed'?'Closed':'Active'} · ${esc(sprDayTime(s.startedAt||s.start))} – ${esc(sprDayTime(s.completedAt||s.end))}${s.goal?' · Goal: '+esc(s.goal):''}</p>
      <div class="spr-stats">
        <div class="spr-stat"><b>${sprFmt(commit,stat)}</b><span>committed</span></div>
        <div class="spr-stat"><b>${sprFmt(sum(doneT),stat)}</b><span>completed</span></div>
        <div class="spr-stat"><b>${sprFmt(sum(openT),stat)}</b><span>not completed</span></div>
        <div class="spr-stat"><b>${doneT.concat(openT).filter(added).length}</b><span>added after start</span></div>
        <div class="spr-stat"><b>${removedT.length}</b><span>removed</span></div>
        <div class="spr-stat"><b>${commit?Math.round(sum(doneT)/commit*100)+'%':'—'}</b><span>of commitment done</span></div>
      </div>${s.state==='closed'&&s.movedTo?`<p class="sr-sub" style="margin:0">Open tickets were moved to ${s.movedTo==='backlog'?'the backlog':esc((store.sprint(s.movedTo)||{}).name||'another sprint')}.</p>`:''}</div>
      ${tbl('Completed tickets', doneT)}
      ${tbl('Tickets not completed', openT)}
      ${tbl('Removed from sprint', removedT, 'Taken out of the sprint after it started.')}
      <p class="sr-sub">* Ticket added to the sprint after it started.</p>`;
  }
  el.innerHTML=`<div class="spr-page">${head}${body}</div>`;
  sprWireBoardSelect('srBoard', ()=>{ SPR.reportSprint=null; renderSprintReports(); });
  const ss=document.getElementById('srSprint'); if(ss) ss.onchange=()=>{ SPR.reportSprint=ss.value; renderSprintReports(); };
  const st=document.getElementById('srStat'); if(st) st.onchange=()=>{ sprSetStat(st.value); renderSprintReports(); };
  el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{ SPR.reportTab=b.dataset.tab; renderSprintReports(); });
  el.querySelectorAll('[data-open]').forEach(k=>k.onclick=()=>openPanel(k.dataset.open));
  el.querySelectorAll('[data-rep]').forEach(a=>a.onclick=e=>{ e.preventDefault(); SPR.reportSprint=a.dataset.rep; SPR.reportTab='report'; renderSprintReports(); });
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && SPR.sel.size && ui.view==='backlog' && !document.querySelector('.tsk-modal')){ SPR.sel.clear(); renderBacklog(); } });

function sprPanelVal(t){
  const cur=t.sprint?store.sprint(t.sprint):null;
  const past=[...new Set((t.sprintHistory||[]).map(h=>h.sprint))].map(id=>store.sprint(id)).filter(x=>x && x.state==='closed' && (!cur || x.id!==cur.id));
  const label = cur ? `${esc(cur.name)}${cur.state==='active'?' <span class="spr-state active">Active</span>':cur.state==='closed'?' <span class="spr-state closed">Closed</span>':''}` : '<span class="fv-none">Backlog</span>';
  return label + (past.length?`<div style="font-size:11px;color:var(--muted);margin-top:2px">Earlier: ${past.map(x=>esc(x.name)).join(', ')}</div>`:'');
}
function sprPanelOpts(t){
  const bid=taskBoardId(t);
  return [{v:'', t:'Backlog (no sprint)'}].concat(store.openSprints(bid).map(x=>({ v:x.id, t:x.name+(x.state==='active'?' (active)':'') })));
}
