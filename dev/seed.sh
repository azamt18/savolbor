#!/usr/bin/env bash
# dev/seed.sh — fill a running savolbor with sample questions to see the ui.
#
#   ./savolbor -data /tmp/savolbor-demo.jsonl -no-open     # a throwaway log
#   dev/seed.sh                                            # or: dev/seed.sh 9000
#
# goes through the real api (several "phones" = several cookie jars), so
# times are current. run it on a LAN server (it relies on localhost being the
# presenter) and not on your real workshop log.
set -euo pipefail

PORT="${1:-8080}"
BASE="http://localhost:$PORT"
JARS="$(mktemp -d)"
trap 'rm -rf "$JARS"' EXIT

json() { printf '{"text":"%s","name":"%s"}' "$1" "$2"; }

# ask <jar> <name> <text> → prints the question id
ask() {
  curl -fsS -b "$JARS/$1" -c "$JARS/$1" -X POST "$BASE/api/questions" \
    -H 'content-type: application/json' -d "$(json "$3" "$2")" | sed -E 's/.*"id":"([^"]+)".*/\1/'
}

# vote <id> <count> — that many different phones upvote
vote() {
  local i
  for ((i = 1; i <= $2; i++)); do
    curl -fsS -b "$JARS/voter$i" -c "$JARS/voter$i" -X POST "$BASE/api/questions/$1/vote" >/dev/null
  done
}

host() { curl -fsS -X POST "$BASE/api/host/$1" -H 'content-type: application/json' -d "$2" >/dev/null; }

curl -fsS "$BASE/api/view" >/dev/null || { echo "no savolbor on $BASE" >&2; exit 1; }

host title '{"title":"Agentlar haqida workshop"}'

q=$(ask ali Ali "Agent va oddiy chatbot orasidagi farq nima?");          vote "$q" 6
q=$(ask madina Madina "Agentlar xotirani qanday saqlaydi?");              vote "$q" 5
q=$(ask jasur Jasur "Ishlab chiqarishda agentni qanday sinab koʻramiz?"); vote "$q" 4
q=$(ask anon "" "Qaysi model arzonroq va yetarlicha yaxshi?");            vote "$q" 3
q=$(ask dilnoza Dilnoza "Agent xato qilsa, kim javobgar?");               vote "$q" 2
q=$(ask sardor Sardor "Oʻzbek tilida yaxshi ishlaydimi?");                vote "$q" 2
q=$(ask nigora Nigora "Slaydlarni qayerdan olsak boʻladi?");              vote "$q" 1
q=$(ask bobur "" "Kodni koʻrsatib berasizmi?")

done_q=$(ask ali Ali "Dastur bepulmi?"); vote "$done_q" 3
host "questions/$done_q/answered" '{"on":true}'

spam=$(ask anon "" "test test")
host "questions/$spam/hidden" '{"on":true}'

echo "seeded $BASE: 8 open, 1 answered, 1 hidden"
