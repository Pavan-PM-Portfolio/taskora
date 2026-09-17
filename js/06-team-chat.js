/* Taskora — 06-team-chat.js
   Loaded in order by app.html (plain scripts sharing one global scope).
   Keep the numeric order: later files use what earlier files define. */
/* ---------- Team chat (bottom-left pop-up) ---------- */
function chatTime(at){ const d=new Date(at); const diff=(Date.now()-d.getTime())/1000;
  let h=d.getHours(); const m=String(d.getMinutes()).padStart(2,'0'); const ap=h>=12?'PM':'AM'; h=h%12||12; const hm=h+':'+m+' '+ap;
  if(diff<86400 && d.getDate()===new Date().getDate()) return hm;
  return fdate(_isoLocal(d))+', '+hm; }
function chatEsc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
// Attachment URLs come from other users' messages: allow only data: URLs so a
// crafted javascript:/other-scheme "attachment" can't run when clicked.
function chatSafeUrl(u){ u=String(u||''); return /^data:/i.test(u) ? u : '#'; }
function renderMentions(text){ let s=chatEsc(text);
  const names=store.users().map(u=>u.name).sort((a,b)=>b.length-a.length);
  names.forEach(n=>{ const esc=chatEsc(n).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); s=s.replace(new RegExp('@'+esc,'g'), `<span class="cmention">@${chatEsc(n)}</span>`); });
  return s.replace(/\n/g,'<br>'); }
function chatUnread(){ const seen=ui.chat.seen||{}; let n=0; store.chatChannels().forEach(c=>{ const last=seen[c.id]||0; store.chatMessages(c.id).forEach(m=>{ if(m.user!==CURRENT_UID && new Date(m.at).getTime()>last) n++; }); }); return n; }
function updateChatFab(){ if(!store.data) return; const n=chatUnread();
  const tt=document.getElementById('ttBadge'); if(tt){ if(n>0 && !ui.chat.open){ tt.textContent=n>9?'9+':String(n); tt.style.display='grid'; } else tt.style.display='none'; }
  const badge=document.getElementById('chatFabBadge'); if(!badge) return;
  if(n>0 && !ui.chat.open){ badge.textContent=n>9?'9+':String(n); badge.style.display='grid'; } else badge.style.display='none'; try{ syncBotBadges(); }catch(e){} }
function renderChatFab(){ const box=document.getElementById('chatFabAvs'); if(!box||!store.data) return;
  const gen=store.chatChannel('ch_general')||store.chatChannels().find(c=>c.type==='group')||{members:[]};
  const mem=(gen.members||[]).map(id=>store.user(id)).filter(Boolean); const show=mem.slice(0,3); const extra=mem.length-show.length;
  box.innerHTML=show.map(u=>avatar(u,24)).join('')+(extra>0?`<span class="chat-fab-more">+${extra}</span>`:''); }
