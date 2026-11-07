# savolbor ui redesign plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** replace the vanilla-js pages with a react + typescript ui that feels like a finished product: thumb-first phone page, a presenter page built around "done, next", and a projector view where the question being answered dominates the room.

**Architecture:** the go backend stays the source of truth and gains three small features (session title, "done, next", connected count). the ui moves to `ui/` (vite, multi-page: `index.html` + `host.html`), builds into `web/dist`, and is embedded with `//go:embed`. `web/dist` is committed so `go build` alone still produces a working binary; node is only needed to change the ui. one `useBoard()` hook owns the live connection (sse, polling fallback) for both pages.

**Tech Stack:** go 1.26 (existing), react 18 + react-dom, typescript, vite, vitest + @testing-library/react + jsdom (dev only), onest font (ofl) embedded as woff2.

**Status (2026-11-07):** tasks 1–8 done on `feat/savolbor`; deviations are listed under [as built](#as-built).

**Spec:** [spec.md](spec.md) — see "ui redesign (2026-11-07)". builds on the as-built state described in [plan.md](plan.md).

## Global Constraints

- runtime dependencies: `react`, `react-dom` only. no ui kits, no css frameworks, no icon packages (inline svg), no cdn, no google fonts — the room has no internet.
- fonts: onest 400 and 600, woff2, files in `ui/src/fonts/`, licence text in `ui/src/fonts/OFL.txt`. stack: `"Onest", system-ui, -apple-system, "Segoe UI", sans-serif`.
- colour tokens (exact), defined once in `ui/src/tokens.css` as css custom properties:

  | token | light | dark (phones only, `prefers-color-scheme: dark`) | use |
  |---|---|---|---|
  | `--paper` | `#F7F8FA` | `#0F1424` | page background |
  | `--surface` | `#FFFFFF` | `#182036` | question rows, composer |
  | `--ink` | `#16203A` | `#E8ECF5` | text |
  | `--muted` | `#6B7489` | `#9AA3B8` | names, times, hints |
  | `--line` | `#E3E6ED` | `#26304A` | dividers |
  | `--lojuvard` | `#2448A8` | `#7D9BFF` | primary actions, links, focus ring |
  | `--firuza` | `#0E9F8E` | `#3CCFBC` | votes, "you voted" |
  | `--zar` | `#E2A43B` | `#E2A43B` | "now answering" only |

  the projector view is always light. every text/background pair used must pass wcag aa (4.5:1 body, 3:1 ≥24px).
- type scale (phone): 15 / 17 / 22 / 34 px, line-height 1.45 body, 1.15 display; weights 400 and 600 only. projector question: `clamp(2.5rem, 5.5vw, 6rem)`, stepped down by text length (see task 6).
- one bold element: the "now answering" moment. no gradients, no drop shadows except the sticky composer's 1px top line, no all-caps labels, no `→` in button text, sentence case everywhere.
- motion: only (1) the projector's highlight change (crossfade + 12px rise, 280ms) and (2) responses to user actions (vote pill fill, menu open, row insert). everything wrapped in `@media (prefers-reduced-motion: no-preference)`.
- tap targets ≥ 44×44px; visible `:focus-visible` ring in `--lojuvard`; works at 360px width; no horizontal scroll.
- question text and names rendered as react text children only — never `dangerouslySetInnerHTML`.
- long unbroken strings wrap: `overflow-wrap: anywhere` on question text.
- i18n: `uz` default, `en`; both dictionaries must have identical keys (enforced by a test). uzbek uses `ʻ` (U+02BB) in `oʻ`/`gʻ`.
- `go test -race ./... && go vet ./...` and `npm --prefix ui test -- --run && npm --prefix ui run build` before every commit; the commit includes the rebuilt `web/dist`.
- prose in docs and readme: lowercase.

## Review Focus

1. **a 280-character question with no spaces** (a pasted url) must wrap on the phone, on `/host` and on the projector, never widen the page. → test in task 4 (`QuestionRow` renders with the wrap class) + screenshot check in tasks 4 and 6.
2. **a 280-character highlighted question on the projector** must fit above the fold at 1280×720 without scrolling. → `projectorSize(text)` test in task 6.
3. **pressing `j`, `x`, `p` while typing the session title** must type letters, not trigger shortcuts. → test in task 5.
4. **voting on a question that was just deleted or hidden** — the optimistic fill must roll back and show `err_not_found`. → test in task 3.
5. **"done, next" on the last question in the queue** — the highlight clears and the projector falls back to the full-screen qr invite, not an empty band. → board test in task 1, view test in task 6.

## File structure

```
products/savolbor/
  qna/event.go, board.go, view.go      + title, next (task 1)
  server/server.go, sse.go, presence.go + routes, connected count, public flag (task 1)
  web/embed.go                          //go:embed all:dist → var Dist (task 2)
  web/dist/                             build output, committed (task 2)
  web/static/                           deleted (task 7)
  Makefile                              ui, build, test (task 2)
  ui/
    package.json, tsconfig.json, vite.config.ts, index.html, host.html
    src/
      tokens.css, base.css, fonts/
      api.ts          View/QuestionView types, typed fetch helpers
      i18n.ts         dictionaries + useT()
      useBoard.ts     live connection hook
      select.ts       pure list logic: tabs, ranking, next, projector sizing
      participant/    main.tsx, App.tsx, Composer.tsx, QuestionRow.tsx, NowStrip.tsx
      host/           main.tsx, HostApp.tsx, Queue.tsx, NowPanel.tsx, Projector.tsx, useShortcuts.ts
      *.test.ts(x)
```

---

### Task 1: backend — session title, "done, next", connected count

**Files:**
- Modify: `qna/event.go`, `qna/board.go`, `qna/view.go`, `server/server.go`, `server/sse.go`
- Create: `server/presence.go`
- Test: `qna/board_test.go`, `qna/view_test.go`, `server/server_test.go`, `server/presence_test.go`

**Interfaces:**
- Produces (qna):
  ```go
  const EvTitle EventType = "title"            // Text = new title, "" clears
  const MaxTitleLen = 80
  func (b *Board) SetTitle(title string) error // trimmed, ≤80 runes, empty allowed
  func (b *Board) Next() (string, error)       // see below; returns new highlighted id or ""
  // View gains:
  Title     string `json:"title,omitempty"`
  Connected int    `json:"connected,omitempty"` // host view only, filled by server
  Public    bool   `json:"public,omitempty"`    // filled by server
  ```
- `Next`: under one lock — if a question is highlighted, commit+apply `EvAnswer{On:true}` for it; then pick the first question from `Ranked(...)` that is not answered, not hidden and not the one just answered; commit+apply `EvHighlight` with that id, or with `""` when none is left. if the second commit fails, the answer stays (it is already logged) and the error is returned.
- Produces (server):

  | method + path | who | body → response |
  |---|---|---|
  | `POST /api/host/title` | host | `{title}` → `204` |
  | `POST /api/host/next` | host | → `200 {id}` (`""` when queue is empty) |

- presence (`server/presence.go`): `type presence struct` with `open(device string) func()` (refcounted open sse streams, returns close func) and `polled(device string, at time.Time)`; `count(now time.Time) int` = distinct device ids with an open stream **or** a poll in the last 6s. host-view requests are not counted. stream open/close pokes all host streams (reuse the `joinSubs` broadcast, renamed `pokeAll`).
- `snapshot()` sets `Public = s.Public` for everyone and `Connected = presence.count(now)` for host views.

- [ ] **Step 1: write failing tests:**
  - `TestSetTitle` — 80 runes ok, 81 → `ErrTooLong`, `""` clears; replay restores title.
  - `TestNextAnswersAndHighlightsTopRemaining` — q1 (5 votes, highlighted), q2 (3), q3 (7, hidden) → `Next()` returns q2; q1 answered; q3 untouched.
  - `TestNextFromNothingHighlighted` — highlights the top-ranked unanswered question; nothing answered.
  - `TestNextOnLastQuestionClears` — one question highlighted → returns `""`, it is answered, `View().Highlighted == ""`.
  - `TestPresenceCountsStreamsAndRecentPolls` — two streams same device → 1; close both → 0; poll at t → counted at t+5s, not at t+7s.
  - `TestHostViewHasConnectedParticipantDoesNot`, `TestPublicFlagInSnapshot`, `TestTitleAndNextRoutesRequireHost`.
- [ ] **Step 2: run** `go test ./...` → FAIL.
- [ ] **Step 3: implement.**
  > **learning by doing (for the human):** leave the "pick the next question" loop inside `Board.Next` as `TODO(human)` — it decides what the room sees after every answer.
- [ ] **Step 4: run** `go test -race ./... && go vet ./...` → PASS.
- [ ] **Step 5: commit** — `feat(savolbor): add session title, done-next and connected count`.

---

### Task 2: ui scaffold, tokens, font, embedding

**Files:**
- Create: `ui/` (package.json, tsconfig.json, vite.config.ts, index.html, host.html, src/tokens.css, src/base.css, src/fonts/*, src/i18n.ts, src/i18n.test.ts, src/participant/main.tsx, src/host/main.tsx), `Makefile`, `web/dist/` (built)
- Modify: `web/embed.go`, `server/server.go`, `main.go`, `.gitignore` (add `ui/node_modules`)
- Test: `ui/src/i18n.test.ts`, `server/server_test.go`

**Interfaces:**
- `web/embed.go`: `//go:embed all:dist` → `var Dist embed.FS`; `main.go` passes `fs.Sub(web.Dist, "dist")` as `Config.Static`.
- routes change: `GET /{$}` → `index.html`, `GET /host` → `host.html` (same host check as today), `GET /assets/` → static files (vite's default asset dir). `GET /static/` is removed.
- `vite.config.ts`: `build.outDir = "../web/dist"`, `emptyOutDir: true`, `rollupOptions.input = { index: "index.html", host: "host.html" }`, dev `server.proxy` for `/api` and `/qr.png` → `http://localhost:8080`. (if the proxy adds `x-forwarded-*`, savolbor treats it as non-host — open `/host?key=…` in dev.)
- `Makefile`: `ui` (`npm --prefix ui ci && npm --prefix ui run build`), `build` (`ui` then `go build -o savolbor .`), `test` (`go test -race ./... && npm --prefix ui test -- --run`), `dev` (prints the two commands to run side by side).
- `i18n.ts`: `export const dict: { uz: Record<Key,string>; en: Record<Key,string> }`, `export function useT(): { t(key: Key, vars?: Record<string,string|number>): string; lang: Lang; setLang(l: Lang): void }`; language stored in `localStorage` `savolbor_lang` (wrapped in try/catch). carry over every key from today's `web/static/i18n.js`, minus `err_rate_limited`, plus: `mine`, `addName`, `you`, `minutesAgo`, `justNow`, `queue`, `hidden`, `connected`, `doneNext`, `answerNow`, `sessionTitle`, `sessionTitlePlaceholder`, `next`, `scanToAsk`, `inviteHeadline` (uz: "Savolingiz bormi?"), `shortcuts`, `sent`.
- fonts: download onest 400/600 woff2 + OFL from the official onest repository once (ask the user before downloading), commit them.

- [ ] **Step 1: write failing tests** — `i18n.test.ts`: `Object.keys(dict.uz).sort()` equals `Object.keys(dict.en).sort()`; no value is empty. go: `TestServesBuiltPages` — `GET /` returns html containing `<div id="root">`, `GET /assets/<first file in dist/assets>` → 200.
- [ ] **Step 2: run** both test suites → FAIL.
- [ ] **Step 3: scaffold and implement** (`npm create vite@latest ui -- --template react-ts`, then trim to the structure above; both `main.tsx` render a placeholder using `tokens.css` + the font).
- [ ] **Step 4: run** `make test && make build` → PASS, `./savolbor` serves the placeholder pages with onest loaded (check in devtools: no network request leaves the laptop).
- [ ] **Step 5: commit** — `build(savolbor): add react ui scaffold embedded from web/dist`.

---

### Task 3: live data layer

**Files:**
- Create: `ui/src/api.ts`, `ui/src/useBoard.ts`, `ui/src/select.ts`
- Test: `ui/src/useBoard.test.ts`, `ui/src/select.test.ts`

**Interfaces:**
- `api.ts`: `type QuestionView` and `type View` mirroring the go json exactly (incl. `title`, `connected`, `public`, `joinUrl`); `type ApiError = { status: number; code: string }`; `export async function call(method: string, path: string, body?: unknown): Promise<void | unknown>` throwing `ApiError` with the server's `error` code (or `network`).
- `useBoard(opts: { host: boolean }) → { view: View | null; status: "live" | "polling" | "offline"; act(fn: () => Promise<unknown>, optimistic?: (v: View) => View): Promise<ApiError | null> }`
  - opens `EventSource("/api/events" + (host ? "?view=host" : ""))`; if `view.public` is true on the first snapshot, or no snapshot arrives within 4s, closes it and polls `GET /api/view` every 2s.
  - `status` becomes `"offline"` only after 5s without a successful snapshot (no flicker on brief blips).
  - `act`: applies `optimistic(view)` immediately, runs `fn`; on error restores the last server snapshot and returns the `ApiError`; when polling, refreshes right after `fn`.
- `select.ts`:
  ```ts
  type Tab = "top" | "new" | "mine"
  function visibleList(v: View, tab: Tab): { open: QuestionView[]; answered: QuestionView[] } // excludes highlighted from open
  function ranked(qs: QuestionView[]): QuestionView[]   // votes desc, then createdAt asc — same rule as qna.Ranked
  function withVote(v: View, id: string): View          // optimistic vote: votes+1, voted=true
  ```

- [ ] **Step 1: write failing tests** (vitest, fake timers, a stub `EventSource` class on `globalThis`, `fetch` mocked):
  - `switches to polling when no snapshot in 4s`; `polls from the start when view.public`; `status offline only after 5s`.
  - `rolls back optimistic vote on 404 and returns not_found` (review focus 4).
  - `ranked matches go rule`; `mine tab shows only mine`; `highlighted is not repeated in open list`.
- [ ] **Step 2: run** `npm --prefix ui test -- --run` → FAIL.
- [ ] **Step 3: implement.**
  > **learning by doing (for the human):** leave the sse → polling decision inside `useBoard` (the 4s timer, the `public` check, when to fall back again after a reconnect) as `TODO(human)`.
- [ ] **Step 4: run** tests → PASS.
- [ ] **Step 5: commit** — `feat(savolbor): add typed api and live board hook`.

---

### Task 4: participant page

**Files:**
- Create: `ui/src/participant/App.tsx`, `Composer.tsx`, `QuestionRow.tsx`, `NowStrip.tsx`, `participant.css`
- Test: `ui/src/participant/App.test.tsx`

**Layout (phone):**
```
┌──────────────────────────┐
│ savolbor · <title>   ● uz│  ● live dot; turns muted + "offline" text only when status=offline
├──────────────────────────┤
│ ▌now answering           │  NowStrip: zar left bar, 2-line clamp, tap scrolls to the row
├──────────────────────────┤
│ [ top | new | mine ]     │  segmented control
│ question text        ▲ 5 │  QuestionRow: vote pill right, 44px, firuza fill when voted
│ dilnoza · 3 min      ⋯   │  ⋯ only on own rows: edit / delete (inline confirm, no confirm())
│ ▸ answered (1)           │  <details>, dimmed
├──────────────────────────┤
│ ask a question…      [↑] │  Composer: sticky bottom, grows to 4 lines on focus,
│ + add your name          │  counter appears at ≤40 chars left; name in localStorage savolbor_name
└──────────────────────────┘
```
- on desktop widths the column is max 640px, centred; the composer stays at the bottom of the column.
- after sending: textarea clears, a quiet "sent" status line for 2s, the new row is scrolled into view.
- empty state: `empty` copy above the composer, nothing else.

- [ ] **Step 1: write failing tests** (testing-library with a mocked `useBoard`): `vote pill shows voted state and is disabled after voting`; `menu only on mine`; `edit hidden when answered`; `long unbroken text gets the wrap class` (review focus 1); `send clears textarea and keeps name`.
- [ ] **Step 2: run** → FAIL. **Step 3: implement.** **Step 4: run** → PASS.
- [ ] **Step 5: visual check** — `make build && ./savolbor -port 8099 -data /tmp/demo.jsonl`, seed the 4 uzbek demo questions, screenshot at 375×812 and 1280×800 in light and dark; check: no horizontal scroll with a 280-char url-like question, composer reachable with the keyboard open (ios: `visualViewport`/`dvh`), focus ring visible on tab.
- [ ] **Step 6: commit** — `feat(savolbor): redesign participant page`.

---

### Task 5: presenter page

**Files:**
- Create: `ui/src/host/HostApp.tsx`, `Queue.tsx`, `NowPanel.tsx`, `useShortcuts.ts`, `host.css`
- Test: `ui/src/host/HostApp.test.tsx`, `ui/src/host/useShortcuts.test.ts`

**Layout (laptop):**
```
┌───────────────────────────────────────────────────────────────┐
│ savolbor  [session title input]   23 connected  export  projector (p) │
├─────────────────────────────────┬─────────────────────────────┤
│ queue 3 │ answered 1 │ hidden 0 │ now answering               │
│ ▲5 agent xotirasini…    answer now │ <highlighted text, 34px>  │
│ ▲0 somsa bor misolida…  answer now │ [done, next]   hide       │
│                                 │ ▲3 · anonymous · 2 min      │
│ j/k move · enter answer now · x hide · n done, next · p projector │
└─────────────────────────────────┴─────────────────────────────┘
```
- queue = unanswered, not hidden, ranked; answered and hidden tabs allow undo (mark unanswered / unhide).
- "done, next" calls `POST /api/host/next`; when nothing is highlighted the button reads `answerNow` for the top question.
- title input saves on blur / enter (`POST /api/host/title`), max 80.
- `useShortcuts(map: Record<string, () => void>)` ignores events whose target is `input`, `textarea` or `[contenteditable]`, and any event with ctrl/meta/alt.
- below 900px wide the two columns stack, now-answering first.

- [ ] **Step 1: write failing tests:** `shortcuts ignored while typing in title` (review focus 3); `j/k moves selection and enter highlights`; `done-next posts to /api/host/next`; `hidden tab offers unhide`.
- [ ] **Step 2: run** → FAIL. **Step 3: implement.** **Step 4: run** → PASS.
- [ ] **Step 5: visual check** at 1280×800 and 1440×900; full keyboard pass without the mouse.
- [ ] **Step 6: commit** — `feat(savolbor): redesign presenter page around done-next`.

---

### Task 6: projector view

**Files:**
- Create: `ui/src/host/Projector.tsx`, `projector.css`
- Modify: `ui/src/select.ts` (add `projectorSize`)
- Test: `ui/src/host/Projector.test.tsx`, `ui/src/select.test.ts`

**Interfaces:**
- toggled from `/host` (button, `p`; `Esc` leaves; remembered in `localStorage` `savolbor_projector`); always light tokens.
- `projectorSize(text: string): "xl" | "l" | "m"` — by rune count: ≤90 → `xl` (`clamp(2.5rem,5.5vw,6rem)`), ≤180 → `l` (`clamp(2rem,4.2vw,4.5rem)`), else `m` (`clamp(1.75rem,3.2vw,3.5rem)`).
- with a highlight: zar band ~70% height with the question (ink on zar) and vote count; bottom strip with "next:" top 2 queue items and a 160px qr + join url (host:port only, no `http://`).
- without a highlight: full-screen invite — `inviteHeadline` + `scanToAsk`, qr ~40vh, join url large, session title above.
- the highlight change is the page's one orchestrated motion (crossfade + 12px rise, 280ms, reduced-motion respected). the qr image reloads when `joinUrl` changes.

- [ ] **Step 1: write failing tests:** `projectorSize thresholds` (89/90/91, 180/181 runes, uzbek multi-byte); `280-char question uses size m` (review focus 2); `no highlight shows invite with qr` and `done-next on last question shows invite` (review focus 5).
- [ ] **Step 2: run** → FAIL. **Step 3: implement.** **Step 4: run** → PASS.
- [ ] **Step 5: visual check** at 1280×720 and 1920×1080: 280-char question fits without scroll; readable from ~8m (squint test on a screenshot at 25% scale).
- [ ] **Step 6: commit** — `feat(savolbor): redesign projector view`.

---

### Task 7: cleanup, docs, end-to-end

**Files:**
- Delete: `web/static/`
- Modify: `README.md` (build now `make build`; ui dev loop; screenshots optional), `docs/spec.md`, `docs/plan.md` (open list)

- [ ] **Step 1: delete** `web/static/` and any leftover references (`grep -rn static/ --include=*.go`).
- [ ] **Step 2: run** `make test && make build` → PASS.
- [ ] **Step 3: end-to-end** — real phone on the same wi-fi: scan, post, vote, edit, delete, language toggle, dark mode; laptop: title, done-next through 3 questions to the invite screen, hide/unhide, export; kill the server mid-session and restart → phones show offline after 5s, then recover on their own.
- [ ] **Step 4: commit** — `chore(savolbor): remove vanilla ui and update docs`.

---

### Task 8: align participant ui with host (added 2026-11-07, after review)

**why:** task 4 specified behaviour, not a shared look. real use showed the phone page reads as a different app: dark navy on phones vs always-light `/host`, pill buttons vs 8px buttons, segmented tabs vs underlined tabs, css duplicated between `participant.css` and `host.css`. buttons on `/host` also differ in height (40 / 52 / lang toggle ~42 / title input 44), and "Markdown yuklab olish" means nothing to a presenter.

**decisions:**
- **light only, everywhere.** drop the `prefers-color-scheme: dark` block from `tokens.css` and the dark overrides in `participant.css`. one look on phone, laptop and projector. (chosen as the default; revisit only if users ask for dark.)
- **one control height: 44px (`--tap`)** for every button, input, tab and the lang toggle, on both pages. primary vs secondary differ by colour and weight, never by size. remove `.hbtn.big`.
- **export label:** uz "Savollarni yuklab olish", en "Download questions"; `title` attribute says the file is markdown (`.md`) for those who care.
- **times:** 24-hour `HH:MM`, independent of the browser locale (no more "07:23 PM" next to "59 daq oldin").

**Files:**
- Create: `ui/src/shared.css` — top bar, `.btn` (+ `primary`, `quiet`, `danger`), underlined `.tabs`, `.live`, `.lang`, question row (`.q-text`, `.meta`), vote control, now card (zar top edge), `.error`
- Modify: `ui/src/tokens.css` (remove dark block), `ui/src/participant/participant.css` and `ui/src/host/host.css` (keep only page layout; delete duplicated rules), `participant/*.tsx` and `host/*.tsx` (class names), `ui/src/format.ts` (`ago` → 24h), `ui/src/i18n.ts` (`export` strings), `participant/Composer.tsx`
- Test: `ui/src/format.test.ts`, `ui/src/i18n.test.ts`, `participant/App.test.tsx`, `host/HostApp.test.tsx`

**participant page, target look:**
- white top bar with bottom border, like `/host`. session title is the heading (`--fs-m`, 600); "Savol bor" small and muted after it, or alone when no title is set.
- tabs: underlined, same as the host queue tabs.
- question row: same row as the host queue (text, meta under it), vote control on the right — square 8px-radius tile, 44×44 min, count + arrow; voted = firuza fill with dark text.
- now card: white card with the 6px zar top edge, same as the host's now panel; vote control on the right.
- composer: textarea grows 1 → 3 rows only while it has text (not on focus); the name is a small chip ("+ ism" / the saved name) inside the composer row, left of the send button, tapping it opens an inline input. no second, offset row. `autocomplete="off"` and `data-1p-ignore`, `data-lpignore="true"`, `data-bwignore` on the textarea so password-manager buttons stay out of it.

- [x] **Step 1: write failing tests:**
  - `ago uses 24h clock` — a question 2h old renders `19:23`, not `07:23 PM`, for both `uz` and `en`, with the test forcing `navigator.language = "en-US"`.
  - `export label is understandable` — `dict.uz.export === "Savollarni yuklab olish"`, `dict.en.export === "Download questions"`; i18n key parity still passes.
  - `host controls share one size class` — every button in the host top bar and now panel has class `btn` and none has `big`.
  - `composer stays one row when empty` — focus without typing keeps `rows=1`; typing 3 lines gives `rows=3`.
  - `name chip` — tapping the chip shows the name input; a saved name shows on the chip after reload (storage).
- [x] **Step 2: run** `cd ui && npm test` → FAIL.
- [x] **Step 3: implement** — `shared.css` first, then delete the duplicated rules from both page css files, then component class changes, then composer.
- [x] **Step 4: run** `make test` → PASS; `grep -n "prefers-color-scheme" ui/src` → nothing; each selector in `shared.css` appears in no other css file.
- [x] **Step 5: visual check** — phone at 390×844 with the os in **dark** mode (must still render light), `/host` at 1280×800: top bars match, buttons line up at one height, now card looks the same on both, no am/pm anywhere.
- [x] **Step 6: commit** — `feat(savolbor): align participant ui with host`.

---

## as built

decisions taken during execution that differ from the text above:

- **contrast:** light `--muted` is `#646D82` (the plan's `#6B7489` is 4.41:1 on `--paper`); the voted pill uses dark text on firuza (white is 3.30:1).
- **liveness:** on sse, "offline" means the stream is closed for 5s — a quiet stream only carries pings, which never reach `onmessage`. once a page falls back to polling it stays polling until reload.
- **connected count:** a participant's first poll also refreshes host streams, so polling-only rooms update the count.
- **now strip (phone):** tapping expands the clamped text; the highlighted question has no row in the list to scroll to.
- **`TestServesBuiltPages`** lives in `dist_test.go` (root package), so `server` tests don't depend on a build.
- **fonts** come from `@fontsource/onest` (latin + latin-ext, 400/600 only).
- **task 8:** the composer grows by text length too (≈34 characters per row on a phone), not only by line breaks; the projector's key hints use `.pj-key` so `kbd` is styled only in `shared.css`; the export button's `title` reads "Markdown fayl (.md)".
