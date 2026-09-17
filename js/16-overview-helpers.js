/* Taskora — 16-overview-helpers.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ---------- Soon ---------- */
function renderSoon(name){
  document.getElementById('soonwrap').innerHTML=`<div class="soon">
    <div><div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg></div>
    <h2>${name} is coming next</h2>
    <p>This section is scaffolded and ready. We'll build ${name.toLowerCase()} out once the core tracker is wired to shared storage.</p></div></div>`;
}

function esc(s){ // Escapes quotes too: this value is dropped into attributes as often
  // as into text (value="${esc(x)}", title="${esc(x)}"), and without the quote
  // escapes a title of  x" onfocus="..."  closed the attribute and injected a
  // live event handler.
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
let toastT; function toast(msg, ms){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('on'), ms||2200); }

// events
document.querySelectorAll('.nav-item[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.getElementById('navColumns').onclick=openBoardSettings;
document.getElementById('boardFlowBtn').onclick=openBoardSettings;
document.getElementById('groupBtn').onclick=e=>{ e.stopPropagation(); document.getElementById('groupMenu').classList.toggle('on'); };
document.querySelectorAll('#groupMenu button').forEach(b=>b.onclick=()=>{ const g=b.dataset.grp; ui.groupBy=g;
  document.getElementById('groupLbl').textContent=b.textContent;
  document.querySelectorAll('#groupMenu button').forEach(x=>x.classList.toggle('on', x===b));
  document.getElementById('groupMenu').classList.remove('on'); renderBoard(); });
document.addEventListener('click',()=>document.getElementById('groupMenu').classList.remove('on'));
{ const _rb=document.getElementById('boardRefresh'); if(_rb) _rb.onclick=function(){ manualRefresh(this); }; }
document.getElementById('navAddBoard').onclick=e=>{ e.stopPropagation(); document.getElementById('navBoardsToggle').classList.add('open'); addBoardFromSide(); };
const AD_IC={
  set:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>',
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  help:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2.5 2.5"/></svg>',
  chev:'<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
  out:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>'};
async function acctSignOut(){ if(GUEST){ leaveGuest(); return; } try{ clearLocalAppData(); }catch(e){}
  try{ localStorage.setItem('taskora:signout', String(Date.now())); }catch(e){}
  if(typeof sb!=='undefined' && sb && sb.auth){ try{ await sb.auth.signOut({scope:'global'}); }catch(e){ try{ await sb.auth.signOut(); }catch(_){} } location.reload(); return; }
  toast('This is the offline demo — there is nothing to sign out of.'); }
function closeAccountPM(){ const s=document.getElementById('acctScrim'); if(s) s.classList.remove('on'); }
async function openAccountPM(){
  if(GUEST){
    document.getElementById('acctScrim').innerHTML=`<div class="acd">
      <div class="acd-top"><span class="t">Guest preview</span><button class="acd-x" onclick="closeAccountPM()" aria-label="Close">\u2715</button></div>
      <div class="acd-body"><div class="acd-sec"><div class="acd-lbl">What this is</div>
        <div class="acd-mods"><div class="acd-mod"><div class="acd-mn">Sample workspace<span class="s">Everything here is example data. You can change anything \u2014 it stays in this tab only and is erased when you refresh or leave.</span></div></div></div></div></div>
      <div class="acd-foot"><button class="acd-signout" onclick="leaveGuest()">${AD_IC.out} Leave preview and sign in</button></div></div>`;
    document.getElementById('acctScrim').classList.add('on');
    const sc=document.getElementById('acctScrim'); sc.onclick=e=>{ if(e.target===sc) closeAccountPM(); };
    return;
  }
  const mu=(typeof meUser==='function' && meUser())||{};
  const name=((typeof ME!=='undefined'&&ME&&ME.user_metadata&&ME.user_metadata.full_name))||mu.name||((typeof ME!=='undefined'&&ME&&ME.email))||'Account';
  const email=mu.email||((typeof ME!=='undefined'&&ME&&ME.email))||'';
  const roleKey = MY_ROLE || (IS_MASTER?'owner':(IS_ADMIN?'admin':'member'));
  const roleLbl = ROLE_LABEL[roleKey]||'Member';
  const roleNote = roleKey==='owner' ? 'You can manage every member, including admins and other owners.'
                 : roleKey==='admin' ? 'You manage boards, workspace settings and members.'
                 : 'Your admin decides which views and actions you can use.';
  document.getElementById('acctScrim').innerHTML=`<div class="acd">
    <div class="acd-top"><span class="t">Account</span><button class="acd-x" onclick="closeAccountPM()" aria-label="Close">✕</button></div>
    <div class="acd-head">${avatar({name:name, email:email, photo:myPhoto()}, 52)}
      <div class="acd-id"><div class="nm">${esc(name)}</div><div class="em">${esc(email||'—')}</div>
        <span class="acd-role ${roleKey==='owner'?'master':''}">${esc(roleLbl)}</span></div></div>
    <div class="acd-body">
      <div class="acd-sec"><div class="acd-lbl">Your role</div><div class="acd-mods"><div class="acd-mod"><div class="acd-mn">${esc(roleLbl)}<span class="s">${esc(roleNote)}</span></div></div></div></div>
      <div class="acd-sec"><div class="acd-lbl">Quick links</div>
        <div class="acd-links">
          <button class="acd-link" onclick="closeAccountPM();setView('settings')">${AD_IC.set} Settings ${AD_IC.chev}</button>
          <button class="acd-link" onclick="closeAccountPM();openChangePassword()">${AD_IC.key} Change password ${AD_IC.chev}</button>
          ${IS_ADMIN?`<button class="acd-link" onclick="closeAccountPM();setView('users')">${AD_IC.users} Members ${AD_IC.chev}</button>`:''}
        </div></div>
    </div>
    <div class="acd-foot"><button class="acd-signout" onclick="acctSignOut()">${AD_IC.out} Sign out</button></div>
  </div>`;
  document.getElementById('acctScrim').classList.add('on');
  const sc=document.getElementById('acctScrim'); sc.onclick=e=>{ if(e.target===sc) closeAccountPM(); };
}
document.getElementById('pkAvatar').onclick=e=>{ e.stopPropagation(); openAccountPM(); };
document.getElementById('acctScrim').addEventListener('click',e=>{ if(e.target.id==='acctScrim') closeAccountPM(); });
document.getElementById('acctMenu').addEventListener('click',e=>e.stopPropagation());
(function(){
  const q=id=>document.getElementById(id);
  const menuOff=()=>{ const m=q('acctMenu'); if(m) m.classList.remove('on'); };
  q('apAccount')&&(q('apAccount').onclick=()=>{ menuOff(); openAccountPM(); });
  q('apMyAccount')&&(q('apMyAccount').onclick=e=>{ e.preventDefault(); menuOff(); openAccountPM(); });
  q('apSettings')&&(q('apSettings').onclick=()=>{ menuOff(); setView('settings'); });
  q('apAdmin')&&(q('apAdmin').onclick=()=>{ menuOff(); setView('users'); });
  q('apHelp')&&(q('apHelp').onclick=()=>{ menuOff(); window.open('https://github.com/','_blank','noopener'); });
})();
document.addEventListener('click',()=>document.getElementById('acctMenu').classList.remove('on'));
document.getElementById('signOutBtn').onclick=async()=>{
  const am=document.getElementById('acctMenu'); if(am) am.classList.remove('on');
  await acctSignOut();
};
window.addEventListener('storage', e=>{ if(e.key==='taskora:signout'){ try{ clearLocalAppData(); }catch(_){} location.reload(); } });
document.getElementById('navBoardsToggle').onclick=e=>{ if(e.target.closest('#navAddBoard')) return; setView('board'); };
(function(){ const nt=document.getElementById('navToggle'); if(nt) nt.onclick=()=>{ document.body.classList.toggle('nav-collapsed'); const wf=document.getElementById('wfScreen'); if(wf&&wf.classList.contains('on')&&typeof renderWorkflow==='function') setTimeout(renderWorkflow,220); }; })();
document.getElementById('navAnalyticsToggle').onclick=e=>{ e.currentTarget.classList.add('open'); setView('analytics'); };
document.querySelectorAll('#navAnalytics .sub-item').forEach(it=>it.onclick=()=>{ ui.analyticsTab=it.dataset.atab; setView('analytics'); });
(function(){
  const g=id=>document.getElementById(id);
  if(g('wfAddCancel')) g('wfAddCancel').onclick=()=>g('wfAddWrap').classList.remove('on');
  if(g('wfAddGo')) g('wfAddGo').onclick=wfAddGo;
  if(g('wfAddWrap')) g('wfAddWrap').onclick=e=>{ if(e.target.id==='wfAddWrap') g('wfAddWrap').classList.remove('on'); };
  if(g('wfEdCancel')) g('wfEdCancel').onclick=()=>g('wfEditWrap').classList.remove('on');
  if(g('wfEdGo')) g('wfEdGo').onclick=wfEditGo;
  if(g('wfEditWrap')) g('wfEditWrap').onclick=e=>{ if(e.target.id==='wfEditWrap') g('wfEditWrap').classList.remove('on'); };
  const nm=g('wfAddName'); if(nm) nm.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); wfAddGo(); } };
  const en=g('wfEdName'); if(en) en.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); wfEditGo(); } };
})();
(function(){
  const tw=document.getElementById('trNameWrap'), ti=document.getElementById('trNameIn');
  const tc=document.getElementById('trNameCancel'), tk=document.getElementById('trNameOk');
  const okName=()=>{ const v=(ti.value||'').trim(); if(!v){ toast('Give the transition a name'); ti.focus(); return; } closeTrName(v); };
  if(tk) tk.onclick=okName;
  if(tc) tc.onclick=()=>closeTrName(null);
  if(tw) tw.onclick=e=>{ if(e.target===tw) closeTrName(null); };
  if(ti) ti.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); okName(); } if(e.key==='Escape') closeTrName(null); };
  const cy=document.getElementById('cfYes'), cn=document.getElementById('cfNo'), cw=document.getElementById('cfWrap');
  if(cy) cy.onclick=()=>closeCf(true);
  if(cn) cn.onclick=()=>closeCf(false);
  if(cw) cw.onclick=e=>{ if(e.target===cw) closeCf(false); };
  document.addEventListener('keydown',e=>{ if(e.key!=='Escape') return;
    if(tw && tw.classList.contains('on')) closeTrName(null);
    if(cw && cw.classList.contains('on')) closeCf(false); });
})();
(function(){
  const pi=document.getElementById('stPickIn');
  if(pi) pi.oninput=()=>stPickDraw(pi.value);
  const pc=document.getElementById('stPickCancel'); if(pc) pc.onclick=()=>document.getElementById('stPickWrap').classList.remove('on');
  const pa=document.getElementById('stPickAdd'); if(pa) pa.onclick=stPickAdd;
  const pw=document.getElementById('stPickWrap'); if(pw) pw.onclick=e=>{ if(e.target===pw) pw.classList.remove('on'); };
  const ec=document.getElementById('stEdCancel'); if(ec) ec.onclick=()=>document.getElementById('stEdWrap').classList.remove('on');
  const es=document.getElementById('stEdSave'); if(es) es.onclick=stEditSave;
  const ew=document.getElementById('stEdWrap'); if(ew) ew.onclick=e=>{ if(e.target===ew) ew.classList.remove('on'); };
})();
(function(){ const pc=document.getElementById('pjCancel'), pv=document.getElementById('pjCreate'), pw=document.getElementById('projWrap');
  if(pc) pc.onclick=closeProjModal;
  if(pv) pv.onclick=saveProjModal;
  if(pw) pw.onclick=e=>{ if(e.target===pw) closeProjModal(); };
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && pw && pw.classList.contains('on')) closeProjModal(); });
})();
(function(){ const bk=document.getElementById('bwBack'), nx=document.getElementById('bwNext'), cn=document.getElementById('bwCancel'), bw=document.getElementById('bwWrap');
  if(bk) bk.onclick=bwBack;
  if(nx) nx.onclick=bwNext;
  if(cn) cn.onclick=closeBoardWizard;
  if(bw) bw.onclick=e=>{ if(e.target===bw) closeBoardWizard(); };
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && bw && bw.classList.contains('on')) closeBoardWizard(); });
})();
(function(){ const c=document.getElementById('sbCancel'), sv=document.getElementById('sbSave'), w=document.getElementById('subWrap');
  if(c) c.onclick=closeSubModal;
  if(sv) sv.onclick=saveSubModal;
  if(w) w.onclick=e=>{ if(e.target===w) closeSubModal(); };
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && w && w.classList.contains('on')) closeSubModal(); });
})();
document.querySelectorAll('#boardMenu button').forEach(btn=>btn.onclick=e=>{ e.stopPropagation();
  const menu=document.getElementById('boardMenu'); const id=menu.dataset.board; menu.classList.remove('on'); boardAction(id, btn.dataset.act); });
