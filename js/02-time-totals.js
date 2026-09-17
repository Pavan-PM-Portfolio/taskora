/* Taskora — 02-time-totals.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ---------- roll-up helpers ---------- */
function taskTotals(taskId){
  const logs = store.worklogs(taskId);
  const byCat={}, byUser={}; let total=0;
  CATS.forEach(c=>byCat[c.id]=0);
  logs.forEach(l=>{ byCat[l.cat]=(byCat[l.cat]||0)+l.min; byUser[l.user]=(byUser[l.user]||0)+l.min; total+=l.min; });
  return {byCat, byUser, total, logs};
}
function projectMinutes(projectId){
  const taskIds = store.tasks().filter(t=>t.project===projectId).map(t=>t.id);
  return store.data.worklogs.filter(w=>taskIds.includes(w.task)).reduce((a,w)=>a+w.min,0);
}
function epicStats(epicId){
  const kids=store.epicChildren(epicId);
  const done=kids.filter(k=>{ const s=store.status(k.status); return s&&s.cat==='done'; }).length;
  const minutes=kids.reduce((a,k)=>a+taskTotals(k.id).total,0);
  const pct=kids.length?Math.round(done/kids.length*100):0;
  let cat='todo';
  if(kids.length){ if(done===kids.length) cat='done'; else if(kids.some(k=>{const s=store.status(k.status);return s&&(s.cat==='inprogress'||s.cat==='done');})) cat='inprogress'; }
  return {total:kids.length, done, pct, minutes, cat, kids};
}

/* ---------- format ---------- */
const initials = n => n.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
/* ---- Required-field validation -------------------------------------------
   One helper for every create/edit form. Hidden enhanced <select>s are flashed
   via their visible proxy button so the feedback lands where the user looks. */
function reqFail(el, msg){
  try{ toast(msg); }catch(e){}
  if(el){
    const proxy=document.querySelector(`[data-for="${el.id}"]`) || el;
    proxy.classList.add('req-bad');
    setTimeout(()=>proxy.classList.remove('req-bad'), 1800);
    try{ (proxy.focus?proxy:el).focus(); }catch(e){}
  }
  return false;
}
function reqCheck(list){
  for(const [id,msg] of list){
    const el=document.getElementById(id);
    if(!el) continue;                       // field not present in this variant
    if(el.offsetParent===null && !el.classList.contains('nt-hidden')) continue;  // genuinely hidden row
    if(!String(el.value||'').trim()) return reqFail(el, msg);
  }
  return true;
}
const AV_COLORS=['#C2410C','#D6264F','#0E8F5A','#7C3AED','#B96A00','#0891B2','#BE185D'];
function avColor(s){ let h=0; for(const c of (s||'?')) h=(h*31+c.charCodeAt(0))>>>0; return AV_COLORS[h%AV_COLORS.length]; }
function hm(min){ if(!min) return '0h'; const h=Math.floor(min/60), m=min%60; return (h?h+'h':'')+(m?(h?' ':'')+m+'m':(h?'':'0h')); }
// Jira-style durations: 1w=5d, 1d=8h, 1h=60m
function parseDur(str){ if(!str) return null; str=String(str).trim(); let total=0, matched=false;
  const re=/(\d+(?:\.\d+)?)\s*([wdhm])/gi; let m;
  while((m=re.exec(str))){ matched=true; const v=parseFloat(m[1]); const u=m[2].toLowerCase();
    total += v*(u==='w'?MIN_PER_WEEK:u==='d'?MIN_PER_DAY:u==='h'?60:1); }
  if(!matched){ const n=parseFloat(str); return isNaN(n)?null:Math.round(n*60); } // bare number = hours
  return Math.round(total); }
function jiraDur(min){ if(!min||min<=0) return ''; let w=Math.floor(min/MIN_PER_WEEK); min-=w*MIN_PER_WEEK; let d=Math.floor(min/MIN_PER_DAY); min-=d*MIN_PER_DAY; let h=Math.floor(min/60); let mm=min-h*60;
  return [w&&w+'w', d&&d+'d', h&&h+'h', mm&&mm+'m'].filter(Boolean).join(' '); }
function daysBetween(a,b){ if(!a||!b) return null; return Math.round((Date.parse(a)-Date.parse(b))/86400000); }
function median(arr){ if(!arr.length) return 0; const s=[...arr].sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; }
const AVATAR_COLORS=['#D6264F','#7C2D12','#14532D','#581C87','#7F1D1D','#164E63','#78350F','#831843','#D6264F','#365314','#134E4A','#1E293B'];
function avatarColor(user){ if(!user) return '#64748B'; return avColor(user.name); }
/* Google-style generic account glyph — the fallback wherever a person has no
   photo yet. Deliberately identical for everyone, exactly like Google/Teams. */
const ACCT_GLYPH='<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8.2" r="3.9"/><path d="M12 13.4c-4.1 0-7.4 2.6-7.4 5.9 0 .4.3.7.7.7h13.4c.4 0 .7-.3.7-.7 0-3.3-3.3-5.9-7.4-5.9Z"/></svg>';
function avatar(user, size=22){ const bw=size>=30?1.5:1.25;
  if(!user) return `<span class="avatar" style="width:${size}px;height:${size}px;background:#8A8F9820;border:${bw}px solid #B4B2A9;color:#5F5E5A;font-size:${Math.max(9,Math.round(size*0.4))}px">–</span>`;
  const _p=photoOf(user);
  if(_p) return `<span class="avatar avatar-img" style="width:${size}px;height:${size}px"><img src="${_p}" alt="${esc(user.name||'')}" loading="lazy"></span>`;
  return `<span class="avatar avatar-glyph" style="width:${size}px;height:${size}px" title="${esc(user.name||'')}">${ACCT_GLYPH}</span>`; }
