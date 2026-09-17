/* Taskora — 23-guest-preview.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ============================================================
   GUEST PREVIEW
   Anyone can open Taskora without an account and explore a sample
   workspace — boards, a live sprint, backlog, reports. Guests can click
   around and change things, but nothing survives the tab:
     * Supabase is never called (no client, no network writes)
     * localStorage and sessionStorage are swapped for an in-memory map,
       so nothing is written to — or read from — the browser's storage
     * the URL hash isn't updated, so nothing lands in browser history
     * the page opts out of the back/forward cache
   Refreshing, closing the tab or signing in wipes everything.
   Guests never see real workspace data: the sample is generated here.
============================================================ */
let GUEST = false;


function guestData(){
  const D=864e5, H=36e5, now=Date.now();
  const iso=ms=>new Date(ms).toISOString();
  const day=ms=>_isoLocal(new Date(ms));
  const ws='ws_guest', bid='b_guest';
  const statuses=JSON.parse(JSON.stringify(DEFAULT_STATUSES));
  const board=Object.assign(defaultBoard(ws), { id:bid, name:'Delivery', type:'scrum', access:'workspace', members:[] });
  const P=(id,name,email,perm,i)=>({ id, name, email, role:perm==='Admin'?'PM':'Developer', perm, profile:perm==='Admin'?'pf_admin':'pf_users', toolRole:perm==='Admin'?'admin':'user', color:SWATCHES[(i*2)%SWATCHES.length], prefs:{} });
  const users=[
    P('u_guest','Guest (you)','guest@taskora.app','Admin',0),
    P('u_ana','Ananya Iyer','ananya@example.com','Admin',1),
    P('u_rahul','Rahul Menon','rahul@example.com','Developer',2),
    P('u_sara','Sara Khan','sara@example.com','Developer',3),
    P('u_leo','Leo Fernandes','leo@example.com','Developer',4),
    P('u_mei','Mei Tanaka','mei@example.com','Developer',5),
    P('u_omar','Omar Haddad','omar@example.com','Developer',6)
  ];
  const team=['u_ana','u_rahul','u_sara','u_leo','u_mei','u_omar'];
  const projects=[
    { id:'p_web', name:'Web storefront', key:'WEB', board:bid, color:'#0C5A9E' },
    { id:'p_mob', name:'Mobile app',     key:'MOB', board:bid, color:'#0E8FA8' },
    { id:'p_api', name:'Platform API',   key:'API', board:bid, color:'#7A3FF2' }
  ];
  const counters={ WEB:0, MOB:0, API:0, HELP:0, OPS:0 };
  const key=pid=>{ const k=projects.find(p=>p.id===pid).key; counters[k]++; return k+'-'+counters[k]; };
  const tasks=[], worklogs=[];
  let rank=1000;
  const epic=(id,title,pid,color)=>{ const t={ id, ws, board:null, project:pid, key:key(pid), title, type:'Epic', status:'st_dev', priority:'High', color,
      assignee:'u_ana', reporter:'u_ana', createdAt:day(now-60*D), createdTs:iso(now-60*D), updatedAt:day(now-2*D), resolution:'Unresolved', desc:'' };
    tasks.push(t); return id; };
  const E1=epic('e_checkout','Checkout redesign','p_web','#D6264F');
  const E2=epic('e_payments','UPI & wallet payments','p_api','#7C3AED');
  const E3=epic('e_mobile','Mobile app v3','p_mob','#0E8FA8');
  const E4=epic('e_search','Faster product search','p_web','#B96A00');

  const sprints=[];
  const mkSprint=(id,name,startDaysAgo,state,goal)=>{ const st=now-startDaysAgo*D; const s={ id, ws, board:bid, name, goal, state, order:sprints.length+1, createdAt:iso(st-2*D),
      start:iso(st), end:iso(st+14*D), startedAt:state==='future'?undefined:iso(st) }; if(state==='future'){ s.start=null; s.end=null; delete s.startedAt; } sprints.push(s); return s; };

  const add=(o)=>{
    const t=Object.assign({ id:'t_'+(tasks.length+1), ws, board:bid, type:'Story', priority:'Medium', reporter:'u_ana', resolution:'Unresolved',
      createdAt:day(now-40*D), createdTs:iso(now-40*D), updatedAt:day(now-D), resolvedAt:null, desc:'', rank:(rank+=1000), sprintHistory:[] }, o);
    t.key=key(t.project);
    const s=t.sprint?sprints.find(x=>x.id===t.sprint):null;
    if(s && s.startedAt){ const st=Date.parse(s.startedAt); t.sprintHistory.push({ sprint:s.id, action:'added', at:iso(t.addedDaysAfterStart!=null ? st+t.addedDaysAfterStart*D : st-H), by:'u_ana' }); }
    else if(s){ t.sprintHistory.push({ sprint:s.id, action:'added', at:iso(now-D), by:'u_ana' }); }
    if(t.doneDaysAfterStart!=null && s){ const at=Date.parse(s.startedAt)+t.doneDaysAfterStart*D; t.status='st_done'; t.resolution='Done'; t.resolvedAt=day(at); t.resolvedTs=iso(at); t.updatedAt=day(at); }
    delete t.addedDaysAfterStart; delete t.doneDaysAfterStart;
    if(t.logH){ worklogs.push({ id:'w_'+t.id, task:t.id, user:t.assignee||'u_rahul', cat:'Development', min:Math.round(t.logH*60), date:t.resolvedAt||day(now-2*D), note:'', loggedAt:iso(now-2*D) }); delete t.logH; }
    tasks.push(t); return t;
  };
  const snap=(s, ids)=>{ let points=0, hours=0; const values={}; ids.forEach(id=>{ const t=tasks.find(x=>x.id===id); const p=Number(t.points)||0, h=(t.estimate||0)/60; values[id]={p,h}; points+=p; hours+=h; }); return { ids, values, count:ids.length, points, hours }; };

  // ---- three completed sprints (velocity + history) --------------------------
  const closedDefs=[
    ['sp_g1','Sprint 21',48,'Ship the new cart page',[ ['Cart page layout','p_web','u_rahul',5,E1,3],['Persist cart across devices','p_api','u_omar',8,E1,9],['Cart empty state','p_web','u_sara',2,E1,4],['Remove item animation','p_mob','u_mei',3,E3,12],['Rate limit cart API','p_api','u_omar',3,null,null],['Promo banner slot','p_web','u_leo',2,null,null] ]],
    ['sp_g2','Sprint 22',34,'Checkout address + delivery slots',[ ['Address autocomplete','p_web','u_sara',5,E1,6],['Delivery slot picker','p_mob','u_mei',8,E3,11],['Slot availability API','p_api','u_omar',5,E2,5],['Save default address','p_web','u_rahul',3,E1,8],['Pincode validation','p_web','u_leo',2,E1,2],['Checkout analytics events','p_web','u_rahul',3,null,13],['Accessibility pass on forms','p_web','u_sara',3,E1,null] ]],
    ['sp_g3','Sprint 23',20,'UPI collect flow behind a flag',[ ['UPI collect request API','p_api','u_omar',8,E2,7],['UPI app chooser (Android)','p_mob','u_mei',5,E2,9],['Payment status polling','p_api','u_omar',3,E2,10],['Order confirmation email','p_api','u_leo',2,null,4],['Retry failed payments','p_web','u_rahul',5,E2,12],['Feature flag service','p_api','u_omar',3,null,null] ]]
  ];
  closedDefs.forEach(([sid,name,ago,goal,rows])=>{
    const s=mkSprint(sid,name,ago,'closed',goal);
    const made=rows.map(([title,pid,who,pts,ep,doneOn])=>add({ title, project:pid, assignee:who, points:pts, estimate:pts*90, parent:ep, sprint:sid, status:'st_backlog',
      type:pts>=5?'Story':'Task', doneDaysAfterStart:doneOn, logH:doneOn!=null?pts*1.2:null }));
    s.committed=snap(s, made.map(t=>t.id));
    const done=made.filter(t=>t.status==='st_done'), open=made.filter(t=>t.status!=='st_done');
    const c=snap(s, done.map(t=>t.id)); delete c.values; const o=snap(s, open.map(t=>t.id)); delete o.values;
    s.completedAt=iso(Date.parse(s.startedAt)+14*D); s.completed=c; s.incomplete=o; s.movedTo='backlog';
    open.forEach(t=>{ t.sprintHistory.push({ sprint:sid, action:'removed', at:s.completedAt, by:'u_ana' }); t.sprint=null; t.status='st_ready'; });
  });

  // ---- the active sprint ------------------------------------------------------
  const act=mkSprint('sp_g4','Sprint 24',6,'active','UPI live for 10% of users; wallet top-up in beta');
  const actRows=[
    { title:'Enable UPI for 10% rollout',            project:'p_api', assignee:'u_omar',  points:5, parent:E2, type:'Story', priority:'Highest', doneDaysAfterStart:2, logH:6 },
    { title:'Wallet balance on account page',        project:'p_web', assignee:'u_sara',  points:3, parent:E2, type:'Story', doneDaysAfterStart:3, logH:4 },
    { title:'Fix double charge on slow networks',    project:'p_api', assignee:'u_rahul', points:2, parent:E2, type:'Bug', priority:'Highest', doneDaysAfterStart:5, logH:3, flagged:false },
    { title:'Wallet top-up screen',                  project:'p_mob', assignee:'u_mei',   points:8, parent:E2, type:'Story', status:'st_dev', logH:9 },
    { title:'Payment method icons refresh',          project:'p_web', assignee:'u_leo',   points:2, parent:E1, type:'Task', status:'st_review' },
    { title:'Refund to wallet',                      project:'p_api', assignee:'u_omar',  points:5, parent:E2, type:'Story', status:'st_qa', logH:5 },
    { title:'Checkout load time under 2s',           project:'p_web', assignee:'u_rahul', points:5, parent:E1, type:'Story', status:'st_dev', priority:'High', flagged:true },
    { title:'UPI intent flow on iOS',                project:'p_mob', assignee:'u_mei',   points:3, parent:E2, type:'Story', status:'st_ready' },
    { title:'Crash when switching payment tabs',     project:'p_mob', assignee:'u_sara',  points:2, parent:E3, type:'Bug', priority:'High', status:'st_ready', addedDaysAfterStart:3 }
  ];
  const actTasks=actRows.map(r=>add(Object.assign({ sprint:'sp_g4', status:'st_backlog', estimate:(r.points||1)*90 }, r)));
  act.committed=snap(act, actTasks.filter(t=>t.sprintHistory[0].at < act.startedAt).map(t=>t.id));

  // ---- next sprint + backlog --------------------------------------------------
  mkSprint('sp_g5','Sprint 25',0,'future','Search relevance and filters');
  [
    ['Typo-tolerant search','p_api','u_omar',8,E4,'Story'],['Search filters: price and brand','p_web','u_sara',5,E4,'Story'],
    ['Recent searches on mobile','p_mob','u_mei',3,E4,'Story'],['Search results skeleton loader','p_web','u_leo',2,E4,'Task']
  ].forEach(([title,pid,who,pts,ep,type])=>add({ title, project:pid, assignee:who, points:pts, estimate:pts*90, parent:ep, type, sprint:'sp_g5', status:'st_ready' }));
  [
    ['Dark mode for mobile app','p_mob',null,8,E3,'Story','Low'],['Gift cards','p_api',null,13,null,'Story','Medium'],
    ['Wishlist sharing link','p_web','u_leo',3,null,'Story','Low'],['Order tracking map','p_mob','u_mei',8,E3,'Story','Medium'],
    ['Coupon stacking rules','p_api','u_omar',5,E1,'Story','High'],['Guest checkout','p_web','u_rahul',8,E1,'Story','High'],
    ['Image CDN migration','p_web',null,null,null,'Task','Medium'],['Currency formatting bug on invoices','p_api','u_omar',1,null,'Bug','High'],
    ['Push notification preferences','p_mob',null,null,E3,'Story','Low'],['Bulk order CSV export','p_api',null,5,null,'Story','Low']
  ].forEach(([title,pid,who,pts,ep,type,prio],i)=>add({ title, project:pid, assignee:who, points:pts, estimate:pts?pts*90:null, parent:ep, type, priority:prio, status:i%3===0?'st_backlog':'st_ready', flagged:i===5 }));

  // a little conversation so the ticket panel has something to show
  const upi=tasks.find(t=>t.title==='Enable UPI for 10% rollout');
  upi.comments=[{ id:'c_1', user:'u_ana', text:'Rollout flag is on for internal users first — then 10%.', date:iso(now-5*D) },{ id:'c_2', user:'u_omar', text:'Done. Success rate 98.4% over the first 2,000 payments.', date:iso(now-3*D) }];
  upi.activity=[{ id:'a_1', by:'u_omar', text:'changed status to Done', at:iso(now-4*D) }];

  // ---- Support: a Kanban board with its own projects, epics and flow history ----
  const kb=Object.assign(defaultBoard(ws), { id:'b_support', name:'Support', type:'kanban', access:'workspace', members:[],
    columns:['st_ready','st_dev','st_review','st_done'], transitions:{} });
  projects.push({ id:'p_help', name:'Customer support', key:'HELP', board:'b_support', color:'#D6264F' },
                { id:'p_ops',  name:'Operations',       key:'OPS',  board:'b_support', color:'#B96A00' });
  const EK1=epic('e_onboard','Onboarding friction','p_help','#0E8FA8');
  const EK2=epic('e_reliab','Infra reliability','p_ops','#CE2F26');
  tasks.filter(t=>t.id===EK1||t.id===EK2).forEach(t=>{ t.board='b_support'; t.assignee='u_ana'; });
  const flow=['st_ready','st_dev','st_review','st_done'];
  [
    ['Password reset email lands in spam','p_help','u_sara','Bug','High',EK1,3],['Refund stuck in pending for 5 days','p_help','u_rahul','Bug','Highest',null,3],
    ['Add FAQ for UPI failures','p_help','u_leo','Task','Low',EK1,3],['Bulk update order statuses','p_ops','u_omar','Task','Medium',null,3],
    ['Rotate payment gateway API keys','p_ops','u_omar','Task','High',EK2,3],['Alert on checkout error spikes','p_ops','u_omar','Story','High',EK2,3],
    ['Invoice PDF shows wrong GST','p_help','u_rahul','Bug','High',null,3],['Onboarding checklist for sellers','p_help','u_mei','Story','Medium',EK1,3],
    ['Database backup restore drill','p_ops','u_omar','Task','Medium',EK2,3],['Customer cannot change phone number','p_help','u_sara','Bug','Medium',EK1,2],
    ['Slow order history page','p_ops','u_rahul','Bug','High',EK2,2],['Seller payout delayed','p_help','u_leo','Bug','Highest',null,1],
    ['Status page for outages','p_ops','u_omar','Story','Medium',EK2,1],['Welcome email copy refresh','p_help','u_mei','Task','Low',EK1,0],
    ['Duplicate SMS on delivery','p_help','u_sara','Bug','Medium',null,0],['Log retention policy','p_ops',null,'Task','Low',EK2,0]
  ].forEach(([title,pid,who,type,prio,ep,_st],i)=>{
    const stage=[3,3,2,3,3,1,3,3,2,3,1,3,2,0,3,1][i];
    const born=now-(29-i*1.7)*D;
    let at=born; const hist=[{ status:flow[0], at:iso(at) }];
    const gaps=[0.6+(i%3)*0.9, 0.5+(i%4)*0.6, 0.4+(i%2)*0.8];
    for(let k=1;k<=stage;k++){ at+=gaps[k-1]*D; if(at>now-2*H) break; hist.push({ status:flow[k], at:iso(at) }); }
    const last=hist[hist.length-1];
    const t=add({ title, project:pid, board:'b_support', assignee:who, type, priority:prio, parent:ep, status:last.status,
      createdAt:day(born), createdTs:iso(born), updatedAt:day(Date.parse(last.at)), statusHistory:hist, estimate:(i%4+1)*60 });
    if(last.status==='st_done'){ t.resolution='Done'; t.resolvedAt=day(Date.parse(last.at)); t.resolvedTs=last.at; }
  });

  return {
    settings:{ workspaceName:'Acme Commerce', defaultView:'board', defaultBoard:bid, fields:[], sprintCfg:{ parallel:false, defaultWeeks:2 } },
    projects, statuses, boards:[board, kb], users,
    teams:[{ id:'tm_web', name:'Web', lead:'u_ana', members:['u_rahul','u_sara','u_leo'] },{ id:'tm_mob', name:'Mobile', lead:'u_ana', members:['u_mei'] },{ id:'tm_plat', name:'Platform', lead:'u_ana', members:['u_omar'] }],
    releases:[{ id:'r_g1', name:'v2.3', date:day(now-18*D), status:'released', desc:'Cart and address improvements' },{ id:'r_g2', name:'v2.4', date:day(now+9*D), status:'unreleased', desc:'UPI and wallet' }],
    sprints, tasks, worklogs,
    spaces:[{ id:ws, name:'Acme Commerce', desc:'Sample workspace for the guest preview', icon:'rocket', members:users.map(u=>u.id), createdAt:day(now-60*D) }],
    chatChannels:[{ id:'ch_general', name:'General', type:'group', members:users.map(u=>u.id) }],
    chatMessages:[], accessRequests:[]
  };
}

