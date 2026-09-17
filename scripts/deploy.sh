#!/usr/bin/env bash
# =============================================================================
# Taskora — deploy
#
#   ./scripts/deploy.sh check          run the pre-flight checks, ship nothing
#   ./scripts/deploy.sh db             apply database migrations
#   ./scripts/deploy.sh functions      deploy the admin-users Edge Function
#   ./scripts/deploy.sh web            publish the web app
#   ./scripts/deploy.sh all            db + functions + web
#
#   --yes    skip the "publish to production?" prompt
#
# First time? Run  bash scripts/setup.sh  instead — it writes the config and
# runs these steps for you.
#   --push   commit and push to GitHub afterwards
#
# Settings come from scripts/deploy.env (copy scripts/deploy.env.example).
# Every command runs the pre-flight checks first and stops if any fail.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

if [[ -t 1 ]]; then B=$'\e[1m'; G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; N=$'\e[0m'; else B=; G=; R=; Y=; N=; fi
ok()   { echo "  ${G}ok${N}    $1"; }
warn() { echo "  ${Y}warn${N}  $1"; }
bad()  { echo "  ${R}fail${N}  $1"; FAIL=1; }
say()  { echo; echo "${B}$1${N}"; }
die()  { echo "${R}$1${N}" >&2; exit 1; }

usage() { sed -n '3,17p' "$0" | sed 's/^# \{0,1\}//'; }

# ---------------------------------------------------------------- arguments ----
MODE=""; YES=0; PUSH=0
for arg in "$@"; do
  case "$arg" in
    check|db|functions|web|all) MODE="$arg" ;;
    --yes|-y) YES=1 ;;
    --push)   PUSH=1 ;;
    -h|--help|help) usage; exit 0 ;;
    *) usage; die "Unknown argument: $arg" ;;
  esac
done
[[ -n "$MODE" ]] || { usage; exit 1; }

[[ -f scripts/deploy.env ]] && { set -a; source scripts/deploy.env; set +a; }
TASKORA_WEB_TARGET="${TASKORA_WEB_TARGET:-none}"
SUPABASE=(npx -y supabase@latest)

# --------------------------------------------------------------- pre-flight ----
FAIL=0
say "Pre-flight"

[[ -f app.html && -f index.html ]] || die "app.html / index.html not found — run this from the Taskora repo."