/* Photos are cached in one localStorage map keyed by email so avatars render
   instantly on load — the person record wins if it carries its own. */
const DP_KEY='tsk_avatars';
/* Parsed once and cached. avatar() runs for every card, chip and dropdown row,
   so re-reading + JSON.parsing this map (which holds base64 photos) per call
   made rendering crawl. Invalidated on our own writes and on cross-tab edits. */
let _dpCache=null;
function dpAll(){
  if(_dpCache) return _dpCache;
  try{ _dpCache=JSON.parse(localStorage.getItem(DP_KEY)||'{}')||{}; }catch(e){ _dpCache={}; }
  return _dpCache;
}
function dpGet(email){ if(!email) return null; return dpAll()[String(email).trim().toLowerCase()]||null; }
function dpSet(email,data){ if(!email) return; const m=dpAll(); const k=String(email).trim().toLowerCase();
  if(data) m[k]=data; else delete m[k];
  _dpCache=m;
  try{ localStorage.setItem(DP_KEY,JSON.stringify(m)); }catch(e){} }
try{ window.addEventListener('storage', e=>{ if(e && e.key===DP_KEY) _dpCache=null; }); }catch(e){}
/* Source of truth is profiles.avatar_url, synced onto the person record.
   dpGet() stays only so photos set before the Storage move still render. */
function photoOf(u){ if(!u) return null; return u.photo || dpGet(u.email) || null; }
function myPhoto(){ try{ return photoOf(meUser()) || (typeof ME_AVATAR!=='undefined'&&ME_AVATAR) || (typeof ME!=='undefined'&&ME&&ME.email?dpGet(ME.email):null) || null; }catch(e){ return null; } }
/* Paint the signed-in person's photo into every account slot (top nav + account
   panel). Falls back to the generic glyph so the chrome never looks broken. */
function applyMyPhoto(){
  const p=myPhoto(); const nm=(function(){ try{ const u=meUser(); return (u&&u.name)||''; }catch(e){ return ''; } })();
  ['acctAv','apAv'].forEach(id=>{ const el=document.getElementById(id); if(!el) return;
    el.innerHTML = p ? `<img src="${p}" alt="${esc(nm)}">` : ACCT_GLYPH; });
}
function priIcon(p){ const c=PRIORITIES[p]||'#9BA3AF';
  return `<svg class="pri" viewBox="0 0 14 14" title="${p}"><rect x="1" y="8" width="3" height="5" rx="1" fill="${c}" opacity="${p==='Low'?1:.45}"/><rect x="5.5" y="4" width="3" height="9" rx="1" fill="${c}" opacity="${p==='Low'?.3:(p==='Medium'?1:.6)}"/><rect x="10" y="1" width="3" height="12" rx="1" fill="${c}" opacity="${(p==='High'||p==='Highest')?1:.3}"/></svg>`; }
function fdate(d){ if(!d) return '—';
  // Accepts a plain date (2026-07-24) or a full ISO timestamp — taking only the
  // date part, otherwise the day parses as NaN and renders "NaN Jul 2026".
  const [y,m,dd]=String(d).slice(0,10).split('-'); const day=+dd; const mi=+m-1;
  if(!y||isNaN(day)||isNaN(mi)) return '—';
  const full=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const abbr=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if(DATE_FMT==='iso') return `${y}-${m}-${dd}`;
  if(DATE_FMT==='mdy') return `${abbr[mi]} ${day}, ${y}`;
  return `${day} ${abbr[mi]} ${y}`; }   // dmy (default)
function timeAgo(at){ const iso=(typeof at==='string'&&at.length<=10)?at+'T00:00:00':at; const d=new Date(iso); const diff=(Date.now()-d.getTime())/1000;
  if(diff<0) return 'just now'; if(diff<45) return 'just now'; if(diff<3600) return Math.max(1,Math.floor(diff/60))+'m ago';
  if(diff<86400) return Math.floor(diff/3600)+'h ago'; if(diff<604800) return Math.floor(diff/86400)+'d ago';
  return fdate((typeof at==='string'?at.slice(0,10):_isoLocal(d))); }
function fdatetime(at){ if(typeof at==='string'&&at.length<=10) return fdate(at); const d=new Date(at);
  if(USER_TZ){ try{ const parts=new Intl.DateTimeFormat('en-CA',{timeZone:USER_TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(d);
    const g=t=>(parts.find(p=>p.type===t)||{}).value;
    return fdate(`${g('year')}-${g('month')}-${g('day')}`)+', '+g('hour')+':'+g('minute')+' '+(g('dayPeriod')||'').toUpperCase(); }catch(e){} }
  let h=d.getHours(); const m=String(d.getMinutes()).padStart(2,'0'); const ap=h>=12?'PM':'AM'; h=h%12||12;
  return fdate(_isoLocal(d))+', '+h+':'+m+' '+ap; }
function _depTime(key){ let n=0; (key||'x').split('').forEach(c=>n=(n*31+c.charCodeAt(0))>>>0); const h=9+(n%9); const m=(n>>3)%60; return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00'; }
