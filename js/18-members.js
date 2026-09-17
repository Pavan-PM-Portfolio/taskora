/* Taskora — 18-members.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ============================================================
   MEMBERS — who can sign in to this workspace.
   Accounts are created here or in Supabase → Authentication → Users.
   Roles, passwords and status change only through the admin-users
   Edge Function; the browser can never write them directly.
============================================================ */
const ROLE_LABEL={owner:'Owner', admin:'Admin', member:'Member'};
const ROLE_RANK={owner:3, admin:2, member:1};
let MY_ROLE=null;
let _members=[], _memFilter='active', _memQuery='';
async function callAdmin(action, payload){
  if(GUEST) throw new Error('Guests can only look around. Sign in as an owner or admin to manage members.');
  if(!(typeof sb!=='undefined' && sb && sb.auth)) throw new Error('Not connected to Supabase.');
  const {data:{session}}=await sb.auth.getSession();
  const res=await fetch(SUPABASE_URL+'/functions/v1/admin-users',{ method:'POST',
    headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON,'Authorization':'Bearer '+(session?session.access_token:'')},
    body:JSON.stringify(Object.assign({action}, payload||{})) });
  const out=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(out.error||('Request failed ('+res.status+')'));
  return out;
}
function canManageMember(m){
  if(!IS_ADMIN || !ME || !m || m.id===ME.id) return false;
  if(MY_ROLE==='owner') return true;
  return (ROLE_RANK[MY_ROLE]||0) > (ROLE_RANK[m.role]||0);
}
function roleOptions(cur){
  const roles = MY_ROLE==='owner' ? ['member','admin','owner'] : ['member','admin'];
  return roles.map(r=>`<option value="${r}" ${r===cur?'selected':''}>${ROLE_LABEL[r]}</option>`).join('');
}
function memName(m){ return m.full_name || [m.first_name,m.last_name].filter(Boolean).join(' ') || (m.email||'').split('@')[0] || '—'; }
function memWhen(iso){ if(!iso) return 'Never signed in'; try{ return 'Last sign-in '+new Date(iso).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return ''; } }
async function loadMembers(){
  if(IS_ADMIN){ const out=await callAdmin('list'); return out.users||[]; }
  const {data,error}=await sb.from('profiles').select('id,email,full_name,first_name,last_name,role,status,avatar_url,created_at').order('created_at');
  if(error) throw error;
  return data||[];
}
async function renderUsers(){
  const el=document.getElementById('usersedwrap');
  if(!REMOTE){
    const rows=store.users();
    el.innerHTML=`<div class="ov-h"><h2>Members</h2><span class="range">${rows.length} sample members</span></div>
      <div class="mem-note">These are sample members in the guest preview. Sign in as an owner or admin to add and manage real people.</div>
      <div class="um-list">${rows.map(u=>`<div class="um-row">${avatar(u,34)}<div class="um-info"><div class="um-nm">${esc(u.name)}</div><div class="um-em">${esc(u.email||'—')}</div></div><span class="um-rolebadge ${pmRole(u).cls}">${esc(pmRole(u).label)}</span></div>`).join('')}</div>`;
    return;
  }
  el.innerHTML=`<div class="ov-h"><h2>Members</h2>${IS_ADMIN?'<button class="btn primary" id="memAdd">Add member</button>':''}</div>
    <div class="mem-bar">
      <div class="mem-tabs" id="memTabs">
        <button data-f="active">Active <span id="memCntA"></span></button>
        <button data-f="deactivated">Deactivated <span id="memCntD"></span></button>
        <button data-f="all">All</button>
      </div>
      <input class="mem-search" id="memSearch" type="search" placeholder="Search by name or email" value="${esc(_memQuery)}"/>
    </div>
    <div class="um-list" id="memList"><p class="ov-cap">Loading members…</p></div>`;
  const add=document.getElementById('memAdd'); if(add) add.onclick=openAddMember;
  document.querySelectorAll('#memTabs button').forEach(b=>{ b.classList.toggle('on', b.dataset.f===_memFilter);
    b.onclick=()=>{ _memFilter=b.dataset.f; document.querySelectorAll('#memTabs button').forEach(x=>x.classList.toggle('on', x===b)); paintMembers(); }; });
  const q=document.getElementById('memSearch'); if(q) q.oninput=()=>{ _memQuery=q.value; paintMembers(); };
  try{ _members=await loadMembers(); }
  catch(e){ const box=document.getElementById('memList'); if(box) box.innerHTML='<p class="ov-cap">Couldn’t load members: '+esc(e.message||'error')+'</p>'; return; }
  paintMembers();
}
function paintMembers(){
  const box=document.getElementById('memList'); if(!box) return;
  const a=_members.filter(m=>m.status==='active').length, d=_members.length-a;
  const ca=document.getElementById('memCntA'); if(ca) ca.textContent=a;
  const cd=document.getElementById('memCntD'); if(cd) cd.textContent=d;
  const q=_memQuery.trim().toLowerCase();
  const rows=_members
    .filter(m=>_memFilter==='all' || m.status===_memFilter)
    .filter(m=>!q || memName(m).toLowerCase().includes(q) || (m.email||'').toLowerCase().includes(q))
    .sort((x,y)=>(ROLE_RANK[y.role]-ROLE_RANK[x.role]) || memName(x).localeCompare(memName(y)));
  if(!rows.length){ box.innerHTML=`<p class="ov-cap">${_members.length?'No members match.':'No members yet. Add the first one to get started.'}</p>`; return; }
  box.innerHTML=rows.map(m=>{
    const manage=canManageMember(m), me=ME&&m.id===ME.id, off=m.status!=='active';
    const photo=m.avatar_url?`<div class="um-ava is-photo"><img src="${esc(m.avatar_url)}" alt="" loading="lazy"></div>`:`<div class="um-ava is-glyph">${ACCT_GLYPH}</div>`;
    const role = manage && !off
      ? `<select class="mem-role" data-id="${m.id}" aria-label="Role for ${esc(memName(m))}">${roleOptions(m.role)}</select>`
      : `<span class="um-rolebadge r-${m.role==='owner'?'master':m.role==='admin'?'admin':'user'}">${ROLE_LABEL[m.role]||m.role}</span>`;
    const actions = manage ? `<div class="mem-acts">
        ${off?'':`<button class="btn" data-act="reset" data-id="${m.id}">Reset password</button>`}
        <button class="btn" data-act="${off?'activate':'deactivate'}" data-id="${m.id}">${off?'Reactivate':'Deactivate'}</button>
        <button class="btn mem-danger" data-act="delete" data-id="${m.id}">Remove</button>
      </div>` : '';
    return `<div class="um-row mem-row ${off?'is-off':''}">${photo}
      <div class="um-info"><div class="um-nm">${esc(memName(m))}${me?' <span class="mem-you">You</span>':''}${off?' <span class="mem-off">Deactivated</span>':''}</div>
        <div class="um-em">${esc(m.email||'—')}${IS_ADMIN?` <span class="mem-when">${esc(memWhen(m.last_sign_in_at))}</span>`:''}</div></div>
      ${role}${actions}</div>`;
  }).join('');
  box.querySelectorAll('.mem-role').forEach(sel=>sel.onchange=async()=>{
    const m=_members.find(x=>x.id===sel.dataset.id); if(!m) return;
    const prev=m.role, next=sel.value;
    if(next==='owner' && !confirm('Make '+memName(m)+' an owner? Owners can manage every member, including other owners.')){ sel.value=prev; return; }
    sel.disabled=true;
    try{ await callAdmin('set_role',{user_id:m.id, role:next}); m.role=next; toast(memName(m)+' is now '+ROLE_LABEL[next]); _suiteSynced=false; syncSuitePeople(); }
    catch(e){ sel.value=prev; toast(e.message); }
    finally{ sel.disabled=false; paintMembers(); }
  });
  box.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>memberAction(b.dataset.act, _members.find(x=>x.id===b.dataset.id)));
}
async function memberAction(act, m){
  if(!m) return;
  const nm=memName(m);
  if(act==='reset'){ openResetPassword(m); return; }
  if(act==='deactivate'){
    if(!confirm('Deactivate '+nm+'? They are signed out and can’t sign in again until reactivated. Their tickets and time logs stay as they are.')) return;
    try{ await callAdmin('set_status',{user_id:m.id, status:'deactivated'}); toast(nm+' deactivated'); }catch(e){ toast(e.message); return; }
  }
  if(act==='activate'){
    try{ await callAdmin('set_status',{user_id:m.id, status:'active'}); toast(nm+' reactivated'); }catch(e){ toast(e.message); return; }
  }
  if(act==='delete'){
    if(!confirm('Remove '+nm+' permanently? Their login is deleted. Tickets keep their name, but this can’t be undone.')) return;
    try{ await callAdmin('delete',{user_id:m.id}); toast(nm+' removed'); }catch(e){ toast(e.message); return; }
  }
  _suiteSynced=false; syncSuitePeople();
  renderUsers();
}
function tskModal(title, bodyHTML, width){
  const ov=document.createElement('div'); ov.className='colm-overlay tsk-modal';
  ov.innerHTML=`<div class="colm" style="width:${width||440}px;max-width:94vw" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="colm-h"><span>${esc(title)}</span><button class="nd-x tsk-x" aria-label="Close">✕</button></div>
    <div class="tsk-mbody">${bodyHTML}</div></div>`;
  document.body.appendChild(ov);
  const close=()=>ov.remove();
  ov.querySelector('.tsk-x').onclick=close;
  ov.addEventListener('mousedown',e=>{ if(e.target===ov) close(); });
  ov.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
  setTimeout(()=>{ const f=ov.querySelector('input,select,button.btn'); if(f) f.focus(); },30);
  return {el:ov, close, q:sel=>ov.querySelector(sel)};
}
function pwChoiceHTML(){
  return `<div class="pw-field"><label>Password</label>
      <div class="mem-seg" data-pw><button type="button" class="on" data-v="gen">Generate one</button><button type="button" data-v="set">Set it myself</button></div>
      <input type="text" id="mPass" placeholder="At least 8 characters" autocomplete="new-password" style="display:none;margin-top:8px"/></div>
    <label class="mem-check"><input type="checkbox" id="mMust" checked/> Ask them to choose a new password after signing in</label>`;
}
function wirePwChoice(d){
  let mode='gen';
  d.el.querySelectorAll('[data-pw] button').forEach(b=>b.onclick=()=>{ mode=b.dataset.v;
    d.el.querySelectorAll('[data-pw] button').forEach(x=>x.classList.toggle('on', x===b));
    const i=d.q('#mPass'); i.style.display=mode==='set'?'':'none'; if(mode==='set') i.focus(); });
  return ()=>({ mode, password: mode==='set' ? d.q('#mPass').value : undefined, require_change: d.q('#mMust').checked });
}
function showCredentials(email, password, verb){
  const d=tskModal(verb, `<p class="mem-p">Share these with ${esc(email)} through a private channel. The password isn’t shown again.</p>
    <div class="mem-cred"><div><span>Email</span><code>${esc(email)}</code></div><div><span>Password</span><code id="credPw">${esc(password)}</code></div></div>
    <div class="mem-foot"><button class="btn" id="credCopy">Copy both</button><button class="btn primary" id="credDone">Done</button></div>`);
  d.q('#credCopy').onclick=async()=>{ try{ await navigator.clipboard.writeText('Email: '+email+'\nPassword: '+password+'\nSign in: '+location.origin+location.pathname); toast('Copied'); }catch(e){ toast('Copy failed — select the text instead'); } };
  d.q('#credDone').onclick=d.close;
}
function openAddMember(){
  const d=tskModal('Add member', `
    <div class="mem-grid2">
      <div class="pw-field"><label for="mFirst">First name</label><input id="mFirst" autocomplete="off"/></div>
      <div class="pw-field"><label for="mLast">Last name</label><input id="mLast" autocomplete="off"/></div>
    </div>
    <div class="pw-field"><label for="mEmail">Email</label><input id="mEmail" type="email" placeholder="name@company.com" autocomplete="off"/></div>
    <div class="pw-field"><label for="mRole">Role</label><select id="mRole" class="mem-sel">${roleOptions('member')}</select>
      <div class="mem-hint">Members get the permissions you set in Settings. Admins manage boards, settings and members. Owners can also manage admins.</div></div>
    ${pwChoiceHTML()}
    <div class="pw-err" id="mErr"></div>
    <div class="mem-foot"><button class="btn" id="mCancel">Cancel</button><button class="btn primary" id="mSave">Add member</button></div>`, 480);
  const pw=wirePwChoice(d);
  d.q('#mCancel').onclick=d.close;
  d.q('#mSave').onclick=async()=>{
    const err=m=>{ const e=d.q('#mErr'); e.textContent=m; e.classList.add('on'); };
    const first=d.q('#mFirst').value.trim(), last=d.q('#mLast').value.trim(), email=d.q('#mEmail').value.trim().toLowerCase();
    const p=pw();
    if(!first) return err('Enter a first name.');
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err('Enter a valid email address.');
    if(p.mode==='set' && (p.password||'').length<8) return err('Passwords need at least 8 characters.');
    const btn=d.q('#mSave'); btn.disabled=true; btn.textContent='Adding…';
    try{
      const out=await callAdmin('create',{ email, first_name:first, last_name:last, role:d.q('#mRole').value, password:p.password, require_change:p.require_change });
      d.close(); toast(first+' added');
      _suiteSynced=false; syncSuitePeople(); renderUsers();
      showCredentials(email, out.password, 'Member added');
    }catch(e){ err(e.message); btn.disabled=false; btn.textContent='Add member'; }
  };
}
function openResetPassword(m){
  const d=tskModal('Reset password', `<p class="mem-p">Set a new password for <b>${esc(memName(m))}</b>. Their current sessions stay signed in until they expire.</p>
    ${pwChoiceHTML()}<div class="pw-err" id="mErr"></div>
    <div class="mem-foot"><button class="btn" id="mCancel">Cancel</button><button class="btn primary" id="mSave">Reset password</button></div>`);
  const pw=wirePwChoice(d);
  d.q('#mCancel').onclick=d.close;
  d.q('#mSave').onclick=async()=>{
    const p=pw(); const e=d.q('#mErr');
    if(p.mode==='set' && (p.password||'').length<8){ e.textContent='Passwords need at least 8 characters.'; e.classList.add('on'); return; }
    const btn=d.q('#mSave'); btn.disabled=true; btn.textContent='Resetting…';
    try{ const out=await callAdmin('reset_password',{ user_id:m.id, password:p.password, require_change:p.require_change });
      d.close(); showCredentials(m.email, out.password, 'Password reset'); }
    catch(x){ e.textContent=x.message; e.classList.add('on'); btn.disabled=false; btn.textContent='Reset password'; }
  };
}
function openChangePassword(){
  if(!(typeof sb!=='undefined' && sb && ME)){ toast('Guests don\u2019t have a password. Sign in to change yours.'); return; }
  const d=tskModal('Change password', `
    <div class="pw-field"><label for="cpCur">Current password</label><input type="password" id="cpCur" autocomplete="current-password"/></div>
    <div class="pw-field"><label for="cpNew">New password</label><input type="password" id="cpNew" autocomplete="new-password"/></div>
    <div class="pw-field"><label for="cpNew2">Confirm new password</label><input type="password" id="cpNew2" autocomplete="new-password"/></div>
    <div class="pw-err" id="cpErr"></div>
    <div class="mem-foot"><button class="btn" id="cpCancel">Cancel</button><button class="btn primary" id="cpSave">Change password</button></div>`);
  d.q('#cpCancel').onclick=d.close;
  d.q('#cpSave').onclick=async()=>{
    const err=m=>{ const e=d.q('#cpErr'); e.textContent=m; e.classList.add('on'); };
    const cur=d.q('#cpCur').value, nw=d.q('#cpNew').value, nw2=d.q('#cpNew2').value;
    if(!cur) return err('Enter your current password.');
    if(nw.length<8) return err('New passwords need at least 8 characters.');
    if(nw!==nw2) return err('The new passwords don’t match.');
    const btn=d.q('#cpSave'); btn.disabled=true; btn.textContent='Saving…';
    const {error:ce}=await sb.auth.signInWithPassword({email:ME.email, password:cur});
    if(ce){ btn.disabled=false; btn.textContent='Change password'; return err('Your current password is incorrect.'); }
    const {error:ue}=await sb.auth.updateUser({password:nw, data:{must_change_pw:false}});
    if(ue){ btn.disabled=false; btn.textContent='Change password'; return err(ue.message||'Could not change the password.'); }
    d.close(); toast('Password changed');
  };
}
function openRecoveryPassword(){
  const d=tskModal('Choose a new password', `<p class="mem-p">You opened a password reset link. Pick a new password to finish.</p>
    <div class="pw-field"><label for="rpNew">New password</label><input type="password" id="rpNew" autocomplete="new-password"/></div>
    <div class="pw-field"><label for="rpNew2">Confirm new password</label><input type="password" id="rpNew2" autocomplete="new-password"/></div>
    <div class="pw-err" id="rpErr"></div>
    <div class="mem-foot"><button class="btn primary" id="rpSave">Save password</button></div>`);
  d.q('.tsk-x').style.display='none';
  d.q('#rpSave').onclick=async()=>{
    const err=m=>{ const e=d.q('#rpErr'); e.textContent=m; e.classList.add('on'); };
    const nw=d.q('#rpNew').value, nw2=d.q('#rpNew2').value;
    if(nw.length<8) return err('Passwords need at least 8 characters.');
    if(nw!==nw2) return err('The passwords don’t match.');
    const {error}=await sb.auth.updateUser({password:nw, data:{must_change_pw:false}});
    if(error) return err(error.message||'Could not save the password.');
    d.close(); toast('Password saved'); try{ history.replaceState(null,'',location.pathname); }catch(e){}
  };
}
function applyDefaults(){
  try{ syncPriorities(); }catch(e){}
  // Standalone / offline use: no backend to seed from, so build the default
  // workflow locally rather than rendering a board with no columns.
  if(!(store.data.statuses && store.data.statuses.length)){
    store.data.statuses=JSON.parse(JSON.stringify(DEFAULT_STATUSES));
    STATUSES=store.data.statuses;
  }
  if(!(store.data.boards && store.data.boards.length)){
    const bd=defaultBoard('ws_main');
    store.data.boards=[bd];
    store.data.settings.defaultBoard=bd.id;
  }
  CURRENT_UID=(function(){
    // Authenticated (real backend): resolve strictly by auth id / email.
    // NEVER fall back to the first person on the list — that silently grants
    // someone else's identity (and their admin rights / workspace access).
    if(typeof ME!=='undefined' && ME){
      const m=store.users().find(u=>u.authId===ME.id)
           || store.users().find(u=>u.email&&ME.email&&u.email.toLowerCase()===ME.email.toLowerCase());
      return m?m.id:null;
    }
    // Local / no-auth (preview) mode only.
    return (store.users()[0]||{}).id||null;
  })();
  const mu=store.user(CURRENT_UID);
  const db=(mu&&mu.prefs&&mu.prefs.defaultBoard)||store.settings().defaultBoard;
  const dv=(mu&&mu.prefs&&mu.prefs.defaultView)||store.settings().defaultView;
  if(db && store.board(db)) ui.board=db;
  if(dv) ui.view=dv;
  if(!store.data.chatChannels){ const ids=store.users().map(u=>u.id);
    store.data.chatChannels=[
      {id:'ch_general', name:'General', type:'group', members:ids.slice()},
      {id:'ch_tech', name:'Delivery', type:'group', members:ids.slice()}
    ]; }
  if(!store.data.chatMessages) store.data.chatMessages=[];
  if(!store.data.accessRequests) store.data.accessRequests=[];
}
function scheduleRerender(){ clearTimeout(rerenderTimer); rerenderTimer=setTimeout(()=>{ STATUSES=store.data.statuses; renderAll(); }, 120); }
function buildSnap(){ snap={settings:JSON.stringify(store.data.settings)}; Object.entries(TBL).forEach(([k,t])=>{ const m=new Map(); (store.data[k]||[]).forEach(d=>m.set(d.id, JSON.stringify(d))); snap[t]=m; }); }

