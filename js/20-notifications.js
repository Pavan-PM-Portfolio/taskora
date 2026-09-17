/* Taskora — 20-notifications.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ============================ NOTIFICATIONS ============================ */
const NTYPE={
  assign:   {c:'#D6264F', ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M19 8v6M22 11h-6"/><circle cx="9" cy="8" r="3.2"/></svg>', flag:'assigned',    tabMention:false},
  unassign: {c:'#71717A', ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M17 11h5"/><circle cx="9" cy="8" r="3.2"/></svg>', flag:'unassigned', tabMention:false},
  role:     {c:'#D6264F', ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6 9 17l-5-5"/></svg>', flag:'roles', tabMention:false},
  mention:  {c:'#7C3AED', ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="12" cy="12" r="4.4"/></svg>', flag:'mentions', tabMention:true},
  reply:    {c:'#3F3F3F', ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg>', flag:'replies', tabMention:false},
  status:   {c:'#0E8F5A', ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12h13M13 6l6 6-6 6"/></svg>', flag:'status', tabMention:false},
  priority: {c:'#B96A00', ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M12 20V10M6 20v-6M18 20V4"/></svg>', flag:'priority', tabMention:false},
  flag:     {c:'#CE2F26', ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><path d="M4 22V4"/></svg>', flag:'flagged', tabMention:false},
  resolved: {c:'#0E8F5A', ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>', flag:'resolved', tabMention:false},
  due:      {c:'#B96A00', ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>', flag:'dueSoon', tabMention:false},
  overdue:  {c:'#CE2F26', ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>', flag:'overdue', tabMention:false},
  newticket:{c:'#D6264F', ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M12 5v14M5 12h14"/></svg>', flag:'newInProject', tabMention:false},
};
const NOTIF_DEFAULTS={enabled:true, badge:true, sound:false, desktop:false,
  assigned:true, unassigned:true, roles:true, mentions:true, replies:true, status:true, priority:false, flagged:true, resolved:true, newInProject:false,
  dueSoon:true, remindBefore:2, overdue:true, onlyAssigned:false, onlyMyProjects:false,
  quiet:false, quietFrom:'20:00', quietTo:'08:00', weekends:true, autoRead:true, group:true, keepDays:30, digest:false};
function nset(){ return Object.assign({}, NOTIF_DEFAULTS, (curPrefs().notify)||{}); }
function notifKey(){ return 'tsk_notifs_'+(myUid()||'anon'); }
/* Cached for the same reason as the photo map: unreadCount() runs on every
   bell/badge refresh, and re-parsing the list each time is wasted work. */
let _notifCache=null, _notifCacheKey=null;
function loadNotifs(){
  const k=notifKey();
  if(_notifCache && _notifCacheKey===k) return _notifCache;
  try{ const a=JSON.parse(localStorage.getItem(k)||'[]'); _notifCache=Array.isArray(a)?a:[]; }
  catch(e){ _notifCache=[]; }
  _notifCacheKey=k; return _notifCache;
}
function saveNotifs(a){ try{ const keep=(nset().keepDays)||30; const cut=Date.now()-keep*864e5;
  a=a.filter(n=>Date.parse(n.at)>=cut).slice(0,80);
  _notifCache=a; _notifCacheKey=notifKey();
  localStorage.setItem(notifKey(), JSON.stringify(a)); }catch(e){} }
try{ window.addEventListener('storage', e=>{ if(e && e.key && e.key.indexOf('tsk_notifs_')===0){ _notifCache=null; _notifCacheKey=null; } }); }catch(e){}
let NOTIF_TAB='all', _selfPushed={};
function markSelfPushed(id){ _selfPushed[id]=Date.now(); }
function myProjectSet(){ const me=myUid(); const s=new Set(); store.tasks().forEach(t=>{ if([t.assignee,t.reporter,t.qa,t.reviewer,t.deployer].includes(me) && t.project) s.add(t.project); }); return s; }
function involvesMe(t, onlyAssigned){ const me=myUid(); if(!me||!t) return false; if(onlyAssigned) return t.assignee===me; return [t.assignee,t.reporter,t.qa,t.reviewer,t.deployer].includes(me); }
function inQuietHours(s){ if(!s.quiet) return false; const now=new Date(); const cur=now.getHours()*60+now.getMinutes();
  const p=x=>{ const m=/^(\d{1,2}):(\d{2})$/.exec(x||''); return m?(+m[1]*60+ +m[2]):null; };
  const a=p(s.quietFrom), b=p(s.quietTo); if(a==null||b==null) return false;
  return a<=b ? (cur>=a&&cur<b) : (cur>=a||cur<b); }
function isWeekendNow(){ const d=new Date().getDay(); return d===0||d===6; }
function notifOn(type){ const s=nset(); if(!s.enabled) return false; const meta=NTYPE[type]; if(!meta) return false;
  if(s[meta.flag]===false) return false; if(inQuietHours(s)) return false; if(!s.weekends && isWeekendNow()) return false; return true; }
function addNotif(o){ // {type,taskId,actorId?,text,at?,dedup?}
  if(!notifOn(o.type)) return;
  const arr=loadNotifs();
  const at=o.at||new Date().toISOString();
  if(o.dedup && arr.some(n=>n.dedup===o.dedup)) return;
  const id='n'+Date.now().toString(36)+Math.floor(Math.random()*999);
  arr.unshift({id, type:o.type, taskId:o.taskId||null, actorId:o.actorId||null, text:o.text||'', at, read:false, dedup:o.dedup||null});
  saveNotifs(arr); updateBell();
  if(document.getElementById('notifScrim').classList.contains('on')) renderNotifDrawer();
  if(nset().sound){ try{ notifBeep(); }catch(e){} }
}
function notifBeep(){ try{ const A=window.AudioContext||window.webkitAudioContext; if(!A) return; const ctx=new A(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value=660; g.gain.value=.05; o.start(); setTimeout(()=>{o.stop();ctx.close();},120); }catch(e){} }
function unreadCount(){ return loadNotifs().filter(n=>!n.read).length; }
function updateBell(){ const s=nset(); const c=unreadCount(); const b=document.getElementById('notifBadge');
  if(b){ if(s.badge && s.enabled && c>0){ b.textContent=c>99?'99+':c; b.style.display=''; } else b.style.display='none'; } try{ syncBotBadges(); }catch(e){} }

// diff a task change (old vs new) into notifications for the current user
function notifyTaskChange(oldDoc, newDoc){
  try{
    const s=nset(); if(!s.enabled) return; const me=myUid(); if(!me) return;
    const id=newDoc.id; if(_selfPushed[id] && Date.now()-_selfPushed[id]<5000) return;   // I made this change
    if(s.onlyMyProjects){ const mp=myProjectSet(); if(newDoc.project && !mp.has(newDoc.project)) { /* still allow direct assign to me */ } }
    const key=newDoc.key||''; const title=newDoc.title||'';
    if(!oldDoc){ // brand new ticket
      if(involvesMe(newDoc, s.onlyAssigned)) addNotif({type:'assign', taskId:id, text:`assigned you · ${title}`, dedup:'assign:'+id});
      else if(s.newInProject && newDoc.project && myProjectSet().has(newDoc.project)) addNotif({type:'newticket', taskId:id, text:`New ticket in your project · ${title}`, dedup:'new:'+id});
      return;
    }
    const inv=involvesMe(newDoc, s.onlyAssigned) || involvesMe(oldDoc, s.onlyAssigned);
    // role/assignee changes
    if(oldDoc.assignee!==newDoc.assignee){
      if(newDoc.assignee===me) addNotif({type:'assign', taskId:id, text:`assigned you · ${title}`, dedup:'assign:'+id+':'+newDoc.assignee});
      else if(oldDoc.assignee===me) addNotif({type:'unassign', taskId:id, text:`unassigned you from ${key}`});
    }
    [['qa','Quality Analyst'],['reviewer','Code Reviewer'],['deployer','Deployer']].forEach(([f,lbl])=>{
      if(oldDoc[f]!==newDoc[f] && newDoc[f]===me) addNotif({type:'role', taskId:id, text:`added you as ${lbl} · ${key}`});
    });
    if(!inv) return;   // remaining events only if I'm involved
    if(oldDoc.status!==newDoc.status){ const st=store.status(newDoc.status);
      if(st && (store.status(newDoc.status)||{}).cat==='done') addNotif({type:'resolved', taskId:id, text:`${key} was marked ${esc(st.name)}`});
      else addNotif({type:'status', taskId:id, text:`${key} moved to ${st?st.name:newDoc.status}`}); }
    if(oldDoc.priority!==newDoc.priority) addNotif({type:'priority', taskId:id, text:`${key} priority set to ${newDoc.priority||'—'}`});
    if(!oldDoc.flagged && newDoc.flagged) addNotif({type:'flag', taskId:id, text:`${key} was flagged`});
    // comments (mentions / replies)
    const oc=(oldDoc.comments||[]).length, nc=(newDoc.comments||[]).length;
    if(nc>oc){ const last=newDoc.comments[nc-1]; const actor=last&&last.user; if(actor!==me){
      const meU=store.user(me); const nm=meU?meU.name:''; const txt=(last&&last.text)||'';
      const mentioned = nm && new RegExp('@\\s*'+nm.split(/\s+/)[0], 'i').test(txt);
      const snip = txt.length>70?txt.slice(0,70)+'…':txt;
      if(mentioned) addNotif({type:'mention', taskId:id, actorId:actor, text:`mentioned you: "${snip}"`});
      else addNotif({type:'reply', taskId:id, actorId:actor, text:`commented on ${key}: "${snip}"`});
    }}
  }catch(e){ __dbg.warn('notif', e); }
}

// due-soon / overdue scan (runs on load)
function scanDueSoon(){
  try{ const s=nset(); if(!s.enabled) return; const me=myUid(); if(!me) return;
    const todayISO=today();
    const days=Number(s.remindBefore)||2; const soon=new Date(); soon.setDate(soon.getDate()+days); const soonISO=_isoLocal(soon);
    store.tasks().forEach(t=>{ if(!t.due) return; if((store.status(t.status)||{}).cat==='done') return;
      if(!involvesMe(t, s.onlyAssigned)) return;
      if(s.onlyMyProjects && t.project && !myProjectSet().has(t.project)) return;
      if(t.due < todayISO){ if(s.overdue) addNotif({type:'overdue', taskId:t.id, text:`${t.key} is overdue · was due ${fdate(t.due)}`, dedup:'overdue:'+t.id+':'+t.due, at:t.due+'T09:00:00'}); }
      else if(t.due<=soonISO){ if(s.dueSoon) addNotif({type:'due', taskId:t.id, text:`${t.key} is due ${t.due===todayISO?'today':fdate(t.due)}`, dedup:'due:'+t.id+':'+t.due, at:new Date().toISOString()}); }
    });
  }catch(e){}
}

function niAvatar(n){ const meta=NTYPE[n.type]||NTYPE.status; const u=n.actorId?store.user(n.actorId):null;
  const badge=`<span class="ni-badge" style="background:${meta.c}">${meta.ic}</span>`;
  if(u) return `<span class="ni-av">${avatar(u,38)}${badge}</span>`;
  return `<span class="ni-av"><span class="ni-tic" style="background:${meta.c}1a;color:${meta.c}">${meta.ic}</span>${badge}</span>`;
}
function niName(n){ if(n.actorId){ const u=store.user(n.actorId); if(u) return esc(u.name); }
  return {assign:'Assigned to you',unassign:'Unassigned',role:'Role added',status:'Status update',priority:'Priority changed',flag:'Flagged',resolved:'Resolved',due:'Due soon',overdue:'Overdue',newticket:'New ticket'}[n.type]||'Update'; }
function renderNotifDrawer(){
  const body=document.getElementById('ndBody'); if(!body) return;
  const all=loadNotifs();
  const unread=all.filter(n=>!n.read).length;
  const mentions=all.filter(n=>n.type==='mention').length;
  document.getElementById('ndcAll').textContent=all.length;
  document.getElementById('ndcUnread').textContent=unread;
  document.getElementById('ndcMentions').textContent=mentions;
  const cp=document.getElementById('ndCount'); if(cp){ if(unread>0){ cp.textContent=unread+' new'; cp.style.display=''; } else cp.style.display='none'; }
  let list=all;
  if(NOTIF_TAB==='unread') list=all.filter(n=>!n.read);
  else if(NOTIF_TAB==='mentions') list=all.filter(n=>n.type==='mention');
  if(!list.length){ body.innerHTML=`<div class="nd-empty"><div class="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></div>${NOTIF_TAB==='all'?'No notifications yet.':'Nothing here.'}<br><span style="font-size:12px">You’ll see updates on your tickets here.</span></div>`; return; }
  const now=Date.now(); const dayMs=864e5;
  const rows=n=>{ const grp=nset().group;
    return `<div class="ni ${n.read?'rd':''}" data-nid="${n.id}" data-task="${n.taskId||''}"><span class="undot"></span>${niAvatar(n)}
      <div class="bd"><div class="top"><span class="nm">${niName(n)}</span>${n.taskId&&store.task(n.taskId)?`<span class="key">${store.task(n.taskId).key}</span>`:''}</div>
      <div class="txt">${esc(n.text)}</div>
      <div class="tm"><span>${timeAgo(n.at)}</span><span class="dot"></span><span class="exact">${fdatetime(n.at)}</span></div></div></div>`; };
  const newer=list.filter(n=>!n.read || (now-Date.parse(n.at))<dayMs);
  const older=list.filter(n=>!(!n.read || (now-Date.parse(n.at))<dayMs));
  let html='';
  if(newer.length) html+=`<div class="nd-sep">New</div>`+newer.map(rows).join('');
  if(older.length) html+=`<div class="nd-sep">Earlier</div>`+older.map(rows).join('');
  body.innerHTML=html;
  body.querySelectorAll('.ni').forEach(el=>el.onclick=()=>{ const nid=el.dataset.nid, tid=el.dataset.task;
    const arr=loadNotifs(); const n=arr.find(x=>x.id===nid); if(n){ n.read=true; saveNotifs(arr); }
    updateBell();
    if(tid && store.task(tid)){ closeNotifs(); const t=store.task(tid); if(!IS_ADMIN && !canView(ui.view)){} ui.openTask=tid; setTimeout(()=>openPanel(tid),80); }
    else renderNotifDrawer();
  });
}
function openNotifs(){ NOTIF_TAB='all'; document.querySelectorAll('#ndTabs button').forEach(b=>b.classList.toggle('on', b.dataset.tab==='all'));
  renderNotifDrawer(); document.getElementById('notifScrim').classList.add('on'); }
function closeNotifs(){ document.getElementById('notifScrim').classList.remove('on'); }
function markAllNotifsRead(){ const arr=loadNotifs(); arr.forEach(n=>n.read=true); saveNotifs(arr); updateBell(); renderNotifDrawer(); }
function clearAllNotifs(){ localStorage.setItem(notifKey(),'[]'); updateBell(); renderNotifDrawer(); }
function wireNotifs(){
  const bell=document.getElementById('notifBell'); if(bell) bell.onclick=openNotifs;
  try{ wireBotbar(); }catch(e){}
  const x=document.getElementById('notifClose'); if(x) x.onclick=closeNotifs;
  const scrim=document.getElementById('notifScrim'); if(scrim) scrim.onclick=e=>{ if(e.target===scrim) closeNotifs(); };
  const mk=document.getElementById('ndMarkAll'); if(mk) mk.onclick=markAllNotifsRead;
  const cl=document.getElementById('ndClear'); if(cl) cl.onclick=clearAllNotifs;
  document.querySelectorAll('#ndTabs button').forEach(b=>b.onclick=()=>{ NOTIF_TAB=b.dataset.tab;
    document.querySelectorAll('#ndTabs button').forEach(x=>x.classList.toggle('on', x===b)); renderNotifDrawer(); });
  const set=document.getElementById('ndSettings'); if(set) set.onclick=()=>{ closeNotifs(); if(IS_ADMIN||true){ setView('settings'); setTimeout(()=>{ const el=document.getElementById('notifPrefAnchor'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); },120); } };
}
