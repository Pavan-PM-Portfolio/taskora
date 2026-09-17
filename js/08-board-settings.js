/* Taskora — 08-board-settings.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ============================================================
   BOARD SETTINGS  (configurable columns, Jira-style)
============================================================ */
function renderBoardSwitch(){
  const wrap=document.getElementById('navBoards');
  wrap.innerHTML=store.boards().map(bd=>`<div class="nav-item board-nav ${(ui.view==='board'&&bd.id===ui.board)?'on':''}" data-board="${bd.id}">
      <span class="bn-nm">${esc(bd.name)}</span>
      <button class="bn-kebab" title="Board options"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button></div>`).join('');
  wrap.querySelectorAll('.board-nav').forEach(it=>{ const id=it.dataset.board;
    it.onclick=e=>{ if(e.target.closest('.bn-kebab')) return; ui.board=id; setView('board'); };
    it.querySelector('.bn-kebab').onclick=e=>{ e.stopPropagation(); openBoardMenu(id, e.currentTarget); };
  });
}
function openBoardMenu(id, btn){
  const m=document.getElementById('boardMenu'); m.dataset.board=id;
  const r=btn.getBoundingClientRect();
  m.style.left=Math.min(r.right-180, window.innerWidth-190)+'px';
  m.style.top=(r.bottom+5)+'px';
  m.classList.add('on');
}
function openDepMenu(id, btn){
  const m=document.getElementById('depMenu'); m.dataset.dep=id;
  const r=btn.getBoundingClientRect();
  m.style.left=Math.min(r.right-180, window.innerWidth-190)+'px';
  m.style.top=(r.bottom+5)+'px';
  m.classList.add('on');
}
function depAction(id, act){
  const t=store.task(id); if(!t) return;
  if(act==='open'){ openPanel(id); }
  else if(act==='copykey'){ copyText(t.key); toast('Key copied'); }
  else if(act==='copylink'){ copyText(location.origin+location.pathname+'#'+t.key); toast('Link copied'); }
  else if(act==='del'){ if(!can('deploy_manage')){ toast('You don\u2019t have permission to change deployments'); return; }
    confirmDelete({ title:'Remove deployment', lead:`Remove <b>${esc(t.key)}</b> from the deployment tracker? The ticket itself stays unchanged.`,
      confirmLabel:'Remove deployment', warn:'', onConfirm:()=>{ store.deleteDeployment(id); renderDeployments(); } }); }
  else if(act==='delete'){ if(!can('ticket_delete')){ toast('You don\u2019t have permission to delete tickets'); return; }
    { const _cm=((t.comments)||[]).length, _sb=((t.subtasks)||[]).length, _wl=store.data.worklogs.filter(w=>w.task===id).length;
      confirmDelete({ title:'Delete ticket', lead:`Delete <b>${esc(t.key)}</b> \u2014 ${esc(t.title)}?`,
        impact:[{n:_sb,label:'subtask'+(_sb===1?'':'s')},{n:_cm,label:'comment'+(_cm===1?'':'s')},{n:_wl,label:'time log'+(_wl===1?'':'s')}],
        confirmLabel:'Delete ticket',
        onConfirm:()=>{ store.removeTask(id); if(ui.openTask===id) closePanel(); refreshViews(); toast(`${t.key} deleted`); } }); } }
}
function openQaMenu(id, btn){
  const m=document.getElementById('qaMenu'); m.dataset.qa=id;
  const r=btn.getBoundingClientRect();
  m.style.left=Math.min(r.right-180, window.innerWidth-190)+'px';
  m.style.top=(r.bottom+5)+'px';
  m.classList.add('on');
}
function qaAction(id, act){
  const t=store.task(id); if(!t) return;
  if(act==='open'){ openPanel(id); }
  else if(act==='copykey'){ copyText(t.key); toast('Key copied'); }
  else if(act==='copylink'){ copyText(location.origin+location.pathname+'#'+t.key); toast('Link copied'); }
  else if(act==='clear'){ if(!can('qa_clear')){ toast('You don\u2019t have permission to clear QA'); return; }
    confirmDelete({ title:'Clear QA', lead:`Clear <b>all QA cases and fixes</b> on <b>${esc(t.key)}</b>?`,
      confirmLabel:'Clear QA', onConfirm:()=>{ store.clearQa(id); renderQA(); } }); }
  else if(act==='delete'){ { const _cm=((t.comments)||[]).length, _sb=((t.subtasks)||[]).length, _wl=store.data.worklogs.filter(w=>w.task===id).length;
      confirmDelete({ title:'Delete ticket', lead:`Delete <b>${esc(t.key)}</b> \u2014 ${esc(t.title)}?`,
        impact:[{n:_sb,label:'subtask'+(_sb===1?'':'s')},{n:_cm,label:'comment'+(_cm===1?'':'s')},{n:_wl,label:'time log'+(_wl===1?'':'s')}],
        confirmLabel:'Delete ticket',
        onConfirm:()=>{ store.removeTask(id); if(ui.openTask===id) closePanel(); refreshViews(); toast(`${t.key} deleted`); } }); } }
}
let _qaAttTask=null, _qaAttPending=null;
function wireQaAtt(){
  const f=document.getElementById('qaAttFile'); if(!f || f._wired) return; f._wired=true;
  f.onchange=e=>{ const file=e.target.files&&e.target.files[0]; if(!file) return;
    if(file.size>4*1024*1024){ try{ toast('File is too large (max 4 MB)'); }catch(_){} return; }
    const reader=new FileReader();
    reader.onload=()=>{ _qaAttPending={task:_qaAttTask, orig:file.name, type:file.type||'', size:file.size, data:reader.result};
      const info=document.getElementById('qaAttFileInfo'); if(info) info.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg><div><div class="fn">'+esc(file.name)+'</div><div class="fs">'+(file.size/1024).toFixed(0)+' KB</div></div>';
      const nm=document.getElementById('qaAttName'); if(nm){ nm.value=file.name.replace(/\.[^.]+$/,''); }
      document.getElementById('qaAttWrap').classList.add('on'); setTimeout(()=>{ if(nm){ nm.focus(); nm.select(); } },30);
    };
    reader.readAsDataURL(file);
  };
  const up=document.getElementById('qaAttUpload'); if(up) up.onclick=()=>{ if(!_qaAttPending) return;
    const nm=(document.getElementById('qaAttName').value||'').trim()||_qaAttPending.orig;
    store.addQaAttachment(_qaAttPending.task, {id:'at'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36), name:nm, orig:_qaAttPending.orig, type:_qaAttPending.type, size:_qaAttPending.size, data:_qaAttPending.data});
    document.getElementById('qaAttWrap').classList.remove('on'); _qaAttPending=null; renderQA(); try{ toast('Attachment uploaded'); }catch(_){} };
  const ca=document.getElementById('qaAttCancel'); if(ca) ca.onclick=()=>{ document.getElementById('qaAttWrap').classList.remove('on'); _qaAttPending=null; };
  const nm2=document.getElementById('qaAttName'); if(nm2) nm2.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); const up2=document.getElementById('qaAttUpload'); if(up2) up2.click(); } };
  const w=document.getElementById('qaAttWrap'); if(w) w.onclick=e=>{ if(e.target===w){ w.classList.remove('on'); _qaAttPending=null; } };
}
/* ---- Record a deployment -------------------------------------------------
   The deployer states where the build went and which version, so the tracker
   reflects an actual release rather than a status guess. */