// ---- writes: keep local cache + push per-record to Supabase ----
store._persist = function(){
  try{ localStorage.setItem(this._k, JSON.stringify(this.data)); }catch(e){}
  if(REMOTE && WS){ clearTimeout(syncTimer); syncTimer=setTimeout(diffPush, 300); }
};
// flush any pending (debounced) write before the page goes away or is reloaded,
// so an edit made just before a reload is never lost / reverted.
function flushSync(){ if(syncTimer){ clearTimeout(syncTimer); syncTimer=null; if(REMOTE && WS){ try{ diffPush(); }catch(e){} } } }
window.addEventListener('pagehide', flushSync);
window.addEventListener('beforeunload', flushSync);
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') flushSync(); });
// Tables RLS reserves for admins. A non-admin has no UI to change these, so any
// push of them is spurious — attempting it just triggers "row-level security"
// rejections. Skip them rather than fail the whole save.
const ADMIN_ONLY_TABLES = new Set(['settings','statuses','projects','teams','boards','spaces']);
/* Which top-level fields changed between the last synced copy and now.
   Shallow on purpose: it mirrors Postgres's `doc || patch`, which is also a
   shallow merge. Two people editing different FIELDS both survive; two people
   editing the same field is still last-write-wins, which is expected. */
function docDiff(prev, next){
  const patch={};
  Object.keys(next).forEach(k=>{
    if(JSON.stringify(next[k])!==JSON.stringify(prev[k])) patch[k]=next[k];
  });
  Object.keys(prev).forEach(k=>{ if(!(k in next)) patch[k]=null; });   // field removed
  return patch;
}

