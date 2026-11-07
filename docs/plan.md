# savolbor implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a single go binary that runs a live, lan-only q&a board for workshops: phones post and upvote questions, the presenter moderates and projects them.

**Architecture:** every change is a `qna.Event`. `qna.Board` validates a command, hands the event to a commit callback (the json-lines log), then applies it to in-memory state and notifies subscribers. on start, the log is replayed through `Board.Apply`. an `net/http` server exposes a small json api plus one sse stream that pushes a per-device snapshot on every change; the vanilla-js pages are embedded in the binary.

**Tech Stack:** go 1.26 stdlib (`net/http` method patterns, `embed`, `log/slog`), `github.com/skip2/go-qrcode`, vanilla html/css/js.

**Spec:** [products/savolbor/docs/spec.md](spec.md)

**Status (2026-11-07):** tasks 1–7 done on branch `feat/savolbor` (not merged). behaviour added after the plan is recorded in [post-plan changes](#post-plan-changes-as-built); the readme is the operator guide.

## Global Constraints

- module root: `products/savolbor/`, module path `savolbor`, `go 1.26`.
- the only third-party module is `github.com/skip2/go-qrcode`. no js libraries, no cdn links, no fonts from the internet — the room has no internet.
- question text: trimmed, non-empty, max **280 runes** (count with `utf8.RuneCountInString`, never `len`). display name: trimmed, max **40 runes**, optional.
- ~~post rate limit: 1 new question per device per 20 seconds~~ — removed 2026-11-07; nothing is rate limited.
- edit allowed only by the author and only while not answered; sets `Edited=true`; votes kept.
- one vote per device per question; repeat votes are a silent no-op.
- hidden questions are invisible to participants (not listed, not votable, not editable) and excluded from export.
- cookies: `savolbor_device` (random 16-byte hex, `HttpOnly`, `SameSite=Lax`, `Path=/`, max-age 30 days); `savolbor_host` (admin key, same attributes).
- host access = request from loopback **or** `?key=` / `savolbor_host` cookie equal to the admin key (compare with `crypto/subtle.ConstantTimeCompare`).
- defaults: port `8080`, data file `savolbor-YYYY-MM-DD.jsonl` in the working directory.
- ui strings live only in `web/static/i18n.js`; default language `uz` (latin, use `ʻ` U+02BB in `oʻ`/`gʻ`), toggle to `en`, choice remembered in `localStorage` key `savolbor_lang`.
- question text and names are always rendered with `textContent`, never `innerHTML`.
- prose in docs/readme: lowercase (author preference).
- run `go test -race ./...` and `go vet ./...` before every commit.

## Review Focus

1. **uzbek text near the limit** — a 280-character question full of `oʻ`, `gʻ`, `ş`, emoji must be accepted; 281 rejected. byte-length checks would wrongly reject it. → test in task 1.
2. **laptop dies mid-write** — a truncated last line in the jsonl file must be skipped with a warning, and the server must still start with every earlier question. → test in task 2.
3. **phone sleeps / wi-fi blips** — `EventSource` reconnects on its own; the server must send a full snapshot immediately on (re)connect so the phone is never stale. → test in task 4.
4. **html in a question** — `<img src=x onerror=alert(1)>` must show as literal text on participant, host and projector views. → api test in task 3 returns raw text; manual check in tasks 5 and 6.
5. **laptop with vpn / several interfaces** — the join url must point at the wi-fi/hotspot address (`en*`, `bridge*`), not a `utun*` vpn or `169.254.*` address; all candidates are printed so the presenter can pick by hand. → test in task 7.

## File structure

```
products/savolbor/
  go.mod, go.sum
  main.go            flags, startup, wiring, graceful shutdown
  lanip.go           lan ipv4 selection (pure function + os glue)
  lanip_test.go
  qna/
    event.go         Event, EventType constants
    board.go         Board: commands, Apply, Subscribe
    view.go          View/QuestionView, Board.View, Ranked
    export.go        ExportMarkdown
    errors.go        sentinel errors
    *_test.go
  store/
    log.go           append-only jsonl: Open, Append, Close
    log_test.go
  server/
    server.go        New, routes, error mapping
    device.go        device cookie middleware, host check
    sse.go           /api/events handler
    *_test.go
  web/
    embed.go         package web; //go:embed static → var Static embed.FS
    static/
      index.html     participant page
      host.html      presenter page (+ projector mode)
      i18n.js        strings uz/en, t(), lang toggle, small fetch helper
      app.js         participant logic
      host.js        presenter logic
      style.css
  README.md
```

---

### Task 1: event model and board commands

**Files:**
- Create: `go.mod`, `qna/event.go`, `qna/errors.go`, `qna/board.go`
- Test: `qna/board_test.go`

**Interfaces:**
- Produces:
  ```go
  type EventType string
  const (
      EvPost EventType = "post"; EvEdit = "edit"; EvDelete = "delete"; EvVote = "vote"
      EvAnswer = "answer"; EvHide = "hide"; EvHighlight = "highlight"
  )
  type Event struct {
      Type   EventType `json:"type"`
      At     time.Time `json:"at"`
      QID    string    `json:"qid,omitempty"`
      Device string    `json:"device,omitempty"` // "host" for presenter events
      Text   string    `json:"text,omitempty"`
      Name   string    `json:"name,omitempty"`
      On     bool      `json:"on,omitempty"`     // answer/hide toggles
  }
  var ErrEmpty, ErrTooLong, ErrRateLimited, ErrNotFound, ErrNotOwner, ErrAnswered error
  const MaxTextLen = 280; MaxNameLen = 40; PostCooldown = 20 * time.Second

  func NewBoard(commit func(Event) error, now func() time.Time) *Board
  func (b *Board) Apply(e Event) error                // replay: no commit, no rate limit, no notify
  func (b *Board) Post(device, text, name string) (id string, err error)
  func (b *Board) Edit(device, id, text string) error
  func (b *Board) Delete(device, id string) error
  func (b *Board) Vote(device, id string) error
  func (b *Board) SetAnswered(id string, on bool) error
  func (b *Board) SetHidden(id string, on bool) error
  func (b *Board) Highlight(id string) error          // "" clears
  func (b *Board) Subscribe() (updates <-chan struct{}, cancel func())
  ```
- internal: `question{ID, Text, Name, Author string; CreatedAt time.Time; Voters map[string]struct{}; Edited, Answered, Hidden bool}`, kept in a map plus an insertion-order slice; `lastPost map[string]time.Time` (set in `Apply` from `e.At`, so replay restores it); `highlighted string`.
- every command: lock → validate → build event (id = 8 random bytes hex for posts) → `commit(e)` (on error return it, state untouched) → `apply` → non-blocking send on each subscriber channel (buffer 1, so bursts coalesce) → unlock.
- `Delete` of the highlighted question clears the highlight. participant commands on a hidden question return `ErrNotFound`.

- [x] **Step 1: init module** — `cd products/savolbor && go mod init savolbor` and set `go 1.26`.

- [x] **Step 2: write the failing tests** in `qna/board_test.go` using a fake clock (`now := func() time.Time { return t0 }`, advance a variable) and a commit spy that records events:
  - `TestPostAcceptsUzbek280Runes` — 280 runes of `"oʻ"`-mix text → ok; 281 → `ErrTooLong`; `"   "` → `ErrEmpty`; name of 41 runes → `ErrTooLong`.
  - `TestPostRateLimit` — second post from same device at +19s → `ErrRateLimited`; at +20s → ok; other device at +1s → ok.
  - `TestEditOwnerOnlyUntilAnswered` — other device → `ErrNotOwner`; author → ok and `Edited` true, votes unchanged; after `SetAnswered(id,true)` → `ErrAnswered`.
  - `TestDeleteOwnerOnlyClearsHighlight`.
  - `TestVoteOncePerDevice` — two votes from same device → 1 voter and exactly one `EvVote` committed; unknown id → `ErrNotFound`; hidden question → `ErrNotFound`.
  - `TestCommitFailureLeavesStateUntouched` — commit returns error → `Post` returns it and the board has 0 questions.
  - `TestReplayRebuildsState` — feed the spy's recorded events into a fresh board via `Apply` → same questions, voters, flags, highlight.
  - `TestSubscribeCoalesces` — three commands, then one receive succeeds and a second non-blocking receive finds nothing.

- [x] **Step 3: run** `go test ./qna/` → FAIL (undefined: NewBoard).

- [x] **Step 4: implement** `event.go`, `errors.go`, `board.go` per the interfaces above.
  > **learning by doing (for the human):** leave `Post`'s validation block (trim, rune limits, cooldown check) as `TODO(human)` and hand it over — it's where the uzbek rune-count and rate-limit rules live.

- [x] **Step 5: run** `go test -race ./qna/` → PASS.

- [x] **Step 6: commit** — `feat(savolbor): add event-sourced q&a board`.

---

### Task 2: append-only event log

**Files:**
- Create: `store/log.go`
- Test: `store/log_test.go`

**Interfaces:**
- Consumes: `qna.Event`.
- Produces:
  ```go
  func Open(path string) (*Log, []qna.Event, error) // creates file if missing; returns existing events
  func (l *Log) Append(e qna.Event) error            // json + "\n", then f.Sync()
  func (l *Log) Close() error
  ```
- reading: `bufio.Scanner` with a 1 MiB buffer; a line that fails to unmarshal is skipped with `slog.Warn` (line number), never fatal. open the file `O_APPEND|O_CREATE|O_RDWR`, perms `0o644`. if the file doesn't end in `\n` (torn write), write one `\n` before the first append so the next event starts on a fresh line.

- [x] **Step 1: write the failing tests:**
  - `TestAppendThenReopen` — append 3 events, close, `Open` again → same 3 events (compare `Type`, `QID`, `Text`, `At.Equal`).
  - `TestTruncatedLastLineIsSkipped` — file containing 2 valid lines + `{"type":"po` → `Open` returns 2 events, nil error; a following `Append` + reopen → 3 events.
  - `TestOpenCreatesMissingFile`.
- [x] **Step 2: run** `go test ./store/` → FAIL.
- [x] **Step 3: implement** `store/log.go`.
- [x] **Step 4: run** `go test -race ./store/` → PASS.
- [x] **Step 5: commit** — `feat(savolbor): persist events to json-lines log`.

---

### Task 3: views, ranking, markdown export and the http api

**Files:**
- Create: `qna/view.go`, `qna/export.go`, `server/server.go`, `server/device.go`, `web/embed.go`, `web/static/index.html` (placeholder `<h1>savolbor</h1>` for now), `web/static/host.html` (placeholder)
- Test: `qna/view_test.go`, `server/server_test.go`

**Interfaces:**
- Consumes: task 1 `Board`.
- Produces:
  ```go
  // qna
  type QuestionView struct {
      ID string `json:"id"`; Text string `json:"text"`; Name string `json:"name,omitempty"`
      Votes int `json:"votes"`; CreatedAt time.Time `json:"createdAt"`
      Voted bool `json:"voted"`; Mine bool `json:"mine"`; Edited bool `json:"edited"`
      Answered bool `json:"answered"`; Hidden bool `json:"hidden,omitempty"`
  }
  type View struct {
      Questions   []QuestionView `json:"questions"`   // creation order; never nil
      Highlighted string         `json:"highlighted,omitempty"`
      JoinURL     string         `json:"joinUrl,omitempty"` // filled by server
  }
  func (b *Board) View(device string, host bool) View // host=true includes hidden
  func Ranked(qs []QuestionView) []QuestionView      // copy, votes desc, then CreatedAt asc
  func ExportMarkdown(v View, date time.Time) string

  // server
  type Config struct {
      Board    *qna.Board
      AdminKey string
      JoinURL  string
      Static   fs.FS // web.Static sub-tree "static"
  }
  func New(cfg Config) http.Handler
  func DeviceID(r *http.Request) string // from context, set by middleware
  func IsHost(r *http.Request, adminKey string) bool
  ```
- `Author` (device id) never leaves the server — `QuestionView` has no author field.
- export format (exact):
  ```
  # savolbor — 2026-11-06

  ## unanswered

  - **5** · how does sse reconnect? — dilnoza
  - **2** · anonymous question here

  ## answered

  - **7** · what is event sourcing?
  ```
  hidden questions are left out; ` — name` only when a name exists; empty section prints `_none_`.
- routes (go 1.22+ method patterns, `r.PathValue("id")`):

  | method + path | who | body → response |
  |---|---|---|
  | `GET /` | all | `index.html` |
  | `GET /host` | host | `host.html`; with valid `?key=` set `savolbor_host` cookie and redirect to `/host` |
  | `GET /static/` | all | embedded files |
  | `GET /qr.png` | all | 512px png of `JoinURL` (`qrcode.Encode(url, qrcode.Medium, 512)`) |
  | `POST /api/questions` | all | `{text,name}` → `201 {id}` |
  | `PATCH /api/questions/{id}` | author | `{text}` → `204` |
  | `DELETE /api/questions/{id}` | author | `204` |
  | `POST /api/questions/{id}/vote` | all | `204` |
  | `POST /api/host/questions/{id}/answered` | host | `{on}` → `204` |
  | `POST /api/host/questions/{id}/hidden` | host | `{on}` → `204` |
  | `POST /api/host/highlight` | host | `{id}` (`""` clears) → `204` |
  | `GET /api/host/export.md` | host | `text/markdown`, `Content-Disposition: attachment; filename="savolbor-YYYY-MM-DD.md"` |

- error mapping → json `{"error":"<code>"}` (the client translates the code via i18n): `ErrEmpty` 400 `empty`, `ErrTooLong` 400 `too_long`, `ErrRateLimited` 429 `rate_limited`, `ErrNotFound` 404 `not_found`, `ErrNotOwner` 403 `not_owner`, `ErrAnswered` 409 `answered`, bad json 400 `bad_request`, non-host on host route 403 `forbidden`, anything else 500 `internal`. request bodies capped with `http.MaxBytesReader` at 8 KiB.
- `IsHost`: `net.SplitHostPort(r.RemoteAddr)` → `ip.IsLoopback()`, else key from query or cookie.

- [x] **Step 1: write failing tests** in `qna/view_test.go`:
  - `TestViewHidesHiddenForParticipants` and shows them (with `Hidden`) for host.
  - `TestViewMineAndVoted` — flags are per device.
  - `TestRankedVotesThenOldest`.
  - `TestExportMarkdownExact` — compare against the exact format above.
- [x] **Step 2: write failing tests** in `server/server_test.go` with `httptest` and a cookie jar client (`httptest.NewServer` binds loopback, so for "remote participant" tests call the handler directly with `httptest.NewRequest` and set `req.RemoteAddr = "192.168.1.50:1234"`):
  - `TestFirstRequestSetsDeviceCookie` — `HttpOnly`, `SameSite=Lax`.
  - `TestPostAndEditFlow` — post → 201; edit with same cookie → 204; edit with a different cookie → 403 `not_owner`.
  - `TestHTMLTextReturnedRaw` — post `<img src=x onerror=alert(1)>` → `GET` via `Board.View` text equals the input byte-for-byte (escaping is the client's job).
  - `TestRateLimitReturns429`.
  - `TestHostRoutesForbiddenForRemoteWithoutKey`, `TestHostKeyQuerySetsCookieAndRedirects`, `TestHostAllowedFromLoopback`.
  - `TestExportDownload` — content type and filename.
- [x] **Step 3: run** `go test ./...` → FAIL.
- [x] **Step 4: implement** `view.go`, `export.go`, `web/embed.go`, `server/device.go`, `server/server.go`. add the qr module: `go get github.com/skip2/go-qrcode`.
  > **learning by doing (for the human):** hand over `Ranked`'s comparator as `TODO(human)` — the tie-break rule decides which question the projector shows first.
- [x] **Step 5: run** `go test -race ./... && go vet ./...` → PASS.
- [x] **Step 6: commit** — `feat(savolbor): add json api, views and markdown export`.

---

### Task 4: live updates over sse

**Files:**
- Create: `server/sse.go`
- Modify: `server/server.go` (register route)
- Test: `server/sse_test.go`

**Interfaces:**
- Consumes: `Board.Subscribe`, `Board.View`, `IsHost`, `DeviceID`.
- Produces: `GET /api/events` (participant view) and `GET /api/events?view=host` (host view; 403 `forbidden` if not host). headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`.
- loop: subscribe **before** writing the first snapshot (no lost update window) → write `data: <View json>\n\n` + flush → `select` on update channel (write snapshot), a 25s ticker (write `: ping\n\n`), and `r.Context().Done()` (cancel subscription, return). `View.JoinURL` is set from config on every snapshot.
- set `retry: 2000\n` once at stream start so phones reconnect quickly.

- [x] **Step 1: write failing tests:**
  - `TestSSESendsSnapshotOnConnect` — connect, read first `data:` line, unmarshal → `View` with existing questions.
  - `TestSSEPushesAfterPost` — connect, post via api, next `data:` contains the new question.
  - `TestSSEHostViewRequiresHost`.
  - `TestSSEUnsubscribesOnDisconnect` — cancel request context, then posting does not block (run with `-race`, a 1s timeout).
- [x] **Step 2: run** `go test ./server/` → FAIL.
- [x] **Step 3: implement** `server/sse.go` (use `http.NewResponseController(w).Flush()`).
- [x] **Step 4: run** `go test -race ./...` → PASS.
- [x] **Step 5: commit** — `feat(savolbor): push live board snapshots over sse`.

---

### Task 5: participant page

**Files:**
- Create: `web/static/i18n.js`, `web/static/app.js`, `web/static/style.css`
- Modify: `web/static/index.html`

**Interfaces:**
- Consumes: api from task 3, sse from task 4.
- Produces (`i18n.js`, loaded first on both pages, attached to `window.savolbor`): `t(key)`, `setLang(lang)`, `applyI18n(root)` (fills `[data-i18n]` text and `[data-i18n-placeholder]`), `api(method, path, body) → Promise<{ok,status,data}>`, `errorText(code)`.
- string keys (both `uz` and `en`): `title`, `askPlaceholder`, `namePlaceholder`, `send`, `charsLeft`, `top`, `newest`, `answered`, `edited`, `edit`, `save`, `cancel`, `delete`, `confirmDelete`, `vote`, `nowAnswering`, `empty`, `offline`, plus one per error code (`err_empty`, `err_too_long`, `err_rate_limited`, `err_not_found`, `err_not_owner`, `err_answered`, `err_forbidden`, `err_bad_request`, `err_internal`).
- page: header with title + `uz | en` toggle; form (textarea `maxlength=280` with live counter, name input remembered in `localStorage` `savolbor_name`, send button); tabs `top` / `newest` (client-side sort; `top` uses votes desc then oldest); the highlighted question pinned at top with a `nowAnswering` badge; unanswered list then a collapsed `answered` section; own questions get edit/delete (edit hidden when answered; delete confirmation is an inline "are you sure" row, not `confirm()`); vote button disabled once `voted`; `offline` banner while `EventSource` is in error state.
- render by rebuilding the list from each snapshot with `textContent` (≤300 items, no diffing needed). mobile-first css, ≥44px tap targets, works at 360px width, light/dark via `prefers-color-scheme`.

- [x] **Step 1: build the page** per the above.
- [x] **Step 2: manual check** — `go run .` (task 7 wires main; until then use a tiny `main.go` stub, or do task 7 before 5–6 if preferred), open `http://localhost:8080` in two browser profiles: post, vote, edit, delete, toggle language; post `<img src=x onerror=alert(1)>` → shows as text; second profile updates live without refresh; stop the server → `offline` banner; start again → banner clears and list returns.
- [x] **Step 3: commit** — `feat(savolbor): add participant page`.

---

### Task 6: presenter page and projector mode

**Files:**
- Create: `web/static/host.js`
- Modify: `web/static/host.html`, `web/static/style.css`, `web/static/i18n.js` (host keys: `hostTitle`, `markAnswered`, `unmarkAnswered`, `hide`, `unhide`, `highlight`, `unhighlight`, `export`, `projector`, `exitProjector`, `joinAt`, `hidden`, `count`)

**Interfaces:**
- Consumes: host api + `/api/events?view=host`, `/qr.png`, `View.JoinURL`.
- normal mode: list with sort `top`/`newest`, per-question buttons answer / hide / highlight, hidden questions shown dimmed with an unhide button, export button (link to `/api/host/export.md`), counters (total, unanswered).
- projector mode (toggle button, also `p` key and `Esc` to leave; stored in `localStorage` `savolbor_projector`): adds `body.projector` → hides every control; shows big qr (`/qr.png`) + `JoinURL` text, the highlighted question in large type, and the top 5 unanswered by votes. font sizes in `vw`/`clamp()` so it reads from the back of a room.

- [x] **Step 1: build the page.**
- [x] **Step 2: manual check** — on `http://localhost:8080/host`: answer/hide/highlight each reflect live on a participant tab; hidden question disappears from participant; export downloads markdown matching the spec format; projector mode shows qr + highlight, no buttons visible; html-payload question renders as text in both modes.
- [x] **Step 3: commit** — `feat(savolbor): add presenter page with projector mode`.

---

### Task 7: startup, lan ip, terminal qr, shutdown

**Files:**
- Create: `main.go`, `lanip.go`, `README.md`
- Test: `lanip_test.go`

**Interfaces:**
- Consumes: everything above.
- Produces:
  ```go
  type ifaceAddrs struct { Name string; Addrs []net.Addr }
  func pickLANIP(ifaces []ifaceAddrs) (best net.IP, all []net.IP) // pure, testable
  func lanInterfaces() []ifaceAddrs                              // net.Interfaces(): up, not loopback
  ```
- `pickLANIP`: ipv4 only; drop loopback and link-local (`169.254.0.0/16`); rank private (`ip.IsPrivate()`) on `en*`, `wl*`, `eth*`, `bridge*` first, then other private, then anything else; `utun*`/`tun*`/`ppp*` last. `all` is every kept address in rank order. none → `best` is `nil` and main falls back to `localhost`.
- flags: `-port int` (8080), `-data string` (`savolbor-` + `time.Now().Format("2006-01-02") + ".jsonl"`).
- startup order: open log → replay through `board.Apply` (log count) → admin key (8 random bytes hex) → join url `http://<best>:<port>` → `server.New` → listen on `:<port>` → print:
  ```
  savolbor is running — 12 questions restored from savolbor-2026-11-06.jsonl

    participants:   http://192.168.1.23:8080
    presenter:      http://localhost:8080/host
    presenter (phone): http://192.168.1.23:8080/host?key=9f2c…

  <ascii qr of participant url: qrcode.New(url, qrcode.Medium).ToSmallString(false)>

    other addresses: 10.8.0.3 (utun4)
  ```
- `SIGINT`/`SIGTERM` → `srv.Shutdown` with a 2s timeout (sse streams end via request context) → `log.Close()`. port in use → clear error message, exit 1.
- readme (lowercase): what it is, `go build -o savolbor .`, how to run in a room (hotspot tip: phone hotspots often cap ~10–30 devices, prefer venue wi-fi or a travel router for bigger groups), macos firewall prompt → allow incoming, flags, where data and exports go.

- [x] **Step 1: write failing tests** in `lanip_test.go`:
  - `TestPickPrefersWiFiOverVPN` — `utun4: 10.8.0.3`, `en0: 192.168.1.23` → best `192.168.1.23`, all `[192.168.1.23, 10.8.0.3]`.
  - `TestPickSkipsLinkLocalAndIPv6` — `en0: 169.254.3.4, fe80::1` and `bridge100: 192.168.2.1` → best `192.168.2.1`.
  - `TestPickNone` — only loopback → `nil`.
- [x] **Step 2: run** `go test .` → FAIL.
- [x] **Step 3: implement** `lanip.go`, `main.go`, `README.md`.
- [x] **Step 4: run** `go test -race ./... && go vet ./... && go build -o savolbor .` → PASS, binary built.
- [x] **Step 5: end-to-end check** — run `./savolbor`; scan the terminal qr with a real phone on the same wi-fi; post + vote from the phone; laptop `/host` sees it live; ctrl+c, start again → questions restored; `kill -9` mid-session, start again → restored (review focus 2).
- [x] **Step 6: commit** — `feat(savolbor): add startup, lan discovery and readme`. add `savolbor` binary and `*.jsonl` to `products/savolbor/.gitignore` in the same commit.

---

## post-plan changes (as built)

added in the implementation session after tasks 1–7, each with its own commit and tests. recorded here so the plan matches the code; nothing left to execute.

| commit | change | where | tests |
|---|---|---|---|
| `b21b24d` | **cross-site write protection** — loopback counts as host, so a page in the presenter's browser could post to `localhost`. all routes go through `http.NewCrossOriginProtection()`; denied → 403 `forbidden` | `server/server.go` | `server/server_test.go` |
| `fb2ac12` | **qr centred on an empty projector** — no highlight and no questions → the qr fills the screen | `web/static/host.js`, `style.css` | manual |
| `6c178c5` | **`-debug` request logging** — one log line per request; no line when a phone connects = the request never reached the laptop (firewall, vpn agent, ap isolation) | `debuglog.go`, `main.go` | `debuglog_test.go` |
| `423a7e4` | **join url follows the laptop's address** — `watchJoinURL` re-checks every 5s; on change: `Server.SetJoinURL` regenerates the qr png, pushes a fresh snapshot to every stream, prints the new url + qr in the terminal; projector reloads the qr image. disabled in public mode | `joinurl.go`, `server/server.go`, `server/sse.go`, `host.js` | `joinurl_test.go`, `server/join_test.go` |
| `0830076` | **public mode for tunnels** — requests carrying `X-Forwarded-For`, `Forwarded`, `Cf-Connecting-Ip` or `X-Real-Ip` are never host, even from loopback. `-public-url <url>` sets `Config.Public` (loopback no longer implies host) and fixes the join url/qr to the tunnel url | `server/device.go` (`fromLocalBrowser`), `server/server.go`, `main.go` | `server/public_test.go` |
| `64ef0d7` | **sse → polling fallback** — through tunnels / corporate tls inspection the stream can arrive headers-only. new `GET /api/view` returns the same `View` as one sse snapshot; pages switch to polling it every 2s if no snapshot arrives within 4s, and refresh right after their own actions | `server/sse.go`, `server/server.go`, `i18n.js`, `app.js`, `host.js` | `server/view_test.go` |

### deltas to the sections above

- **global constraints → host access:** host = (loopback **and** no proxy header **and** not public mode) **or** valid key; plus cross-origin writes are rejected.
- **task 3 routes:** add `GET /api/view` (participant or `?view=host`, same access rule as `/api/events`).
- **task 7 flags:** add `-debug bool` (off) and `-public-url string` (empty).
- **rate limit removed (2026-11-07):** `PostCooldown`, `ErrRateLimited`, `Board.lastPost`, the 429 `rate_limited` mapping and the `err_rate_limited` strings are gone; `TestPostRateLimit` / `TestRateLimitReturns429` replaced by `TestPostBackToBackAllowed` / `TestBackToBackPostsAndEmpty`. task 1–3 text above still describes the original design.
- **delete rule:** authors may delete their own question at any time (only *edit* stops once answered) — this is what the code does and what the spec says.

## open

- real-phone qr scan in an actual room.
- merge decision for `feat/savolbor`.
- ui redesign — done 2026-11-07 per [plan-redesign.md](plan-redesign.md); the vanilla `web/static` pages are gone. follow-up **task 8** (align participant ui with host, one button size, export label, 24h times) done too.