const DEPLOY_ENVS=['V3','LMS','API','WrkFrce','Admin','EPS'];
let _depMarkId=null, _depEnvSel=[];
function openDepMark(id){
  const t=store.task(id); if(!t) return;
  if(!can('deploy_manage')){ toast('You don\u2019t have permission to record deployments'); return; }
  _depMarkId=id; _depEnvSel=(t.deployEnvs||[]).slice();
  const sub=document.getElementById('depMarkSub');
  if(sub) sub.innerHTML=`<b style="color:var(--accent)">${esc(t.key)}</b> \u00b7 ${esc(t.title)}`;
  const ver=document.getElementById('depVersion'); if(ver) ver.value=t.deployVersion||'';
  drawDepEnvs(); wireDepMark();
  document.getElementById('depMarkWrap').classList.add('on');
  setTimeout(()=>{ const v=document.getElementById('depVersion'); if(v) v.focus(); },40);
}
function drawDepEnvs(){
  const box=document.getElementById('depEnvPick'); if(!box) return;
  box.innerHTML=DEPLOY_ENVS.map(e=>`<button type="button" class="env-opt ${_depEnvSel.includes(e)?'on':''}" data-env="${esc(e)}">${esc(e)}</button>`).join('');
  box.querySelectorAll('[data-env]').forEach(b=>b.onclick=()=>{
    const e=b.dataset.env;
    _depEnvSel = _depEnvSel.includes(e) ? _depEnvSel.filter(x=>x!==e) : _depEnvSel.concat([e]);
    drawDepEnvs();
  });
}
function wireDepMark(){
  const w=document.getElementById('depMarkWrap'); if(!w || w._wired) return; w._wired=true;
  const close=()=>w.classList.remove('on');
  document.getElementById('depMarkCancel').onclick=close;
  w.onclick=e=>{ if(e.target===w) close(); };
  document.getElementById('depVersion').onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); document.getElementById('depMarkSave').click(); } };
  document.getElementById('depMarkSave').onclick=()=>{
    if(!_depEnvSel.length){ toast('Pick at least one environment'); return; }
    const v=(document.getElementById('depVersion').value||'').trim();
    if(!v){ return reqFail(document.getElementById('depVersion'), 'Enter the version number'); }
    if(!can('deploy_manage')){ toast('You don\u2019t have permission to record deployments'); return; }
    store.markDeployed(_depMarkId, _depEnvSel, v);
    close(); refreshViews();
    toast('Marked as deployed \u00b7 v'+v+' \u2192 '+_depEnvSel.join(', '));
  };
}
function openQaAtt(taskId){ _qaAttTask=taskId; wireQaAtt(); const f=document.getElementById('qaAttFile'); if(f){ f.value=''; f.click(); } }
/* ---- Profile photo -------------------------------------------------------
   Photos ride along inside the person record, so they are downscaled and
   re-encoded to a square JPEG first — a raw 4 MB camera shot would bloat every
   sync. 256px is plenty for a 76px avatar on a retina screen. */
/* Avatars live in the public `avatars` bucket as <user-id>.jpg; the URL is
   mirrored to profiles.avatar_url so every teammate's copy of the app sees it. */