async function diffPush(){
  if(!sb||!WS) return;
  const amAdmin = (typeof IS_ADMIN!=='undefined' && IS_ADMIN);
  const jobs=[];
  for(const [k,t] of Object.entries(TBL)){
    const arr=store.data[k]||[]; const cur=new Map(); const ups=[]; const patches=[];
    const prevMap=snap[t]||new Map();
    arr.forEach((d,i)=>{ const js=JSON.stringify(d); cur.set(d.id, js);
      const prev=prevMap.get(d.id);
      if(prev===js) return;                                  // unchanged
      if(t==='tasks'){ try{ markSelfPushed(d.id); }catch(e){} }
      if(prev===undefined || t==='statuses' || t==='boards'){
        // brand new row, or a table where row order (sort) matters — send it whole
        const row={workspace_id:WS, id:d.id, doc:d};
        if(t==='statuses'||t==='boards') row.sort=i;
        ups.push(row); return;
      }
      // existing row: send ONLY the fields that changed, so a concurrent edit to
      // a different field is not overwritten by our copy of it
      const patch=docDiff(JSON.parse(prev), d);
      if(Object.keys(patch).length) patches.push({id:d.id, patch});
    });
    const del=[...prevMap.keys()].filter(id=>!cur.has(id));
    if(!ups.length && !patches.length && !del.length){ snap[t]=cur; continue; }
    if(!amAdmin && ADMIN_ONLY_TABLES.has(t)){ snap[t]=cur; continue; }   // not ours to write
    jobs.push({t, cur, ups, patches, del});
  }
  const sjs=JSON.stringify(store.data.settings);
  const pushSettings = (sjs!==snap.settings) && amAdmin;   // settings are admin-only

  const failed=[];
  const runOne=async j=>{
    try{
      if(j.ups.length){ const r=await pmdb.from(j.t).upsert(j.ups); if(r&&r.error) throw r.error; }
      for(const pt of (j.patches||[])){
        const r=await pmdb.rpc('pm_patch_doc', { p_table:j.t, p_ws:WS, p_id:pt.id, p_patch:pt.patch });
        if(r&&r.error) throw r.error;
        if(r && r.data===0){
          // the row is not there (deleted elsewhere, or never inserted) — insert it whole
          const doc=(store.data[Object.keys(TBL).find(k=>TBL[k]===j.t)]||[]).find(x=>x.id===pt.id);
          if(doc){ const r2=await pmdb.from(j.t).upsert([{workspace_id:WS, id:pt.id, doc}]); if(r2&&r2.error) throw r2.error; }
        }
      }
      if(j.del.length){ const r=await pmdb.from(j.t).delete().eq('workspace_id',WS).in('id',j.del); if(r&&r.error) throw r.error; }
      snap[j.t]=j.cur;                      // commit the snapshot ONLY once the DB accepted it
    }catch(e){ failed.push({t:j.t, e}); }   // leave snap alone so the change is retried, not lost
  };
  // ORDER MATTERS: worklogs are gated by an RLS check that looks their parent task
  // up in the DB. Pushed in parallel, a worklog for a brand-new ticket could hit
  // that check before the task row existed and be rejected as a policy violation.
  // Push everything else first, then worklogs.
  await Promise.all(jobs.filter(j=>j.t!=='worklogs').map(runOne));
  await Promise.all(jobs.filter(j=>j.t==='worklogs').map(runOne));
  if(pushSettings){
    try{ const r=await pmdb.from('settings').upsert({workspace_id:WS, doc:store.data.settings}); if(r&&r.error) throw r.error; snap.settings=sjs; }
    catch(e){ failed.push({t:'settings', e}); }
  }

  if(failed.length){
    const names=[...new Set(failed.map(f=>f.t))];
    failed.forEach(f=>__dbg.error('[sync] '+f.t+' rejected:', f.e && (f.e.message||f.e), f.e));
    const rls=failed.some(f=>(((f.e&&f.e.message)||'')+'').toLowerCase().includes('row-level'));
    const msg=(failed[0].e&&failed[0].e.message)||'';
    toast(rls ? 'Some changes weren\u2019t saved \u2014 you may not have permission.' : 'Some changes couldn\u2019t be saved. Please retry.');
  }
}

