# savolbor

live q&a for workshops, lessons and seminars. participants send and upvote questions from their phones; the presenter sees, sorts and moderates them on the laptop and puts them on the projector. everything runs on the local network — **no internet needed**.

## build

```bash
go build -o savolbor .
```

one binary, the web pages are embedded. go 1.26.

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
- **address changed?** the join url is worked out at startup. if the laptop switches networks (or gets a new address), restart savolbor so the qr code points to the new one.
- **work laptops**: corporate vpn / security agents (globalprotect, sentinelone, …) can silently drop incoming lan connections even when the macos firewall allows them. run `./savolbor -debug`, open the url from a phone: no log line means the laptop is blocking it — use a personal machine.
- some venue networks isolate clients from each other ("ap isolation"). if phones can't open the url, use a hotspot instead.

## flags

| flag | default | meaning |
|---|---|---|
| `-port` | `8080` | port to listen on |
| `-data` | `savolbor-YYYY-MM-DD.jsonl` | event log file |
| `-debug` | off | log every request — if a phone connects and no line appears, its request never reached the laptop |

## data and export

- every change is appended to the `-data` file (json lines) in the working directory. restarting on the same day restores the session, even after a crash. a new day — or a different `-data` file — starts fresh.
- **export** on `/host` downloads `savolbor-YYYY-MM-DD.md`: unanswered questions by votes, then answered ones. hidden questions are left out.

## rules

- questions: up to 280 characters, one new question per phone every 20 seconds.
- one vote per phone per question.
- authors can edit or delete their own question until it is marked answered.
- hidden questions disappear from participants' phones.

## develop

```bash
go test -race ./...
go vet ./...
go run . -port 8081 -data dev.jsonl
```