function openChat(){ ui.chat.open=true; document.getElementById('chatWin').classList.add('on'); renderChat(); updateChatFab(); }
function closeChat(){ ui.chat.open=false; document.getElementById('chatWin').classList.remove('on'); }
function syncBotBadges(){
  try{ const n=(typeof unreadCount==='function')?unreadCount():0; const b=document.getElementById('botNotifBadge'); if(b){ if(n>0){ b.textContent=n>99?'99+':n; b.style.display='grid'; } else b.style.display='none'; } }catch(e){}
  try{ const c=(typeof chatUnread==='function')?chatUnread():0; const t=document.getElementById('botTtBadge'); if(t){ if(c>0 && !(ui.chat&&ui.chat.open)){ t.textContent=c>9?'9+':c; t.style.display='grid'; } else t.style.display='none'; } }catch(e){}
}
function openCmdk(){ const s=document.getElementById('cmdkScrim'); if(!s) return; s.classList.add('on'); const i=document.getElementById('cmdkInput'); if(i){ i.value=''; renderCmdk(''); setTimeout(()=>i.focus(),20); } }
function closeCmdk(){ const s=document.getElementById('cmdkScrim'); if(s) s.classList.remove('on'); }
function renderCmdk(q){
  q=(q||'').trim().toLowerCase();
  const res=document.getElementById('cmdkResults'); if(!res) return;
  const VIEWS=[['overview','Overview'],['board','Board'],['backlog','Backlog'],['sprint','Active sprint'],['sprintreports','Sprint reports'],['flow','Flow reports'],['list','List View'],['epics','Epics'],['qa','QA & Testing'],['deployments','Deployments'],['projects','Projects'],['team','Team'],['calendar','Calendar'],['dashboard','Dashboard'],['boardsettings','Board & workflow'],['settings','Settings']];
  const ICO='<svg class="cmdk-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
  let html='';
  const vm=VIEWS.filter(v=>!q||v[1].toLowerCase().includes(q));
  if(vm.length){ html+='<div class="cmdk-sec">Jump to</div>'+vm.slice(0,q?6:8).map(v=>`<button class="cmdk-row" data-view="${v[0]}">${ICO}${esc(v[1])}<span class="cmdk-hint">View</span></button>`).join(''); }
  if(q){
    try{ const tix=store.standardTasks().filter(t=>((t.key||'').toLowerCase().includes(q))||((t.title||'').toLowerCase().includes(q))).slice(0,8);
      if(tix.length){ html+='<div class="cmdk-sec">Tickets</div>'+tix.map(t=>`<button class="cmdk-row" data-tk="${t.id}"><span class="cmdk-key">${esc(t.key)}</span>${esc(t.title)}</button>`).join(''); } }catch(e){}
    try{ const ppl=store.users().filter(u=>(u.name||'').toLowerCase().includes(q)).slice(0,4);
      if(ppl.length){ html+='<div class="cmdk-sec">People</div>'+ppl.map(u=>`<button class="cmdk-row" data-user="${u.id}">${avatar(u,20)}${esc(u.name)}</button>`).join(''); } }catch(e){}
  }
  if(!html) html='<div class="cmdk-none">No matches for \u201c'+esc(q)+'\u201d</div>';
  res.innerHTML=html;
  res.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{ closeCmdk(); setView(b.dataset.view); });
  res.querySelectorAll('[data-tk]').forEach(b=>b.onclick=()=>{ closeCmdk(); openPanel(b.dataset.tk); });
  res.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>{ closeCmdk(); setView('team'); });
}
function openShortcuts(){ const b=document.getElementById('kbdBody'); if(b){ const rows=[['Command / search','Ctrl / \u2318 + K'],['Open this panel','?'],['Close dialogs & menus','Esc'],['New ticket','N'],['Focus search','/']];
  b.innerHTML=rows.map(r=>`<div class="kbd-row"><span>${esc(r[0])}</span><kbd>${esc(r[1])}</kbd></div>`).join(''); }
  document.getElementById('kbdWrap').classList.add('on');
  const c=document.getElementById('kbdClose'); if(c) c.onclick=()=>document.getElementById('kbdWrap').classList.remove('on'); }
