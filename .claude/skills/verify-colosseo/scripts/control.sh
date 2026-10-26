#!/usr/bin/env bash
# Drives Overwatch Stats Colosseo for verification: a private Vite dev server
# plus a private tab in Orca's built-in browser. See ../SKILL.md.
set -euo pipefail

ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
RUNS="$ROOT/.verify-runs"
TITLE='Overwatch Stats Colosseo'

die() { echo "control.sh: $*" >&2; exit 1; }

# The run to act on: $VERIFY_RUN_ID, else the last one launched.
run_dir() {
  local id=${VERIFY_RUN_ID:-$(cat "$RUNS/latest" 2>/dev/null || true)}
  [[ -n $id && -d $RUNS/$id ]] || die "no run found; start one with: control.sh launch"
  echo "$RUNS/$id"
}

load_state() {
  local dir; dir=$(run_dir)
  [[ -f $dir/state.env ]] || die "run $(basename "$dir") was cleaned up; start another with: control.sh launch"
  # shellcheck disable=SC1091
  source "$dir/state.env"
}

log_action() { echo "$(date '+%H:%M:%S') $*" >> "$EVIDENCE/actions.log"; }

o() { orca "$@" --page "$PAGE" --json; }

cmd_launch() {
  command -v orca >/dev/null || die "the orca CLI is not on PATH; this skill needs Orca's built-in browser"
  [[ -d $ROOT/node_modules ]] || (cd "$ROOT" && npm ci)

  # Ports get reused once a run is cleaned up, so launch also empties the origin's storage below.
  local port
  for port in $(seq 5300 5399); do
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || break
  done
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && die "no free port in 5300-5399"

  local id; id=$(date +%Y%m%d-%H%M%S)-$port
  local dir=$RUNS/$id
  mkdir -p "$dir/evidence"
  echo "$id" > "$RUNS/latest"

  # exec, so the recorded pid is Vite itself and cleanup can't orphan it.
  (cd "$ROOT" && exec nohup node node_modules/vite/bin/vite.js --port "$port" --strictPort > "$dir/vite.log" 2>&1) &
  local pid=$!
  echo "$pid" > "$dir/vite.pid"
  local url=http://localhost:$port
  for _ in $(seq 1 60); do
    curl -s "$url/" | grep -q "<title>$TITLE</title>" && break
    kill -0 "$pid" 2>/dev/null || die "vite exited; see $dir/vite.log"
    sleep 0.5
  done
  curl -s "$url/" | grep -q "<title>$TITLE</title>" || die "vite never served the app; see $dir/vite.log"

  local page
  page=$(orca tab create --url "$url/" --json | jq -r '.result.browserPageId // empty')
  [[ -n $page ]] || die "orca could not open a tab"
  cat > "$dir/state.env" <<EOF
RUN_ID=$id
PORT=$port
URL=$url
VITE_PID=$pid
PAGE=$page
EVIDENCE=$dir/evidence
EOF
  # Usable means React rendered the top bar, not just that Vite answered.
  orca wait --page "$page" --fn "!!document.querySelector('.add-player')" --timeout 20000 --json >/dev/null \
    || die "the app did not render in the tab"
  # Baseline: no Recent Players left over from an earlier run on this port.
  orca eval --page "$page" --expression "localStorage.clear(), localStorage.length" --json \
    | jq -e '.result.result | tostring == "0"' >/dev/null || die "could not empty localStorage for $url"
  cat "$dir/state.env"
  echo "READY $url (run $id, page $page)"
}

cmd_doctor() {
  load_state
  local ok=1
  check() { if eval "$2" >/dev/null 2>&1; then echo "ok    $1"; else echo "FAIL  $1"; ok=0; fi; }
  check "vite process $VITE_PID is alive" "kill -0 $VITE_PID"
  check "port $PORT is owned by vite $VITE_PID" "lsof -nP -a -p $VITE_PID -iTCP:$PORT -sTCP:LISTEN"
  check "$URL serves the app" "curl -s $URL/ | grep -q '<title>$TITLE</title>'"
  check "orca tab $PAGE is open" "orca tab list --json | jq -e '.result.tabs[] | select(.browserPageId == \"$PAGE\")'"
  check "tab is on $URL" "orca tab list --json | jq -e '.result.tabs[] | select(.browserPageId == \"$PAGE\") | .url | startswith(\"$URL\")'"
  check "OverFast answers" "curl -sf -o /dev/null https://overfast-api.tekrop.fr/heroes"
  [[ $ok == 1 ]] && echo "HEALTHY run $RUN_ID" || { echo "UNHEALTHY run $RUN_ID"; exit 1; }
}

