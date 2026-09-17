/* Taskora — 05-task-panel.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ============================================================
   TASK PANEL  (detail + time tracking)
============================================================ */
function openEpicPanel(e){
  const st=epicStats(e.id); const proj=store.project(e.project); const rep=store.user(e.reporter);
  const panel=document.getElementById('panel');
  const kidRows=st.kids.map(k=>{ const s=store.status(k.status); const kt=taskTotals(k.id).total;
    return `<div class="ek" data-id="${k.id}" style="padding-left:15px"><span class="ek-key">${k.key}</span>
      <span class="ek-title">${esc(k.title)}</span>
      ${k.assignee?avatar(store.user(k.assignee),20):''}
      <span class="tag" style="background:var(--surface-2);color:var(--ink-2)"><span class="col-dot" style="background:${s?s.color:'#999'}"></span>${s?esc(s.name):''}</span>
      <span class="ek-time">${kt?hm(kt):'—'}</span></div>`; }).join('')
    || `<div class="none" style="padding-left:15px">No child issues yet. Link tickets to this epic from their Epic field.</div>`;
  panel.innerHTML=`
    <div class="panel-h">
      <div class="meta"><div class="key" style="color:${e.color}">◆ EPIC · ${proj?proj.key:''} · ${e.key}</div><h2>${esc(e.title)}</h2></div>
      <button class="icon-btn" id="panelClose"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <div class="panel-body">
      <div class="epic-prog" style="width:100%;margin-bottom:18px"><div class="lbl"><span>${st.done} of ${st.total} issues done</span><span class="num">${st.pct}%</span></div>
        <div class="track" style="height:10px"><div class="fill" style="width:${st.pct}%;background:${CATCOLOR[st.cat]}"></div></div></div>
      <div class="tt-strip" style="margin-bottom:22px">
        <div class="tsi"><span class="tsl">Issues</span><span class="tsv">${st.total}</span></div>
        <div class="tsi"><span class="tsl">Done</span><span class="tsv">${st.done}</span></div>
        <div class="tsi"><span class="tsl">Logged</span><span class="tsv">${hm(st.minutes)}</span></div>
      </div>
      ${e.desc?`<div class="desc">${esc(e.desc)}</div>`:''}
      <div class="epic-team">
        <span class="et-lbl">Team</span>
        <select id="epicTeam"><option value="">Unassigned</option>${store.teams().map(tm=>`<option value="${tm.id}" ${e.team===tm.id?'selected':''}>${esc(tm.name)}</option>`).join('')}</select>
        ${e.team&&store.team(e.team)?`<div class="et-members">${store.teamMembers(store.team(e.team)).map(u=>avatar(u,22)).join('')||'<span style="font-size:11.5px;color:var(--muted)">No members</span>'}</div>`:''}
      </div>
      <div class="tt-head"><h3>Child issues</h3><span class="tt-total" style="font-size:14px;color:var(--muted)">${st.total}</span></div>
      <p class="tt-sub">Tasks and bugs grouped under this epic.</p>
      <div style="border:1px solid var(--line);border-radius:6px;overflow:hidden">${kidRows}</div>
      <div class="sysmeta"><span>Reporter <b>${rep?rep.name:'—'}</b></span><span>Created <b>${fdate(e.createdAt)}</b></span><span>Updated <b>${fdate(e.updatedAt)}</b></span></div>
    </div>`;
  document.getElementById('panelClose').onclick=closePanel;
  const et=document.getElementById('epicTeam'); if(et) et.onchange=ev=>{ store.updateTask(e.id,{team:ev.target.value||null}); openEpicPanel(store.task(e.id)); if(ui.view==='team') renderTeam(); toast('Team updated'); };
  panel.querySelectorAll('.ek').forEach(k=>k.onclick=()=>openPanel(k.dataset.id));
  document.getElementById('overlay').classList.add('on'); panel.classList.add('on');
}
let panelTab='comments';
let panelSub='worklog';   // the two-pane block: 'worklog' | 'cat'
let CURRENT_UID=null;
function openPanel(id, keepScroll){
  if(panelTab==='worklog') panelTab='comments';   // Work log lives in the two-pane block now
  try{ if(typeof nset==='function' && nset().autoRead && typeof loadNotifs==='function'){ const a=loadNotifs(); let ch=false; a.forEach(n=>{ if(n.taskId===id && !n.read){ n.read=true; ch=true; } }); if(ch){ saveNotifs(a); updateBell(); if(document.getElementById('notifScrim')&&document.getElementById('notifScrim').classList.contains('on')) renderNotifDrawer(); } } }catch(e){}
  ui.openTask=id;
  try{ urlSync(); }catch(e){}
  const t=store.task(id); if(!t) return;
  if(t.type==='Epic'){ return openEpicPanel(t); }
  const tot=taskTotals(id);
  const estLocked = tot.total>0;   // original estimate freezes once time is logged
  const proj=store.project(t.project);
  const stObj=store.status(t.status); const stCat=stObj?stObj.cat:'todo';
  const remaining = (t.estimate||0) - tot.total;
  const peopleOpts=(cur)=>`<option value="">Unassigned</option>`+store.activeUsers(cur).map(u=>`<option value="${u.id}" ${u.id===cur?'selected':''}>${esc(u.name)}</option>`).join('');
  const ovChip=(uid)=>{ const u=store.user(uid); return u?`<span class="ov-p">${avatar(u,24)}<span class="ov-nm">${esc(u.name)}</span></span>`:'<span class="ov-none">Unassigned</span>'; };
  const cdBtn=(field)=>`<button class="cdate p-cd" data-id="${id}" data-field="${field}">${t[field]?fdate(t[field]):'<span class="cf-muted">Set date</span>'}<svg class="cfchev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>`;
  const peopleSel=[{v:'',t:'Unassigned'}].concat(store.activeUsers().map(u=>({v:u.id,t:u.name,ava:avatar(u,18)})));
  const reporterSel=[{v:'',t:'—'}].concat(store.activeUsers().map(u=>({v:u.id,t:u.name,ava:avatar(u,18)})));
  const projSel=[{v:'',t:'Not Assigned'}].concat(store.projects().map(pr=>({v:pr.id,t:pr.name})));
  const prioSel=Object.keys(PRIORITIES).map(pp=>({v:pp,t:pp}));
  const statusSel=(function(){ const bd=activeBoard(); const allow=bd.enforce?[t.status,...allowedTargets(bd,t.status)]:STATUSES.map(s=>s.id); return STATUSES.filter(s=>allow.includes(s.id)).map(s=>({v:s.id,t:s.name})); })();
  const epicSel=[{v:'',t:'None'}].concat(store.epics().filter(x=>x.project===t.project).map(x=>({v:x.id,t:x.title})));
  const pLbl=(opts,v)=>{ const o=opts.find(o=>o.v===(v||'')); return o?esc(o.t):'—'; };
  const pselBtn=(fid,label)=>`<button class="p-sel" id="${fid}"><span class="p-sel-t">${label}</span><svg class="cfchev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>`;
  const meU=meUser();
  const pOver = HL_OVERDUE && t.due && (store.status(t.status)||{}).cat!=='done' && new Date(t.due+'T00:00:00') < new Date(new Date().toDateString());
  const personVal=(uid)=>{ const u=store.user(uid); return u?`${avatar(u,20)}<span class="fv-nm">${esc(u.name)}</span>`:`<span class="fv-none">Unassigned</span>`; };
  const fvBtn=(fid,html)=>`<button class="fval" id="${fid}">${html}</button>`;
  const cdVal=(field)=>`<button class="fval p-cd${field==='due'&&pOver?' over':''}" data-id="${id}" data-field="${field}">${t[field]?fdate(t[field]):'<span class="fv-none">None</span>'}</button>`;
  const dtRow=(label,val,ed=true)=>`<div class="dt-row${ed?'':' dt-ro'}"><span class="dt-l">${label}</span><div class="dt-v">${val}</div><span class="dt-ind ${ed?'ed':'lk'}" title="${ed?'Editable':'Read-only'}">${ed?EDIT_ICO:LOCK_ICO}</span></div>`;
  const EDIT2F={field_points:'points',field_sprint:'sprint',field_status:'status',field_priority:'priority',role_developer:'assignee',role_qa:'qa',role_reviewer:'reviewer',role_deployer:'deployer',role_reporter:'reporter',field_project:'project',field_start:'start',field_due:'due',field_estimate:'estimate',field_epic:'epic'};
  const SEE2F={see_reporter:'reporter',see_dates:'due',see_estimate:'estimate',see_logged:'logged',see_contributors:'contributors'};
  const dtField=(seeCap,editCap,label,val)=>{ const key=EDIT2F[editCap]||SEE2F[seeCap]||null;
    if(key && !canSeeField(key)) return '';
    let ed; if(editCap==null){ ed=false; } else { ed = key ? canEditField(key) : can(editCap); }
    return dtRow(label, val, ed); };
  const tlEvents=[];
  if(t.createdAt) tlEvents.push({by:t.reporter, text:'created this ticket', at:t.createdTs||t.createdAt});
  (t.activity||[]).forEach(a=>tlEvents.push({by:a.by, text:a.text, at:a.at}));
  (t.comments||[]).forEach(c=>tlEvents.push({by:c.user, text:'added a comment', at:c.date, note:c.text}));
  store.data.worklogs.filter(w=>w.task===id).forEach(w=>tlEvents.push({by:w.user, text:`logged ${hm(w.min)}${w.cat?' · '+w.cat:''}`, at:w.loggedAt||w.date, note:w.note}));
  if(t.resolvedAt) tlEvents.push({by:t.reporter, text:'resolved this ticket', at:t.resolvedTs||t.resolvedAt});
  const _ts=x=>new Date((typeof x==='string'&&x.length<=10)?x+'T00:00:00':x).getTime();
  tlEvents.sort((a,b)=>_ts(b.at)-_ts(a.at));
  const panel=document.getElementById('panel');
  const prevScroll = keepScroll ? (panel.querySelector('.panel-body')||{}).scrollTop : 0;

  const catBlocks=CATS.map(c=>{
    const logs=tot.logs.filter(l=>l.cat===c.id);
    const catMin=tot.byCat[c.id]||0;
    const logRows=logs.map(l=>{ const u=store.user(l.user);
      return `<div class="log">${avatar(u,22)}<div><div class="who">${u?u.name:'—'}</div>
        <div class="dt">${fdate(l.date)}${l.note?` · <span class="note">${esc(l.note)}</span>`:''}</div></div>
        <span class="hrs">${hm(l.min)}</span>
        <button class="del" data-del="${l.id}" title="Remove">✕</button></div>`; }).join('')
      || `<div style="padding:9px 0;font-size:12px;color:var(--faint)">No time logged yet.</div>`;
    return `<div class="cat">
      <div class="cat-h">${catIcon(c.id, c.color)}
        <span class="nm">${c.id}</span>
        <span class="tot" style="color:${catMin?'var(--ink)':'var(--faint)'}">${hm(catMin)}</span>
        <span class="cnt">${logs.length?`· ${logs.length} log${logs.length>1?'s':''}`:''}</span>
        <button class="cat-log" data-cat="${c.id}">＋ Log</button></div>
      <div class="logs">${logRows}</div></div>`;
  }).join('');

  // contributors summary (per-person totals on this task, split by category)
  const contribIds=Object.keys(tot.byUser).sort((a,b)=>tot.byUser[b]-tot.byUser[a]);
  const contribRows=contribIds.map(uid=>{
    const u=store.user(uid); const utot=tot.byUser[uid];
    const segs=CATS.map(c=>{ const m=tot.logs.filter(l=>l.user===uid&&l.cat===c.id).reduce((a,l)=>a+l.min,0);
      return m?`<div class="seg" style="width:${m/utot*100}%;background:${c.color}" title="${c.id}: ${hm(m)}"></div>`:''; }).join('');
    return `<div class="contrib-row"><span class="who">${avatar(u,20)} ${u?u.name:'—'}</span>
      <span class="track">${segs}</span><span class="tot">${hm(utot)}</span></div>`;
  }).join('') || `<div style="font-size:12px;color:var(--faint)">No contributors yet.</div>`;

  panel.innerHTML=`
    <div class="panel-h">
      <div class="meta"><div class="key">${t.key}</div><div class="pn-ttl-row"><h2 id="pnTitle" class="${canEditField('title')?'ed':''}" ${canEditField('title')?'contenteditable="true" spellcheck="false" role="textbox" aria-label="Ticket title"':''}>${esc(t.title)}</h2>${canEditField('title')?`<button class="pn-edit" id="pnTitleEdit" type="button" title="Rename ticket" aria-label="Rename ticket"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>`:''}</div></div>
      <button class="icon-btn" id="panelClose"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <div class="panel-body">
      <div class="pnl-main">
        <div class="ov">
          <div class="ov-i"><div class="ov-l">Time spent</div><div class="ov-time">${hm(tot.total)}</div></div>
          <div class="ov-i"><div class="ov-l">Reporter</div>${ovChip(t.reporter)}</div>
          <div class="ov-i"><div class="ov-l">Developer</div>${ovChip(t.assignee)}</div>
          <div class="ov-i"><div class="ov-l">QA</div>${ovChip(t.qa)}</div>
          <div class="ov-i"><div class="ov-l">Code Reviewer</div>${ovChip(t.reviewer)}</div>
          <div class="ov-i"><div class="ov-l">Deployer</div>${ovChip(t.deployer)}</div>
        </div>
        <div class="pb-pr ${t.prRaised?'raised':''}" style="${can('pr_raise')?'':'display:none'}">
          <div class="pb-pr-l"><span class="pb-pr-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg></span>
            <div><div class="pb-pr-t">Pull Request</div><div class="pb-pr-s">${t.prRaised?('Raised '+fdate(t.prRaisedAt)+' \u00b7 tracking in Deployments'):'Mark when the PR is raised to open a deployment ticket'}</div></div></div>
          <button class="pb-pr-btn ${t.prRaised?'done':''}" id="prRaiseBtn">${t.prRaised?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> PR Raised':'Mark PR Raised'}</button>
        </div>
        ${canSeeField('desc')?`<div class="pb-sec">
          <div class="pb-h">Description</div>
          <textarea id="pDesc" class="pdesc" ${canEditField('desc')?'':'readonly'} placeholder="Add a description…">${esc(t.desc||'')}</textarea>
        </div>`:''}
        ${(function(){ if(!canSeeField('subtasks')) return ''; const canEd=canEditField('subtasks'); const subs=t.subtasks||[]; const dn=subs.filter(s=>s.done).length; const pct=subs.length?Math.round(dn/subs.length*100):0;
          const CBK=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
          const rows=subs.map(s=>{ const su=s.assignee?store.user(s.assignee):null;
            return `<div class="sub ${s.done?'done':''}" data-sid="${s.id}"><button class="sub-cb ${s.done?'on':''}" data-toggle="${s.id}" title="${s.done?'Mark not done':'Mark done'}">${CBK}</button>
            <input class="sub-tt" data-rename="${s.id}" value="${esc(s.title)}" autocomplete="off" ${canEd?'':'readonly'}/>
            ${s.estimate?`<span class="sub-est">${hm(s.estimate)}</span>`:''}
            ${su?`<span class="sub-av" title="${esc(su.name)}">${avatar(su,18)}</span>`:''}
            ${canEd?`<button class="sub-edit" data-subedit="${s.id}" title="Edit subtask"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>`:''}
            ${canEd?`<button class="sub-del" data-subdel="${s.id}" title="Delete subtask">✕</button>`:''}</div>`; }).join('');
          return `<div class="subs">
            <div class="subs-h"><div class="pb-h">Subtasks</div>${subs.length?`<div class="subs-prog"><div class="subs-bar"><div class="subs-fill" style="width:${pct}%"></div></div><span>${dn}/${subs.length}</span></div>`:''}</div>
            <div class="sub-list">${rows}</div>
            ${subs.length?'':'<div class="subs-empty">No subtasks yet. Break this ticket into smaller steps.</div>'}
            ${canEd?`<button class="tsk-btn tsk-btn--ghost tsk-btn--sm" id="subAddBtn" type="button" style="margin-bottom:8px">Add subtask</button><div class="sub-add"><span class="sub-add-ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><input class="sub-add-in" id="subAddIn" placeholder="Add a subtask and press Enter" autocomplete="off"/></div>`:''}
          </div>`; })()}
        <div class="pn-pane">
          <aside class="pn-rail">
            <button type="button" class="pn-rl ${panelSub==='worklog'?'on':''}" data-sub="worklog">Work log</button>
            <button type="button" class="pn-rl ${panelSub==='cat'?'on':''}" data-sub="cat">Time spent by category</button>
            <button type="button" class="pn-rl pn-rl-flex ${panelSub==='qafix'?'on':''}" data-sub="qafix">QA Fixes${(function(){ const o=(t.qaBugs||[]).filter(b=>b.status!=='fixed').length; return o?`<span class="pn-badge">${o}</span>`:''; })()}</button>
          </aside>
          <section class="pn-det">
            ${panelSub==='cat'?`<div class="tsb tsb-bare">
          <div class="tsb-h">Time spent by category</div>
          ${CATS.map(c=>{ const m=tot.byCat[c.id]||0; const pct=tot.total?Math.round(m/tot.total*100):0;
            return `<div class="tsb-row">${catIcon(c.id,c.color)}<span class="tsb-nm">${c.id}</span><span class="tsb-bar"><span class="tsb-fill" style="width:${pct}%;background:${c.color}"></span></span><span class="tsb-val">${hm(m)}</span></div>`; }).join('')}
          <div class="tsb-row tsb-total"><span class="tsb-ico" style="visibility:hidden"></span><span class="tsb-nm">Total</span><span class="tsb-bar" style="visibility:hidden"></span><span class="tsb-val">${hm(tot.total)}</span></div>
            </div>`:''}
            ${panelSub==='worklog'?`
            <div class="tt-strip">
              <div class="tsi"><span class="tsl">Original estimate</span><span class="tsv">${t.estimate?hm(t.estimate):'—'}</span></div>
              <div class="tsi"><span class="tsl">Logged</span><span class="tsv">${hm(tot.total)}</span></div>
              <div class="tsi"><span class="tsl">Remaining</span><span class="tsv" style="color:${remaining<0?'var(--crit)':'var(--ink)'}">${t.estimate?hm(Math.abs(remaining)):'—'}${remaining<0?' over':''}</span></div>
            </div>
            <div class="tt-head"><h3>Time tracking</h3><div class="tt-actions"><span class="tt-total">${hm(tot.total)}</span></div></div>
            <p class="tt-sub">Anyone can log time in any category. Totals roll up per person and per ticket.</p>
            ${catBlocks}
            <div class="contrib"><h3>Contributors on this ticket</h3>${contribRows}</div>
`:''}
            ${panelSub==='qafix'?(function(){ const qb=t.qaBugs||[]; const open=qb.filter(b=>b.status!=='fixed').length; const fixed=qb.length-open;
              const rows=qb.slice().reverse().map(b=>{ const bu=store.user(b.by); return `<div class="qbug ${b.status}">
                  <span class="qvf-sev ${b.severity}">${QA_SEV[b.severity]||'Med'}</span>
                  <div class="qbug-main"><div class="qbug-tx">${esc(b.text)}</div><div class="qbug-meta">${bu?esc(bu.name):'QA'} \u00b7 ${timeAgo(b.at)}${b.status==='fixed'?' \u00b7 resolved':''}</div></div>
                  <button class="qbug-fix" data-qbugfix="${t.id}|${b.id}">${b.status==='fixed'?'Reopen':'Mark complete'}</button>
                </div>`; }).join('');
              return `<div class="qafix-head"><h3>QA Fixes</h3>${qb.length?`<span class="qafix-pill ${open?'open':'done'}">${open?open+' open':'All resolved'}</span>`:''}</div>
                <p class="tt-sub" style="text-align:center">Fixes raised by QA. Mark each complete when done \u2014 it updates on the QA card so QA can track it.</p>
                ${qb.length?`<div class="qbug-list qafix-list">${rows}</div>`:`<div class="qafix-empty"><div class="qafix-empty-ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>No QA fixes yet. When QA flags a fix, it lands here for you to resolve.</div>`}`;
            })():''}
          </section>
        </div>
        ${store.fields().length?`<div class="pb-sec"><div class="pb-h">Custom fields</div><div class="meta-grid pf-grid">${store.fields().map(f=>`<div class="meta-item"><div class="l">${esc(f.name)}</div><div class="v">${cfControl(t,f)}</div></div>`).join('')}</div></div>`:''}
        <div class="pb-sec">
          <div class="act-tabs">
            <button class="act-tab ${panelTab==='comments'?'on':''}" data-tab="comments">Comments${(t.comments||[]).length?` (${(t.comments||[]).length})`:''}</button>
            <button class="act-tab ${panelTab==='notes'?'on':''}" data-tab="notes">Notes${notesOnTicket(t.id).length?` (${notesOnTicket(t.id).length})`:''}</button>
            <button class="act-tab ${panelTab==='timeline'?'on':''}" data-tab="timeline">Timeline</button>
          </div>
          ${panelTab==='comments'?`
            ${canEditField('comments')?`<div class="cmt-new">${avatar(meU,28)}<div class="cmt-new-b"><textarea id="cmtInput" class="cmt-input" placeholder="Add a comment…"></textarea><div class="cmt-actions"><button class="btn primary" id="cmtPost">Comment</button></div></div></div>`:''}
            ${canSeeField('comments')?`<div class="cmt-list">${(t.comments||[]).slice().reverse().map(c=>{ const u=store.user(c.user); return `<div class="cmt">${avatar(u,28)}<div class="cmt-main"><div class="cmt-top"><span class="cmt-nm">${u?esc(u.name):'—'}</span><span class="cmt-dt">${fdate(c.date)}</span>${canEditField('comments')?`<button class="cmt-del" data-cid="${c.id}" title="Delete">✕</button>`:''}</div><div class="cmt-text">${esc(c.text)}</div></div></div>`; }).join('')||'<div class="cmt-empty">No comments yet. Start the discussion.</div>'}</div>`:'<div class="cmt-empty">Comments are hidden.</div>'}
          `:''}
          
          ${panelTab==='notes'?`
            <div class="pn-notes">
              ${(()=>{ const ns=notesOnTicket(t.id);
                if(!ns.length) return `<p class="notes-none">No notes on this ticket yet. Add one from the Calendar and link it here.</p>`;
                return ns.map(n=>{ const au=store.user(n.user);
                  return `<div class="note-card">
                    <div class="note-tx">${noteHtml(n.text)}</div>
                    <div class="note-m">${au?`<span class="note-au-a">${avatar(au,18)}${esc(au.name)}</span>`:''}
                      <span class="note-at">${esc(noteStamp(n.at))}</span></div>
                  </div>`; }).join('');
              })()}
            </div>
          `:''}
          ${panelTab==='timeline'?`
            <div class="tl">
              ${tlEvents.length? tlEvents.map(e=>{ const u=store.user(e.by); return `<div class="tl-item">
                <div class="tl-node">${avatar(u,26)}</div>
                <div class="tl-content">
                  <div class="tl-line"><span class="tl-who">${u?esc(u.name):'System'}</span> <span class="tl-act">${esc(e.text)}</span></div>
                  ${e.note?`<div class="tl-note">${esc(e.note)}</div>`:''}
                  <div class="tl-time" title="${fdatetime(e.at)}">${timeAgo(e.at)} · ${fdatetime(e.at)}</div>
                </div>
              </div>`; }).join('') : '<div class="cmt-empty">No activity yet.</div>'}
            </div>
          `:''}
        </div>
        <div class="pnl-tail"></div>
      </div>
      <div class="pnl-side">
        <div class="dt-title">Details</div>
        <div class="dt-list">
          ${dtField(null,'field_status','Status', fvBtn('pStatus', tskSt(t.status)))}
          ${dtField(null,'field_priority','Priority', fvBtn('pPriority', `<span style="color:${PRIORITIES[t.priority]||'var(--ink)'};font-weight:600">${esc(t.priority||'—')}</span>`))}
          ${dtField(null,'role_developer','Developer', fvBtn('pAssignee', personVal(t.assignee)))}
          ${dtField('see_contributors','role_qa','Quality Analyst', fvBtn('pQa', personVal(t.qa)))}
          ${dtField('see_contributors','role_reviewer','Code Reviewer', fvBtn('pReviewer', personVal(t.reviewer)))}
          ${dtField('see_contributors','role_deployer','Deployer', fvBtn('pDeployer', personVal(t.deployer)))}
          ${dtField('see_reporter','role_reporter','Reporter', fvBtn('pReporter', personVal(t.reporter)))}
          ${dtField(null,'field_project','Project', fvBtn('pProject', `<span class="${t.project?'':'fv-none'}">${esc(pLbl(projSel,t.project))}</span>`))}
          ${dtField('see_dates','field_start','Start date', cdVal('start'))}
          ${dtField('see_dates','field_due','Due date', cdVal('due'))}
          ${dtField('see_estimate', estLocked?null:'field_estimate', 'Original estimate', estLocked ? `<span class="fv-input" style="opacity:.7" title="Locked — time has been logged">${t.estimate?hm(t.estimate):'None'}</span>` : `<input id="pEstimate" class="fv-input" type="number" step="0.25" min="0" placeholder="None" value="${t.estimate?(t.estimate/60):''}"/>`)}
          ${t.type!=='Epic'?dtField(null,'field_sprint','Sprint', fvBtn('pSprint', sprPanelVal(t))):''}
          ${t.type!=='Epic'?dtField(null,'field_points','Story points', `<input id="pPoints" class="fv-input" type="number" step="0.5" min="0" placeholder="None" value="${t.points!=null?esc(String(t.points)):''}"/>`):''}
          ${dtField(null,'field_epic','Epic', fvBtn('pParent', `<span class="${t.parent?'':'fv-none'}">${esc(pLbl(epicSel,t.parent))}</span>`))}
          ${dtField('see_logged',null,'Time logged', `<b style="font-size:13px">${hm(tot.total)}</b>`, false)}
        </div>
        <div class="pnl-tail"></div>
      </div>
    </div>`;

  // wire panel
  const F=(elid,cap)=>{ const el=document.getElementById(elid); return (el && can(cap)) ? el : {set onclick(v){}, set onchange(v){}}; };
  document.getElementById('panelClose').onclick=closePanel;
  /* Inline rename. contenteditable keeps the heading's exact type styling; we
     read textContent so pasted markup can never land in the title. */
  { const ttl=document.getElementById('pnTitle');
    if(ttl && canEditField('title')){
      let orig=t.title||'';
      const commit=()=>{ const v=(ttl.textContent||'').replace(/\s+/g,' ').trim();
        if(!v){ ttl.textContent=orig; toast('Title can\u2019t be empty'); return; }
        if(v===orig){ ttl.textContent=orig; return; }
        store.updateTask(id,{title:v}); orig=v; ttl.textContent=v;
        refreshViews(); toast('Title updated'); };
      ttl.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); ttl.blur(); }
        else if(e.key==='Escape'){ e.preventDefault(); ttl.textContent=orig; ttl.blur(); } };
      ttl.onblur=commit;
      ttl.onpaste=e=>{ e.preventDefault(); const cd=e.clipboardData||window.clipboardData; const txt=(cd?cd.getData('text'):'')||'';
        document.execCommand('insertText', false, txt.replace(/\s+/g,' ').trim()); };
      const pen=document.getElementById('pnTitleEdit');
      if(pen) pen.onclick=()=>{ ttl.focus();
        try{ const r=document.createRange(); r.selectNodeContents(ttl); r.collapse(false);
          const s=window.getSelection(); s.removeAllRanges(); s.addRange(r); }catch(e){} };
    } }
  { const prb=document.getElementById('prRaiseBtn'); if(prb) prb.onclick=()=>{ const now=!t.prRaised; store.setPrRaised(id, now); refreshViews(); openPanel(id,true); toast(now?`${t.key} — PR raised, deployment ticket created`:'PR mark removed'); }; }
  panel.querySelectorAll('[data-qbugfix]').forEach(b=>b.onclick=()=>{ const p=b.dataset.qbugfix.split('|'); const bug=(store.task(p[0]).qaBugs||[]).find(x=>x.id===p[1]); store.updateQaBug(p[0],p[1],{status:bug&&bug.status==='fixed'?'open':'fixed'}); openPanel(p[0], true); });
  F('pStatus','field_status').onclick=e=>{ e.stopPropagation(); openSelMenu(e.currentTarget, statusSel, t.status, v=>{ store.updateTask(id,{status:v}); refreshViews(); openPanel(id,true); toast('Status updated'); }); };
  F('pPriority','field_priority').onclick=e=>{ e.stopPropagation(); openSelMenu(e.currentTarget, prioSel, t.priority, v=>{ store.updateTask(id,{priority:v}); refreshViews(); openPanel(id,true); }); };
  F('pAssignee','role_developer').onclick=e=>{ e.stopPropagation(); openSelMenu(e.currentTarget, peopleSel, t.assignee||'', v=>{ store.updateTask(id,{assignee:v||null}); refreshViews(); openPanel(id,true); }); };
  F('pQa','role_qa').onclick=e=>{ e.stopPropagation(); openSelMenu(e.currentTarget, peopleSel, t.qa||'', v=>{ store.updateTask(id,{qa:v||null}); openPanel(id,true); }); };
  F('pReviewer','role_reviewer').onclick=e=>{ e.stopPropagation(); openSelMenu(e.currentTarget, peopleSel, t.reviewer||'', v=>{ store.updateTask(id,{reviewer:v||null}); openPanel(id,true); }); };
  F('pDeployer','role_deployer').onclick=e=>{ e.stopPropagation(); openSelMenu(e.currentTarget, peopleSel, t.deployer||'', v=>{ store.updateTask(id,{deployer:v||null}); openPanel(id,true); }); };
  F('pReporter','role_reporter').onclick=e=>{ e.stopPropagation(); openSelMenu(e.currentTarget, reporterSel, t.reporter||'', v=>{ store.updateTask(id,{reporter:v||null}); openPanel(id,true); }); };
  F('pProject','field_project').onclick=e=>{ e.stopPropagation(); openSelMenu(e.currentTarget, projSel, t.project||'', v=>{ store.updateTask(id,{project:v||null}); refreshViews(); openPanel(id,true); }); };
  F('pParent','field_epic').onclick=e=>{ e.stopPropagation(); openSelMenu(e.currentTarget, epicSel, t.parent||'', v=>{ store.updateTask(id,{parent:v||null}); openPanel(id,true); }); };
  panel.querySelectorAll('.p-cd').forEach(el=>{ const _f=el.dataset.field||'due'; if(!can(_f==='start'?'field_start':'field_due')) return; el.onclick=e=>{ e.stopPropagation(); const f=el.dataset.field||'due'; openDateMenu(el, el.dataset.id, (store.task(el.dataset.id)||{})[f], f); }; });
  F('pSprint','field_sprint').onclick=e=>{ e.stopPropagation(); if(!can('backlog_rank')){ toast('You don\u2019t have permission to move tickets between sprints'); return; } openSelMenu(e.currentTarget, sprPanelOpts(t), t.sprint&&store.sprint(t.sprint)&&store.sprint(t.sprint).state!=='closed'?t.sprint:'', v=>{ store.setTaskSprint(id, v||null); openPanel(id,true); refreshViews(); }); };
  F('pPoints','field_points').onchange=e=>{ const raw=e.target.value.trim(); const n=raw===''?null:Math.max(0, Math.round(parseFloat(raw)*2)/2); store.updateTask(id,{points:(n!==null&&isNaN(n))?null:n}); openPanel(id,true); refreshViews(); };
  F('pEstimate','field_estimate').onchange=e=>{ const h=parseFloat(e.target.value); store.updateTask(id,{estimate:h>0?Math.round(h*60):null}); openPanel(id,true); };
  const pDesc=document.getElementById('pDesc'); if(pDesc && canEditField('desc')){ pDesc.onchange=()=>{ store.updateTask(id,{desc:pDesc.value}); refreshViews(); }; }
  panel.querySelectorAll('.act-tab').forEach(tb=>tb.onclick=()=>{ panelTab=tb.dataset.tab; openPanel(id,true); });
  panel.querySelectorAll('.pn-rl').forEach(rb=>rb.onclick=()=>{ panelSub=rb.dataset.sub; openPanel(id,true); });
  const cmtPost=document.getElementById('cmtPost'); if(cmtPost && canEditField('comments')) cmtPost.onclick=()=>{ const el=document.getElementById('cmtInput'); const v=(el.value||'').trim(); if(!v){ el.focus(); return; }
    const author=meUser(); if(!author){ toast('We couldn\u2019t confirm who you are \u2014 reload and sign in again'); return; }
    store.addComment(id, author.id, v); toast('Comment added'); openPanel(id,true); };
  panel.querySelectorAll('.cmt-del').forEach(b=>b.onclick=()=>{ store.removeComment(id, b.dataset.cid); openPanel(id,true); });
  wireCustomEdits(panel, ()=>openPanel(id,true));
  panel.querySelectorAll('.cat-log').forEach(btn=>btn.onclick=()=>openLogModal(id, btn.dataset.cat));
  panel.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ store.removeWorklog(b.dataset.del); openPanel(id,true); refreshViews(); toast('Log removed'); });
  if(canEditField('subtasks')){
  panel.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{ store.toggleSubtask(id, b.dataset.toggle); openPanel(id,true); });
  panel.querySelectorAll('[data-subdel]').forEach(b=>b.onclick=()=>{ const sub=(t.subtasks||[]).find(x=>x.id===b.dataset.subdel);
    if(sub && sub.estimate) store.updateTask(id,{estimate:Math.max(0,(t.estimate||0)-sub.estimate)});   // take its estimate back out
    store.removeSubtask(id, b.dataset.subdel); openPanel(id,true); });
  panel.querySelectorAll('[data-subedit]').forEach(b=>b.onclick=()=>openSubModal(id, b.dataset.subedit));
  const _sbAdd=document.getElementById('subAddBtn'); if(_sbAdd) _sbAdd.onclick=()=>openSubModal(id, null);
  panel.querySelectorAll('[data-rename]').forEach(inp=>{ inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); inp.blur(); } }; inp.onchange=()=>{ store.renameSubtask(id, inp.dataset.rename, inp.value); }; });
  const subAdd=document.getElementById('subAddIn'); if(subAdd) subAdd.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); const v=(subAdd.value||'').trim(); if(!v) return; store.addSubtask(id, v); openPanel(id,true); setTimeout(()=>{ const el=document.getElementById('subAddIn'); if(el) el.focus(); },10); } };
  }

  document.getElementById('overlay').classList.add('on');
  document.getElementById('overlay').onclick=closePanel;
  panel.classList.add('on');
  if(keepScroll){ const pb=panel.querySelector('.panel-body'); if(pb) pb.scrollTop=prevScroll; }
}
function closePanel(){ ui.openTask=null; try{ urlSync(); }catch(e){} document.getElementById('panel').classList.remove('on'); document.getElementById('overlay').classList.remove('on'); }