// ---- realtime: apply other users' changes ----
function subscribeRealtime(){
  const ch=pmdb.channel('ws-'+WS);
  Object.entries(TBL).forEach(([k,t])=>{ ch.on('postgres_changes',{event:'*',schema:'public',table:t,filter:'workspace_id=eq.'+WS},p=>{
    const arr=store.data[k];
    if(p.eventType==='DELETE'){ const id=p.old&&p.old.id; if(id) store.data[k]=arr.filter(x=>x.id!==id); }
    else if(p.new&&p.new.doc){ const doc=p.new.doc; const i=arr.findIndex(x=>x.id===doc.id);
      if(k==='tasks'){ try{ notifyTaskChange(i>=0?arr[i]:null, doc); }catch(e){} }
      if(i>=0) arr[i]=doc; else arr.push(doc); }
    // Only re-snapshot the row that actually arrived. Rebuilding the whole
    // table's snapshot from LOCAL data folded any unsaved local edit into snap,
    // and diffPush then saw no diff and never pushed it — the edit vanished.
    if(p.eventType==='DELETE'){ const id=p.old&&p.old.id; if(id && snap[t]) snap[t].delete(id); }
    else if(p.new&&p.new.doc){ if(!snap[t]) snap[t]=new Map(); snap[t].set(p.new.doc.id, JSON.stringify(p.new.doc)); }
    scheduleRerender();
  }); });
  ch.on('postgres_changes',{event:'*',schema:'public',table:'settings',filter:'workspace_id=eq.'+WS},p=>{ if(p.new&&p.new.doc){ store.data.settings=p.new.doc; snap.settings=JSON.stringify(p.new.doc); scheduleRerender(); }});
  ch.subscribe();
}

