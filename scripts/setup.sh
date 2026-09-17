#!/usr/bin/env bash
# =============================================================================
# Taskora — guided setup and first deploy
#
#   bash scripts/setup.sh           full walkthrough
#   bash scripts/setup.sh --local   only write config + init git (no network)
#
# What it does, in order (every step can be skipped or re-run safely):
#   1. checks the tools you need
#   2. asks for your Supabase project URL, publishable key and DB password
#      and writes web/config.js + scripts/deploy.env (both git-ignored)
#   3. configures Supabase Auth: sign-ups off, redirect URLs
#   4. creates the database (migrations) and deploys the admin-users function
#   5. creates your owner account
#   6. creates the GitHub repo and pushes
#   7. publishes the web app (GitHub Pages, Netlify, EC2 or skip)
#
# Nothing secret is written to disk except the DB password in
# scripts/deploy.env, which is git-ignored. The secret API key and access token
# you may paste are used for this run only.
# Works with the bash that ships with macOS (3.2).
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
LOCAL_ONLY=0
# filled in by ask() via printf -v
SUPABASE_URL=""; SUPABASE_KEY=""; REF=""; PAT=""; db_pw=""; choice=""; h=""; k=""; d=""; c=""
OWNER_EMAIL=""; OWNER_FIRST=""; OWNER_LAST=""; OWNER_PW=""; SECRET_KEY=""; GH_OWNER=""; GH_REPO=""
[[ "${1:-}" == "--local" ]] && LOCAL_ONLY=1

if [[ -t 1 ]]; then B=$'\e[1m'; D=$'\e[2m'; G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; C=$'\e[36m'; N=$'\e[0m'; else B=; D=; G=; R=; Y=; C=; N=; fi
step() { echo; echo "${C}${B}── $1 ──${N}"; }
ok()   { echo "  ${G}✓${N} $1"; }
warn() { echo "  ${Y}!${N} $1"; }
bad()  { echo "  ${R}✗${N} $1"; }
note() { echo "  ${D}$1${N}"; }
die()  { echo; echo "${R}$1${N}" >&2; exit 1; }

# ask VAR "Question" "default" [secret]
ask() {
  local __var="$1" __q="$2" __def="${3:-}" __secret="${4:-}" __ans=""
  if [[ -n "$__secret" ]]; then
    read -r -s -p "  $__q: " __ans; echo
  else
    if [[ -n "$__def" ]]; then read -r -p "  $__q [$__def]: " __ans; else read -r -p "  $__q: " __ans; fi
  fi
  [[ -z "$__ans" ]] && __ans="$__def"
  printf -v "$__var" '%s' "$__ans"
}
yes_default() { local a; read -r -p "  $1 [Y/n] " a; [[ -z "$a" || "$a" =~ ^[Yy] ]]; }
no_default()  { local a; read -r -p "  $1 [y/N] " a; [[ "$a" =~ ^[Yy] ]]; }
pause()       { local a; read -r -p "  ${D}Press Enter when done…${N}" a; }

# read KEY=value from scripts/deploy.env without sourcing it
env_get() { [[ -f scripts/deploy.env ]] && sed -n "s/^$1=//p" scripts/deploy.env | tail -1 || true; }
# set KEY=value in scripts/deploy.env (creates the file from the example)
env_set() {
  local key="$1" val="$2" tmp
  [[ -f scripts/deploy.env ]] || cp scripts/deploy.env.example scripts/deploy.env
  tmp="$(mktemp)"
  if grep -q "^$key=" scripts/deploy.env; then
    awk -v k="$key" -v v="$val" 'BEGIN{FS=OFS="="} $1==k {print k"="v; next} {print}' scripts/deploy.env > "$tmp"
  else
    cat scripts/deploy.env > "$tmp"; echo "$key=$val" >> "$tmp"
  fi
  mv "$tmp" scripts/deploy.env; chmod 600 scripts/deploy.env
}

echo
echo "${B}Taskora setup${N}"
note "Project folder: $ROOT"

