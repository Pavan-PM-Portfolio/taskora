/* Taskora — 17-supabase-sync.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ============================================================
   BACKEND  —  Supabase auth + load + first-run seed + per-record
   sync + realtime. Falls back to localStorage when not configured.
============================================================ */
let REMOTE = !!(SUPABASE_URL && !SUPABASE_URL.includes('PASTE') && SUPABASE_ANON && !SUPABASE_ANON.includes('PASTE') && window.supabase);
let sb=null, WS=null, IS_ADMIN=true, IS_MASTER=false, TOOL_ROLE=null, ME=null, ME_AVATAR=null;
/* pmdb — every workspace table read/write goes through this. Taskora runs on a
   single Supabase project, so it is the same client as sb (set in boot()). The
   separate name is kept so data-layer code reads clearly. */
let pmdb=null;
/* ---- Local cache hygiene -------------------------------------------------
   _persist() mirrors the workspace into localStorage. Two problems on a shared
   machine: the cache outlives the session, and a single fixed key means two
   accounts share one slot. Scope it per user, and wipe everything on sign-out. */
const STORE_KEY_BASE='taskora_v1';
function scopeStoreKey(){
  try{
    if(String(store._k).indexOf('taskora_preview')===0) return;   // preview build: leave alone
    const uid=(ME&&ME.id)||null; if(!uid) return;
    const scoped=STORE_KEY_BASE+'_'+uid;
    if(store._k===scoped) return;
    store._k=scoped;
    // never inherit whatever the previous account left in the unscoped slot
    try{ localStorage.removeItem(STORE_KEY_BASE); }catch(e){}
  }catch(e){}
}
function clearLocalAppData(){
  try{
    const kill=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i); if(!k) continue;
      if(k.indexOf('taskora_')===0        // workspace cache (scoped or not)
       || k.indexOf('tsk_notifs_')===0    // notifications
       || k==='tsk_avatars'               // display pictures
       || k==='tsk_spot'                  // last-visited view
       || k==='tsk_booted') kill.push(k);
    }
    kill.forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
    try{ sessionStorage.removeItem('tsk_booted'); }catch(e){}
    _dpCache=null; _notifCache=null; _notifCacheKey=null;   // drop in-memory copies too
  }catch(e){}
}
const TBL={users:'people', projects:'projects', statuses:'statuses', boards:'boards', teams:'teams', tasks:'tasks', worklogs:'worklogs', spaces:'spaces', sprints:'sprints'};
let snap={}, syncTimer=null, rerenderTimer=null;

function meUser(){
  const u=store.user(CURRENT_UID); if(u) return u;
  // Signed in but no matching person record → nobody. Falling back to the first
  // user here would hand out their role (incl. Admin) to every account.
  if(typeof ME!=='undefined' && ME) return null;
  return store.users()[0] || null;
}
