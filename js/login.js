/* Taskora — login page (index.html)
   Account holders sign in with email + password and continue to app.html.
   Guests continue to app.html?guest, where nothing is ever stored.
   Already signed in? You go straight to the app. */
(function(){
  const APP = 'app.html';
  const q = new URLSearchParams(location.search);
  if(q.has('guest')){ location.replace(APP + '?guest'); return; }

  const cfg = window.TASKORA_CONFIG || {};
  const url = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
  const key = String(cfg.supabaseKey || '');
  const configured = !!(url && key);
  let sb = null;
  if(configured && window.supabase){
    try{ sb = window.supabase.createClient(url, key, { auth:{ storageKey:'taskora-auth' } }); }catch(e){ sb = null; }
  }

  const $ = id => document.getElementById(id);
  const errEl = $('authErr'), okEl = $('authOk'), go = $('authGo');
  function showError(m){ okEl.classList.remove('on'); errEl.textContent = m; errEl.classList.add('on'); }
  function showNotice(m){ errEl.classList.remove('on'); okEl.textContent = m; okEl.classList.add('on'); }

  // a message handed over by the app (e.g. "This account is deactivated")
  // (if there is one, stay here even with a session — otherwise app ⇄ login could bounce)
  let handed = '';
  try{ handed = sessionStorage.getItem('taskora:authmsg') || ''; if(handed){ sessionStorage.removeItem('taskora:authmsg'); showError(handed); } }catch(e){}

  if(sb && !handed){
    sb.auth.getSession().then(({ data }) => { if(data && data.session) location.replace(APP + location.hash); }).catch(()=>{});
  } else if(configured && !sb){
    showError('Can’t reach the sign-in service. Check your connection and refresh, or sign in as a guest.');
  }

  let mode = 'signin';
  function setMode(next){
    mode = next;
    const reset = mode === 'reset';
    $('authTitle').textContent = reset ? 'Reset your password' : 'Sign in to Taskora';
    $('authSub').textContent = reset ? 'Enter your email and we’ll send you a link to choose a new password.' : 'Use the email and password your workspace admin gave you.';
    $('authPassRow').style.display = reset ? 'none' : '';
    $('authBack').style.display = reset ? '' : 'none';
    $('authGuestWrap').style.display = reset ? 'none' : '';
    go.textContent = reset ? 'Send reset link' : 'Sign in';
    errEl.classList.remove('on'); okEl.classList.remove('on');
  }

  async function submit(){
    errEl.classList.remove('on');
    const email = $('authEmail').value.trim(), pass = $('authPass').value;
    if(!email){ showError('Enter your email address.'); return; }
    if(!sb){ showError(configured ? 'Can’t reach the sign-in service right now. Check your connection, or sign in as a guest.' : 'Account sign-in isn’t switched on yet. Sign in as a guest to look around.'); return; }
    const label = go.textContent; go.disabled = true; go.textContent = 'Please wait…';
    try{
      if(mode === 'reset'){
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL(APP, location.href).href });
        if(error) throw error;
        showNotice('If that email belongs to an account, a reset link is on its way.');
        go.disabled = false; go.textContent = label; return;
      }
      if(!pass) throw new Error('Enter your password.');
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if(error) throw error;
      if(!data.session) throw new Error('Sign-in didn’t complete. Try again.');
      go.textContent = 'Opening Taskora…';
      location.replace(APP);
    }catch(e){
      const msg = (e && e.message) || 'Something went wrong.';
      showError(/invalid login credentials/i.test(msg) ? 'That email and password don’t match an active account.'
        : /banned/i.test(msg) ? 'This account is deactivated. Contact your workspace admin.' : msg);
      go.disabled = false; go.textContent = label;
    }
  }

  go.onclick = submit;
  ['authEmail', 'authPass'].forEach(id => $(id).addEventListener('keydown', e => { if(e.key === 'Enter') submit(); }));
  $('authForgot').onclick = () => { setMode('reset'); $('authEmail').focus(); };
  $('authBack').onclick = () => setMode('signin');
  $('authGuest').onclick = () => { location.href = APP + '?guest'; };
})();