# ----------------------------------------------------------------- 1. tools ----
step "1/7  Checking tools"
missing=0
need() { if command -v "$1" >/dev/null 2>&1; then ok "$1"; else bad "$1 is missing — $2"; missing=1; fi; }
need git     "install Xcode command line tools: xcode-select --install"
need curl    "install curl"
need node    "install Node.js 18+: brew install node"
need npx     "comes with Node.js"
need python3 "install Python 3: brew install python"
if command -v node >/dev/null 2>&1; then
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [[ "$major" -ge 18 ]] || { bad "Node.js $major is too old — need 18+"; missing=1; }
fi
if command -v gh >/dev/null 2>&1; then ok "gh (GitHub CLI)"; else warn "gh not found — the GitHub step will print manual commands (brew install gh)"; fi
[[ $missing -eq 0 ]] || die "Install the missing tools and run this again."
chmod +x scripts/*.sh 2>/dev/null || true

# -------------------------------------------------------------- 2. config ----
step "2/7  Supabase project"
cur_url=""; cur_key=""
if [[ -f web/config.js ]]; then
  cur_url="$(sed -n 's/.*supabaseUrl:[[:space:]]*"\([^"]*\)".*/\1/p' web/config.js | sed -n 1p)"
  cur_key="$(sed -n 's/.*supabaseKey:[[:space:]]*"\([^"]*\)".*/\1/p' web/config.js | sed -n 1p)"
fi
if [[ -z "$cur_url" ]]; then
  note "No project yet? Create one at https://supabase.com/dashboard → New project"
  note "Name: taskora · Region: South Asia (Mumbai) or closest to your users · save the DB password"
  note "Then copy from Project Settings → API Keys: the Project URL and the publishable key."
fi

while :; do
  ask SUPABASE_URL "Project URL (https://<ref>.supabase.co)" "$cur_url"
  SUPABASE_URL="${SUPABASE_URL%/}"
  if [[ "$SUPABASE_URL" =~ ^https://([a-z0-9]{20})\.supabase\.co$ ]]; then REF="${BASH_REMATCH[1]}"; break; fi
  bad "That doesn't look like https://<20-character-ref>.supabase.co"
done
ok "project ref: $REF"

while :; do
  ask SUPABASE_KEY "Publishable key (sb_publishable_…) or legacy anon key" "$cur_key"
  if [[ -z "$SUPABASE_KEY" ]]; then bad "The key is required."; continue; fi
  if [[ "$SUPABASE_KEY" == sb_secret_* ]]; then bad "That's a SECRET key. Paste the publishable one."; continue; fi
  if [[ "$SUPABASE_KEY" == eyJ* ]]; then
    role="$(node -e 'try{console.log(JSON.parse(Buffer.from(process.argv[1].split(".")[1],"base64url")).role||"")}catch(e){}' "$SUPABASE_KEY")"
    [[ "$role" == "service_role" ]] && { bad "That's the service_role key. Paste the anon / publishable one."; continue; }
  fi
  break
done

cat > web/config.js <<EOF
/* Taskora — runtime config (git-ignored). Written by scripts/setup.sh. */
window.TASKORA_CONFIG = {
  supabaseUrl: "$SUPABASE_URL",
  supabaseKey: "$SUPABASE_KEY"
};
EOF
ok "wrote web/config.js"

env_set TASKORA_PROJECT_REF "$REF"
db_pw="$(env_get SUPABASE_DB_PASSWORD)"
if [[ -n "$db_pw" ]] && yes_default "Use the database password already saved in scripts/deploy.env?"; then :; else
  ask db_pw "Database password (from when you created the project)" "" secret
  [[ -n "$db_pw" ]] && env_set SUPABASE_DB_PASSWORD "$db_pw"
fi
ok "wrote scripts/deploy.env (git-ignored, readable only by you)"

# ----------------------------------------------------------------- git init ----
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init -q && git checkout -q -b main 2>/dev/null || true
  ok "initialised a git repository"
fi
if [[ -z "$(git log --oneline -1 2>/dev/null || true)" ]]; then
  git add -A
  git -c user.name="$(git config user.name || echo Taskora)" -c user.email="$(git config user.email || echo taskora@localhost)" \
    commit -qm "Taskora: project management with backlog, sprints and reports" && ok "created the first commit"
fi
leak="$(git ls-files | grep -E '^web/config\.js$|deploy\.env$|\.pem$' || true)"
[[ -z "$leak" ]] || die "These must not be tracked by git: $leak"

if [[ $LOCAL_ONLY -eq 1 ]]; then
  echo; ok "Local setup done. Run it again without --local to deploy."; exit 0
fi

# ------------------------------------------------------------------ 3. auth ----
step "3/7  Supabase Auth settings"
note "Taskora needs public sign-ups OFF: the first account becomes owner, and accounts are added by admins."
note "With a personal access token this is automatic: https://supabase.com/dashboard/account/tokens"
ask PAT "Personal access token (Enter to skip and do it in the dashboard)" "" secret
if [[ -n "$PAT" ]]; then export SUPABASE_ACCESS_TOKEN="$PAT"; fi

auth_patch() { # $1 = JSON body
  curl -fsS -X PATCH "https://api.supabase.com/v1/projects/$REF/config/auth" \
    -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" -d "$1" >/dev/null
}
signups_off() {
  curl -fsS --max-time 10 "$SUPABASE_URL/auth/v1/settings" -H "apikey: $SUPABASE_KEY" 2>/dev/null \
    | grep -Eq '"disable_signup"[[:space:]]*:[[:space:]]*true'
}
if [[ -n "$PAT" ]]; then
  if auth_patch '{"disable_signup":true,"site_url":"http://localhost:5500","uri_allow_list":"http://localhost:5500/**,http://127.0.0.1:5500/**","password_min_length":8}'; then
    ok "sign-ups disabled, password minimum 8, localhost allowed as a redirect"
  else
    warn "couldn't update Auth settings with that token — do it in the dashboard instead"; PAT=""
  fi
else
  note "Supabase → Authentication → Sign In / Providers → turn OFF \"Allow new users to sign up\""
  note "Supabase → Authentication → URL Configuration → Site URL: http://localhost:5500"
  pause
  npx -y supabase@latest login
fi
tries=0
until signups_off; do
  tries=$((tries+1))
  [[ $tries -ge 3 ]] && die "Sign-ups still look enabled. Turn them off, then run this script again."
  warn "Sign-ups still look enabled (settings can take a few seconds)."; pause
done
ok "public sign-ups are off"

# -------------------------------------------------------------- 4. backend ----
step "4/7  Database and Edge Function"
bash scripts/deploy.sh db --yes
bash scripts/deploy.sh functions --yes

# ---------------------------------------------------------------- 5. owner ----
step "5/7  Your owner account"
note "The first account created in this project becomes the owner."
if yes_default "Create it now?"; then
  ask OWNER_EMAIL "Your email" ""
  ask OWNER_FIRST "First name" ""
  ask OWNER_LAST  "Last name" ""
  while :; do
    ask OWNER_PW "Password (min 8 characters)" "" secret
    [[ ${#OWNER_PW} -ge 8 ]] && break; bad "At least 8 characters."
  done
  note "Creating a user needs the SECRET key once (Project Settings → API Keys). It isn't saved."
  ask SECRET_KEY "Secret key (sb_secret_…) or service_role key — Enter to use the dashboard instead" "" secret
  created=0
  if [[ -n "$SECRET_KEY" ]]; then
    body="$(node -e 'const [e,p,f,l]=process.argv.slice(1);console.log(JSON.stringify({email:e,password:p,email_confirm:true,user_metadata:{first_name:f,last_name:l,full_name:[f,l].filter(Boolean).join(" ")}}))' "$OWNER_EMAIL" "$OWNER_PW" "$OWNER_FIRST" "$OWNER_LAST")"
    if [[ "$SECRET_KEY" == eyJ* ]]; then auth=(-H "Authorization: Bearer $SECRET_KEY"); else auth=(); fi
    resp="$(curl -sS -w '\n%{http_code}' -X POST "$SUPABASE_URL/auth/v1/admin/users" -H "apikey: $SECRET_KEY" ${auth[@]+"${auth[@]}"} -H "Content-Type: application/json" -d "$body" || true)"
    code="$(echo "$resp" | tail -1)"
    if [[ "$code" == 200 || "$code" == 201 ]]; then ok "created $OWNER_EMAIL"; created=1
    else warn "couldn't create the user (HTTP $code): $(echo "$resp" | sed '$d' | head -c 200)"; fi
    unset SECRET_KEY
  fi
  if [[ $created -eq 0 ]]; then
    note "Supabase → Authentication → Users → Add user → Create new user"
    note "Email: $OWNER_EMAIL · your password · tick \"Auto Confirm User\""
    pause
  fi
  unset OWNER_PW
fi

# --------------------------------------------------------------- 6. github ----
step "6/7  GitHub repository"
if git remote get-url origin >/dev/null 2>&1; then
  ok "remote origin: $(git remote get-url origin)"
  git add -A; git commit -qm "Update Taskora" 2>/dev/null || true
  git push -q -u origin HEAD 2>/dev/null && ok "pushed" || warn "push failed — run: git push -u origin main"
elif command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh_user="$(gh api user -q .login 2>/dev/null || echo)"
  ask GH_OWNER "GitHub owner (your user or an organisation)" "$gh_user"
  ask GH_REPO  "Repository name" "taskora"
  vis="--public"; no_default "Make it private instead of public?" && vis="--private"
  gh repo create "$GH_OWNER/$GH_REPO" $vis --source . --remote origin --push \
    --description "Project management with boards, backlog, sprints and reports — vanilla JS on Supabase" \
    && ok "created https://github.com/$GH_OWNER/$GH_REPO" || warn "gh repo create failed — create it on github.com and push manually"
else
  warn "GitHub CLI isn't signed in. Either run: gh auth login   (then re-run this script)"
  note "or create an empty repo on github.com and run:"
  note "  git remote add origin https://github.com/<owner>/taskora.git && git push -u origin main"
fi

# ------------------------------------------------------------------ 7. web ----
step "7/7  Publish the web app"
echo "  1) GitHub Pages  — free, https://<owner>.github.io/<repo>/"
echo "  2) Netlify       — free tier, asks you to log in"
echo "  3) EC2 / server  — rsync over SSH"
echo "  4) Skip for now  — run it locally"
ask choice "Choose" "1"
SITE=""
case "$choice" in
  1)
    env_set TASKORA_WEB_TARGET github-pages
    if git remote get-url origin >/dev/null 2>&1; then
      bash scripts/deploy.sh web --yes
      slug="$(git remote get-url origin | sed -E 's#^(https://[^/]+/|git@[^:]+:)##; s#\.git$##')"
      SITE="https://$(echo "${slug%%/*}" | tr '[:upper:]' '[:lower:]').github.io/${slug#*/}/"
    else warn "No GitHub remote yet — skipped. Re-run after creating the repo."; fi ;;
  2)
    env_set TASKORA_WEB_TARGET netlify
    bash scripts/deploy.sh web --yes
    ask SITE "Your Netlify URL (shown above, e.g. https://taskora-xyz.netlify.app/)" "" ;;
  3)
    env_set TASKORA_WEB_TARGET ec2
    ask h "SSH host (user@host)" "$(env_get TASKORA_SSH_HOST)"; env_set TASKORA_SSH_HOST "$h"
    ask k "SSH key path" "$(env_get TASKORA_SSH_KEY)"; env_set TASKORA_SSH_KEY "${k:-scripts/keypair.pem}"
    ask d "Remote folder" "$(env_get TASKORA_REMOTE_DIR)"; env_set TASKORA_REMOTE_DIR "$d"
    ask c "Command to run after upload (optional)" "$(env_get TASKORA_POST_DEPLOY_CMD)"; env_set TASKORA_POST_DEPLOY_CMD "$c"
    bash scripts/deploy.sh web --yes
    ask SITE "Public URL of the site" "" ;;
  *) env_set TASKORA_WEB_TARGET none; note "Skipped." ;;
esac

if [[ -n "$SITE" ]]; then
  SITE="${SITE%/}/"
  if [[ -n "${PAT:-}" ]]; then
    auth_patch "{\"site_url\":\"$SITE\",\"uri_allow_list\":\"$SITE**,http://localhost:5500/**,http://127.0.0.1:5500/**\"}" \
      && ok "Auth Site URL set to $SITE" || warn "set Site URL to $SITE in Authentication → URL Configuration"
  else
    note "Set Authentication → URL Configuration → Site URL to $SITE (password-reset links return there)"
  fi
fi

# --------------------------------------------------------------- summary ----
echo
echo "${G}${B}Taskora is set up.${N}"
[[ -n "$SITE" ]] && echo "  Live:     $SITE"
echo "  Locally:  python3 -m http.server 5500 --directory web   →  http://localhost:5500"
echo "  Redeploy: ./scripts/deploy.sh web      (front end)"
echo "            ./scripts/deploy.sh all      (database + function + front end)"
echo
if no_default "Start the local server now?"; then
  echo "  Serving on http://localhost:5500 — Ctrl+C to stop"
  command -v open >/dev/null 2>&1 && (sleep 1; open "http://localhost:5500") &
  python3 -m http.server 5500 --directory web
fi