async function uploadAvatar(dataUrl){
  const m=/^data:([^;]+);base64,(.*)$/.exec(String(dataUrl||'')); if(!m) throw new Error('Unsupported image');
  const bin=atob(m[2]); const buf=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
  const blob=new Blob([buf],{type:m[1]});
  const path=ME.id+'.jpg';
  const up=await sb.storage.from('avatars').upload(path, blob, {upsert:true, contentType:m[1], cacheControl:'3600'});
  if(up.error) throw up.error;
  const {data:pub}=sb.storage.from('avatars').getPublicUrl(path);
  const url=pub.publicUrl+'?v='+Date.now();
  const {error}=await sb.from('profiles').update({avatar_url:url}).eq('id',ME.id);
  if(error) throw error;
  return url;
}
async function removeAvatar(){
  try{ await sb.storage.from('avatars').remove([ME.id+'.jpg']); }catch(e){}
  const {error}=await sb.from('profiles').update({avatar_url:null}).eq('id',ME.id);
  if(error) throw error;
}
function squarePhoto(file, px=256){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onerror=()=>rej(new Error('read failed'));
    fr.onload=()=>{ const img=new Image();
      img.onerror=()=>rej(new Error('not an image'));
      img.onload=()=>{ try{
        const side=Math.min(img.width,img.height);
        const sx=(img.width-side)/2, sy=(img.height-side)/2;
        const c=document.createElement('canvas'); c.width=px; c.height=px;
        const g=c.getContext('2d'); g.imageSmoothingQuality='high';
        g.drawImage(img, sx, sy, side, side, 0, 0, px, px);
        res(c.toDataURL('image/jpeg', 0.85));
      }catch(e){ rej(e); } };
      img.src=fr.result; };
    fr.readAsDataURL(file);
  });
}
function wirePhotoPicker(){
  const f=document.getElementById('pfPhotoFile'); if(!f || f._wired) return; f._wired=true;
  f.onchange=async e=>{ const file=e.target.files&&e.target.files[0]; if(!file) return;
    if(!/^image\//.test(file.type)){ toast('Pick a JPG or PNG image'); return; }
    if(file.size>2*1024*1024){ toast('Image is too large (max 2 MB)'); return; }
    const btn=document.getElementById('pfUpload'); const lbl=btn?btn.textContent:'';
    if(btn){ btn.disabled=true; btn.textContent='Uploading\u2026'; }
    try{
      const data=await squarePhoto(file); const u=meUser();
      if(!u){ toast('No profile to attach this to'); return; }
      let url=data;
      if(typeof sb!=='undefined' && sb && ME){
        url=await uploadAvatar(data);             // Storage + profiles.avatar_url
      }
      store.setUserPhoto(u.id, url||data); applyMyPhoto();
      if(ui.view==='settings') renderSettings(); refreshViews(); toast('Photo updated');
    }catch(err){ toast('Couldn\u2019t save the photo: '+((err&&err.message)||'error')); }
    finally{ if(btn){ btn.disabled=false; btn.textContent=lbl; } }
  };
}
function openPhotoPicker(){ wirePhotoPicker(); const f=document.getElementById('pfPhotoFile'); if(f){ f.value=''; f.click(); } }
/* Click any photo avatar to see it full-size (premium DP preview). Your own
   photo also offers a "Change photo" action, reusing the normal upload flow. */
function openDpLightbox(src, name, isMe){
  if(!src) return;
  let lb=document.getElementById('dpLightbox');
  if(!lb){ lb=document.createElement('div'); lb.id='dpLightbox'; lb.className='dp-lb';
    lb.addEventListener('click', e=>{ if(e.target===lb) closeDpLightbox(); });
    document.body.appendChild(lb); }
  const camera='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  lb.innerHTML=`<div class="dp-lb-card">
    <button class="dp-lb-close" onclick="closeDpLightbox()" aria-label="Close">\u00d7</button>
    <img class="dp-lb-img" src="${esc(src)}" alt="${esc(name||'')}">
    ${name?`<div class="dp-lb-name">${esc(name)}</div>`:''}
    ${isMe?`<button class="dp-lb-btn" onclick="closeDpLightbox();openPhotoPicker();">${camera} Change photo</button>`:''}
  </div>`;
  lb.classList.add('on');
}
function closeDpLightbox(){ const lb=document.getElementById('dpLightbox'); if(lb) lb.classList.remove('on'); }
document.addEventListener('click', function(e){
  const av=e.target.closest && e.target.closest('.avatar-img'); if(!av) return;
  const img=av.querySelector('img'); const src=img&&img.getAttribute('src'); if(!src) return;
  e.preventDefault(); e.stopPropagation();
  let mine=false; try{ mine = (src===myPhoto()); }catch(_){}
  openDpLightbox(src, (img.getAttribute('alt')||''), mine);
}, false);
document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeDpLightbox(); });
const ENV_NAMES={staging:'Staging', test:'Test Environment'};
function fclock(iso){ if(!iso) return ''; const d=new Date(iso); if(isNaN(d)) return ''; let h=d.getHours(), m=d.getMinutes(); const ap=h>=12?'PM':'AM'; h=h%12||12; return h+':'+String(m).padStart(2,'0')+' '+ap; }
function envHolderName(b){ const u=b&&store.user&&store.user(b.user); return u?u.name:'Someone'; }
function toLocalInput(d){ d=new Date(d); const p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes()); }
function renderEnvBanner(){
  const host=document.getElementById('envBanner'); if(!host||!store.data) return;
  const me=(typeof CURRENT_UID!=='undefined'&&CURRENT_UID)||(typeof myUid==='function'&&myUid())||null;
  const IC_USER='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  const IC_CLOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  const IC_Q='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="7" r="4"/></svg>';
  const seg=env=>{ const act=store.envActive(env); const q=store.envQueue(env); const nm=ENV_NAMES[env];
    if(!act) return `<span class="eb-env">${nm} <span class="eb-pill free">Available</span></span>`;
    const mine=act.user===me; const holder=mine?'You':esc(envHolderName(act));
    const chips=`<span class="eb-metch">${IC_USER}${holder}</span><span class="eb-metch">${IC_CLOCK}Until ${fclock(act.to)}</span>${q.length?`<span class="eb-metch">${IC_Q}${q.length} in queue</span>`:''}`;
    const rel=(mine&&can('env_release'))?` <button class="eb-rel" data-envrel="${env}">Release</button>`:'';
    return `<span class="eb-env">${nm} <span class="eb-pill inuse">In use</span></span>${chips}${rel}`; };
  const anyBusy=!!(store.envActive('staging')||store.envActive('test'));
  const lead=anyBusy
    ? '<span class="eb-ic warn"><svg class="eb-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg></span>'
    : '<span class="eb-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><path d="M6 7h.01M6 17h.01"/></svg></span>';
  host.innerHTML=`<div class="env-banner">
    ${lead}
    <div class="eb-body">${seg('staging')}<span class="eb-dv"></span>${seg('test')}</div>
  </div>`;
  host.querySelectorAll('[data-envrel]').forEach(b=>b.onclick=()=>{ const env=b.dataset.envrel; const r=store.releaseEnv(env); renderEnvBanner(); try{ updateBell(); }catch(e){} toast(`${ENV_NAMES[env]} released${(r&&r.next)?' \u2014 next in queue notified':''}`); });
  try{ syncHdr(); }catch(e){}
}
/* The workspaces overlay is position:fixed and must start below the real header
   (env banner + nav). That height is dynamic, so measure it instead of hardcoding. */
function syncHdr(){ try{ const nav=document.querySelector('.tsknav'); if(!nav) return; const b=Math.max(62, Math.round(nav.getBoundingClientRect().bottom)); document.documentElement.style.setProperty('--tsk-hdr', b+'px'); }catch(e){} }
try{ window.addEventListener('resize', function(){ try{ syncHdr(); }catch(e){} }); }catch(e){}
let _envSel='test';
function openEnvBlock(env){ _envSel=env||'test'; wireEnvBlock(); renderEnvBlock(); const w=document.getElementById('envBlockWrap'); if(w) w.classList.add('on'); }
function renderEnvBlock(){
  document.querySelectorAll('#envSeg button').forEach(b=>b.classList.toggle('on', b.dataset.env===_envSel));
  const act=store.envActive(_envSel); const q=store.envQueue(_envSel); const info=document.getElementById('envAvail'); if(!info) return; let base;
  if(!act){ base=new Date(); info.className='env-avail free'; info.innerHTML=`<b>${ENV_NAMES[_envSel]}</b> is free right now \u2014 you'll get it immediately.`; }
  else { base=new Date(act.to); const extra=q.length?` \u00b7 ${q.length} already queued`:''; info.className='env-avail busy';
    info.innerHTML=`<b>${ENV_NAMES[_envSel]}</b> is in use until <b>${fclock(act.to)}</b>. Next available slot: <b>${fclock(act.to)}</b>${extra}. Your request will be queued and you'll be notified the moment it's free.`; }
  const from=document.getElementById('envFrom'), to=document.getElementById('envTo');
  const r=new Date(base); r.setSeconds(0,0); r.setMinutes(Math.ceil(r.getMinutes()/15)*15); if(r<new Date()) r.setTime(Date.now());
  const t=new Date(r.getTime()+3600000);
  if(from) from.value=toLocalInput(r); if(to) to.value=toLocalInput(t);
  const sub=document.getElementById('envSubmit'); if(sub) sub.textContent=act?'Join queue':'Block environment';
}
function wireEnvBlock(){ const w=document.getElementById('envBlockWrap'); if(!w||w._wired) return; w._wired=true;
  document.querySelectorAll('#envSeg button').forEach(b=>b.onclick=()=>{ _envSel=b.dataset.env; renderEnvBlock(); });
  const c=document.getElementById('envCancel'); if(c) c.onclick=()=>w.classList.remove('on');
  w.onclick=e=>{ if(e.target===w) w.classList.remove('on'); };
  const s=document.getElementById('envSubmit'); if(s) s.onclick=()=>{
    const fv=document.getElementById('envFrom').value, tv=document.getElementById('envTo').value;
    if(!fv||!tv){ toast('Pick a from and to time'); return; }
    if(new Date(tv)<=new Date(fv)){ toast('End time must be after the start'); return; }
    if(!can('env_block')){ toast('You don\u2019t have permission to block environments'); return; }
    const r=store.blockEnv(_envSel, new Date(fv).toISOString(), new Date(tv).toISOString());
    w.classList.remove('on'); renderEnvBanner(); try{ updateBell(); }catch(e){}
    if(r&&r.active) toast(`${ENV_NAMES[_envSel]} blocked ${fclock(new Date(fv).toISOString())}\u2013${fclock(new Date(tv).toISOString())}`);
    else toast(`Queued for ${ENV_NAMES[_envSel]} \u2014 you'll be notified when it's free (position ${r?r.position:'?'})`);
  };
}
let _depVfId=null;function openDepVerify(id){ _depVfId=id; renderDepVerify();
  const w=document.getElementById('depVerifyWrap'); w.classList.add('on');
  document.getElementById('depVfClose').onclick=()=>{ w.classList.remove('on'); renderDeployments(); };
  w.onclick=e=>{ if(e.target===w){ w.classList.remove('on'); renderDeployments(); } };
}
function renderDepVerify(){
  const t=store.task(_depVfId); if(!t) return;
  const proj=store.project(t.project);
  const checks=t.verifyChecks||{};
  const doneN=VERIFY_ITEMS.filter(it=>checks[it.k]).length, total=VERIFY_ITEMS.length;
  const allDone=doneN===total;
  const vBy=t.verifiedBy?store.user(t.verifiedBy):null;
  document.getElementById('depVfHead').innerHTML=`Deployment verification
    <div style="font-size:12px;font-weight:400;color:var(--muted);margin-top:3px"><b style="color:var(--accent);font-weight:700">${esc(t.key)}</b>${proj?' \u00b7 '+esc(proj.name):''} \u2014 ${esc(t.title)}</div>`;
  const CHK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const rows=VERIFY_ITEMS.map(it=>`<label class="dvf-row ${checks[it.k]?'on':''}" data-k="${it.k}"><span class="dvf-box">${checks[it.k]?CHK:''}</span><span class="dvf-tx">${esc(it.t)}</span></label>`).join('');
  document.getElementById('depVfBody').innerHTML=`
    <p class="dvf-hint">QA sign-off. Confirm the mandatory post-deployment sanity checks before this deployment is marked verified.</p>
    <div class="dvf-list">${rows}</div>
    <div class="dvf-status ${allDone?'ok':''}">${allDone?(CHK+' Verified'+(vBy?' by '+esc(vBy.name):'')):(doneN+' of '+total+' checks complete')}</div>`;
  document.querySelectorAll('#depVfBody .dvf-row').forEach(r=>r.onclick=e=>{ e.preventDefault();
    const tk=store.task(_depVfId); const c=Object.assign({}, tk.verifyChecks||{}); c[r.dataset.k]=!c[r.dataset.k];
    const verified=VERIFY_ITEMS.every(it=>c[it.k]);
    const wasStatus=tk.status;
    store.verifyDeployment(_depVfId, c, verified); renderDepVerify();
    const now=store.task(_depVfId);
    if(now && now.status!==wasStatus){
      const st=store.status(now.status);
      try{ toast(`${now.key} verified \u2014 moved to ${st?st.name:'Done'}`); }catch(e){}
    }
    try{ refreshViews(); }catch(e){}
  });
}
const QA_SEV={low:'Low', med:'Med', high:'High'};
let _qaVfId=null, _qaSev='med';
function openQaVerify(id){ _qaVfId=id; _qaSev='med'; renderQaVerify();
  const w=document.getElementById('qaVerifyWrap'); w.classList.add('on');
  document.getElementById('qaVfClose').onclick=()=>{ w.classList.remove('on'); renderQA(); };
  w.onclick=e=>{ if(e.target===w){ w.classList.remove('on'); renderQA(); } };
}
function renderQaVerify(){
  const t=store.task(_qaVfId); if(!t) return;
  const proj=store.project(t.project); const dev=store.user(t.assignee);
  const cases=t.qaCases||[]; const passed=cases.filter(c=>c.status==='pass').length; const total=cases.length;
  const verified=total>0 && passed===total; const bugs=t.qaBugs||[];
  const SL={pending:'Pending',pass:'Pass',fail:'Fail'};
  const CHK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  document.getElementById('qaVfHead').innerHTML=`QA sign-off
    <div style="font-size:12px;font-weight:400;color:var(--muted);margin-top:3px"><b style="color:var(--accent);font-weight:700">${esc(t.key)}</b>${proj?' \u00b7 '+esc(proj.name):''} \u2014 ${esc(t.title)}</div>`;
  const caseRows = cases.length ? cases.map(c=>`<div class="qvf-case">
      <div class="qa-case-main"><span class="qvf-case-tx">${esc(c.title)}</span><span class="qa-case-kind ${c.kind==='use'?'use':'test'}">${c.kind==='use'?'Use Case':'Test'}</span></div>
      <button class="qa-status ${c.status||'pending'}" data-qcy="${t.id}|${c.id}">${SL[c.status]||'Pending'}</button>
    </div>`).join('') : '<div class="qa-empty-cases">No cases yet. Add them on the QA card first.</div>';
  const bugRows = bugs.length ? bugs.map(b=>{ const bu=store.user(b.by); return `<div class="qvf-bug ${b.status}">
      <span class="qvf-sev ${b.severity}">${QA_SEV[b.severity]||'Med'}</span>
      <div class="qvf-bug-main"><div class="qvf-bug-tx">${esc(b.text)}</div>
        <div class="qvf-bug-meta">${bu?esc(bu.name):'QA'} \u00b7 ${timeAgo(b.at)}${b.status==='fixed'?' \u00b7 fixed':''}</div></div>
      <button class="qvf-bug-tog" data-bugtog="${t.id}|${b.id}">${b.status==='fixed'?'Reopen':'Resolve'}</button>
      <button class="qvf-bug-del" data-bugdel="${t.id}|${b.id}" title="Delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>`; }).join('') : '<div class="qa-empty-cases">No fixes reported yet.</div>';
  const sevBtn=k=>`<button class="qvf-sevb ${k} ${_qaSev===k?'on':''}" data-sev="${k}">${QA_SEV[k]}</button>`;
  document.getElementById('qaVfBody').innerHTML=`
    <div class="qvf-sec-h">Test &amp; use cases <span>${passed}/${total} passing</span></div>
    <div class="qvf-cases">${caseRows}</div>
    <div class="qvf-sec-h" style="margin-top:18px">Bugs &amp; fixes for the developer${dev?' \u00b7 <span>'+esc(dev.name)+'</span>':''}</div>
    <div class="qvf-hint">Anything you send shows up on the ticket for the developer, in their notifications, and on the ticket timeline.</div>
    <div class="qvf-bugs">${bugRows}</div>
    <div class="qvf-compose">
      <textarea class="qvf-in" id="qvfIn" placeholder="Describe the bug or the fix needed\u2026"></textarea>
      <div class="qvf-compose-b"><div class="qvf-sevpick">${sevBtn('low')}${sevBtn('med')}${sevBtn('high')}</div>
        <button class="qvf-send" id="qvfSend">Send to developer</button></div>
    </div>
    <div class="dvf-status ${verified?'ok':''}">${verified?(CHK+' QA verified \u2014 all cases passing'):(total?passed+' of '+total+' cases passing':'Add and pass cases to verify')}</div>`;
  document.querySelectorAll('#qaVfBody .qa-status[data-qcy]').forEach(b=>b.onclick=()=>{ const p=b.dataset.qcy.split('|'); const tk=store.task(p[0]); const c=(tk&&tk.qaCases||[]).find(x=>x.id===p[1]); if(!c) return;
    const nx={pending:'pass',pass:'fail',fail:'pending'}[c.status||'pending']; store.updateQaCase(p[0],p[1],{status:nx}); renderQaVerify(); });
  document.querySelectorAll('#qaVfBody .qvf-sevb').forEach(b=>b.onclick=()=>{ _qaSev=b.dataset.sev; document.querySelectorAll('#qaVfBody .qvf-sevb').forEach(x=>x.classList.toggle('on', x===b)); });
  document.querySelectorAll('#qaVfBody .qvf-bug-tog').forEach(b=>b.onclick=()=>{ const p=b.dataset.bugtog.split('|'); const bug=(store.task(p[0]).qaBugs||[]).find(x=>x.id===p[1]); store.updateQaBug(p[0],p[1],{status:bug&&bug.status==='fixed'?'open':'fixed'}); renderQaVerify(); });
  document.querySelectorAll('#qaVfBody .qvf-bug-del').forEach(b=>b.onclick=()=>{ const p=b.dataset.bugdel.split('|'); store.removeQaBug(p[0],p[1]); renderQaVerify(); });
  const send=()=>{ const ta=document.getElementById('qvfIn'); const v=(ta.value||'').trim(); if(!v) return; store.addQaBug(_qaVfId, v, _qaSev); renderQaVerify(); const nt=document.getElementById('qvfIn'); if(nt) nt.focus(); try{ toast('Sent to developer'); }catch(e){} };
  document.getElementById('qvfSend').onclick=send;
  document.getElementById('qvfIn').onkeydown=e=>{ if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){ e.preventDefault(); send(); } };
}
function boardAction(id, act){
  const inSettings = ui.view==='boardsettings';
  if(act==='configure'){ ui.board=id; bsTab='columns';
    if(inSettings){ renderBoardSettings(); renderBoardSwitch(); }
    else { if(ui.view!=='board'){ setView('board'); } else renderAll(); openBoardSettings(); } }
  else if(act==='rename'){ if(!can('board_rename')){ toast('You don\u2019t have permission to rename boards'); return; }
    if(inSettings) renameBoardSettingRow(id); else renameBoardInline(id); }
  else if(act==='delete'){ if(!can('board_delete')){ toast('You don\u2019t have permission to delete boards'); return; }
    if(store.boards().length<=1){ toast('Keep at least one board'); return; }
    const nm=store.board(id).name; store.removeBoard(id); if(ui.board===id) ui.board=store.boards()[0].id;
    if(inSettings){ renderBoardSettings(); renderBoardSwitch(); } else renderAll();
    toast(`Deleted \u201c${nm}\u201d`); }
}
function renameBoardSettingRow(id){
  const card=document.querySelector(`.brd-card[data-board="${id}"]`); if(!card) return;
  const nm=card.querySelector('.brd-nm'); if(!nm) return;
  const inp=document.createElement('input'); inp.className='brd-nm-edit'; inp.value=store.board(id).name;
  nm.replaceWith(inp); inp.focus(); inp.select();
  let done=false;
  const save=commit=>{ if(done) return; done=true; const v=inp.value.trim();
    if(commit&&v) store.updateBoard(id,{name:v});
    renderBoardSettings(); renderBoardSwitch();
    if(ui.view==='board'&&ui.board===id){ const t=document.getElementById('pageTitle'); if(t) t.textContent=store.board(id).name; } };
  inp.onclick=e=>e.stopPropagation();
  inp.onkeydown=e=>{ if(e.key==='Enter') save(true); if(e.key==='Escape') save(false); };
  inp.onblur=()=>save(true);
}
function renameBoardInline(id){
  const item=document.querySelector(`.board-nav[data-board="${id}"]`); if(!item) return;
  const nm=item.querySelector('.bn-nm'); const cur=store.board(id).name;
  const inp=document.createElement('input'); inp.className='bn-edit'; inp.value=cur;
  nm.replaceWith(inp); inp.focus(); inp.select();
  let done=false;
  const save=commit=>{ if(done) return; done=true; const v=inp.value.trim(); if(commit&&v) store.updateBoard(id,{name:v});
    renderBoardSwitch(); if(ui.view==='board'&&ui.board===id) document.getElementById('pageTitle').textContent=store.board(id).name; };
  inp.onclick=e=>e.stopPropagation();
  inp.onkeydown=e=>{ if(e.key==='Enter') save(true); if(e.key==='Escape') save(false); };
  inp.onblur=()=>save(true);
}
function addBoardFromSide(){ if(!can('board_create')){ toast('You don\u2019t have permission to create boards'); return; }
  openBoardWizard();
}

