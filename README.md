# savolbor

live q&a for workshops, lessons and seminars. participants send and upvote questions from their phones; the presenter sees, sorts and moderates them on the laptop and puts them on the projector. everything runs on the local network — **no internet needed**.

## build

```bash
go build -o savolbor .
```

one binary, the web pages are embedded. go 1.26. the built ui (`web/dist`) is committed, so this needs no node.

after changing the ui (`ui/`, react + typescript + vite), rebuild it and the binary — needs node 20+:

```bash
make build      # npm ci + vite build into web/dist, then go build
```

## quick start

```bash
./workshop.sh            # build + start, phones on the same wi-fi
./workshop.sh --public   # build + cloudflare tunnel + start with the tunnel url
```

ctrl+c stops everything. `PORT=8081 ./workshop.sh` picks another port; data goes to `~/savolbor-YYYY-MM-DD.jsonl` (override with `DATA=…`).

## run in a room

1. connect the laptop to the venue wi-fi (or turn on a hotspot / travel router).
2. run `./savolbor`. it prints:
   - the participant url and a qr code in the terminal,
   - the presenter url (`http://localhost:8080/host`),
   - a presenter link with `?key=…` for moderating from your phone.
3. open `/host` on the laptop, press **projector** (or `p`) and put it on the big screen — it shows the qr code, the join url, the question being answered and the top questions. `esc` leaves projector mode.

tips:

- **phone hotspots** usually cap at ~10–30 devices. for bigger groups use the venue wi-fi or a travel router.
- **macos firewall**: on first run macos asks whether to accept incoming connections — choose *allow*, otherwise phones can't connect.
- **vpn on**: the join url prefers wi-fi/ethernet/hotspot addresses over vpn tunnels. every other address is printed under *other addresses* if you need to pick one by hand.
- **address changed?** savolbor re-checks the laptop's address every 5s. if it switches networks, the terminal prints the new url and qr, and the projector qr updates by itself (not in `-public-url` mode).
- **work laptops**: corporate vpn / security agents (globalprotect, sentinelone, …) can silently drop incoming lan connections even when the macos firewall allows them. run `./savolbor -debug`, open the url from a phone: no log line means the laptop is blocking it — use a personal machine.
- some venue networks isolate clients from each other ("ap isolation"). if phones can't open the url, use a hotspot instead.

## flags

| flag | default | meaning |
|---|---|---|
| `-port` | `8080` | port to listen on |
| `-data` | `savolbor-YYYY-MM-DD.jsonl` | event log file |
| `-public-url` | — | public tunnel url; join url/qr use it and the presenter always needs the key |
| `-wifi` | — | wi-fi name shown in the terminal, under the qr on the projector and in the full-screen qr, so phones on mobile data notice |
| `-no-open` | off | don't open the presenter page in the browser on start (otherwise `open` / `xdg-open` / `rundll32` is used; with `-public-url` the `?key=` link opens) |
| `-debug` | off | log every request — if a phone connects and no line appears, its request never reached the laptop |

## over the internet (when the lan is blocked)

if phones can't reach the laptop (corporate vpn, client isolation), expose it through a tunnel for the length of the workshop:

```bash
cloudflared tunnel --url http://localhost:8080      # prints https://<random>.trycloudflare.com
./savolbor -public-url https://<random>.trycloudflare.com
```

- in public mode the laptop is **not** trusted automatically: open the `presenter` link with `?key=` printed at startup.
- requests that arrive through any proxy (`x-forwarded-for`, `cf-connecting-ip`, …) never count as the presenter, even without `-public-url`.
- some networks (corporate tls inspection) hold the live stream back; pages notice within 4s and switch to polling `/api/view` every 2s. in public mode they poll from the start.
- anyone with the url can post. stop the tunnel (ctrl+c) when the session ends. check your company's policy before tunnelling from a work laptop.

## data and export

- every change is appended to the `-data` file (json lines) in the working directory. restarting on the same day restores the session, even after a crash. a new day — or a different `-data` file — starts fresh.
- **export** on `/host` downloads `savolbor-YYYY-MM-DD.md`: unanswered questions by votes, then answered ones. hidden questions are left out.

## rules

- questions: up to 280 characters, no limit on how often a phone can post.
- one vote per phone per question.
- authors can edit their own question until it is marked answered, and delete it at any time.
- hidden questions disappear from participants' phones.

## presenter page

- **session title** at the top: shown on phones and the projector. saves on enter or when you click away.
- **done, next** marks the current question answered and puts the top-voted open one on screen. after the last one the projector switches to the qr invite.
- **connected** counts phones with the page open.
- keys: `j`/`k` select, `enter` answer now, `n` done, next, `x` hide, `p` projector, `esc` leave the projector. keys do nothing while you type in a field.
- tabs **queue / answered / hidden** let you undo: mark unanswered, unhide.

## develop

```bash
make test                    # go test -race, go vet, ui tests (vitest)
go run . -debug              # api + embedded pages on :8080
npm --prefix ui run dev      # live-reloading pages on :5173, api proxied to :8080
```

through the vite dev server, open `/host?key=<key printed by go run>` — the proxy adds forwarding headers, so localhost isn't trusted as the presenter there.

layout: `ui/src/participant` (phone page), `ui/src/host` (presenter + projector), `ui/src/useBoard.ts` (live connection, sse with polling fallback), `ui/src/select.ts` (list rules shared by all views).