function enterGuest(){
  if(GUEST) return;
  GUEST = true;
  guestLockStorage();
  REMOTE = false;
  try{ if(sb && sb.auth && sb.auth.stopAutoRefresh) sb.auth.stopAutoRefresh(); }catch(e){}
  sb = null; pmdb = null; ME = null; WS = null;
  // never restore this page from the back/forward cache
  window.addEventListener('unload', ()=>{});
  window.addEventListener('pageshow', e=>{ if(e.persisted) location.reload(); });

  store.data = guestData();
  STATUSES = store.data.statuses;
  IS_ADMIN = true; IS_MASTER = true; TOOL_ROLE = 'admin'; MY_ROLE = 'guest';
  { const as=document.getElementById('authScreen'); if(as) as.style.display = 'none'; }
  document.body.classList.add('is-guest');
  const bar = document.getElementById('guestBar');
  if(bar){ bar.hidden = false; const si=document.getElementById('guestSignIn'); if(si) si.style.display = ''; }

  applyDefaults(); applyPrefs(); ensureSpaces(); renderAll(); wireSpaces();
  enterSpace('ws_guest');
  ui.board = 'b_guest'; ui.boardChosen = false; ui.allBoards = false;
  if(typeof boardMarkSeen==='function') boardMarkSeen();
  setView('board');
  try{ scanNoteMentions(); }catch(e){}
  try{ wireNotifs(); scanDueSoon(); updateBell(); }catch(e){}
  const setEl=(id,fn)=>{ const e=document.getElementById(id); if(e) fn(e); };
  setEl('acctName', e=>e.textContent='Guest');
  setEl('acctRole', e=>e.textContent='Preview — not saved');
  setEl('apName', e=>e.textContent='Guest'); setEl('apEmail', e=>e.textContent='Not signed in'); setEl('apRole', e=>e.textContent='Guest');
}
function leaveGuest(){
  // a full page load is what guarantees every in-memory change is gone
  location.replace('index.html');
}
