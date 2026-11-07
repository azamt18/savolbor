# savolbor — distribution plan

drafted 2026-11-07, after the redesign (tasks 1–8) was built on `feat/savolbor`. two audiences:

- **a. workshop attendees**: people in the room who join from their phones, and the trainers among them who want to run savolbor at their own events.
- **b. the public**: savolbor as an open-source product that anyone can download and run without go, node or a terminal habit.

track a ships first (it's the next workshop). track b builds on it.

## decisions (accepted 2026-11-07)

| area | proposal | why |
|---|---|---|
| repo | own public repo `github.com/azamt18/savolbor`, history kept with `git subtree split` | a product needs its own issues, releases and stars; `coding-vault` mixes private notes |
| license | mit | shortest, no friction for schools and companies |
| module path | `savolbor` → `github.com/azamt18/savolbor` | `go install` works only with a real path |
| version | `v0.1.0` first release; semver tags | signals "usable, still young" |
| binaries | goreleaser in github actions on tag push: macos (arm64, amd64), windows (amd64), linux (amd64, arm64); zip/tar.gz + checksums | presenters must not need go |
| signing | v0.1 unsigned, readme shows the one-time gatekeeper / smartscreen step; revisit apple notarization ($99/yr) after real demand | cost before proof of use is wasted |
| install | 1) download from releases, 2) `brew install azamt18/tap/savolbor`, 3) `go install` | covers non-devs, mac devs, go devs |
| double-click start | `savolbor` with no flags opens `http://localhost:8080/host` in the browser by itself (new `-no-open` flag to skip) | a windows/mac user who double-clicks gets the presenter page, not a bare terminal |
| landing page | one static page on github pages (`azamt18.github.io/savolbor`), uzbek first, english toggle; screenshots of phone + projector, 3-step "how it works", download buttons per os | the readme is for developers; the page is for trainers |
| privacy line | "savollar sizning noutbukingizdan chiqmaydi" / "questions never leave your laptop" as the headline promise | the real differentiator vs slido/mentimeter: no account, no internet, no data collection |
| feedback | github issues + a telegram group `savolbor` linked from the landing page and from `/host` footer | uzbek trainers live in telegram, not on github |

## track a — workshop attendees

### a1. joining (participants)

- **join card**: projector mode already shows the qr; for tables and walls add a **print** button on `/host` (join tab) that prints the qr, the short url and one line "telefoningiz shu wi-fi'ga ulangan bo'lsin" / "join the same wi-fi". css `@media print`, no new endpoint.
- **wi-fi name on the card**: optional `-wifi "<ssid>"` flag; shown under the qr on projector, print card and terminal. the most common failure in a room is a phone on mobile data.
- **first-visit hint** on the phone: one dismissible line above the list, "savolingizni yozing, boshqalarning savoliga ovoz bering" / "ask, and upvote others". stored in localStorage.

### a2. attendees who want to run it (trainers)

- end each workshop with a "take it home" slide: qr to the landing page (track b), or until then to the github release.
- a **one-page presenter guide** (`docs/guide-uz.md`, uzbek, rendered on the landing page): download → open → put on projector → share the moderator link → export. screenshots, no terminal words beyond "allow" on the firewall prompt.
- the moderator answer already given (send the `presenter (phone)` link privately; new key each start) goes into that guide.

### a3. acceptance

- run one real workshop with v0.1 binaries downloaded from the release page (not built locally), on a laptop without go installed.
- note every question attendees ask about joining; each one becomes a guide line or a ui fix.

## track b — public product

### b1. repo and release (impl session)

1. `git subtree split --prefix=products/savolbor -b savolbor-split` after `feat/savolbor` is merged; push to the new repo as `main`.
2. rename the module path; `go build ./... && make test` green.
3. add `LICENSE` (mit), `.goreleaser.yaml`, `.github/workflows/release.yml` (tag `v*` → goreleaser), `.github/workflows/test.yml` (push/pr → `make test`).
4. `-no-open` flag + auto-open browser on start (`open` / `xdg-open` / `rundll32 url.dll,FileProtocolHandler`). test: flag parsing and the command chosen per `runtime.GOOS`, without actually launching.
5. `-wifi` flag (track a1). test: shown in `/api/view` and the banner.
6. print button + `@media print` on `/host` join tab.
7. tag `v0.1.0`; check the release page has 5 archives + checksums; download the macos one on a clean user account and run it.
8. homebrew tap repo `azamt18/homebrew-tap`, formula filled by goreleaser.

### b2. readme for the public (plan session drafts, impl session commits)

- top: one sentence, one screenshot (phone + projector side by side), download links.
- sections: why (no internet, no accounts, no data leaves the room) / start in 3 steps / moderators / over the internet / build from source / license.
- move the troubleshooting tips (vpn, ap isolation, hotspot caps) under "if phones can't connect".
- uzbek readme `README.uz.md`, linked at the top.

### b3. landing page

- `site/` folder in the repo, plain html + the same `shared.css` tokens and onest font (one look with the app), deployed by a pages workflow.
- sections: hero (the projector "now answering" zar band as the image — it's the signature moment), how it works (3 steps: run, scan, ask), privacy promise, download per os (detects the visitor's os), presenter guide, telegram link.
- no analytics, no cookies — matching the privacy promise.

### b4. announcement

| channel | what | when |
|---|---|---|
| own workshop | "take it home" slide + qr | next workshop |
| linkedin (linkedin.com/in/azam-t) | short post, english: problem → demo gif → link; then uzbek version | release day |
| uzbek telegram tech / education channels | uzbek post with the gif, ask admins first | release day + 1 week |
| github | topics (`qa`, `workshop`, `offline`, `lan`, `go`), social preview image | release day |
| later, if traction | product hunt, hacker news "show hn" | after 3+ real outside users |

the demo gif (15s: scan qr → ask → vote rises → presenter presses "done, next" → projector zar band) is the single most important asset; record it once, reuse everywhere.

### b5. after launch

- watch issues and the telegram group for two weeks; fix join problems first.
- measure only what's public: stars, release downloads (github shows counts), telegram members. no telemetry in the app.

## resolved

1. split into its own repo once `feat/savolbor` is merged.
2. keep the name, add the tagline "savolbor — offline q&a for workshops".
3. no macos notarization in v0.1.

## order of work

1. on `feat/savolbor` in `coding-vault`: a1 (print button, `-wifi`, first-visit hint), b1 step 4 (auto-open, `-no-open`). each a commit, `make test` green.
2. **stop and ask the user** before anything outward-facing: merging to `main`, creating the public repo, pushing, tagging `v0.1.0`, the homebrew tap.
3. then b1 steps 1–3 and 7–8, b2, b3.

## task split

- **plan session**: this file, readme drafts (b2), presenter guide (a2), landing page copy, announcement texts.
- **impl session**: b1 steps 1–8, a1 ui bits, landing page build (b3), each as its own commit with `make test` green, reporting back hash + test result + deviations.