document.addEventListener('click',()=>document.getElementById('boardMenu').classList.remove('on'));
document.querySelectorAll('#depMenu button').forEach(btn=>btn.onclick=e=>{ e.stopPropagation();
  const menu=document.getElementById('depMenu'); const id=menu.dataset.dep; menu.classList.remove('on'); depAction(id, btn.dataset.act); });
document.addEventListener('click',()=>document.getElementById('depMenu').classList.remove('on'));
document.querySelectorAll('#qaMenu button').forEach(btn=>btn.onclick=e=>{ e.stopPropagation();
  const menu=document.getElementById('qaMenu'); const id=menu.dataset.qa; menu.classList.remove('on'); qaAction(id, btn.dataset.act); });
document.addEventListener('click',()=>document.getElementById('qaMenu').classList.remove('on'));
(function(){ const sw=document.getElementById('spSwitch'); if(sw) sw.onclick=()=>backToSpaces(); })();
document.getElementById('search').oninput=e=>{ ui.filters.search=e.target.value; refreshViews(); };
document.querySelectorAll('#periodSeg button').forEach(btn=>btn.onclick=()=>{ if(ui.view==='overview'){ ui.ovRange=btn.dataset.p; } else { ui.filters.period=btn.dataset.p; } fillFilters(); refreshViews(); });
let umEditId=null;
function openMemberEdit(uid){ const u=store.user(uid); if(!u) return; umEditId=uid;
  document.getElementById('ueName').value=u.name||'';
  document.getElementById('ueEmail').value=u.email||'';
  document.getElementById('ueDesig').innerHTML=DESIGNATIONS.map(d=>`<option ${u.role===d?'selected':''}>${d}</option>`).join('');
  document.getElementById('ueColor').value=(u.color&&/^#[0-9a-fA-F]{6}$/.test(u.color))?u.color:'#D6264F';
  document.getElementById('umEditWrap').classList.add('on'); setTimeout(()=>document.getElementById('ueName').focus(),50);
}
function closeMemberEdit(){ umEditId=null; document.getElementById('umEditWrap').classList.remove('on'); }
async function saveMemberEdit(){ if(!umEditId){ closeMemberEdit(); return; } const u=store.user(umEditId); if(!u){ closeMemberEdit(); return; }
  const name=(document.getElementById('ueName').value||'').trim()||u.name;
  const email=(document.getElementById('ueEmail').value||'').trim();
  const role=document.getElementById('ueDesig').value;
  const color=document.getElementById('ueColor').value;
  const emailChanged=email!==(u.email||'');
  store.updateUser(umEditId,{name,email,role,color});
  if(sb && emailChanged && u.authId && typeof WS!=='undefined' && WS){ try{ await pmdb.from('members').update({email}).eq('workspace_id',WS).eq('user_id',u.authId); }catch(e){} }
  closeMemberEdit(); renderSettings(); renderAll();
  toast(sb ? 'Details updated & synced' : 'Details updated');
}
document.getElementById('ueCancel').onclick=closeMemberEdit;
document.getElementById('ueSave').onclick=saveMemberEdit;
document.getElementById('umEditWrap').addEventListener('click',e=>{ if(e.target.id==='umEditWrap') closeMemberEdit(); });
document.getElementById('clearFilters').onclick=()=>{ ui.filters={search:'',assignee:'all',status:'all',priority:'all',type:'all',time:'all',epic:'all',period:'all',from:'',to:''};
  document.getElementById('search').value=''; fillFilters(); renderFilterChips(); refreshViews(); };
const _ntb=document.getElementById('newTaskBtn'); if(_ntb) _ntb.onclick=openModal;
document.getElementById('ntCancel').onclick=closeModal;
{ const _x=document.getElementById('ntX'); if(_x) _x.onclick=closeModal; }
document.getElementById('ntCreate').onclick=createTask;
document.getElementById('epX').onclick=closeEpicModal;
document.getElementById('epCancel').onclick=closeEpicModal;
document.getElementById('epSubmit').onclick=submitEpic;
document.getElementById('epmAddTask').onclick=()=>epmAddTaskRow(true);
document.getElementById('epicWrap').onclick=e=>{ if(e.target.id==='epicWrap') closeEpicModal(); };
document.getElementById('overlay').onclick=closePanel;
document.getElementById('modalWrap').onclick=e=>{ if(e.target.id==='modalWrap') closeModal(); };
document.getElementById('logCancel').onclick=closeLogModal;
document.getElementById('logSave').onclick=saveLog;
document.getElementById('logWrap').onclick=e=>{ if(e.target.id==='logWrap') closeLogModal(); };
document.getElementById('logSpent').addEventListener('keydown',e=>{ if(e.key==='Enter') saveLog(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closePanel(); closeModal(); closeBoardSettings(); closeLogModal(); closeEpicModal(); } });
