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
| limits | max 280 characters (runes) per question; max 1 new question per device per 20 seconds |
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
| startup | `savolbor` listens on `:8080`; flags `-port`, `-data <file>`; prints urls, terminal qr and admin key |
| location | `products/savolbor/` in `coding-vault` |

## resolved during planning

- **"one session per run" vs "replay on start"**: the default data file is `savolbor-YYYY-MM-DD.jsonl` in the working directory. restarting the same day recovers the session (crash/sleep safety); a new day starts fresh; `-data other.jsonl` starts a fresh session the same day.
- **voting** is one-way (no un-vote) and idempotent; voting twice is a no-op, not an error.
- **export** leaves hidden questions out.

## out of scope (v1)

replies/comments, multiple rooms, pre-moderation, accounts, polls, internet deployment.