// ---- load workspace from Supabase (seed on first run) ----
async function loadWorkspace(){
  scopeStoreKey();          // cache under this user's own key before anything persists
  // 1. Who is this? Role and status live in `profiles` and are written only by
  //    the admin-users Edge Function (or the SQL editor), never by this page.
  IS_ADMIN=false; IS_MASTER=false; TOOL_ROLE=null; MY_ROLE=null;
  try{
    const {data:pf, error:pe}=await sb.from('profiles').select('role, status').eq('id',ME.id).maybeSingle();
    if(pe) throw pe;
    if(!pf){ showAuth(); authError('This login has no Taskora profile. Ask a workspace admin to add you under Members.'); return; }
    if(pf.status!=='active'){
      try{ sessionStorage.setItem('taskora:authmsg','This account is deactivated. Contact your workspace admin.'); }catch(e){}
      try{ await sb.auth.signOut(); }catch(e){}
      showAuth(); authError('This account is deactivated. Contact your workspace admin.'); return;
    }
    MY_ROLE=pf.role;
    IS_MASTER = pf.role==='owner';
    TOOL_ROLE = pf.role==='member' ? 'user' : 'admin';
  }catch(e){ showAuth(); authError('Couldn’t load your profile: '+((e&&e.message)||'error')); return; }
  if(IS_MASTER || TOOL_ROLE==='admin') IS_ADMIN=true;
  // 2. Join the single shared workspace (always as a plain member row — the
  //    members table is bookkeeping, not authority).
  let mem=null;
  { const {data}=await pmdb.from('members').select('*').eq('user_id',ME.id).maybeSingle(); mem=data; }
  if(!mem){
    const WSID='main';
    const {error:me}=await pmdb.from('members').upsert({workspace_id:WSID,user_id:ME.id,email:ME.email,role:'member'},{onConflict:'user_id'});
    if(me){ showAuth(); authError('Couldn’t set up your workspace: '+me.message); return; }
    mem={workspace_id:WSID, role:'member'};
  }
  WS=mem.workspace_id;
  // Seed an empty workspace — masters only (RLS blocks everyone else anyway).
  if(IS_MASTER){
    const {data:s0}=await pmdb.from('settings').select('workspace_id').eq('workspace_id',WS).maybeSingle();
    if(!s0){ try{ await pushSeed(); }catch(e){ authError('Workspace seed failed: '+e.message); return; } }
  }
  await fetchAll();
  // Self-heal: a workspace that arrived without a workflow (seeded before this
  // existed, or a partial seed) gets one, rather than showing an empty board.
  const empty = !(store.data.statuses&&store.data.statuses.length);
  if(empty){
    if(IS_MASTER || TOOL_ROLE==='admin'){
      try{ await provisionWorkflow(); setTimeout(()=>toast('Workspace set up with a default delivery workflow'),400); }
      catch(e){ __dbg.warn('workflow provision failed', e); setTimeout(()=>toast('This workspace has no workflow yet — an admin needs to set up columns.'),400); }
    } else {
      setTimeout(()=>toast('This workspace has no workflow yet — ask an admin to set up the board columns.'),400);
    }
  }
  STATUSES=store.data.statuses||[];
  buildSnap(); applyDefaults(); applyPrefs();
  // A member added under Members gets a `profiles` row, but no `people` row
  // until someone mirrors it — so they were invisible in Settings > Access &
  // permissions (which lists people), while still showing under Members.
  // With no people row their identity resolved to nobody and they silently fell
  // back to DEFAULT_ROLE_PERMS — which grants view_board. Provision them here.
  if(!CURRENT_UID && ME){
    try{
      const meta=(ME.user_metadata&&ME.user_metadata.full_name)||'';
      const nm=(meta || (ME.email||'').split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) || 'Teammate').trim();
      const isToolAdmin = (TOOL_ROLE==='admin') || IS_MASTER;
      const doc={ id:'u_'+ME.id.slice(0,8), name:nm, email:(ME.email||''), authId:ME.id,
        role: isToolAdmin?'PM':'Developer',
        perm: isToolAdmin?'Admin':'User',
        profile: isToolAdmin?'pf_admin':'pf_users',
        master: !!IS_MASTER,
        color: SWATCHES[(store.users().length*2)%SWATCHES.length],
        prefs:{} };
      const {error}=await pmdb.from('people').upsert({workspace_id:WS, id:doc.id, doc});
      if(!error){ store.data.users.push(doc); buildSnap(); applyDefaults(); applyPrefs(); }
      else __dbg.warn('people provision failed', error.message);
    }catch(e){ __dbg.warn('people provision failed', e); }
  }
  // Admin comes ONLY from profiles.role (owner/admin). It never comes from
  // people.doc.perm — a database trigger stops members writing that field.
  applyRole();
  document.getElementById('authScreen').style.display='none';
  const em=(ME&&ME.email)||''; const ae=document.getElementById('acctEmail'); if(ae) ae.textContent=em||'Signed in';
  if(em){ const meta=(ME&&ME.user_metadata&&ME.user_metadata.full_name||'').trim(); const full=meta||em.split('@')[0].replace(/[._-]+/g,' ').trim().replace(/\b\w/g,c=>c.toUpperCase()); const first=(ME&&ME.user_metadata&&ME.user_metadata.first_name)||full.split(/\s+/)[0]; const an=document.getElementById('acctName'); if(an) an.textContent=full||'Account';
    const AVC=['#C2410C','#D6264F','#0E8F5A','#7C3AED','#B96A00','#0891B2','#BE185D']; let hh=0; for(const ch of em) hh=(hh*31+ch.charCodeAt(0))>>>0; const cc=AVC[hh%AVC.length];
    /* account glyph is a neutral person icon — no initials, no per-person tint */
    const _roleLbl = ROLE_LABEL[MY_ROLE] || (IS_MASTER ? 'Owner' : (IS_ADMIN ? 'Admin' : 'Member'));
    const rl=document.getElementById('acctRole'); if(rl) rl.textContent=_roleLbl;
    const pini=(full.split(/\s+/).map(x=>x[0]||'').slice(0,2).join('')||'?').toUpperCase();
    const setEl=(id,fn)=>{const e=document.getElementById(id);if(e)fn(e);};
    setEl('apName',e=>e.textContent=full||'Account'); setEl('apEmail',e=>e.textContent=em); setEl('apRole',e=>e.textContent=_roleLbl);
    /* account panel uses the same neutral person glyph */
    setEl('apAdmin',e=>{e.style.display=IS_ADMIN?'':'none';}); }
  ensureSpaces(); renderAll(); subscribeRealtime(); wireSpaces(); restoreSpot(); try{ scanNoteMentions(); }catch(e){} _urlReady=true; try{ urlSync(); }catch(e){}
  const mc = (ME && ME.user_metadata) ? ME.user_metadata.must_change_pw : undefined;
  const mustChange = (mc===true) ? true : (mc===false ? false : store.isPwPending(em));
  if(em && mustChange) forcePasswordModal(em);
}
function forcePasswordModal(em){
  if(document.getElementById('pwSetOverlay')) return;
  const ov=document.createElement('div'); ov.className='colm-overlay'; ov.id='pwSetOverlay'; ov.style.zIndex='400';
  ov.innerHTML=`<div class="colm" style="width:420px;max-width:94vw">
    <div class="colm-h"><span>Set your password</span></div>
    <div style="padding:18px">
      <p style="font-size:13px;color:var(--muted);margin:0 0 16px;line-height:1.55">Welcome! For your first sign-in, enter the temporary password your admin gave you, then choose your own new password.</p>
      <div class="pw-field"><label>Current (temporary) password</label><input type="password" id="pwCur" autocomplete="current-password"/></div>
      <div class="pw-field"><label>New password</label><input type="password" id="pwNew" autocomplete="new-password"/></div>
      <div class="pw-field"><label>Confirm new password</label><input type="password" id="pwNew2" autocomplete="new-password"/></div>
      <div class="pw-err" id="pwErr"></div>
      <button class="btn primary" id="pwSave" style="width:100%;margin-top:8px">Save new password</button>
    </div></div>`;
  document.body.appendChild(ov);
  const err=m=>{ const e=document.getElementById('pwErr'); e.textContent=m; e.classList.add('on'); };
  document.getElementById('pwSave').onclick=async()=>{
    const cur=document.getElementById('pwCur').value, nw=document.getElementById('pwNew').value, nw2=document.getElementById('pwNew2').value;
    if(!cur) return err('Enter your current password');
    if(!nw || nw.length<8) return err('New password must be at least 8 characters');
    if(nw!==nw2) return err('New passwords do not match');
    const btn=document.getElementById('pwSave'); btn.disabled=true; btn.textContent='Saving…';
    const {error:ce}=await sb.auth.signInWithPassword({email:em, password:cur});
    if(ce){ btn.disabled=false; btn.textContent='Save new password'; return err('Current password is incorrect'); }
    const {error:ue}=await sb.auth.updateUser({password:nw, data:{ must_change_pw:false }});
    if(ue){ btn.disabled=false; btn.textContent='Save new password'; return err(ue.message||'Could not update password'); }
    if(ME&&ME.user_metadata) ME.user_metadata.must_change_pw=false;
    try{ store.clearPwPending(em); }catch(e){}
    ov.remove(); toast('Password updated — you’re all set');
  };
}
async function fetchAll(){
  store.data = store.data || {};
  const pull=async (t,order)=>{ let q=pmdb.from(t).select('id,doc').eq('workspace_id',WS); if(order) q=q.order('sort'); const {data}=await q; return (data||[]).map(r=>r.doc); };
  store.data.projects = await pull('projects');
  store.data.statuses = await pull('statuses', true);
  store.data.boards   = await pull('boards', true);
  store.data.teams    = await pull('teams');
  store.data.users    = await pull('people');
  store.data.tasks    = await pull('tasks');
  store.data.worklogs = await pull('worklogs');
  store.data.spaces   = await pull('spaces');
  store.data.sprints  = await pull('sprints');
  const {data:s}=await pmdb.from('settings').select('doc').eq('workspace_id',WS).maybeSingle();
  store.data.settings = (s&&s.doc) || JSON.parse(JSON.stringify(SEED.settings));
}
async function wipeWorkspace(){
  if(!(typeof sb!=='undefined' && sb && typeof WS!=='undefined' && WS)){ toast('Not connected to the server.'); return; }
  const tables=['tasks','worklogs','sprints','people','projects','teams','statuses','boards','settings'];
  let err=null;
  for(const t of tables){ try{ const r=await pmdb.from(t).delete().eq('workspace_id',WS); if(r&&r.error){ err=t+' — '+r.error.message; break; } }catch(e){ err=t+' — '+((e&&e.message)||'failed'); break; } }
  if(err){ toast('Wipe blocked by the database: '+err+'. Run the SQL in Supabase → SQL Editor instead.', 10000); return; }
  try{ await pushSeed(); }catch(e){ toast('Cleared, but rebuild failed: '+((e&&e.message)||e)+'. Open Supabase and run seed if needed.', 9000); }
  try{ localStorage.removeItem(store._k); }catch(e){}
  toast('Workspace wiped. Reloading…'); setTimeout(()=>location.reload(), 1000);
}
/* Give a workspace the default flow. Used both when self-healing an empty one
   and by Settings -> Data -> "Set up default workflow". */