/* ---------- Board creation wizard ----------------------------------------
   A board is created only after its workflow (statuses + first transitions)
   and at least one project are defined. Steps: Name → Statuses → Projects.
   Nothing is written to the store until the final "Create board". */
let _bw=null;   // wizard draft state
function openBoardWizard(){
  if(!can('board_create')){ toast('You don\u2019t have permission to create boards'); return; }
  // seed default statuses from the workspace's existing status catalogue (todo→done spread)
  const todo=(STATUSES.find(s=>s.cat==='todo')||STATUSES[0]||{});
  const prog=(STATUSES.find(s=>s.cat==='progress')||{});
  const done=(STATUSES.find(s=>s.cat==='done')||{});
  const seedCols=[todo,prog,done].filter(s=>s&&s.id).map(s=>s.id);
  _bw={ step:0, name:'', columns:seedCols.length?seedCols:(STATUSES.slice(0,3).map(s=>s.id)), projects:[] };
  document.getElementById('bwWrap').classList.add('on');
  renderBoardWizard();
}
function closeBoardWizard(){ const w=document.getElementById('bwWrap'); if(w) w.classList.remove('on'); _bw=null; }
const BW_STEPS=['Name','Workflow','Projects'];
function renderBoardWizard(){
  if(!_bw) return;
  const steps=document.getElementById('bwSteps');
  steps.innerHTML=BW_STEPS.map((s,i)=>`<div class="bw-step ${i===_bw.step?'on':''} ${i<_bw.step?'done':''}"><span class="bw-dot">${i<_bw.step?'\u2713':(i+1)}</span>${s}</div>`).join('<div class="bw-sep"></div>');
  const body=document.getElementById('bwBody');
  const back=document.getElementById('bwBack'), next=document.getElementById('bwNext');
  back.style.visibility=_bw.step===0?'hidden':'visible';
  next.textContent=_bw.step===BW_STEPS.length-1?'Create board':'Next';

  if(_bw.step===0){
    body.innerHTML=`<div class="field"><label>Board name<span class="req">*</span></label>
      <input id="bwName" placeholder="e.g. Mobile Squad" autocomplete="off" value="${esc(_bw.name)}"/></div>
      <div class="loghint" style="margin-top:8px">Boards are containers for a team's work. Each board owns its own workflow and projects.</div>`;
    const inp=document.getElementById('bwName'); inp.oninput=()=>{ _bw.name=inp.value; };
    inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); bwNext(); } };
    setTimeout(()=>inp.focus(),40);
  } else if(_bw.step===1){
    // status multi-select from the workspace catalogue + order = column order
    const chips=STATUSES.map(s=>{ const on=_bw.columns.includes(s.id);
      return `<button class="bw-stx ${on?'on':''}" data-st="${s.id}" type="button"><span class="bw-stdot" style="background:${s.color||'#999'}"></span>${esc(s.name)}</button>`; }).join('');
    body.innerHTML=`<div class="field"><label>Statuses in this board's flow<span class="req">*</span></label>
      <div class="bw-sthint">These become the board's columns, left to right. Pick at least two.</div>
      <div class="bw-stwrap">${chips}</div></div>
      <div class="bw-order" id="bwOrder"></div>`;
    body.querySelectorAll('.bw-stx').forEach(b=>b.onclick=()=>{ const id=b.dataset.st;
      const i=_bw.columns.indexOf(id); if(i>=0) _bw.columns.splice(i,1); else _bw.columns.push(id); renderBoardWizard(); });
    const ord=document.getElementById('bwOrder');
    ord.innerHTML=_bw.columns.length?('<div class="bw-ordlbl">Column order</div>'+_bw.columns.map(id=>{ const s=store.status(id)||{name:id};
      return `<span class="bw-ordchip">${esc(s.name)}</span>`; }).join('<span class="bw-ordarr">\u2192</span>')):'';
  } else {
    // projects for this board
    const rows=_bw.projects.map((p,i)=>`<div class="bw-prow">
      <input class="bw-pn" data-i="${i}" placeholder="Project name" value="${esc(p.name)}"/>
      <input class="bw-pk" data-i="${i}" placeholder="KEY" maxlength="10" value="${esc(p.key)}"/>
      <button class="bw-prm" data-i="${i}" type="button" title="Remove">\u2715</button></div>`).join('');
    body.innerHTML=`<div class="field"><label>Projects on this board<span class="req">*</span></label>
      <div class="bw-sthint">Every ticket on this board belongs to one of these projects. Add at least one.</div>
      <div class="bw-plist">${rows}</div>
      <button class="btn bw-addp" id="bwAddP" type="button">+ Add project</button></div>`;
    body.querySelectorAll('.bw-pn').forEach(inp=>inp.oninput=()=>{ const i=+inp.dataset.i; _bw.projects[i].name=inp.value;
      if(!_bw.projects[i]._kt){ _bw.projects[i].key=inp.value.replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase(); const kf=body.querySelector('.bw-pk[data-i="'+i+'"]'); if(kf) kf.value=_bw.projects[i].key; } });
    body.querySelectorAll('.bw-pk').forEach(inp=>inp.oninput=()=>{ const i=+inp.dataset.i; _bw.projects[i]._kt=true; inp.value=inp.value.toUpperCase().replace(/[^A-Z0-9]/g,''); _bw.projects[i].key=inp.value; });
    body.querySelectorAll('.bw-prm').forEach(b=>b.onclick=()=>{ _bw.projects.splice(+b.dataset.i,1); renderBoardWizard(); });
    document.getElementById('bwAddP').onclick=()=>{ _bw.projects.push({name:'',key:'',_kt:false}); renderBoardWizard();
      setTimeout(()=>{ const ins=document.querySelectorAll('.bw-pn'); if(ins.length) ins[ins.length-1].focus(); },30); };
    if(!_bw.projects.length){ _bw.projects.push({name:'',key:'',_kt:false}); renderBoardWizard(); }
  }
}
function bwBack(){ if(_bw && _bw.step>0){ _bw.step--; renderBoardWizard(); } }
function bwNext(){
  if(!_bw) return;
  if(_bw.step===0){ if(!_bw.name.trim()){ toast('Give the board a name'); return; } _bw.step=1; return renderBoardWizard(); }
  if(_bw.step===1){ if(_bw.columns.length<2){ toast('Pick at least two statuses for the flow'); return; } _bw.step=2; return renderBoardWizard(); }
  // final: validate projects (>=1 named, unique keys) then create everything
  const projs=_bw.projects.map(p=>({name:(p.name||'').trim(), key:(p.key||'').trim().toUpperCase()})).filter(p=>p.name);
  if(!projs.length){ toast('Add at least one project'); return; }
  for(const p of projs){ if(!p.key){ p.key=p.name.replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase()||'PRJ'; } }
  // key uniqueness (against existing + within the batch)
  const seen={}; for(const p of projs){ if(seen[p.key]){ toast('Duplicate key "'+p.key+'" in your projects'); return; } seen[p.key]=1;
    const clash=store.projects().find(x=>String(x.key||'').toUpperCase()===p.key); if(clash){ toast('Key "'+p.key+'" is already used by '+clash.name); return; } }
  // create board with the chosen columns
  const bid=store.addBoard(_bw.name.trim());
  const bd=store.board(bid); if(bd){ bd.columns=_bw.columns.slice(); }
  // create projects on this board
  projs.forEach(p=>{ const pid=store.addProject(p.name, bid); store.updateProject(pid,{key:p.key}); });
  store._persist();
  closeBoardWizard();
  ui.board=bid; setView('board');
  if(window.renderBoardSwitch) renderBoardSwitch();
  toast('Board created');
}
let bsTab='boards';
function openBoardSettings(){ ui.view='boardsettings'; setView('boardsettings'); }
function closeBoardSettings(){ renderAll(); fillFilters(); }
function renderBoardSettings(){
  const el=document.getElementById('boardsettingswrap'); if(!el) return;
  const b=activeBoard();
  const SECS=[
    {k:'boards',  n:'Boards',      d:'Each board holds its own tickets \u2014 a new one starts empty'},
    {k:'columns', n:'Columns',     d:'Which statuses appear as columns on this board'},
    {k:'flow',    n:'Transitions', d:'Which status can move to which'},
    {k:'fields',  n:'Fields',      d:'Custom fields on every ticket'},
    {k:'types',   n:'Ticket types', d:'Task, Bug, Hot fix — add your own'},
    {k:'prios',   n:'Priorities',  d:'Levels and their order — top row is most urgent'},
  ];
  if(!SECS.find(x=>x.k===bsTab)) bsTab='boards';
  const cur=SECS.find(x=>x.k===bsTab);
  const addLbl = bsTab==='boards'?'Add board' : bsTab==='fields'?'Add field' : bsTab==='types'?'Add type' : bsTab==='prios'?'Add priority' : bsTab==='columns'?'New status' : null;
  const dirty = bsTab==='flow' && _flowDirty;

  let body='';
  if(bsTab==='boards') body=bsBoards();
  else if(bsTab==='columns') body=bsColumns(b);
  else if(bsTab==='fields') body=bsFields();
  else if(bsTab==='types') body=bsTypes();
  else if(bsTab==='prios') body=bsPriorities();
  else body=bsFlow(b);
  const onBoards = bsTab==='boards';

  el.innerHTML=`<div class="bs-wrap">
      <div class="bs-head">
        <div class="bs-head-l">
          ${onBoards?'':`<button class="bs-back" id="bsBack" type="button"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 6l-6 6 6 6"/></svg>Boards</button>`}
          <div class="bs-head-tx"><h2>${esc(cur.n)}</h2><p>${esc(cur.d)}</p></div>
        </div>
        ${addLbl?`<button class="tsk-btn tsk-btn--ghost tsk-btn--sm" id="bsAdd" type="button">${addLbl}</button>`:''}
      </div>
      <div id="bsBody">${onBoards?body:`<div class="bs-panel">${body}</div>`}</div>
    </div>`;

  const back=document.getElementById('bsBack');
  if(back) back.onclick=()=>{
    const proceed=()=>{ if(_flowDirty) flowDraftReset(); bsTab='boards'; renderBoardSettings(); };
    if(_flowDirty){ confirmDelete({ title:'Unsaved changes', lead:'You have unsaved workflow changes.',
      confirmLabel:'Leave without saving', warn:'', onConfirm:proceed }); return; }
    proceed();
  };
  const add=document.getElementById('bsAdd');
  if(add) add.onclick=()=>{
    if(bsTab==='boards'){ openBoardWizard(); }
    else if(bsTab==='columns'){ if(!can('board_columns')){ toast('You don\u2019t have permission to edit columns'); return; }
      store.addStatus('New status');
      const nid=store.statuses()[store.statuses().length-1].id;
      store.toggleBoardColumn(activeBoard(), nid, true); renderBoardSettings();
      const rows=document.querySelectorAll('#bsBody .bsrow'); const last=rows[rows.length-1];
      if(last){ const inp=last.querySelector('.bsname'); if(inp){ inp.focus(); inp.select(); } } }
    else if(bsTab==='types'){ if(!can('type_manage')){ toast('You don\u2019t have permission to manage ticket types'); return; }
      const nm=prompt('New ticket type name'); if(!nm) return;
      if(!store.addType(nm)){ toast('That type already exists'); return; }
      renderBoardSettings(); toast(nm.trim()+' added'); }
    else if(bsTab==='prios'){ if(!can('prio_manage')){ toast('You don\u2019t have permission to manage priorities'); return; }
      const nm=prompt('New priority name'); if(!nm) return;
      if(!store.addPriority(nm)){ toast('That priority already exists'); return; }
      renderBoardSettings(); refreshViews(); toast(nm.trim()+' added'); }
    else if(bsTab==='fields'){ if(!can('cf_create')){ toast('You don\u2019t have permission to create custom fields'); return; }
      store.addField('New field','text'); renderBoardSettings();
      const rows=document.querySelectorAll('#bsBody .fld-row'); const last=rows[rows.length-1];
      if(last){ const inp=last.querySelector('.fld-name'); if(inp){ inp.focus(); inp.select(); } } }
  };
  const sv=document.getElementById('bsSave');
  if(sv) sv.onclick=flowSave;
  wireBoardSettings(b);
}