# 1. config.js exists and holds a browser-safe key
URL=""; KEY=""
if [[ -f config.js ]]; then
  URL="$(sed -n 's/.*supabaseUrl:[[:space:]]*"\([^"]*\)".*/\1/p' config.js | sed -n 1p)"
  KEY="$(sed -n 's/.*supabaseKey:[[:space:]]*"\([^"]*\)".*/\1/p' config.js | sed -n 1p)"
  if [[ -z "$URL" || -z "$KEY" ]]; then
    warn "config.js has no Supabase keys yet — guest sign-in works, email sign-in is off"
  elif [[ "$KEY" == sb_secret_* ]]; then
    bad "config.js holds a SECRET key. Use the publishable key (sb_publishable_…)."
  elif [[ "$KEY" == eyJ* ]] && command -v node >/dev/null 2>&1 &&
       [[ "$(node -e 'try{const p=JSON.parse(Buffer.from(process.argv[1].split(".")[1],"base64url"));console.log(p.role||"")}catch(e){}' "$KEY")" == "service_role" ]]; then
    bad "config.js holds the service_role key. Use the anon / publishable key."
  else
    ok "config.js points at $URL"
  fi
else
  bad "config.js is missing — copy config.example.js to config.js"
fi

# 2. project ref matches the URL
if [[ -n "${TASKORA_PROJECT_REF:-}" && -n "$URL" ]]; then
  if [[ "$URL" == "https://${TASKORA_PROJECT_REF}.supabase.co" ]]; then
    ok "project ref matches config.js"
  else
    bad "TASKORA_PROJECT_REF ($TASKORA_PROJECT_REF) doesn't match config.js ($URL)"
  fi
elif [[ "$MODE" == db || "$MODE" == functions || "$MODE" == all ]]; then
  bad "TASKORA_PROJECT_REF is not set in scripts/deploy.env"
fi

# 3. Windows line endings break shell scripts and are a sign of a bad paste
crlf="$(grep -rlI $'\r' index.html app.html config.js js css scripts supabase --include='*.html' --include='*.js' --include='*.css' --include='*.ts' \
        --include='*.sql' --include='*.sh' --include='*.toml' 2>/dev/null || true)"
if [[ -n "$crlf" ]]; then
  bad "Windows line endings in:"; echo "$crlf" | sed 's/^/          /'
  echo "          fix with: sed -i.bak \$'s/\\r\$//' <file>"
else ok "line endings"; fi

# 4. JavaScript parses
if command -v node >/dev/null 2>&1; then
  if node -e '
    const fs=require("fs"), vm=require("vm");
    const files=["config.js"].concat(fs.readdirSync("js").filter(f=>f.endsWith(".js")).map(f=>"js/"+f));
    files.forEach(f=>{ if(fs.existsSync(f)) new vm.Script(fs.readFileSync(f,"utf8"),{filename:f}); });
    const app=fs.readFileSync("app.html","utf8");
    [...app.matchAll(/<script src="(js\/[^"?]+)/g)].forEach(m=>{ if(!fs.existsSync(m[1])) throw new Error("app.html loads a missing file: "+m[1]); });
  ' 2>/tmp/taskora-js.err; then ok "javascript parses and every script app.html loads exists"
  else bad "javascript syntax error:"; sed 's/^/          /' /tmp/taskora-js.err | head -8; fi
else warn "node not found — skipped the JavaScript syntax check"; fi

# 5. nothing secret is tracked by git
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  leak="$(git ls-files | grep -E '(^|/)(deploy\.env|\.env(\..*)?|[^/]*\.pem)$|^backups/' || true)"
  if [[ -n "$leak" ]]; then bad "these must not be committed:"; echo "$leak" | sed 's/^/          /'
  else ok "no secrets tracked by git"; fi
  if git grep -nIE 'sb_secret_[A-Za-z0-9_-]{10,}|service_role"?[[:space:]]*[:=][[:space:]]*"eyJ' -- . ':!scripts/deploy.sh' >/tmp/taskora-grep.txt 2>/dev/null; then
    bad "a secret key appears in tracked files:"; sed 's/^/          /' /tmp/taskora-grep.txt | head -5
  fi
fi

# 6. public sign-ups must be OFF — the first account becomes owner, and every
#    account can read the workspace
if [[ -n "$URL" && -n "$KEY" ]] && command -v curl >/dev/null 2>&1; then
  settings="$(curl -fsS --max-time 10 "$URL/auth/v1/settings" -H "apikey: $KEY" 2>/dev/null || true)"
  if [[ -z "$settings" ]]; then
    warn "couldn't reach $URL/auth/v1/settings to confirm sign-ups are disabled"
  elif echo "$settings" | grep -Eq '"disable_signup"[[:space:]]*:[[:space:]]*true'; then
    ok "public sign-ups are disabled"
  else
    bad "public sign-ups are ENABLED. Supabase → Authentication → Sign In / Providers → turn off \"Allow new users to sign up\""
  fi
fi

# 7. required files
for f in supabase/migrations supabase/functions/admin-users/index.ts assets/taskora-logo.png js css; do
  [[ -e "$f" ]] || bad "missing $f"
done
[[ $FAIL -eq 0 ]] && ok "required files present"

if [[ $FAIL -ne 0 ]]; then echo; die "Pre-flight failed — nothing was deployed."; fi
echo; echo "${G}${B}Pre-flight passed${N}"
[[ "$MODE" == check ]] && exit 0

# ------------------------------------------------------------------ helpers ----
link_project() {
  say "Linking Supabase project $TASKORA_PROJECT_REF"
  if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
    "${SUPABASE[@]}" link --project-ref "$TASKORA_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
  else
    "${SUPABASE[@]}" link --project-ref "$TASKORA_PROJECT_REF"
  fi
}

deploy_db() {
  link_project
  say "Database migrations"
  "${SUPABASE[@]}" migration list || true
  if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
    "${SUPABASE[@]}" db push --password "$SUPABASE_DB_PASSWORD"
  else
    "${SUPABASE[@]}" db push
  fi
  ok "migrations applied"
}

deploy_functions() {
  say "Edge Functions"
  local log; log="$(mktemp)"
  if ! "${SUPABASE[@]}" functions deploy admin-users --project-ref "$TASKORA_PROJECT_REF" --no-verify-jwt 2>&1 | tee "$log"; then
    if grep -qi 'docker' "$log"; then
      warn "Docker isn't available — retrying with server-side bundling"
      "${SUPABASE[@]}" functions deploy admin-users --project-ref "$TASKORA_PROJECT_REF" --no-verify-jwt --use-api
    else
      rm -f "$log"; die "Function deploy failed (see the output above)."
    fi
  fi
  rm -f "$log"
  ok "admin-users deployed"
}

build_web() {
  DIST="$ROOT/dist"
  rm -rf "$DIST"; mkdir -p "$DIST"
  cp index.html app.html config.js "$DIST"/
  cp -R assets css js "$DIST"/
  echo "  built dist/ ($(find "$DIST" -type f | wc -l | tr -d ' ') files)"
}

confirm() {
  [[ $YES -eq 1 ]] && return 0
  read -r -p "$1 [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || die "Cancelled."
}

deploy_web() {
  say "Web app → $TASKORA_WEB_TARGET"
  build_web
  case "$TASKORA_WEB_TARGET" in
    ec2)
      [[ -n "${TASKORA_SSH_HOST:-}" && -n "${TASKORA_REMOTE_DIR:-}" ]] || die "Set TASKORA_SSH_HOST and TASKORA_REMOTE_DIR in scripts/deploy.env"
      local key="${TASKORA_SSH_KEY:-scripts/keypair.pem}"
      [[ -f "$key" ]] || die "SSH key not found: $key"
      chmod 400 "$key"
      confirm "Publish dist/ to ${TASKORA_SSH_HOST}:${TASKORA_REMOTE_DIR}?"
      local ssh_cmd="ssh -i $key -o StrictHostKeyChecking=accept-new"
      $ssh_cmd "$TASKORA_SSH_HOST" "mkdir -p '$TASKORA_REMOTE_DIR'"
      rsync -az --delete -e "$ssh_cmd" "$DIST"/ "$TASKORA_SSH_HOST:$TASKORA_REMOTE_DIR"/
      ok "uploaded to $TASKORA_REMOTE_DIR"
      if [[ -n "${TASKORA_POST_DEPLOY_CMD:-}" ]]; then
        $ssh_cmd -t "$TASKORA_SSH_HOST" "$TASKORA_POST_DEPLOY_CMD"
        ok "ran post-deploy command"
      fi
      ;;
    dir)
      [[ -n "${TASKORA_WEB_DIR:-}" ]] || die "Set TASKORA_WEB_DIR in scripts/deploy.env"
      confirm "Copy dist/ into $TASKORA_WEB_DIR?"
      mkdir -p "$TASKORA_WEB_DIR"
      rsync -a --delete "$DIST"/ "$TASKORA_WEB_DIR"/
      ok "copied to $TASKORA_WEB_DIR"
      ;;
    github-pages)
      local origin slug tmp
      origin="$(git remote get-url origin 2>/dev/null || true)"
      [[ -n "$origin" ]] || die "No git remote 'origin'. Create the GitHub repo first (scripts/setup.sh does this)."
      slug="$(echo "$origin" | sed -E 's#^(https://[^/]+/|git@[^:]+:)##; s#\.git$##')"
      confirm "Publish dist/ to GitHub Pages for $slug (branch gh-pages)?"
      tmp="$(mktemp -d)"
      cp -R "$DIST"/. "$tmp"/ && touch "$tmp/.nojekyll"
      (
        cd "$tmp"
        git init -q && git checkout -q -b gh-pages
        git add -A && git -c user.name="taskora-deploy" -c user.email="deploy@taskora.local" commit -qm "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
        git push -qf "$origin" gh-pages
      )
      rm -rf "$tmp"
      ok "pushed to the gh-pages branch"
      if command -v gh >/dev/null 2>&1; then
        gh api -X POST "repos/$slug/pages" -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null 2>&1 \
          || gh api -X PUT "repos/$slug/pages" -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null 2>&1 \
          || warn "Turn on Pages yourself: GitHub → $slug → Settings → Pages → Branch: gh-pages"
      fi
      local owner="${slug%%/*}" repo="${slug#*/}"
      owner="$(echo "$owner" | tr '[:upper:]' '[:lower:]')"
      ok "site: https://${owner}.github.io/${repo}/  (first publish can take a minute or two)"
      ;;
    netlify)
      confirm "Publish dist/ to Netlify (production)?"
      if [[ -n "${TASKORA_NETLIFY_SITE:-}" ]]; then
        npx -y netlify-cli deploy --dir "$DIST" --prod --site "$TASKORA_NETLIFY_SITE"
      else
        npx -y netlify-cli deploy --dir "$DIST" --prod
      fi
      ok "published to Netlify"
      ;;
    none)
      ok "dist/ is ready — upload it to any static host"
      ;;
    *) die "TASKORA_WEB_TARGET must be github-pages, netlify, ec2, dir or none (got: $TASKORA_WEB_TARGET)" ;;
  esac
}

# --------------------------------------------------------------------- run ----
case "$MODE" in
  db)        deploy_db ;;
  functions) deploy_functions ;;
  web)       deploy_web ;;
  all)       deploy_db; deploy_functions; deploy_web ;;
esac

if [[ $PUSH -eq 1 ]]; then
  say "Git"
  if [[ -z "$(git status --porcelain)" ]]; then
    ok "nothing to commit"
  else
    git add -A
    read -r -p "Commit message: " msg
    git commit -m "${msg:-deploy}"
  fi
  git push origin "$(git rev-parse --abbrev-ref HEAD)"
  ok "pushed"
fi

echo; echo "${G}${B}Done.${N}"