function wireBotbar(){
  const bb=document.getElementById('botbar'); if(!bb) return;
  bb.querySelectorAll('[data-bb]').forEach(el=>el.onclick=()=>{ const a=el.dataset.bb;
    if(a==='techtalk'){ (ui.chat&&ui.chat.open)?closeChat():openChat(); }
    else if(a==='board'){ setView('board'); }
    else if(a==='overview'){ setView('overview'); }
    else if(a==='timeline'){ setView('timeline'); }
    else if(a==='calendar'){ setView('calendar'); }
    else if(a==='notif'){ if(typeof openNotifs==='function') openNotifs(); }
    else if(a==='settings'){ setView('settings'); }
    else if(a==='shortcuts'){ openShortcuts(); }
  });
  const cmd=document.getElementById('botCmd'); if(cmd) cmd.onclick=openCmdk;
  const ci=document.getElementById('cmdkInput'); if(ci) ci.oninput=e=>renderCmdk(e.target.value);
  const cs=document.getElementById('cmdkScrim'); if(cs) cs.onclick=e=>{ if(e.target===cs) closeCmdk(); };
  if(!window._botKeys){ window._botKeys=true;
    document.addEventListener('keydown',e=>{
      if((e.metaKey||e.ctrlKey)&&(e.key==='k'||e.key==='K')){ e.preventDefault(); openCmdk(); return; }
      if(e.key==='Escape'){ closeCmdk(); return; }
      const tag=(e.target&&e.target.tagName)||''; const typing=tag==='INPUT'||tag==='TEXTAREA'||(e.target&&e.target.isContentEditable);
      if(typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if(e.key==='?'){ openShortcuts(); }
      else if(e.key==='/' ){ const s=document.querySelector('.search input'); if(s){ e.preventDefault(); s.focus(); } }
      else if(e.key==='n'||e.key==='N'){ const nb=document.getElementById('newTaskBtn'); if(nb && nb.offsetParent!==null){ nb.click(); } }
    });
  }
  syncBotBadges();
}
function chatScrollBottom(){ const el=document.getElementById('chatMsgs'); if(el) el.scrollTop=el.scrollHeight; }
function chatGroupIcon(){ return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></svg>'; }
function chatShort(at){ const d=new Date(at); const diff=(Date.now()-d.getTime())/1000; let h=d.getHours();const m=String(d.getMinutes()).padStart(2,'0');const ap=h>=12?'PM':'AM';h=h%12||12;
  if(d.toDateString()===new Date().toDateString()) return h+':'+m+' '+ap; if(diff<604800) return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]; return d.getDate()+'/'+(d.getMonth()+1); }
function chatFmtSize(b){ b=b||0; if(b<1024)return b+' B'; if(b<1048576)return Math.round(b/1024)+' KB'; return (b/1048576).toFixed(1)+' MB'; }
function chatPreview(m){ if(m.attachment) return (m.attachment.type||'').startsWith('image/')?'Photo':m.attachment.name; return m.text||''; }
function chatFileIcon(){ return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'; }
function chatAttHTML(a){ if(!a) return ''; const url=chatSafeUrl(a.dataUrl); if((a.type||'').startsWith('image/')) return `<a class="cmsg-imgw" href="${url}" target="_blank" rel="noopener"><img class="cmsg-img" src="${url}" alt="${chatEsc(a.name)}"/></a>`;
  return `<a class="cmsg-file" href="${url}" download="${chatEsc(a.name)}"><span class="cmsg-file-ic">${chatFileIcon()}</span><span class="cmsg-file-b"><span class="cmsg-file-nm">${chatEsc(a.name)}</span><span class="cmsg-file-sz">${chatFmtSize(a.size)}</span></span></a>`; }
function chatConvoRow(c){ const me=CURRENT_UID; const isDm=c.type==='dm'; const other=isDm?store.user(c.members.find(x=>x!==me)):null; const nm=isDm?(other?other.name:'Direct'):c.name; const last=store.chatLast(c.id); const on=c.id===ui.chat.channel;
  const ic=isDm?avatar(other,34):`<span class="chat-grp-ic">${chatGroupIcon()}</span>`;
  const pv=last?`${chatEsc((store.user(last.user)||{}).name||'').split(' ')[0]}: ${chatEsc(chatPreview(last)).slice(0,26)}`:(isDm?'Start a conversation':'No messages yet');
  return `<button class="chat-row ${on?'on':''}" data-ch="${c.id}">${ic}<span class="chat-row-b"><span class="chat-row-top"><span class="chat-row-nm">${chatEsc(nm)}</span>${last?`<span class="chat-row-tm">${chatShort(last.at)}</span>`:''}</span><span class="chat-row-lm">${pv}</span></span></button>`; }
function chatPersonRow(u){ return `<button class="chat-row" data-person="${u.id}">${avatar(u,34)}<span class="chat-row-b"><span class="chat-row-top"><span class="chat-row-nm">${chatEsc(u.name)}</span></span><span class="chat-row-lm">${chatEsc(u.role||'Send a message')}</span></span></button>`; }
function renderChatRailList(){ const box=document.getElementById('chatRailList'); if(!box) return; const me=CURRENT_UID; const q=(ui.chat.search||'').trim().toLowerCase();
  const groups=store.chatChannels().filter(c=>c.type==='group');
  if(q){ const chM=groups.filter(c=>c.name.toLowerCase().includes(q)); const ppl=store.users().filter(u=>u.id!==me && u.name.toLowerCase().includes(q));
    box.innerHTML=(chM.length?`<div class="chat-rail-h">Channels</div>${chM.map(chatConvoRow).join('')}`:'')+(ppl.length?`<div class="chat-rail-h">People</div>${ppl.map(chatPersonRow).join('')}`:'')+((!chM.length&&!ppl.length)?'<div class="chat-hint">No people or chats match “'+chatEsc(ui.chat.search)+'”.</div>':'');
  } else { const convos=store.chatChannels().filter(c=>c.type==='group'||store.chatMessages(c.id).length>0);
    convos.sort((a,b)=>{const la=store.chatLast(a.id),lb=store.chatLast(b.id);return new Date(lb?lb.at:0)-new Date(la?la.at:0);});
    box.innerHTML=`<div class="chat-rail-h">Recent</div>${convos.map(chatConvoRow).join('')}<div class="chat-hint">Search above to message anyone on the team.</div>`; }
  box.querySelectorAll('.chat-row[data-ch]').forEach(b=>b.onclick=()=>{ ui.chat.channel=b.dataset.ch; ui.chat.newGroup=false; ui.chat.editing=null; renderChat(); });
  box.querySelectorAll('.chat-row[data-person]').forEach(b=>b.onclick=()=>{ ui.chat.channel=store.dmChannel(b.dataset.person); ui.chat.newGroup=false; ui.chat.editing=null; ui.chat.search=''; renderChat(); });
}
function renderChat(){
  const win=document.getElementById('chatWin'); if(!ui.chat.open) return; const me=CURRENT_UID;
  if(!store.chatChannel(ui.chat.channel)) ui.chat.channel=(store.chatChannels()[0]||{}).id;
  const active=store.chatChannel(ui.chat.channel);
  if(active){ ui.chat.seen=ui.chat.seen||{}; ui.chat.seen[active.id]=Date.now(); }
  let mainHTML;
  if(ui.chat.newGroup){
    mainHTML=`<div class="chat-th-h"><span class="chat-th-t">New group</span></div><div class="chat-newg-body"><input id="chatGroupName" class="chat-gn" placeholder="Group name (e.g. Release Squad)"/><div class="chat-gn-l">Add members</div><div class="chat-members">${store.users().map(u=>`<label class="chat-mem"><input type="checkbox" value="${u.id}" ${u.id===me?'checked disabled':''}/>${avatar(u,26)}<span>${chatEsc(u.name)}</span></label>`).join('')}</div><div class="chat-newg-act"><button class="btn" id="chatGroupCancel">Cancel</button><button class="btn primary" id="chatGroupCreate">Create group</button></div></div>`;
  } else if(active){
    const msgs=store.chatMessages(active.id);
    const rows=msgs.map(m=>{ const u=store.user(m.user); const mine=m.user===me;
      if(ui.chat.editing===m.id) return `<div class="cmsg ${mine?'mine':''}" data-mid="${m.id}"><div class="cmsg-col"><textarea class="cmsg-editbox">${chatEsc(m.text)}</textarea><div class="cmsg-editact"><button class="btn primary" data-act="save">Save</button><button class="btn" data-act="cancel">Cancel</button></div></div></div>`;
      return `<div class="cmsg ${mine?'mine':''}" data-mid="${m.id}">${mine?'':avatar(u,28)}<div class="cmsg-col">${mine?'':`<div class="cmsg-nm">${chatEsc(u?u.name:'—')}</div>`}<div class="cmsg-bubble">${m.text?`<div class="cmsg-tx">${renderMentions(m.text)}</div>`:''}${chatAttHTML(m.attachment)}<div class="cmsg-meta">${chatTime(m.at)}${m.edited?' · edited':''}</div></div>${mine?`<div class="cmsg-acts"><button data-act="edit" title="Edit">Edit</button><button data-act="del" title="Delete">Delete</button></div>`:''}</div></div>`;
    }).join('')||'<div class="chat-empty">No messages yet. Say hello 👋</div>';
    const pend=ui.chat.pending?`<div class="chat-pending">${(ui.chat.pending.type||'').startsWith('image/')?`<img src="${ui.chat.pending.dataUrl}"/>`:`<span class="chat-pending-ic">${chatFileIcon()}</span>`}<span class="chat-pending-nm">${chatEsc(ui.chat.pending.name)}</span><button class="chat-pending-x" id="chatPendingX" title="Remove">✕</button></div>`:'';
    mainHTML=`<div class="chat-th-h"><span class="chat-th-ic">${active.type==='dm'?avatar(store.user(active.members.find(x=>x!==me)),26):chatGroupIcon()}</span><span class="chat-th-t">${chatEsc(active.name)}</span><span class="chat-th-sub">${active.type==='dm'?'Direct message':active.members.length+' members'}</span></div><div class="chat-msgs" id="chatMsgs">${rows}</div><div class="chat-mention" id="chatMention"></div>${pend}<div class="chat-compose"><button class="chat-attach" id="chatAttach" title="Attach file or image"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></button><input type="file" id="chatFile" hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"/><textarea id="chatInput" placeholder="Type a message…  @ to mention" rows="1"></textarea><button class="chat-send" id="chatSend" title="Send"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button></div>`;
  } else mainHTML='<div class="chat-empty">Select a conversation</div>';
  win.innerHTML=`<div class="chat-hd"><span class="chat-hd-t">Tech-Talk</span><div class="chat-hd-r"><button class="chat-ic" id="chatNew" title="New group"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg></button><button class="chat-ic" id="chatMin" title="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div></div><div class="chat-body"><div class="chat-rail"><div class="chat-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input id="chatSearch" placeholder="Search people or chats" autocomplete="off" value="${chatEsc(ui.chat.search||'')}"/></div><div class="chat-rail-scroll" id="chatRailList"></div></div><div class="chat-thread">${mainHTML}</div></div>`;
  renderChatRailList();
  document.getElementById('chatMin').onclick=closeChat;
  document.getElementById('chatNew').onclick=()=>{ ui.chat.newGroup=true; renderChat(); };
  const si=document.getElementById('chatSearch'); if(si){ si.oninput=()=>{ ui.chat.search=si.value; renderChatRailList(); }; }
  const gc=document.getElementById('chatGroupCreate'); if(gc) gc.onclick=()=>{ const nm=(document.getElementById('chatGroupName').value||'').trim()||'New group'; const mem=[...win.querySelectorAll('.chat-mem input:checked')].map(i=>i.value); const id=store.createChannel(nm, mem, 'group'); ui.chat.newGroup=false; ui.chat.channel=id; renderChat(); };
  const gcx=document.getElementById('chatGroupCancel'); if(gcx) gcx.onclick=()=>{ ui.chat.newGroup=false; renderChat(); };
  const att=document.getElementById('chatAttach'); if(att){ att.onclick=()=>document.getElementById('chatFile').click();
    document.getElementById('chatFile').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; if(!f) return; if(f.size>3*1024*1024){ toast('Max file size is 3 MB'); return; } const r=new FileReader(); r.onload=()=>{ ui.chat.pending={name:f.name,type:f.type,dataUrl:r.result,size:f.size}; renderChat(); setTimeout(()=>{const i=document.getElementById('chatInput'); if(i) i.focus();},0); }; r.readAsDataURL(f); }; }
  const px=document.getElementById('chatPendingX'); if(px) px.onclick=()=>{ ui.chat.pending=null; renderChat(); };
  const input=document.getElementById('chatInput');
  if(input){ const send=()=>{ const v=input.value.trim(); const a=ui.chat.pending; if(!v && !a) return; store.sendChatMessage(ui.chat.channel, me, v, a); input.value=''; ui.chat.pending=null; renderChat(); chatScrollBottom(); updateChatFab(); };
    document.getElementById('chatSend').onclick=send;
    input.onkeydown=e=>{ const pop=document.getElementById('chatMention'); if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); if(pop&&pop.classList.contains('on')){ const first=pop.querySelector('.cm-opt'); if(first){ first.click(); return; } } send(); } };
    input.oninput=()=>{ const pop=document.getElementById('chatMention'); const pos=input.selectionStart; const upto=input.value.slice(0,pos); const mm=upto.match(/@([\w ]*)$/);
      if(mm && active){ const qq=mm[1].toLowerCase().trim(); const cands=(active.members||[]).map(id=>store.user(id)).filter(u=>u&&u.name.toLowerCase().includes(qq)).slice(0,6);
        if(cands.length){ pop.innerHTML=cands.map(u=>`<div class="cm-opt" data-nm="${chatEsc(u.name)}">${avatar(u,22)}<span>${chatEsc(u.name)}</span></div>`).join(''); pop.classList.add('on');
          pop.querySelectorAll('.cm-opt').forEach(o=>o.onclick=()=>{ const nm=o.dataset.nm; const nu=upto.replace(/@([\w ]*)$/,'@'+nm+' '); input.value=nu+input.value.slice(pos); pop.classList.remove('on'); input.focus(); }); }
        else pop.classList.remove('on'); } else pop.classList.remove('on'); };
    setTimeout(()=>input.focus(),0);
  }
  win.querySelectorAll('.cmsg').forEach(row=>{ const mid=row.dataset.mid; row.querySelectorAll('[data-act]').forEach(btn=>btn.onclick=()=>{ const a=btn.dataset.act;
    if(a==='del'){ confirmDelete({ title:'Delete message', lead:'Delete this message for everyone in the chat?',
        confirmLabel:'Delete message', onConfirm:()=>{ store.deleteChatMessage(mid); renderChat(); } }); }
    else if(a==='edit'){ ui.chat.editing=mid; renderChat(); }
    else if(a==='cancel'){ ui.chat.editing=null; renderChat(); }
    else if(a==='save'){ const tx=row.querySelector('.cmsg-editbox').value.trim(); if(tx) store.editChatMessage(mid, tx); ui.chat.editing=null; renderChat(); } }); });
  chatScrollBottom();
}
function wireChat(){ const fab=document.getElementById('chatFab'); if(fab) fab.onclick=()=>{ ui.chat.open?closeChat():openChat(); };
  const nt=document.getElementById('navTechTalk'); if(nt) nt.onclick=()=>{ ui.chat.open?closeChat():openChat(); };
  setTimeout(()=>{renderChatFab();updateChatFab();}, 400); }
