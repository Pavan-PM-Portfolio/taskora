/* Taskora — 01-config-and-data.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ============================================================
   CONFIG — read from config.js (see config.example.js).
   With no URL/key the app runs as a single-browser demo that
   keeps everything in localStorage.
============================================================ */
const TASKORA_CONFIG = window.TASKORA_CONFIG || {};
const SUPABASE_URL  = String(TASKORA_CONFIG.supabaseUrl || '').replace(/\/+$/, '');
const SUPABASE_ANON = String(TASKORA_CONFIG.supabaseKey || '');
var __guestLocked = false;   // var: guestLockStorage() can run before this line executes
function guestLockStorage(){
  if(__guestLocked) return; __guestLocked = true;
  const mem = { local:new Map(), session:new Map() };
  const pick = s => { try{ return s===window.sessionStorage ? mem.session : mem.local; }catch(e){ return mem.local; } };
  const P = Storage.prototype;
  P.getItem    = function(k){ const m=pick(this); k=String(k); return m.has(k) ? m.get(k) : null; };
  P.setItem    = function(k,v){ pick(this).set(String(k), String(v)); };
  P.removeItem = function(k){ pick(this).delete(String(k)); };
  P.clear      = function(){ pick(this).clear(); };
  P.key        = function(i){ const keys=[...pick(this).keys()]; return i>=0 && i<keys.length ? keys[i] : null; };
  try{ Object.defineProperty(P, 'length', { configurable:true, get(){ return pick(this).size; } }); }catch(e){}
}
if(!(SUPABASE_URL && SUPABASE_ANON) || new URLSearchParams(location.search).has('guest')) guestLockStorage();

/* Production ships silent: no console output leaks table names, RLS messages,
   or error internals. Flip on for troubleshooting with ?debug=1 in the URL,
   or localStorage.setItem('pm:debug','1'). */
const __PM_DEBUG = (function(){ try{ return location.search.indexOf('debug=1')>-1 || localStorage.getItem('pm:debug')==='1'; }catch(e){ return false; } })();
const __dbg = __PM_DEBUG ? console : { log:function(){}, warn:function(){}, error:function(){} };

/* ============================================================
   DATA LAYER  —  reads stay in-memory (store.data); writes sync
   per-record to Supabase when configured, else localStorage.
============================================================ */
const CATS = [
  {id:'Development', color:'#0C5A9E'},
  {id:'Code Review', color:'#B96A00'},
  {id:'QA',          color:'#CE2F26'},
  {id:'Deployment',  color:'#0E8F5A'},
  {id:'Other',       color:'#727A87'},
];
/* Colour map kept in sync with store.priorities(). Everything that reads
   PRIORITIES / Object.keys(PRIORITIES) keeps working, but the source of truth
   is now editable in Board settings. */
let PRIORITIES = {Highest:'#CE2F26', High:'#CA8A04', Medium:'#0E8F5A', Low:'#0C5A9E'};
function syncPriorities(){
  try{ const l=store.priorities(); const m={}; l.forEach(p=>{ m[p.id]=p.color; }); PRIORITIES=m; }catch(e){}
}
const CAT_ICON={
  'Development':'<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  'Code Review':'<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/>',
  'QA':'<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  'Deployment':'<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  'Other':'<circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/><circle cx="5" cy="12" r="1.4"/>'
};
function catIcon(id, color){ return `<svg class="tsb-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:${color}">${CAT_ICON[id]||''}</svg>`; }
const EDIT_ICO='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const LOCK_ICO='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
/* Workspace icons. Chosen per workspace (replacing the old colour swatch) and
   animated the same way as the tool icons in the top nav. */
const SP_ICONS=[
  {id:'layers', name:'Layers'},
  {id:'rocket', name:'Rocket'},
  {id:'target', name:'Target'},
  {id:'spark',  name:'Spark'},
  {id:'grid',   name:'Grid'},
  {id:'chart',  name:'Chart'},
  {id:'flow',   name:'Flow'},
  {id:'cube',   name:'Cube'},
];
const SP_ICON={
  layers:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="si-l1" d="M12 3.2 21 8l-9 4.8L3 8z" fill="currentColor"/>
      <path class="si-l2" d="M3 12.4 12 17.2l9-4.8" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" opacity=".55"/>
      <path class="si-l3" d="M3 16.6 12 21.4l9-4.8" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" opacity=".3"/>
    </svg>`,
  rocket:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g class="si-rk">
        <path d="M12 2.4c3.2 2.2 5 5.6 5 9.4l-2.2 2.6H9.2L7 11.8c0-3.8 1.8-7.2 5-9.4z" fill="currentColor" opacity=".22"/>
        <path d="M12 2.4c3.2 2.2 5 5.6 5 9.4l-2.2 2.6H9.2L7 11.8c0-3.8 1.8-7.2 5-9.4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="12" cy="9.4" r="1.7" fill="currentColor"/>
        <path d="M9.2 14.4 7 17.6l2.4-.5M14.8 14.4 17 17.6l-2.4-.5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      </g>
      <path class="si-rf" d="M12 16.6v4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`,
  target:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle class="si-t3" cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="1.6" opacity=".28"/>
      <circle class="si-t2" cx="12" cy="12" r="5.6" stroke="currentColor" stroke-width="1.7" opacity=".55"/>
      <circle class="si-t1" cx="12" cy="12" r="2.2" fill="currentColor"/>
    </svg>`,
  spark:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="si-sp" d="M13 2.4 4.4 13.6h6L11 21.6l8.6-11.2h-6z" fill="currentColor" opacity=".2"/>
      <path class="si-sp" d="M13 2.4 4.4 13.6h6L11 21.6l8.6-11.2h-6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    </svg>`,
  grid:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect class="si-g" x="3" y="3" width="8" height="8" rx="2.2" fill="currentColor"/>
      <rect class="si-g" x="13" y="3" width="8" height="8" rx="2.2" fill="currentColor"/>
      <rect class="si-g" x="13" y="13" width="8" height="8" rx="2.2" fill="currentColor"/>
      <rect class="si-g" x="3" y="13" width="8" height="8" rx="2.2" fill="currentColor"/>
    </svg>`,
  chart:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect class="si-c" x="3.6" y="12" width="3.8" height="8" rx="1.3" fill="currentColor" opacity=".45"/>
      <rect class="si-c" x="10.1" y="8" width="3.8" height="12" rx="1.3" fill="currentColor" opacity=".7"/>
      <rect class="si-c" x="16.6" y="4" width="3.8" height="16" rx="1.3" fill="currentColor"/>
    </svg>`,
  flow:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="5" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7"/>
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7"/>
      <circle cx="19" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7"/>
      <path d="M7.6 12h1.8M14.6 12h1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>
      <circle class="si-fd" cx="5" cy="12" r="1.4" fill="currentColor"/>
    </svg>`,
  cube:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g class="si-cb">
        <path d="M12 2.6 20.6 7v10L12 21.4 3.4 17V7z" fill="currentColor" opacity=".18"/>
        <path d="M12 2.6 20.6 7v10L12 21.4 3.4 17V7z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M3.4 7 12 11.6 20.6 7M12 11.6v9.8" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" opacity=".6"/>
      </g>
    </svg>`
};
const SWATCHES = ['#9BA3AF','#6B7280','#0C5A9E','#7A3FF2','#0EA5E9','#0E8FA8','#B96A00','#C026D3','#CE2F26','#0E8F5A'];
const CATLABEL = {todo:'To Do', inprogress:'In Progress', done:'Done'};
const CATCOLOR = {todo:'#727A87', inprogress:'#0C5A9E', done:'#0E8F5A'};
// LOCAL date, not UTC. toISOString() shifts the day for anyone east/west of
// UTC — in IST (+5:30) this returned yesterday until 05:30 every morning,
// which silently emptied the Today filters.
const today = () => _isoLocal(new Date());
/* ---- user preferences (applied app-wide) ---- */
let DATE_FMT='dmy', WEEK_START=0, HOURS_PER_DAY=8, MIN_PER_DAY=480, MIN_PER_WEEK=2400, USER_TZ='', HL_OVERDUE=true, PAGE_SIZE=25;
function curPrefs(){ try{ const u=(typeof meUser==='function')&&meUser(); return (u&&u.prefs)||{}; }catch(e){ return {}; } }
function applyPrefs(){ const p=curPrefs();
  DATE_FMT=p.dateFmt||'dmy';
  WEEK_START=(p.weekStart==='mon')?1:0;
  HOURS_PER_DAY=parseInt(p.hoursPerDay||'8',10)||8; MIN_PER_DAY=HOURS_PER_DAY*60; MIN_PER_WEEK=MIN_PER_DAY*5;
  USER_TZ=p.tz||'';
  HL_OVERDUE=(p.hlOverdue!==false);
  PAGE_SIZE=parseInt(p.pageSize||'25',10)||25;
  try{ document.body.dataset.density=(p.density==='compact')?'compact':'comfortable'; }catch(e){}
}
let STATUSES = []; // live reference to store.data.statuses after load

