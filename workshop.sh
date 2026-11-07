#!/usr/bin/env bash
# workshop.sh — build savolbor and start it for a session.
#
#   ./workshop.sh            lan only (phones on the same wi-fi)
#   ./workshop.sh --public   also open a cloudflare quick tunnel and use its url
#
# ctrl+c stops savolbor and the tunnel. today's questions stay in
# ~/savolbor-YYYY-MM-DD.jsonl, so running it again the same day restores them.
set -euo pipefail

cd "$(dirname "$0")"
PORT="${PORT:-8080}"
DATA="${DATA:-$HOME/savolbor-$(date +%F).jsonl}"
PUBLIC=0
[[ "${1:-}" == "--public" ]] && PUBLIC=1

# from a source checkout: build (the ui only when node is around, web/dist is
# committed). from a release zip (no go.mod): use the savolbor next to this script.
if [[ -f go.mod ]]; then
  if command -v npm >/dev/null; then
    echo "building ui…"
    npm --prefix ui ci --silent
    npm --prefix ui run build --silent >/dev/null
  fi
  echo "building savolbor…"
  go build -o savolbor .
fi
[[ -x ./savolbor ]] || { echo "savolbor not found next to workshop.sh" >&2; exit 1; }

# cloudflared: use the installed one, else download it next to this script
# (curl downloads are not quarantined by macos, so nothing to approve)
cloudflared_bin() {
  if command -v cloudflared >/dev/null; then command -v cloudflared; return; fi
  if [[ ! -x ./cloudflared ]]; then
    local arch; arch="$(uname -m)"; [[ $arch == x86_64 ]] && arch=amd64
    local base="https://github.com/cloudflare/cloudflared/releases/latest/download"
    echo "downloading cloudflared (once)…" >&2
    case "$(uname -s)" in
      Darwin) curl -fsSL "$base/cloudflared-darwin-$arch.tgz" | tar xz cloudflared ;;
      Linux)  curl -fsSL -o cloudflared "$base/cloudflared-linux-$arch" && chmod +x cloudflared ;;
      *) echo "install cloudflared first: https://github.com/cloudflare/cloudflared" >&2; return 1 ;;
    esac
  fi
  echo "$PWD/cloudflared"
}

if lsof -ti "tcp:$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port $PORT is busy — stop the old savolbor first: lsof -ti tcp:$PORT -sTCP:LISTEN | xargs kill" >&2
  exit 1
fi

args=(-port "$PORT" -data "$DATA")

if [[ $PUBLIC == 1 ]]; then
  cf="$(cloudflared_bin)" || exit 1
  log="$(mktemp -t savolbor-tunnel)"
  "$cf" tunnel --no-autoupdate --url "http://localhost:$PORT" >"$log" 2>&1 &
  tunnel=$!
  trap 'kill $tunnel 2>/dev/null; rm -f "$log"' EXIT
  echo "starting tunnel…"
  url=""
  for _ in $(seq 1 30); do
    url="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$log" | head -1 || true)"
    [[ -n "$url" ]] && break
    kill -0 $tunnel 2>/dev/null || { cat "$log" >&2; exit 1; }
    sleep 1
  done
  [[ -n "$url" ]] || { echo "tunnel gave no url after 30s:" >&2; cat "$log" >&2; exit 1; }
  echo "tunnel: $url"
  args+=(-public-url "$url")
fi

# not exec: the EXIT trap must still stop the tunnel when savolbor ends
./savolbor "${args[@]}"