async function provisionWorkflow(){
  const sts=JSON.parse(JSON.stringify(DEFAULT_STATUSES));
  const bd =defaultBoard((typeof ui!=='undefined'&&ui.space)||'ws_main');
  store.data.statuses=sts;
  store.data.boards=(store.data.boards||[]).concat([bd]);
  STATUSES=store.data.statuses;
  store.updateSettings({ defaultBoard: bd.id });
  ui.board=bd.id;
  if(typeof sb!=='undefined' && sb && WS){
    const {error:e1}=await pmdb.from('statuses').upsert(sts.map((d,i)=>({workspace_id:WS,id:d.id,doc:d,sort:i})));
    if(e1) throw e1;
    const {error:e2}=await pmdb.from('boards').upsert([{workspace_id:WS,id:bd.id,doc:bd,sort:0}]);
    if(e2) throw e2;
  }
  store._persist(); buildSnap();
  return bd.id;
}
async function pushSeed(){
  const S=JSON.parse(JSON.stringify(SEED));
  // Fresh workspace: seed only the workflow scaffolding + the first user (master admin).
  const nm=((ME&&ME.user_metadata&&ME.user_metadata.full_name)|| (ME&&ME.email||'').split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) ||'Admin').trim();
  const meDoc={ id:'u_'+ME.id.slice(0,8), name:nm, email:(ME&&ME.email)||'', role:'PM', profile:'pf_admin', authId:ME.id, master:true, color:'#D6264F' };
  // A fresh workspace has no statuses of its own, so fall back to the default
  // delivery flow — otherwise the board renders with no columns at all.
  const sts   = (S.statuses && S.statuses.length) ? S.statuses : DEFAULT_STATUSES;
  const bds   = (S.boards   && S.boards.length)   ? S.boards   : [defaultBoard('ws_main')];
  S.settings  = Object.assign({}, S.settings, { defaultBoard: bds[0].id });
  const steps=[
    ['statuses', sts.map((d,i)=>({workspace_id:WS,id:d.id,doc:d,sort:i}))],
    ['boards',   bds.map((d,i)=>({workspace_id:WS,id:d.id,doc:d,sort:i}))],
    ['people',   [{workspace_id:WS,id:meDoc.id,doc:meDoc}]],
  ];
  for(const [t,rows] of steps){ if(!rows||!rows.length) continue; const {error}=await pmdb.from(t).upsert(rows); if(error){ __dbg.error('SEED FAILED on '+t, error); throw new Error(t+' — '+error.message); } }
  const {error:se}=await pmdb.from('settings').upsert({workspace_id:WS,doc:S.settings}); if(se){ __dbg.error('SEED FAILED on settings', se); throw new Error('settings — '+se.message); }
}