/* ---- Default workflow for a brand-new workspace -------------------------
   Structure, not data: a workspace with no statuses has no board columns and
   is unusable, so provisioning has to produce a working delivery flow. Every
   name, colour and column here is editable in Board settings afterwards. */
const DEFAULT_STATUSES=[
  {id:'st_backlog', name:'Backlog',         cat:'todo',       color:'#71717A'},
  {id:'st_ready',   name:'Ready',           cat:'todo',       color:'#D6264F'},
  {id:'st_dev',     name:'In Development',  cat:'inprogress', color:'#0C5A9E'},
  {id:'st_review',  name:'Code Review',     cat:'inprogress', color:'#B96A00'},
  {id:'st_qa',      name:'QA Testing',      cat:'inprogress', color:'#CE2F26'},
  {id:'st_deploy',  name:'Ready to Deploy', cat:'inprogress', color:'#7C3AED'},
  {id:'st_done',    name:'Done',            cat:'done',       color:'#0E8F5A'},
];
/* One board, all columns, transitions unenforced — a new team should be able to
   drag freely and turn on enforcement later once their flow has settled. */
function defaultBoard(wsId){
  return { id:'main', name:'Delivery', ws:wsId||'ws_main', enforce:false,
           columns:DEFAULT_STATUSES.map(s=>s.id), transitions:{} };
}
const SEED = {
  settings:{ workspaceName:'Workspace', defaultView:'board', defaultBoard:'main', fields:[] },
  projects:[],
  statuses:[],
  boards:[],
  users:[],
  teams:[],
  releases:[],
  sprints:[],
  tasks:[],
  worklogs:[],
  spaces:[],
};