/* ---------- Deployment tracker ---------- */
function depInRange(t){ const f=ui.depFilter; if(!f.mode||f.mode==='all') return true; const dt=t.deployedAt||t.prRaisedAt; if(!dt) return false;
  const ds=String(dt).slice(0,10);
  const pr=periodRange(f.mode);
  if(pr) return ds>=pr.from && ds<=pr.to;
  if(f.mode==='custom'){ if(f.from && ds<f.from) return false; if(f.to && ds>f.to) return false; return true; }
  return true; }
function renderQA(){
  const el=document.getElementById('qawrap'); if(!el) return;
  const f=ui.qaFilter;
  const isQaStatus=sid=>{ const s=store.status(sid); return !!(s && /qa/i.test(s.name)); };
  let list=store.standardTasks().filter(t=> isQaStatus(t.status) || (t.qaCases&&t.qaCases.length) || (t.qaBugs&&t.qaBugs.length));
  if(f.project!=='all') list=list.filter(t=>t.project===f.project);
  if(f.priority!=='all') list=list.filter(t=>t.priority===f.priority);
  if(f.qa!=='all') list=list.filter(t=>t.qa===f.qa);
  if(f.status==='untested') list=list.filter(t=>{ const c=t.qaCases||[]; return !c.length||c.some(x=>x.status==='pending'); });
  else if(f.status==='passing') list=list.filter(t=>{ const c=t.qaCases||[]; return c.length&&c.every(x=>x.status==='pass'); });
  else if(f.status==='failing') list=list.filter(t=>(t.qaCases||[]).some(x=>x.status==='fail'));
  list=list.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));

  const SLABEL={pending:'Pending', pass:'Pass', fail:'Fail'};
  const caseRow=(t,c)=>`<div class="qa-case" data-cid="${c.id}">
      <div class="qa-case-main"><span class="qa-case-tx">${esc(c.title)}</span><span class="qa-case-kind ${c.kind==='use'?'use':'test'}">${c.kind==='use'?'Use Case':'Test'}</span></div>
      <button class="qa-status ${c.status||'pending'}" data-cy="${t.id}|${c.id}" title="Click to cycle status">${SLABEL[c.status]||'Pending'}</button>
      <button class="qa-del" data-del="${t.id}|${c.id}" title="Delete case"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>`;
  const cardHTML=t=>{ const cases=t.qaCases||[]; const total=cases.length;
    const passed=cases.filter(c=>c.status==='pass').length; const failed=cases.filter(c=>c.status==='fail').length;
    const openBugs=(t.qaBugs||[]).filter(b=>b.status!=='fixed').length;
    const verified=total>0 && passed===total;
    const CHK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    const SHIELD='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
    const verifyBtn=`<button class="dep-verify ${verified?'ok':(passed?'part':'')}" data-qav="${t.id}">${verified?CHK+' Verified':SHIELD+' '+passed+'/'+total}</button>`;
    const qaU=store.user(t.qa); const stName=(store.status(t.status)||{}).name||'';
    return `<div class="ep-card qa-ep" data-qa="${t.id}" style="position:relative">
      <button class="ep-kebab" data-qak="${t.id}" title="QA options"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
      <div class="ep-left">
        <div class="ep-head"><div class="ep-ti">${esc(t.title)}</div><div class="ep-sub"><a class="dep-key" data-open="${t.id}">${esc(t.key)}</a></div></div>
        <div class="ep-mid">
          <div class="qa-badge"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6M10 2v5.5L5.5 18a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 7.5V2"/><path d="M7.5 14h9"/></svg></div>
          <div><div class="ep-state">${esc(stName)||'In QA'}</div><div class="ep-statesub">${qaU?'QA: '+esc(qaU.name):'No QA assigned'}</div></div>
        </div>
        <div class="dep-stats">
          <div class="dep-st"><span class="dep-st-v">${total}</span><span class="dep-st-l">Cases</span></div>
          <div class="dep-st"><span class="dep-st-v" style="color:#0E8F5A">${passed}</span><span class="dep-st-l">Passed</span></div>
          <div class="dep-st"><span class="dep-st-v" style="${failed?'color:#CE2F26':''}">${failed}</span><span class="dep-st-l">Failed</span></div>
          <div class="dep-st"><span class="dep-st-v" style="${openBugs?'color:#B96A00':''}">${openBugs}</span><span class="dep-st-l">Open bugs</span></div>
          <div class="dep-st">${verifyBtn}<span class="dep-st-l">QA Verified</span></div>
        </div>
      </div>
      <div class="ep-right">
        <div class="tsk-sec-head" style="margin-bottom:10px"><span class="tsk-eyebrow">Test &amp; use cases</span>
          <a class="dep-open2" href="?ticket=${encodeURIComponent(t.key)}" target="_blank" rel="noopener">Open ticket <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg></a></div>
        <div class="qa-cases ${total>5?'qa-scroll':''}" data-cases="${t.id}">${total?cases.map(c=>caseRow(t,c)).join(''):'<div class="qa-empty-cases">No cases yet. Add the first test or use case below.</div>'}</div>
        <div class="qa-add" data-add="${t.id}">
          <div class="qa-kind-tog"><button data-k="test" class="on">Test</button><button data-k="use">Use Case</button></div>
          <input class="qa-add-in" placeholder="Describe a test or use case\u2026"/>
          <button class="qa-add-btn">Add</button>
        </div>
        <div class="qa-atts">
          <div class="qa-att-list">${(t.qaAttachments||[]).map(a=>`<span class="qa-att"><a href="${a.data}" download="${esc(a.orig||a.name)}" title="${esc(a.orig||a.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg><span class="qa-att-nm">${esc(a.name)}</span></a><button class="qa-att-x" data-qaattdel="${t.id}|${a.id}" title="Remove">\u00d7</button></span>`).join('')}</div>
          <button class="qa-att-btn" data-qaatt="${t.id}" style="${can('qa_attach')?'':'display:none'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>Attach file</button>
        </div>
      </div>
    </div>`;
  };

  let body;
  if(!list.length){ body='<div class="dep-none">No QA work yet. When a ticket moves into a <b>QA</b> status, it appears here automatically.</div>'; }
  else { body=`<div class="dep-grid">${list.map(cardHTML).join('')}</div>`; }

  const chip=(id,ico,label,val,active)=>`<button class="chip ${active?'active':''}" id="${id}">${ico}<span class="chip-lbl">${label}</span><span class="chip-val">${esc(val)}</span>${CHEV_SVG}</button>`;
  const projOpts=[{v:'all',t:'All projects'}].concat(store.projects().map(p=>({v:p.id,t:p.name})));
  const priOpts=[{v:'all',t:'All priorities'}].concat(Object.keys(PRIORITIES).map(p=>({v:p,t:p,dot:PRIORITIES[p]})));
  const qaPeople=[...new Set(store.standardTasks().filter(t=>t.qa).map(t=>t.qa))];
  const qaOpts=[{v:'all',t:'All QAs'}].concat(qaPeople.map(uid=>{ const u=store.user(uid); return {v:uid,t:u?u.name:uid, ava:u?avatar(u,18):''}; }));
  const stOpts=[{v:'all',t:'All'},{v:'untested',t:'Not tested'},{v:'passing',t:'All passing'},{v:'failing',t:'Has failures'}];
  const ICO_PROJ='<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="color:#7C3AED"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  const ICO_PRI='<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="color:#CA8A04"><path d="M4 21V4M4 4h13l-2 5 2 5H4"/></svg>';
  const ICO_QA='<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#0C5A9E"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  const ICO_ST='<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#0E8F5A"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>';
  const projVal=f.project==='all'?'All':((store.project(f.project)||{}).name||'All');
  const priVal=f.priority==='all'?'All':f.priority;
  const qaVal=f.qa==='all'?'All':((store.user(f.qa)||{}).name||'All');
  const stVal=(stOpts.find(o=>o.v===f.status)||{}).t||'All';

  el.innerHTML=`<div class="ov-h" style="align-items:center"><div class="dep-filters">${chip('qaProjBtn',ICO_PROJ,'Project',projVal,f.project!=='all')}${chip('qaPriBtn',ICO_PRI,'Priority',priVal,f.priority!=='all')}${chip('qaQaBtn',ICO_QA,'QA',qaVal,f.qa!=='all')}${chip('qaStBtn',ICO_ST,'Status',stVal,f.status!=='all')}</div>${can('env_block')?`<button class="eb-block" id="qaBlockBtn" style="margin-left:auto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Block Test Env</button>`:''}</div>${body}`;

  document.getElementById('qaProjBtn').onclick=e=>{ e.stopPropagation(); chipMenu(e.currentTarget, projOpts, f.project, v=>{ ui.qaFilter.project=v; renderQA(); }); };
  document.getElementById('qaPriBtn').onclick=e=>{ e.stopPropagation(); chipMenu(e.currentTarget, priOpts, f.priority, v=>{ ui.qaFilter.priority=v; renderQA(); }); };
  document.getElementById('qaQaBtn').onclick=e=>{ e.stopPropagation(); chipMenu(e.currentTarget, qaOpts, f.qa, v=>{ ui.qaFilter.qa=v; renderQA(); }); };
  document.getElementById('qaStBtn').onclick=e=>{ e.stopPropagation(); chipMenu(e.currentTarget, stOpts, f.status, v=>{ ui.qaFilter.status=v; renderQA(); }); };

  el.querySelectorAll('.dep-key[data-open]').forEach(a=>a.onclick=e=>{ e.preventDefault(); e.stopPropagation(); openPanel(a.dataset.open); });
  el.querySelectorAll('.ep-kebab[data-qak]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); openQaMenu(b.dataset.qak, b); });
  el.querySelectorAll('.dep-verify[data-qav]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); if(!can('qa_verify')){ toast('You don\u2019t have permission to sign off QA'); return; } openQaVerify(b.dataset.qav); });
  el.querySelectorAll('.qa-att-btn[data-qaatt]').forEach(b=>b.onclick=()=>openQaAtt(b.dataset.qaatt));
  { const qbb=document.getElementById('qaBlockBtn'); if(qbb) qbb.onclick=()=>openEnvBlock('test'); }
  el.querySelectorAll('.qa-att-x[data-qaattdel]').forEach(b=>b.onclick=()=>{ const p=b.dataset.qaattdel.split('|'); store.removeQaAttachment(p[0],p[1]); renderQA(); });
  el.querySelectorAll('.qa-status[data-cy]').forEach(b=>b.onclick=()=>{ if(!can('qa_status')){ toast('You don\u2019t have permission to set case status'); return; } const p=b.dataset.cy.split('|'); const t=store.task(p[0]); const c=(t&&t.qaCases||[]).find(x=>x.id===p[1]); if(!c) return;
    const nx={pending:'pass',pass:'fail',fail:'pending'}[c.status||'pending']; store.updateQaCase(p[0],p[1],{status:nx}); renderQA(); });
  el.querySelectorAll('.qa-del[data-del]').forEach(b=>b.onclick=()=>{ const p=b.dataset.del.split('|'); store.removeQaCase(p[0],p[1]); renderQA(); });
  el.querySelectorAll('.qa-add').forEach(row=>{ const tid=row.dataset.add;
    const kindBtns=row.querySelectorAll('.qa-kind-tog button');
    kindBtns.forEach(kb=>kb.onclick=()=>{ kindBtns.forEach(x=>x.classList.remove('on')); kb.classList.add('on'); });
    const input=row.querySelector('.qa-add-in');
    const add=()=>{ if(!can('qa_manage')){ toast('You don\u2019t have permission to edit test cases'); return; } const v=input.value.trim(); if(!v) return; const onBtn=row.querySelector('.qa-kind-tog button.on'); const kind=onBtn?onBtn.dataset.k:'test';
      store.addQaCase(tid, kind, v); renderQA();
      const nx=document.querySelector('.qa-add[data-add="'+tid+'"] .qa-add-in'); if(nx) nx.focus(); };
    row.querySelector('.qa-add-btn').onclick=add;
    input.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); add(); } };
  });
}
const VERIFY_ITEMS=[
  {k:'smoke',    t:'Smoke test passed on production'},
  {k:'flows',    t:'Critical user flows verified end-to-end'},
  {k:'logs',     t:'No new errors in logs / monitoring'},
  {k:'perf',     t:'Performance & response times within limits'},
];
let depTab='tickets';
function depTabBtn(k,label){ return `<button type="button" class="dep-tab ${depTab===k?'on':''}" data-deptab="${k}">${label}</button>`; }
function wireDepTabs(el){ el.querySelectorAll('[data-deptab]').forEach(b=>b.onclick=()=>{ depTab=b.dataset.deptab; renderDeployments(); }); }
/* Release history, split by environment. Every recorded deployment is kept, so
   an environment shows the full run of versions that landed on it. */
function renderDepVersions(el){
  const log=store.deployLog().slice().sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  const byEnv={}; DEPLOY_ENVS.forEach(e=>byEnv[e]=[]);
  log.forEach(d=>(d.envs||[]).forEach(e=>{ if(!byEnv[e]) byEnv[e]=[]; byEnv[e].push(d); }));

  const head=`<div class="ov-h" style="align-items:flex-start"><div class="dep-tabs">${depTabBtn('tickets','By ticket')}${depTabBtn('versions','By version')}</div></div>`;

  if(!log.length){
    el.innerHTML=head+`<div class="tsk-empty"><p>No deployments recorded yet. Mark a ticket as deployed to start the release history.</p></div>`;
    wireDepTabs(el); return;
  }

  const envCards=Object.keys(byEnv).map(env=>{
    const rows=byEnv[env];
    if(!rows.length) return `<div class="dv-env empty"><div class="dv-env-h"><span class="dv-env-n">${esc(env)}</span><span class="dv-env-c">No releases</span></div></div>`;
    // group this environment's entries by version, newest first
    const seen=[]; const groups={};
    rows.forEach(d=>{ const v=d.version||'\u2014'; if(!groups[v]){ groups[v]=[]; seen.push(v); } groups[v].push(d); });
    const items=seen.map(v=>{
      const g=groups[v];
      const when=g[0].at;
      const tix=g.map(d=>{ const t=store.task(d.task); if(!t) return '';
        const u=store.user(t.assignee);
        return `<div class="dv-tix-row"><a class="dv-key" data-open="${t.id}">${esc(t.key)}</a>`
             + `<span class="dv-tt">${esc(t.title)}</span>`
             + (u?`<span class="dv-asg">${avatar(u,18)}<span class="dv-asg-n">${esc(u.name)}</span></span>`
                 :'<span class="dv-asg none">Unassigned</span>')
             + `</div>`; }).filter(Boolean).join('');
      const who=store.user(g[0].by);
      return `<div class="dv-row">
        <div class="dv-vhead"><span class="dv-v">v${esc(v)}</span><span class="dv-n">${g.length} ticket${g.length===1?'':'s'}</span></div>
        <div class="dv-meta"><span class="dv-when">${fdatetime(when)}</span>${who?`<span class="dv-by">deployed by ${avatar(who,18)}${esc(who.name)}</span>`:''}</div>
        <div class="dv-tix">${tix}</div>
      </div>`;
    }).join('');
    return `<div class="dv-env">
      <div class="dv-env-h"><span class="dv-env-n">${esc(env)}</span><span class="dv-env-c">${seen.length} version${seen.length===1?'':'s'} \u00b7 latest <b>v${esc(seen[0])}</b></span></div>
      <div class="dv-rows">${items}</div>
    </div>`;
  }).join('');

  el.innerHTML=head+`<div class="dv-grid">${envCards}</div>`;
  wireDepTabs(el);
  el.querySelectorAll('.dv-key[data-open]').forEach(a=>a.onclick=()=>openPanel(a.dataset.open));
}
function renderDeployments(){
  if(!_inRenderAll){ try{ urlSync(); }catch(e){} }   // in-page filter change → reflect in URL
  const el=document.getElementById('deploymentswrap'); if(!el) return;
  const f=ui.depFilter;
  let done=store.standardTasks().filter(t=>t.prRaised||t.deployed).filter(depInRange);
  if(f.project!=='all') done=done.filter(t=>t.project===f.project);
  if(f.priority!=='all') done=done.filter(t=>t.priority===f.priority);
  if(f.assignee!=='all') done=done.filter(t=>t.assignee===f.assignee);
  if(f.verified==='yes') done=done.filter(t=>t.verified);
  else if(f.verified==='no') done=done.filter(t=>!t.verified);
  done=done.sort((a,b)=>{ const _t=x=>new Date(x.deployedAt||'2000-01-01').getTime()||0; return _t(b)-_t(a); });
  const pfld=(label,uid)=>{ const u=store.user(uid); return `<div class="dep-fld"><span class="dep-fld-l">${label}</span><span class="dep-fld-v">${u?`${avatar(u,20)}<span class="dep-fld-nm">${esc(u.name)}</span>`:'<span class="dep-fld-none">—</span>'}</span></div>`; };
  const dfld=(label,val,green)=>`<div class="dep-fld"><span class="dep-fld-l">${label}</span><span class="dep-fld-v"><span class="dep-fld-dt" ${green?'style="color:var(--good,#0E8F5A);font-weight:600"':''}>${val||'—'}</span></span></div>`;
  const cardHTML=t=>{ const proj=store.project(t.project);
    const startISO=t.start||t.createdAt||t.createdTs;
    let cycle='—'; if(t.deployedAt&&startISO){ const d=Math.max(0,Math.round((new Date(t.deployedAt)-new Date(startISO))/864e5)); cycle=d+'d'; }
    const checks=t.verifyChecks||{}; const doneN=VERIFY_ITEMS.filter(it=>checks[it.k]).length; const total=VERIFY_ITEMS.length; const verified=!!t.verified;
    const logged=store.worklogs(t.id).reduce((a,w)=>a+(w.min||0),0);
    const CHK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    const SHIELD='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
    const verifyBtn=`<button class="dep-verify ${verified?'ok':(doneN?'part':'')}" data-verify="${t.id}">${verified?CHK+' Verified':(doneN?SHIELD+' '+doneN+'/'+total:SHIELD+' Verify')}</button>`;
    const isDep=!!t.deployed; const prOnly=!isDep&&t.prRaised;
    const ROCKET='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/></svg>';
    const PRICON='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>';
    const badge=isDep?`<div class="dep-badge">${ROCKET}</div>`:`<div class="dep-badge no">${PRICON}</div>`;
    const stName2=isDep?'Deployed':'Not Deployed';
    const stSub=isDep
      ? (t.deployedAt?fdate(t.deployedAt):'\u2014')
      : (prOnly?('PR raised '+fdate(t.prRaisedAt)):'Awaiting PR');
    const envTags=(t.deployEnvs||[]).length
      ? `<div class="d6-envs">${(t.deployEnvs||[]).map(e=>`<span class="d6-env">${esc(e)}</span>`).join('')}</div>` : '';
    const verTag=t.deployVersion?`<div class="d6-ver">v${esc(t.deployVersion)}</div>`:'';
    const cell=(label,uid)=>{ const u=store.user(uid);
      return `<div class="d6-cell"><span class="d6-lbl">${label}</span>${u
        ? `<span class="d6-who">${avatar(u,22)}<span class="d6-nm">${esc(u.name)}</span></span>`
        : '<span class="d6-none">Unassigned</span>'}</div>`; };
    return `<div class="ep-card dep-ep" data-dep="${t.id}">
      <div class="d6">
        <div class="d6-rail ${isDep?'ok':'no'}">
          ${badge}
          ${isDep
            ? `<div class="d6-state">${stName2}</div><div class="d6-sub">${stSub}</div>${verTag}${envTags}
               <button class="d6-redo" data-undeploy="${t.id}">Undo</button>`
            : `<button class="d6-mark" data-deploy="${t.id}">${stName2}</button><div class="d6-sub">${stSub}</div>`}
        </div>
        <div class="d6-body">
          <div class="d6-head">
            <div class="d6-id">
              <div class="d6-ti">${esc(t.title)}</div>
              <a class="dep-key" data-open="${t.id}">${esc(t.key)}</a>
            </div>
            <div class="d6-act">
              ${verifyBtn}
              <a class="dep-open2" href="?ticket=${encodeURIComponent(t.key)}" target="_blank" rel="noopener">Open ticket <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg></a>
              <button class="ep-kebab d6-keb" data-dep="${t.id}" title="Deployment options"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
            </div>
          </div>
          <div class="d6-chips">
            <span class="d6-chip"><b>${cycle}</b> cycle</span>
            <span class="d6-chip">${esc(t.priority||'\u2014')}</span>
            <span class="d6-chip"><b>${hm(logged)}</b> logged</span>
          </div>
          <div class="d6-team">
            <div class="d6-teamh">Delivery team</div>
            <div class="d6-grid">
              ${cell('Developer',t.assignee)}
              ${cell('Code Reviewer',t.reviewer)}
              ${cell('Quality Analyst',t.qa)}
              ${cell('Deployer',t.deployer)}
            </div>
          </div>
        </div>
      </div>
    </div>`;
  };
  let body;
  if(!done.length){ body='<div class="dep-none">No deployments match these filters. When a ticket is marked <b>Done</b>, it appears here automatically.</div>'; }
  else { body=`<div class="dep-grid">${done.map(cardHTML).join('')}</div>`; }
  const projOpts=[{v:'all',t:'All projects'}].concat(store.projects().map(p=>({v:p.id,t:p.name})));
  const priOpts=[{v:'all',t:'All priorities'}].concat(Object.keys(PRIORITIES).map(p=>({v:p,t:p,dot:PRIORITIES[p]})));
  const asgOpts=[{v:'all',t:'All assignees'}].concat(store.users().map(u=>({v:u.id,t:u.name,ava:avatar(u,18)})));
  const verOpts=[{v:'all',t:'All'},{v:'yes',t:'Verified'},{v:'no',t:'Not verified'}];
  const ICO_PROJ='<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="color:#7C3AED"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  const ICO_PRI='<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="color:#CA8A04"><path d="M4 21V4M4 4h13l-2 5 2 5H4"/></svg>';
  const ICO_ASG='<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#0C5A9E"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  const ICO_VER='<svg class="chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#0E8F5A"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';
  const projVal=f.project==='all'?'All':((store.project(f.project)||{}).name||'All');
  const priVal=f.priority==='all'?'All':f.priority;
  const asgVal=f.assignee==='all'?'All':((store.user(f.assignee)||{}).name||'All');
  const verVal=f.verified==='yes'?'Verified':(f.verified==='no'?'Not verified':'All');
  const chip=(id,ico,label,val,active)=>`<button class="chip ${active?'active':''}" id="${id}">${ico}<span class="chip-lbl">${label}</span><span class="chip-val">${esc(val)}</span>${CHEV_SVG}</button>`;
  const seg=(m,label)=>`<button class="dep-seg ${f.mode===m?'on':''}" data-mode="${m}">${label}</button>`;
  if(depTab==='versions'){ renderDepVersions(el); return; }
  el.innerHTML=`<div class="ov-h" style="align-items:flex-start"><div class="dep-tabs">${depTabBtn('tickets','By ticket')}${depTabBtn('versions','By version')}</div><div class="dep-filters">${chip('depProjBtn',ICO_PROJ,'Project',projVal,f.project!=='all')}${chip('depPriBtn',ICO_PRI,'Priority',priVal,f.priority!=='all')}${chip('depAsgBtn',ICO_ASG,'Assignee',asgVal,f.assignee!=='all')}${chip('depVerBtn',ICO_VER,'Verified',verVal,f.verified&&f.verified!=='all')}</div><div class="period-box"><div class="dep-filter">${seg('all','All')}${seg('today','Today')}${seg('week','Week')}${seg('month','Month')}${seg('custom','Custom')}</div>${f.mode==='custom'?periodCustomRow('dep', f.from, f.to):''}</div></div>
    ${body}`;
  document.getElementById('depProjBtn').onclick=e=>{ e.stopPropagation(); chipMenu(e.currentTarget, projOpts, f.project, v=>{ ui.depFilter.project=v; renderDeployments(); }); };
  document.getElementById('depPriBtn').onclick=e=>{ e.stopPropagation(); chipMenu(e.currentTarget, priOpts, f.priority, v=>{ ui.depFilter.priority=v; renderDeployments(); }); };
  document.getElementById('depAsgBtn').onclick=e=>{ e.stopPropagation(); chipMenu(e.currentTarget, asgOpts, f.assignee, v=>{ ui.depFilter.assignee=v; renderDeployments(); }); };
  document.getElementById('depVerBtn').onclick=e=>{ e.stopPropagation(); chipMenu(e.currentTarget, verOpts, f.verified||'all', v=>{ ui.depFilter.verified=v; renderDeployments(); }); };
  el.querySelectorAll('.dep-seg').forEach(b=>b.onclick=()=>{ ui.depFilter.mode=b.dataset.mode; renderDeployments(); });
  if(f.mode==='custom') wirePeriodCustom('dep', f.from, f.to, v=>{ ui.depFilter.from=v; renderDeployments(); }, v=>{ ui.depFilter.to=v; renderDeployments(); });
  el.querySelectorAll('.ep-kebab[data-dep]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); openDepMenu(b.dataset.dep, b); });
  el.querySelectorAll('.dep-key[data-open]').forEach(a=>a.onclick=e=>{ e.preventDefault(); e.stopPropagation(); openPanel(a.dataset.open); });
  el.querySelectorAll('.dep-verify[data-verify]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); if(!can('deploy_verify')){ toast('You don\u2019t have permission to verify deployments'); return; } openDepVerify(b.dataset.verify); });
  wireDepTabs(el);
  el.querySelectorAll('[data-deploy]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); openDepMark(b.dataset.deploy); });
  el.querySelectorAll('[data-undeploy]').forEach(b=>b.onclick=e=>{ e.stopPropagation();
    if(!can('deploy_manage')){ toast('You don\u2019t have permission to change deployments'); return; }
    const t=store.task(b.dataset.undeploy); if(!t) return;
    confirmDelete({ title:'Undo deployment record',
      lead:`Clear the deployment record for <b>${esc(t.key)}</b>? It goes back to <b>Not Deployed</b>, and its verification is reset.`,
      confirmLabel:'Undo record',
      onConfirm:()=>{ store.unmarkDeployed(t.id); refreshViews(); toast('Deployment record cleared'); } });
  });
}
let _urlTicketOpened=false;
function openTicketFromURL(){ if(_urlTicketOpened) return; try{ const k=new URLSearchParams(location.search).get('ticket'); if(!k||!store.data) return;
  const t=store.tasks().find(x=>x.key===k); if(t){ _urlTicketOpened=true; ui.view='board'; setTimeout(()=>openPanel(t.id), 120); } }catch(e){} }