// ---- role gating (RLS is the real enforcement; this hides admin UI) ----
function applyRole(){
  if(IS_ADMIN) return;
  ['navColumns'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display='none'; });
  // hide nav items for views this teammate can't open
  document.querySelectorAll('.nav-item[data-view]').forEach(b=>{ const v=b.dataset.view; if(VIEW_CAP[v] && !can(VIEW_CAP[v])) b.style.display='none'; });
  // board / users nav + admin action buttons gated by capability
  if(!can('view_board')){ const nb=document.getElementById('navBoardsToggle'); if(nb) nb.style.display='none'; const bl=document.getElementById('navBoards'); if(bl) bl.style.display='none'; }
  if(!can('member_invite')&&!can('member_role')){ document.querySelectorAll('.nav-item[data-view="users"]').forEach(b=>b.style.display='none'); }
  { const e=document.getElementById('navAddBoard'); if(e&&!can('board_create')) e.style.display='none'; }
  { const e=document.getElementById('boardFlowBtn'); if(e&&!can('board_workflow')&&!can('board_columns')) e.style.display='none'; }
  { const e=document.getElementById('newTaskBtn'); if(e&&!can('ticket_create')) e.style.display='none'; }
  document.body.classList.add('is-member');
}

// ---- sign-in lives on index.html ----
// The app never shows a sign-in form. Anything that needs one sends the person
// to the login page, carrying an optional message for it to display.
function goLogin(){
  if(goLogin._done) return; goLogin._done = true;
  setTimeout(()=>location.replace('index.html'), 0);
}
function showAuth(){ goLogin(); }
function authError(m){ try{ if(m) sessionStorage.setItem('taskora:authmsg', m); }catch(e){} goLogin(); }
function authNotice(){}