const store = {
  _k:'taskora_v1',
  data:null,
  load(){
    try{ const raw=localStorage.getItem(this._k); if(raw){ this.data=JSON.parse(raw); if(!this.data.settings) this.data.settings=JSON.parse(JSON.stringify(SEED.settings)); if(!this.data.sprints) this.data.sprints=JSON.parse(JSON.stringify(SEED.sprints)); if(!this.data.releases) this.data.releases=JSON.parse(JSON.stringify(SEED.releases)); if(!this.data._sprintSeeded){ this.data.tasks.filter(t=>t.type!=='Epic').slice(0,14).forEach(t=>t.sprint='sp1'); this.data._sprintSeeded=true; } (this.data.users||[]).forEach(u=>u.color=avColor(u.name)); STATUSES=this.data.statuses; this.migrateProjectBoards(); this.mergeDuplicateStatuses(); this.reconcileTaskBoards(); return; } }catch(e){}
    this.data=JSON.parse(JSON.stringify(SEED)); this.migrateProjectBoards(); this.mergeDuplicateStatuses(); this.reconcileTaskBoards();
    this.data.tasks.filter(t=>t.type!=='Epic').slice(0,14).forEach(t=>t.sprint='sp1'); this.data._sprintSeeded=true;
    (this.data.users||[]).forEach(u=>u.color=avColor(u.name));
    STATUSES=this.data.statuses;
    this._persist();
  },
  _persist(){ try{ localStorage.setItem(this._k, JSON.stringify(this.data)); }catch(e){} },
  reset(){ this.data=JSON.parse(JSON.stringify(SEED)); STATUSES=this.data.statuses; this._persist(); },
  settings(){ return this.data.settings; },
  updateSettings(patch){ Object.assign(this.data.settings, patch); this._persist(); },
  fields(){ return this.data.settings.fields||[]; },
  /* ---- Ticket types (Jira-style, workspace-configurable) ------------------
     'Epic' is structural — the app branches on it — so it can be renamed but
     never removed. Everything else is free to add, rename, recolour, delete. */
  types(){ const s=this.data.settings;
    if(!Array.isArray(s.types) || !s.types.length){
      s.types=[ {id:'Task',   name:'Task',    color:'#0C5A9E', locked:false},
                {id:'Bug',    name:'Bug',     color:'#CE2F26', locked:false},
                {id:'Hot fix',name:'Hot fix', color:'#B96A00', locked:false},
                {id:'Epic',   name:'Epic',    color:'#7C3AED', locked:true} ];
    }
    return s.types; },
  type(id){ return this.types().find(t=>t.id===id)||null; },
  typeColor(id){ const t=this.type(id); return t?t.color:'#71717A'; },
  addType(name){ const nm=String(name||'').trim(); if(!nm) return null;
    const list=this.types(); if(list.some(t=>t.id.toLowerCase()===nm.toLowerCase())) return null;
    list.splice(Math.max(0,list.length-1), 0, {id:nm, name:nm, color:SWATCHES[list.length%SWATCHES.length], locked:false});
    this._persist(); return nm; },
  updateType(id, patch){ const t=this.type(id); if(!t) return;
    if(patch.name!==undefined){ const nm=String(patch.name).trim(); if(!nm) return;
      if(nm!==t.id && this.types().some(x=>x.id.toLowerCase()===nm.toLowerCase())) return;
      if(!t.locked && nm!==t.id){ this.data.tasks.forEach(k=>{ if(k.type===t.id) k.type=nm; }); t.id=nm; }
      t.name=nm; }
    if(patch.color!==undefined) t.color=patch.color;
    this._persist(); },
  removeType(id){ const t=this.type(id); if(!t||t.locked) return false;
    if(this.data.tasks.some(k=>k.type===id)) return false;   // never orphan tickets
    this.data.settings.types=this.types().filter(x=>x.id!==id); this._persist(); return true; },
  typeInUse(id){ return this.data.tasks.filter(k=>k.type===id).length; },
  /* ---- Priorities ---------------------------------------------------------
     Array order IS the rank (index 0 = most urgent), so reordering here drives
     sorting, grouping and the "top priority" pickers everywhere. */
  priorities(){ const s=this.data.settings;
    if(!Array.isArray(s.priorities) || !s.priorities.length){
      s.priorities=[ {id:'Highest',name:'Highest',color:'#CE2F26'},
                     {id:'High',   name:'High',   color:'#CA8A04'},
                     {id:'Medium', name:'Medium', color:'#0E8F5A'},
                     {id:'Low',    name:'Low',    color:'#0C5A9E'} ];
    }
    return s.priorities; },
  priority(id){ return this.priorities().find(p=>p.id===id)||null; },
  priorityRank(id){ const i=this.priorities().findIndex(p=>p.id===id); return i<0?99:i; },
  defaultPriority(){ const l=this.priorities(); const m=l.find(p=>p.id==='Medium'); return (m||l[Math.floor(l.length/2)]||l[0]||{}).id; },
  addPriority(name){ const nm=String(name||'').trim(); if(!nm) return null;
    const l=this.priorities(); if(l.some(p=>p.id.toLowerCase()===nm.toLowerCase())) return null;
    l.push({id:nm, name:nm, color:SWATCHES[l.length%SWATCHES.length]});
    this._persist(); syncPriorities(); return nm; },
  updatePriority(id, patch){ const p=this.priority(id); if(!p) return;
    if(patch.name!==undefined){ const nm=String(patch.name).trim(); if(!nm) return;
      if(nm!==p.id && this.priorities().some(x=>x.id.toLowerCase()===nm.toLowerCase())) return;
      if(nm!==p.id){ this.data.tasks.forEach(t=>{ if(t.priority===p.id) t.priority=nm; }); p.id=nm; }
      p.name=nm; }
    if(patch.color!==undefined) p.color=patch.color;
    this._persist(); syncPriorities(); },
  movePriority(id, dir){ const l=this.priorities(); const i=l.findIndex(p=>p.id===id); const j=i+dir;
    if(i<0||j<0||j>=l.length) return; const [x]=l.splice(i,1); l.splice(j,0,x); this._persist(); syncPriorities(); },
  removePriority(id){ const l=this.priorities(); if(l.length<=1) return false;
    if(this.data.tasks.some(t=>t.priority===id)) return false;   // never orphan tickets
    this.data.settings.priorities=l.filter(p=>p.id!==id); this._persist(); syncPriorities(); return true; },
  priorityInUse(id){ return this.data.tasks.filter(t=>t.priority===id).length; },
  listCols(){ const d=this.data.settings.listCols; return (Array.isArray(d)&&d.length)?d.slice():['key','title','assignee','status','priority','type','due','time']; },
  setListCols(arr){ this.data.settings.listCols=(arr||[]).slice(); this._persist(); },
  addField(name,type){ const id='cf'+Date.now().toString(36); if(!this.data.settings.fields) this.data.settings.fields=[];
    this.data.settings.fields.push({id, name:name||'New field', type:type||'text', options:[], onCard:true}); this._persist(); return id; },
  updateField(id,patch){ const f=this.fields().find(x=>x.id===id); if(f) Object.assign(f,patch); this._persist(); },
  removeField(id){ this.data.settings.fields=this.fields().filter(x=>x.id!==id);
    this.data.tasks.forEach(t=>{ if(t.custom) delete t.custom[id]; }); this._persist(); },
  customVal(taskId,fieldId){ const t=this.task(taskId); return t&&t.custom?t.custom[fieldId]:undefined; },
  setCustom(taskId,fieldId,value){ const t=this.task(taskId); if(!t) return; if(!t.custom) t.custom={};
    const empty = value===''||value==null||(Array.isArray(value)&&!value.length);
    if(empty) delete t.custom[fieldId]; else t.custom[fieldId]=value; t.updatedAt=today(); this._persist(); },
  exportData(){ return JSON.stringify(this.data, null, 2); },
  importData(json){ const d=JSON.parse(json); if(!d.projects||!d.tasks) throw new Error('bad'); this.data=d; if(!this.data.settings) this.data.settings=JSON.parse(JSON.stringify(SEED.settings)); STATUSES=this.data.statuses; this._persist(); },
  clearTickets(){ this.data.tasks=this.data.tasks.filter(t=>t.type==='Epic'); this.data.worklogs=[]; this._persist(); },
  removeTask(id){ this.data.tasks=this.data.tasks.filter(t=>t.id!==id); this.data.worklogs=this.data.worklogs.filter(w=>w.task!==id);
    this.data.tasks.forEach(t=>{ if(t.parent===id) t.parent=null; }); this._persist(); },
  addComment(taskId, userId, text){ const t=this.task(taskId); if(!t) return; if(!t.comments) t.comments=[]; t.comments.push({id:'c'+Date.now().toString(36), user:userId, text, date:new Date().toISOString()}); this._persist(); },
  removeComment(taskId, cid){ const t=this.task(taskId); if(!t||!t.comments) return; t.comments=t.comments.filter(c=>c.id!==cid); this._persist(); },
  addSubtask(taskId, title){ const t=this.task(taskId); if(!t) return; const tt=(title||'').trim(); if(!tt) return; if(!t.subtasks) t.subtasks=[]; t.subtasks.push({id:'st'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), title:tt, done:false, at:new Date().toISOString()}); t.updatedAt=today(); this._persist(); },
  toggleSubtask(taskId, sid){ const t=this.task(taskId); if(!t||!t.subtasks) return; const s=t.subtasks.find(x=>x.id===sid); if(s) s.done=!s.done; t.updatedAt=today(); this._persist(); },
  renameSubtask(taskId, sid, title){ const t=this.task(taskId); if(!t||!t.subtasks) return; const s=t.subtasks.find(x=>x.id===sid); if(s) s.title=(title||'').trim(); this._persist(); },
  removeSubtask(taskId, sid){ const t=this.task(taskId); if(!t||!t.subtasks) return; t.subtasks=t.subtasks.filter(x=>x.id!==sid); this._persist(); },
  chatChannels(){ return this.data.chatChannels||(this.data.chatChannels=[]); },
  chatChannel(id){ return this.chatChannels().find(c=>c.id===id); },
  chatMessages(chId){ return (this.data.chatMessages||[]).filter(m=>m.channel===chId).sort((a,b)=>new Date(a.at)-new Date(b.at)); },
  chatLast(chId){ const ms=this.chatMessages(chId); return ms[ms.length-1]||null; },
  createChannel(name, members, type){ const id=(type==='dm'?'dm_':'ch_')+Date.now().toString(36); this.chatChannels().push({id, name, members:members||[], type:type||'group'}); this._persist(); return id; },
  dmChannel(uid){ const me=CURRENT_UID; const key=[me,uid].sort().join('~'); let ch=this.chatChannels().find(c=>c.type==='dm'&&c.key===key);
    if(!ch){ const u=this.user(uid); ch={id:'dm_'+Date.now().toString(36), type:'dm', key, name:u?u.name:'Direct', members:[me,uid]}; this.chatChannels().push(ch); this._persist(); } return ch.id; },
  renameChannel(id,name){ const c=this.chatChannel(id); if(c){ c.name=name; this._persist(); } },
  leaveChannel(id){ this.data.chatChannels=this.chatChannels().filter(c=>c.id!==id); this.data.chatMessages=(this.data.chatMessages||[]).filter(m=>m.channel!==id); this._persist(); },
  sendChatMessage(chId, uid, text, attachment){ if(!this.data.chatMessages) this.data.chatMessages=[]; const m={id:'m'+Date.now().toString(36)+Math.floor(Math.random()*99), channel:chId, user:uid, text:text||'', attachment:attachment||null, at:new Date().toISOString(), edited:false}; this.data.chatMessages.push(m); this._persist(); return m; },
  editChatMessage(id, text){ const m=(this.data.chatMessages||[]).find(x=>x.id===id); if(m){ m.text=text; m.edited=true; m.editedAt=new Date().toISOString(); this._persist(); } },
  deleteChatMessage(id){ this.data.chatMessages=(this.data.chatMessages||[]).filter(x=>x.id!==id); this._persist(); },
  // reads
  projects(){ return this.data.projects; },
  users(){ return this.data.users; },
  activeUsers(keep){ return this.data.users.filter(u=> u.status!=='deactivated' || (keep && u.id===keep)); },
  user(id){ return this.data.users.find(u=>u.id===id)||null; },
  project(id){ return this.data.projects.find(p=>p.id===id)||null; },
  statuses(){ return this.data.statuses; },
  status(id){ return this.data.statuses.find(s=>s.id===id)||null; },
  tasks(){ return this.data.tasks; },
  standardTasks(){ const w=(typeof ui!=='undefined'&&ui.space)||'ws_main'; return this.data.tasks.filter(t=>t.type!=='Epic' && (t.ws||'ws_main')===w); },
  epics(){ const w=(typeof ui!=='undefined'&&ui.space)||'ws_main'; return this.data.tasks.filter(t=>t.type==='Epic' && (t.ws||'ws_main')===w); },
  // teams
  teams(){ return this.data.teams; },
  team(id){ return this.data.teams.find(t=>t.id===id)||null; },
  addTeam(name){ const id='tm'+Date.now().toString(36); this.data.teams.push({id, name, lead:null, members:[]}); this._persist(); return id; },
  updateTeam(id, patch){ Object.assign(this.team(id), patch); this._persist(); },
  removeTeam(id){ this.data.teams=this.data.teams.filter(t=>t.id!==id); this.data.tasks.forEach(t=>{ if(t.team===id) t.team=null; }); this._persist(); },
  teamMembers(t){ return (t.members||[]).map(id=>this.user(id)).filter(Boolean); },
  addTeamMember(id, uid){ const t=this.team(id); if(t&&!t.members.includes(uid)) t.members.push(uid); this._persist(); },
  removeTeamMember(id, uid){ const t=this.team(id); if(t){ t.members=t.members.filter(x=>x!==uid); if(t.lead===uid) t.lead=null; } this._persist(); },
  setTeamLead(id, uid){ const t=this.team(id); if(t) t.lead=uid; this._persist(); },
  epicsForTeam(id){ return this.epics().filter(e=>e.team===id); },
  // releases (versions)
  releases(){ return this.data.releases||(this.data.releases=[]); },
  release(id){ return this.releases().find(r=>r.id===id)||null; },
  addRelease(name){ const id='r'+Date.now().toString(36);
    this.data.releases.push({id, name:name||('v'+(this.releases().length+1)+'.0'), date:null, status:'unreleased', desc:''}); this._persist(); return id; },
  updateRelease(id,patch){ const r=this.release(id); if(r) Object.assign(r,patch); this._persist(); },
  removeRelease(id){ this.data.tasks.forEach(t=>{ if(t.release===id) t.release=null; }); this.data.releases=this.releases().filter(r=>r.id!==id); this._persist(); },
  markReleased(id){ const r=this.release(id); if(r){ r.status='released'; if(!r.date) r.date=today(); } this._persist(); },
  setTaskRelease(taskId,releaseId){ const t=this.task(taskId); if(t){ t.release=releaseId||null; t.updatedAt=today(); } this._persist(); },
  tasksInRelease(id){ return this.standardTasks().filter(t=>t.release===id); },
  noRelease(){ return this.standardTasks().filter(t=>!t.release && t.status!=='done'); },
  // sprints (scrum)
  sprints(){ return this.data.sprints||(this.data.sprints=[]); },
  sprint(id){ return this.sprints().find(s=>s.id===id)||null; },
  addSprint(name){ const id='sp'+Date.now().toString(36);
    this.data.sprints.push({id, name:name||('Sprint '+(this.sprints().length+1)), goal:'', state:'future', start:null, end:null}); this._persist(); return id; },
  updateSprint(id,patch){ const s=this.sprint(id); if(s) Object.assign(s,patch); this._persist(); },
  removeSprint(id){ this.data.tasks.forEach(t=>{ if(t.sprint===id) t.sprint=null; }); this.data.sprints=this.sprints().filter(s=>s.id!==id); this._persist(); },
  startSprint(id){ const s=this.sprint(id); if(s){ s.state='active'; if(!s.start) s.start=today(); } this._persist(); },
  completeSprint(id){ const s=this.sprint(id); if(s){ s.state='closed'; this.data.tasks.forEach(t=>{ if(t.sprint===id && t.status!=='done') t.sprint=null; }); } this._persist(); },
  setTaskSprint(taskId,sprintId){ const t=this.task(taskId); if(t){ t.sprint=sprintId||null; t.updatedAt=today(); } this._persist(); },
  tasksInSprint(id){ return this.standardTasks().filter(t=>t.sprint===id); },
  backlogTasks(){ return this.standardTasks().filter(t=>!t.sprint && t.status!=='done'); },
  // projects admin
  ticketsInProject(id){ return this.data.tasks.filter(t=>t.project===id).length; },
  addProject(name, board){ const key=((name||'').replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase())||'PRJ'; const id='p'+Date.now().toString(36);
    this.data.projects.push({id, name:name||'New project', key, board:board||null}); this._persist(); return id; },
  updateProject(id, patch){ Object.assign(this.project(id), patch); this._persist(); },
  removeProject(id){ this.data.projects=this.data.projects.filter(p=>p.id!==id); this._persist(); },
  // A project's effective home board: its own `board`, or the anchor board for
  // legacy projects with none set (mirrors how boardless tickets adopt the anchor,
  // so nothing disappears). Board-facing project views use this.
  projectBoardId(p){ const pr=(typeof p==='string')?this.project(p):p; if(!pr) return null;
    return pr.board || (typeof boardlessAnchorId==='function'?boardlessAnchorId():(this.boards()[0]||{}).id); },
  // Projects whose home board is `boardId` (or all if boardId is null/'all').
  projectsForBoard(boardId){ if(!boardId||boardId==='all') return this.projects();
    return this.projects().filter(p=>this.projectBoardId(p)===boardId); },
  // One-time migration: projects now belong to exactly one board. Any project
  // without a board is pinned to the workspace anchor board (the original board,
  // e.g. Tech Delivery). Idempotent — runs once, guarded by a data flag, and only
  // touches projects that have no board yet, so it never overrides a real choice.
  migrateProjectBoards(){
    if(this.data._projBoardsMigrated) return;
    const bs=this.data.boards||[];
    // Match boardlessAnchorId: prefer the seed board 'main', else earliest by id timestamp.
    let anchor=null;
    if(bs.length){ const seed=bs.find(b=>b.id==='main');
      if(seed) anchor=seed.id;
      else { const ord=b=>{ const m=/^b([0-9a-z]+)$/i.exec(b.id||''); return m?parseInt(m[1],36):-1; };
        anchor=bs.slice().sort((a,b)=>ord(a)-ord(b))[0].id; } }
    if(anchor && Array.isArray(this.data.projects)){
      this.data.projects.forEach(p=>{ if(!p.board) p.board=anchor; });
    }
    this.data._projBoardsMigrated=true; this._persist();
  },
  // Heal every ticket's stored board to match its project's board — the project is the
  // source of truth, so this keeps the stored data in step with what the board view
  // shows and stops tickets from being stranded on a stale board. Runs every load
  // (cheap, idempotent) so any drift is corrected automatically.
  reconcileTaskBoards(){
    if(!Array.isArray(this.data.tasks)) return;
    let changed=false;
    this.data.tasks.forEach(t=>{
      if(t.type==='Epic') return;               // epics aren't board-bound
      if(!t.project) return;                     // no project → leave its board as-is
      const pr=this.project(t.project); if(!pr) return;
      const pb=pr.board; if(!pb) return;
      if(t.board!==pb){ t.board=pb; changed=true; }
    });
    // Collapse duplicate-name statuses onto the board's real columns. A ticket whose
    // status ISN'T one of its board's columns but shares a normalized name with one
    // that IS gets remapped to the board's column status — this removes the phantom
    // duplicate columns (e.g. a global "Backlog" ticket on a board whose column is
    // "Back Log"). Normalization ignores case and spacing so near-identical names match.
    const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    this.data.tasks.forEach(t=>{
      if(t.type==='Epic' || !t.status) return;
      const bd=this.board(t.board); if(!bd) return;
      const cols=(bd.columns||[]);
      if(cols.includes(t.status)) return;                 // already a real column
      const tName=norm((this.status(t.status)||{}).name); if(!tName) return;
      const match=cols.map(id=>this.status(id)).filter(Boolean).find(s=>norm(s.name)===tName);
      if(match){ t.status=match.id; changed=true; }
    });
    if(changed) this._persist();
  },
  /* ROOT-CAUSE cleanup: merge duplicate status DEFINITIONS. If the workspace has
     two+ statuses whose names normalize to the same thing (e.g. "Back Log" and
     "Backlog"), keep one canonical status and repoint every reference — ticket
     statuses, board columns, and board transitions (both sides) — to it, then
     delete the duplicates. Runs once on load (guarded by a flag) so prod data is
     cleaned permanently, not just hidden at render time. The canonical winner is
     the status that's actually used as a board column (so we keep the "real" one),
     else the earliest-defined. */
  mergeDuplicateStatuses(){
    if(this.data._statusDupesMerged) return;
    const sts=this.data.statuses||[]; if(sts.length<2) return;
    const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    // group status ids by normalized name
    const groups={};
    sts.forEach(s=>{ const n=norm(s.name); (groups[n]=groups[n]||[]).push(s); });
    // which status ids are used as a board column (preferred canonical)
    const colIds=new Set();
    (this.data.boards||[]).forEach(b=>(b.columns||[]).forEach(id=>colIds.add(id)));
    const remap={};                                   // dupId -> canonicalId
    Object.values(groups).forEach(list=>{
      if(list.length<2) return;                       // no duplicates for this name
      // pick canonical: prefer one that's a board column, else the first in list
      const canonical = list.find(s=>colIds.has(s.id)) || list[0];
      list.forEach(s=>{ if(s.id!==canonical.id) remap[s.id]=canonical.id; });
    });
    const dupIds=Object.keys(remap);
    if(!dupIds.length){ this.data._statusDupesMerged=true; this._persist(); return; }
    // 1) tickets
    (this.data.tasks||[]).forEach(t=>{ if(t.status && remap[t.status]) t.status=remap[t.status]; });
    // 2) board columns (dedupe after remap) + 3) transitions (keys and values)
    (this.data.boards||[]).forEach(b=>{
      if(Array.isArray(b.columns)){
        const seen=new Set(); const out=[];
        b.columns.forEach(id=>{ const c=remap[id]||id; if(!seen.has(c)){ seen.add(c); out.push(c); } });
        b.columns=out;
      }
      if(b.transitions && typeof b.transitions==='object'){
        const nt={};
        Object.keys(b.transitions).forEach(from=>{
          const cf=remap[from]||from;
          const tos=(b.transitions[from]||[]).map(to=>remap[to]||to);
          nt[cf]=[...new Set([...(nt[cf]||[]), ...tos])].filter(to=>to!==cf);
        });
        b.transitions=nt;
      }
    });
    // 4) delete the duplicate status definitions
    this.data.statuses=sts.filter(s=>!remap[s.id]);
    STATUSES=this.data.statuses;
    this.data._statusDupesMerged=true;
    this._persist();
  },
  // users admin
  assignmentsForUser(id){ return this.data.tasks.filter(t=>t.assignee===id).length; },
  addUser(name, role){ const id='u'+Date.now().toString(36);
    this.data.users.push({id, name:name||'New teammate', role:role||'Developer', color:SWATCHES[(this.data.users.length*2)%SWATCHES.length]}); this._persist(); return id; },
  addMember(name, email, perm, authId){ const id='u'+Date.now().toString(36)+Math.floor(Math.random()*99);
    this.data.users.push({id, name:name||'New member', email:email||'', role:perm||'Developer', perm:perm||'Developer', authId:authId||null, color:SWATCHES[(this.data.users.length*2)%SWATCHES.length]}); this._persist(); return id; },
  updateUser(id, patch){ Object.assign(this.user(id), patch); this._persist(); },
  setUserPhoto(id, photo){ const u=this.user(id); if(!u) return; if(photo) u.photo=photo; else delete u.photo; this._persist(); },
  pwPending(){ return this.data.settings.pwPending||(this.data.settings.pwPending={}); },
  flagPwPending(email){ if(!email) return; this.pwPending()[email.toLowerCase()]=true; this._persist(); },
  clearPwPending(email){ if(!email) return; const m=this.pwPending(); delete m[email.toLowerCase()]; this._persist(); },
  isPwPending(email){ return !!(email && this.pwPending()[email.toLowerCase()]); },
  removeUser(id){ this.data.users=this.data.users.filter(u=>u.id!==id);
    this.data.tasks.forEach(t=>{ if(t.assignee===id) t.assignee=null; if(t.reporter===id) t.reporter=null; if(t.qa===id) t.qa=null; if(t.reviewer===id) t.reviewer=null; if(t.deployer===id) t.deployer=null; });
    this.data.teams.forEach(tm=>{ tm.members=tm.members.filter(x=>x!==id); if(tm.lead===id) tm.lead=null; });
    this._persist(); },
  accessRequests(){ return this.data.accessRequests||(this.data.accessRequests=[]); },
  addAccessRequest(name, email, perm){ this.accessRequests().push({id:'req'+Date.now().toString(36), name, email, perm:perm||'Developer', date:today()}); this._persist(); },
  acceptRequest(reqId){ const r=this.accessRequests().find(x=>x.id===reqId); if(!r) return; const uid=this.addMember(r.name, r.email, r.perm); this.data.accessRequests=this.accessRequests().filter(x=>x.id!==reqId); this._persist(); return uid; },
  rejectRequest(reqId){ this.data.accessRequests=this.accessRequests().filter(x=>x.id!==reqId); this._persist(); },
  epicChildren(epicId){ return this.data.tasks.filter(t=>t.parent===epicId && t.type!=='Epic'); },
  task(id){ return this.data.tasks.find(t=>t.id===id)||null; },
  worklogs(taskId){ return this.data.worklogs.filter(w=>w.task===taskId); },
  // writes
  moveTask(id, statusId){ const t=this.task(id); if(!t) return; t.status=statusId; this._applyResolution(t); /* deployment is recorded explicitly (env + version), never inferred from status */ t.updatedAt=today(); this._persist(); },
  deleteDeployment(id){ const t=this.task(id); if(!t) return; t.deployed=false; t.deployedAt=null; this._persist(); },
  verifyDeployment(id, checks, verified){ const t=this.task(id); if(!t) return; t.verifyChecks=checks||{}; t.verified=!!verified;
    t.verifiedAt=verified?new Date().toISOString():null; t.verifiedBy=verified?((typeof CURRENT_UID!=='undefined'&&CURRENT_UID)||null):null;
    /* Verification is the last gate, so a verified deployment closes the ticket.
       Board transition rules are deliberately bypassed — this is a system action,
       not a manual drag — but it is written to the timeline so it is traceable. */
    if(verified){
      const done=this.statuses().find(s=>(s.cat||'todo')==='done');
      if(done && t.status!==done.id){
        const from=(this.status(t.status)||{}).name||'\u2014';
        t.status=done.id; this._applyResolution(t); t.updatedAt=today();
        try{ this._pushActivity(id, 'deployment verified \u2014 status moved from '+from+' to '+done.name); }catch(e){}
        try{ if(typeof addNotif==='function' && t.assignee) addNotif({type:'status', taskId:id,
          actorId:t.verifiedBy, text:`${t.key} verified and closed`, dedup:'vdone:'+id}); }catch(e){}
      }
    }
    this._persist(); },
  setPrRaised(id, raised){ const t=this.task(id); if(!t) return; t.prRaised=!!raised; t.prRaisedAt=raised?new Date().toISOString():null;
    try{ this._pushActivity(id, raised?'raised a PR \u2014 sent to Deployments':'unmarked the PR'); }catch(e){} this._persist(); },
  /* ---- Deployment record --------------------------------------------------
     A ticket is only "deployed" once someone records WHERE it went and WHICH
     build — never inferred from status, so the tracker reflects reality. */
  markDeployed(id, envs, version){ const t=this.task(id); if(!t) return;
    t.deployed=true; t.deployedAt=new Date().toISOString();
    t.deployEnvs=(envs||[]).slice(); t.deployVersion=String(version||'').trim();
    t.deployedBy=(typeof myUid==='function'?myUid():null);
    // every release is appended to the log — the ticket fields only hold the latest
    if(!Array.isArray(this.data.deployLog)) this.data.deployLog=[];
    this.data.deployLog.push({ id:'dl'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36),
      task:id, version:t.deployVersion, envs:t.deployEnvs.slice(), at:t.deployedAt, by:t.deployedBy });
    try{ this._pushActivity(id, 'deployed '+(t.deployVersion?('v'+t.deployVersion+' '):'')+'to '+(t.deployEnvs.join(', ')||'\u2014')); }catch(e){}
    this._persist(); },
  deployLog(){ if(!Array.isArray(this.data.deployLog)) this.data.deployLog=[]; return this.data.deployLog; },
  removeDeployEntry(entryId){ this.data.deployLog=this.deployLog().filter(d=>d.id!==entryId); this._persist(); },
  unmarkDeployed(id){ const t=this.task(id); if(!t) return;
    // drop only this ticket's most recent release, then fall back to the one before it
    const mine=this.deployLog().filter(d=>d.task===id).sort((a,b)=>String(a.at).localeCompare(String(b.at)));
    const last=mine[mine.length-1];
    if(last) this.data.deployLog=this.deployLog().filter(d=>d.id!==last.id);
    const prev=mine[mine.length-2];
    if(prev){ t.deployed=true; t.deployedAt=prev.at; t.deployEnvs=(prev.envs||[]).slice(); t.deployVersion=prev.version; t.deployedBy=prev.by; }
    else { t.deployed=false; t.deployedAt=null; t.deployEnvs=[]; t.deployVersion=''; t.deployedBy=null;
      t.verified=false; t.verifyChecks={}; t.verifiedAt=null; t.verifiedBy=null; }
    try{ this._pushActivity(id, 'reverted the deployment record'); }catch(e){}
    this._persist(); },
  addQaCase(taskId, kind, title){ const t=this.task(taskId); if(!t||!title) return; if(!t.qaCases) t.qaCases=[];
    t.qaCases.push({id:'qc'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36), kind:kind==='use'?'use':'test', title, status:'pending'}); this._persist(); },
  updateQaCase(taskId, cid, patch){ const t=this.task(taskId); if(!t||!t.qaCases) return; const c=t.qaCases.find(x=>x.id===cid); if(c){ Object.assign(c, patch); this._persist(); } },
  removeQaCase(taskId, cid){ const t=this.task(taskId); if(!t||!t.qaCases) return; t.qaCases=t.qaCases.filter(x=>x.id!==cid); this._persist(); },
  addQaBug(taskId, text, severity){ const t=this.task(taskId); if(!t||!text) return; if(!t.qaBugs) t.qaBugs=[];
    const b={id:'qb'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36), text, severity:severity||'med', status:'open', by:((typeof CURRENT_UID!=='undefined'&&CURRENT_UID)||null), at:new Date().toISOString()};
    t.qaBugs.push(b); try{ this._pushActivity(taskId, 'QA flagged a fix needed: '+text); }catch(e){}
    try{ if(typeof addNotif==='function' && t.assignee) addNotif({type:'flag', taskId:taskId, actorId:b.by, text:`QA needs a fix · ${t.key}: ${text}`, dedup:'qabug:'+b.id}); }catch(e){}
    this._persist(); return b; },
  updateQaBug(taskId, bugId, patch){ const t=this.task(taskId); if(!t||!t.qaBugs) return; const b=t.qaBugs.find(x=>x.id===bugId); if(b){ const was=b.status; Object.assign(b, patch);
    if(patch.status==='fixed' && was!=='fixed'){ try{ this._pushActivity(taskId, 'marked a QA fix as resolved'); }catch(e){} } this._persist(); } },
  removeQaBug(taskId, bugId){ const t=this.task(taskId); if(!t||!t.qaBugs) return; t.qaBugs=t.qaBugs.filter(x=>x.id!==bugId); this._persist(); },
  clearQa(taskId){ const t=this.task(taskId); if(!t) return; t.qaCases=[]; t.qaBugs=[]; this._persist(); },
  addQaAttachment(taskId, att){ const t=this.task(taskId); if(!t||!att) return; if(!t.qaAttachments) t.qaAttachments=[]; t.qaAttachments.push(att); this._persist(); },
  removeQaAttachment(taskId, attId){ const t=this.task(taskId); if(!t||!t.qaAttachments) return; t.qaAttachments=t.qaAttachments.filter(a=>a.id!==attId); this._persist(); },
  _envs(){ if(!this.data.envBookings||typeof this.data.envBookings!=='object') this.data.envBookings={}; const e=this.data.envBookings; if(!Array.isArray(e.staging)) e.staging=[]; if(!Array.isArray(e.test)) e.test=[]; return e; },
  envList(env){ return this._envs()[env]||[]; },
  envActive(env){ return this.envList(env)[0]||null; },
  envQueue(env){ return this.envList(env).slice(1); },
  blockEnv(env, from, to){ const e=this._envs(); const l=e[env]; if(!l) return null; const wasFree=l.length===0;
    const uid=(typeof CURRENT_UID!=='undefined'&&CURRENT_UID)||(typeof myUid==='function'&&myUid())||null;
    const b={id:'eb'+Date.now().toString(36)+Math.floor(Math.random()*46656).toString(36), user:uid, from, to, createdAt:new Date().toISOString()};
    l.push(b); this._persist(); return {booking:b, active:wasFree, position:l.length-1}; },
  releaseEnv(env){ const l=this._envs()[env]; if(!l||!l.length) return null; const released=l.shift(); const next=l[0]||null; this._persist();
    if(next){ try{ addNotif({type:'env', taskId:null, text:`${env==='staging'?'Staging':'Test Environment'} is now free and reserved for you`}); }catch(e){} }
    return {released, next}; },
  cancelEnv(env, id){ const l=this._envs()[env]; if(!l) return; const i=l.findIndex(b=>b.id===id); if(i>=0){ l.splice(i,1); this._persist(); } },
  _applyResolution(t){ const s=this.status(t.status); const cat=s?s.cat:'todo';
    if(cat==='done'){ t.resolution='Done'; if(!t.resolvedAt){ t.resolvedAt=today(); t.resolvedTs=new Date().toISOString(); } }
    else { t.resolution='Unresolved'; t.resolvedAt=null; } },
  updateTask(id, patch){ const t=this.task(id); if(!t) return; try{ this._logChanges(t, patch); }catch(e){} Object.assign(t, patch); if('status' in patch){ this._applyResolution(t); /* deployment is recorded explicitly (env + version), never inferred from status */ } t.updatedAt=today(); this._persist(); },
  /* Identity must come from the signed-in account. Falling back to users()[0]
     silently stamps everyone's actions with the first person in the workspace. */
  _actor(){ try{ if(typeof myUid==='function') return myUid(); }catch(e){}
    return (typeof CURRENT_UID!=='undefined'&&CURRENT_UID)||null; },
  _pushActivity(taskId, text){ const t=this.task(taskId); if(!t) return; if(!t.activity) t.activity=[]; t.activity.push({id:'a'+Date.now().toString(36)+Math.floor(Math.random()*999), by:this._actor(), text, at:new Date().toISOString()}); },
  _logChanges(t, patch){
    const L={sprint:'sprint',points:'story points',title:'title',status:'status',priority:'priority',assignee:'developer',qa:'QA',reviewer:'code reviewer',deployer:'deployer',reporter:'reporter',project:'project',due:'due date',start:'start date',estimate:'estimate',parent:'epic'};
    const disp=(k,v)=>{ if(v==null||v==='') return null;
      if(k==='status') return (this.status(v)||{}).name||v;
      if(k==='sprint') return (this.sprint(v)||{}).name||v;
      if(['assignee','qa','reviewer','deployer','reporter'].includes(k)) return (this.user(v)||{}).name||'someone';
      if(k==='project') return (this.project(v)||{}).name||v;
      if(k==='parent') return (this.task(v)||{}).title||v;
      if(k==='estimate') return (v/60)+'h';
      if(k==='due'||k==='start') return fdate(v);
      return v; };
    Object.keys(patch).forEach(k=>{ if(k==='title'){ if(patch.title!==t.title) this._pushActivity(t.id,'updated the title'); return; }
      if(k==='desc'){ if(patch.desc!==t.desc) this._pushActivity(t.id,'updated the description'); return; }
      if(k==='flagged'){ this._pushActivity(t.id, patch.flagged?'flagged this ticket':'removed the flag'); return; }
      if(k==='archived' && patch.archived){ this._pushActivity(t.id,'archived this ticket'); return; }
      if(!(k in L)) return; if(patch[k]===t[k]) return;
      const nv=disp(k,patch[k]);
      if(['assignee','qa','reviewer','deployer','reporter'].includes(k)){ this._pushActivity(t.id, nv?`set ${L[k]} to ${nv}`:`cleared the ${L[k]}`); }
      else { this._pushActivity(t.id, nv?`changed ${L[k]} to ${nv}`:`cleared the ${L[k]}`); }
    });
  },
  addTask(t){ this.data.tasks.unshift(t); this._persist(); },
  addWorklog(w){ this.data.worklogs.push(w); this._persist(); },
  removeWorklog(id){ this.data.worklogs = this.data.worklogs.filter(w=>w.id!==id); this._persist(); },
  // status config (mutate in place so the STATUSES reference stays valid)
  addStatus(name){ const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,12)||'col';
    this.data.statuses.push({id:slug+Date.now().toString(36), name, color:SWATCHES[this.data.statuses.length%SWATCHES.length]}); this._persist(); },
  updateStatus(id, patch){ Object.assign(this.status(id), patch); this._persist(); },
  removeStatus(id){ const i=this.data.statuses.findIndex(s=>s.id===id); if(i>=0){ this.data.statuses.splice(i,1); this._persist(); } },
  moveStatus(id, dir){ const a=this.data.statuses; const i=a.findIndex(s=>s.id===id); const j=i+dir;
    if(i<0||j<0||j>=a.length) return; [a[i],a[j]]=[a[j],a[i]]; this._persist(); },
  tasksInStatus(id){ return this.data.tasks.filter(t=>t.status===id).length; },
  // boards + workflow
  boards(){ const w=(typeof ui!=='undefined'&&ui.space)||'ws_main'; return this.data.boards.filter(b=>(b.ws||'ws_main')===w); },
  board(id){ return this.data.boards.find(b=>b.id===id)||null; },
  spaces(){ return this.data.spaces||[]; },
  space(id){ return (this.data.spaces||[]).find(s=>s.id===id)||null; },
  addSpace(sp){ (this.data.spaces=this.data.spaces||[]).push(sp); this._persist(); return sp.id; },
  updateSpace(id, patch){ const s=this.space(id); if(s){ Object.assign(s, patch); this._persist(); } },
  removeSpace(id){ this.data.spaces=(this.data.spaces||[]).filter(s=>s.id!==id); this._persist(); },
  addBoard(name){ const id='b'+Date.now().toString(36);
    // A workflow starts at its first To-do status and grows from there — not
    // empty (nowhere to begin) and not pre-loaded with every status that exists.
    const first=(this.data.statuses.find(x=>x.cat==='todo')||this.data.statuses[0]||{}).id;
    this.data.boards.push({id, name, ws:(typeof ui!=='undefined'&&ui.space)||'ws_main', enforce:false,
      columns:first?[first]:[], transitions:{}}); this._persist(); return id; },
  updateBoard(id, patch){ Object.assign(this.board(id), patch); this._persist(); },
  removeBoard(id){ this.data.boards=this.data.boards.filter(b=>b.id!==id); this._persist(); },
  boardColumns(b){ return (b.columns||[]).map(id=>this.status(id)).filter(Boolean); },
  moveBoardColumn(b, statusId, dir){ const a=b.columns; const i=a.indexOf(statusId); const j=i+dir;
    if(i<0||j<0||j>=a.length) return; [a[i],a[j]]=[a[j],a[i]]; this._persist(); },
  toggleBoardColumn(b, statusId, on){ if(on){ if(!b.columns.includes(statusId)) b.columns.push(statusId); }
    else { b.columns=b.columns.filter(x=>x!==statusId); delete b.transitions[statusId]; Object.keys(b.transitions).forEach(k=>b.transitions[k]=b.transitions[k].filter(x=>x!==statusId)); } this._persist(); },
  setTransition(b, from, to, on){ if(!b.transitions[from]) b.transitions[from]=[];
    if(on){ if(!b.transitions[from].includes(to)) b.transitions[from].push(to); }
    else { b.transitions[from]=b.transitions[from].filter(x=>x!==to); } this._persist(); },
};