# goto <path-and-query>: opens a page of this run's app, e.g. goto '/?players=Jingwen-11594'
cmd_goto() {
  load_state
  log_action "goto $1"
  o goto --url "$URL$1" | jq -e '.ok' >/dev/null
}

# ref <literal text>: the ref of the first snapshot line containing the text, e.g. ref 'button "Change Jingwen#11594"'
cmd_ref() {
  load_state
  o snapshot | jq -r '.result.snapshot' | grep -F -- "$1" | head -1 | grep -o 'ref=e[0-9]*' | cut -d= -f2 \
    | grep . || die "nothing in the snapshot matches: $1"
}

# click <literal text>: clicks the matching element with the mouse.
cmd_click() {
  load_state
  local ref; ref=$(cmd_ref "$1")
  log_action "click $1 ($ref)"
  o click --element "$ref" | jq -e '.ok' >/dev/null
}

# press <literal text>: focuses the matching element and presses Enter.
cmd_press() {
  load_state
  local ref; ref=$(cmd_ref "$1")
  log_action "press $1 ($ref)"
  o focus --element "$ref" | jq -e '.ok' >/dev/null
  o keypress --key Enter | jq -e '.ok' >/dev/null
}

# type <literal text> <value>: fills the matching input and presses Enter.
cmd_type() {
  load_state
  local ref; ref=$(cmd_ref "$1")
  log_action "type $1 ($ref) <- $2"
  o fill --element "$ref" --value "$2" | jq -e '.ok' >/dev/null
  o keypress --key Enter | jq -e '.ok' >/dev/null
}

# wait <js expression>: waits up to 20s for the expression to be true in the page.
cmd_wait() {
  load_state
  o wait --fn "$1" --timeout 20000 | jq -e '.ok' >/dev/null || die "timed out waiting for: $1"
}

# js <js expression>: prints the expression's value from the page.
cmd_js() {
  load_state
  o eval --expression "$1" | jq -r '.result.result'
}

# snap <name>: saves the accessibility snapshot as evidence/<name>.aria.txt
cmd_snap() {
  load_state
  o snapshot | jq -r '.result.snapshot' > "$EVIDENCE/$1.aria.txt"
  log_action "snap $1"
  echo "$EVIDENCE/$1.aria.txt"
}

# shot <name>: saves a viewport screenshot as evidence/<name>.png
cmd_shot() {
  load_state
  o screenshot | jq -r '.result.data' | base64 -d > "$EVIDENCE/$1.png"
  log_action "shot $1"
  echo "$EVIDENCE/$1.png"
}

# orca <command> [args]: any other orca browser command, aimed at this run's tab.
cmd_orca() {
  load_state
  log_action "orca $*"
  o "$@"
}

# Stops only what this run started. Evidence stays in .verify-runs/<run>/evidence.
cmd_cleanup() {
  load_state
  local dir; dir=$(run_dir)
  orca tab close --page "$PAGE" --json >/dev/null 2>&1 || echo "tab $PAGE was already closed"
  if kill -0 "$VITE_PID" 2>/dev/null; then kill "$VITE_PID"; fi
  rm -f "$dir/state.env" "$dir/vite.pid"
  [[ $(cat "$RUNS/latest" 2>/dev/null) == "$RUN_ID" ]] && rm -f "$RUNS/latest"
  echo "CLEANED run $RUN_ID; evidence kept in $EVIDENCE"
}

case ${1:-} in
  launch | doctor | goto | ref | click | press | type | wait | js | snap | shot | orca | cleanup)
    cmd=$1; shift; "cmd_$cmd" "$@" ;;
  *) sed -n '2,3p' "$0"; echo "usage: control.sh launch|doctor|goto|ref|click|press|type|wait|js|snap|shot|orca|cleanup"; exit 2 ;;
esac
