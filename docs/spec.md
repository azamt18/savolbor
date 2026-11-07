# savolbor — design spec

live q&a for workshops, lessons and seminars. participants send questions from their phones; the presenter sees, sorts and moderates them. works on a local network with **no internet**.

decided in a grilling session on 2026-11-06.

## decisions

| area | decision |
|---|---|
| hosting | presenter's laptop runs one binary; phones join over the venue wi-fi or the laptop/phone hotspot. lan only, no internet, no cdn |
| stack | go (1.26) + one module `github.com/skip2/go-qrcode`; vanilla html/css/js embedded via `embed`, no build step |
| scale | ~50 participants (should not fall over at ~300) |
| identity | server-issued `HttpOnly` cookie with a random device id. anonymous by default, optional display name per question |
| participant features | post a question, upvote (once per device), live updating list, edit own question, delete own question |
| edit rules | allowed until the presenter marks the question answered; votes are kept; an "edited" label is shown |
| limits | max 280 characters (runes) per question; no post rate limit (the 20s per-device cooldown was removed on 2026-11-07) |
| moderation | post-moderation: questions appear instantly, presenter can hide them |
| presenter page | `/host`, reachable from `localhost` without a key, or from any device with `?key=<admin key>` printed at startup |
| presenter actions | mark answered, hide, highlight ("now answering"), sort by votes / newest, export markdown |
| projector | a **projector mode toggle** on `/host`: hides controls, shows big qr + join url, the highlighted question and the top questions |
| join flow | server auto-detects the lan ipv4; qr code + url shown in the terminal (ascii) and in projector mode |
| live updates | server-sent events (sse) push; writes are plain http `POST`/`PATCH`/`DELETE` |
| sessions | one session per server run |
| persistence | in-memory state + append-only json-lines event log on disk, replayed on start |
| export | markdown download from `/host` (unanswered by votes, then answered) |
| ui language | uzbek (latin) default + english, toggle in the ui |
| startup | `savolbor` listens on `:8080`; flags `-port`, `-data <file>`, `-debug`, `-public-url <url>`; prints urls, terminal qr and admin key |
| location | `products/savolbor/` in `coding-vault` |

## resolved during planning

- **"one session per run" vs "replay on start"**: the default data file is `savolbor-YYYY-MM-DD.jsonl` in the working directory. restarting the same day recovers the session (crash/sleep safety); a new day starts fresh; `-data other.jsonl` starts a fresh session the same day.
- **voting** is one-way (no un-vote) and idempotent; voting twice is a no-op, not an error.
- **export** leaves hidden questions out.

## added during implementation (2026-11-07)

- **cross-site protection:** the api rejects cross-origin writes, so a random page open in the presenter's browser can't act as host via `localhost`.
- **join url follows the network:** re-checked every 5s; qr, projector and terminal update when the laptop's address changes.
- **`-debug`:** logs every request, to tell "phone can't reach laptop" apart from app bugs.
- **public mode (`-public-url`):** for when the lan is blocked and a tunnel (cloudflared/ngrok) is used. proxied requests are never host; the presenter always needs the key; join url fixed to the tunnel url.
- **polling fallback:** if no sse snapshot arrives within 4s, pages poll `GET /api/view` every 2s.
- **empty projector:** the qr code is centred and large when there's nothing else to show.

this softens "lan only" — internet use is an opt-in escape hatch, off by default.

## ui redesign (2026-11-07)

decided after reviewing screenshots of the first ui ("works, but looks like a default dark admin template"). implementation plan: [plan-redesign.md](plan-redesign.md).

| area | decision |
|---|---|
| ui stack | react + typescript + vite in `ui/`, built into `web/dist` and embedded; `web/dist` committed so `go build` works without node |
| theme | light-first; phones follow the system setting (dark available); projector always light |
| palette | paper `#F7F8FA`, ink `#16203A`, lojuvard `#2448A8` (primary), firuza `#0E9F8E` (votes), zar `#E2A43B` ("now answering" only), muted `#6B7489` |
| type | onest 400/600 embedded (ofl), system fallback |
| signature moment | "now answering" fills the projector on a zar band; the only orchestrated motion |
| phone | sticky bottom composer, name behind "add your name", vote pill on the right, tabs top / new / mine, own questions behind a `⋯` menu, answered collapsed |
| presenter | two columns: queue / answered / hidden tabs + now-answering panel; **done, next** (answer current + highlight next top) ; keyboard shortcuts j/k/enter/n/x/p |
| projector | highlighted question large with size steps by length, small next strip + qr; empty → full-screen qr invite |
| new features | session title (presenter-set, shown on phones and projector), connected count on `/host`, "mine" tab, public mode polls from the start (no sse through quick tunnels) |

## out of scope (v1)

replies/comments, multiple rooms, pre-moderation, accounts, polls, internet deployment.