// ---- boot ----
const CONFIGURED = !!(SUPABASE_URL && !SUPABASE_URL.includes('PASTE') && SUPABASE_ANON && !SUPABASE_ANON.includes('PASTE'));
function migrateProfiles(){ if(!store.data) return;
  // Rewrites shared settings + other people's rows -> admin-only under RLS.
  // Running it for everyone made every save fail with "Not allowed - admins only".
  if(typeof IS_ADMIN!=='undefined' && !IS_ADMIN) return;
  const s=store.settings(); let changed=false;
  const cur=s.profiles||[];
  const adminP=cur.find(p=>p.id==='pf_admin'); const stdSrc=cur.find(p=>p.id==='pf_users')||cur.find(p=>p.id==='pf_editor');
  const need = !s.profiles || cur.length!==2 || !cur.find(p=>p.id==='pf_users') || cur.find(p=>p.id==='pf_editor'||p.id==='pf_viewer');
  if(need){
    s.profiles=[ {id:'pf_admin', name:'Admin', perms:(adminP&&adminP.perms)||_setOf(ALL_CAPS)},
                 {id:'pf_users', name:'Users', perms:(stdSrc&&stdSrc.perms)||JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMS.Developer))} ];
    changed=true;
  }
  (store.data.users||[]).forEach(u=>{ if(u.profile==='pf_editor'||u.profile==='pf_viewer'){ u.profile='pf_users'; changed=true; } });
  if(changed) store._persist();
}
const SP_COLORS=['#D6264F','#0E8FA8','#7A3FF2','#0E8F5A','#B96A00','#CE2F26','#C026D3','#0C5A9E'];
let _spEdit=null;
function effPerms(uid){
  try{
    if(!uid) return {};                       // unknown identity => no capabilities
    const s=store.settings();
    if(s.userPerms && s.userPerms[uid]) return s.userPerms[uid];
    const u=store.user&&store.user(uid);
    if(!u) return {};                         // no person record => no capabilities.
                                              // (was falling through to permOf({})='User',
                                              //  whose defaults include view_board)
    return DEFAULT_ROLE_PERMS[permOf(u)]||{};
  }catch(e){ return {}; }
}
function can(cap){
  if(typeof IS_ADMIN!=='undefined' && IS_ADMIN) return true;
  // fail CLOSED: this used to `return true` on any error, so a hiccup while
  // resolving permissions handed out the capability instead of withholding it.
  try{ return !!effPerms(myUid())[cap]; }catch(e){ return false; }
}
// field-level Read/Edit/Hide (admins bypass; unset fields default to full edit)
function fieldPerm(key){ if(typeof IS_ADMIN!=='undefined' && IS_ADMIN) return 'edit'; try{ const s=store.settings(); const fp=s.fieldPerms && s.fieldPerms[myUid()]; const v=fp && fp[key]; return v||'edit'; }catch(e){ return 'edit'; } }
function canSeeField(key){ return fieldPerm(key)!=='hide'; }
function canEditField(key){ return fieldPerm(key)==='edit'; }
const VIEW_CAP={flow:'view_sprint_reports',backlog:'view_backlog',sprint:'view_sprint',sprintreports:'view_sprint_reports',overview:'view_overview',list:'view_list',epics:'view_epics',board:'view_board',qa:'view_qa',analytics:'view_analytics',reports:'view_reports',team:'view_team',deployments:'view_operations'};
function canView(v){ const c=VIEW_CAP[v]; return c?can(c):true; }
function myUid(){
  try{ if(typeof CURRENT_UID!=='undefined' && CURRENT_UID) return CURRENT_UID; }catch(e){}
  try{ if(typeof ME!=='undefined' && ME && ME.id && store.users){
    const pp=store.users().find(u=>u.authId===ME.id) || store.users().find(u=>u.email&&ME.email&&u.email.toLowerCase()===ME.email.toLowerCase());
    if(pp) return pp.id;
    return null;   // signed in but unlinked → identify as nobody, never as users()[0]
  } }catch(e){}
  const u=store.users&&store.users()[0]; return u?u.id:null;
}
function canAccessSpace(sp){
  if(!sp) return false;
  // ONLY a real master admin sees every workspace. Being an admin of the PM tool
  // does NOT grant access to workspaces you were not added to.
  if(typeof IS_MASTER!=='undefined' && IS_MASTER) return true;
  const me=myUid(); if(!me) return false;                      // unknown identity → no access
  return (sp.members||[]).includes(me);
}
function showSpaces(){ ui.space=null; renderSpaces(); const el=document.getElementById('spacesScreen'); if(el) el.classList.add('on'); saveSpot();
  try{ if(!_urlApplying) history.replaceState(null,'','#/'); }catch(e){} }
