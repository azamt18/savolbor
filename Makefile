.PHONY: ui build test dev seed release

# the ui is built into web/dist and embedded; web/dist is committed so a
# plain `go build` works without node
ui:
	npm --prefix ui ci
	npm --prefix ui run build

build: ui
	go build -o savolbor .

test:
	go test -race ./...
	go vet ./...
	npm --prefix ui test -- --run

dev:
	@echo "run these side by side:"
	@echo "  go run . -debug          # api on :8080"
	@echo "  npm --prefix ui run dev  # pages on :5173, open /host?key=<key printed by go run>"

# sample questions in a throwaway log on :8099, to look at the ui
seed: build
	@lsof -ti tcp:8099 -sTCP:LISTEN | xargs kill 2>/dev/null; sleep 0.5; true
	@rm -f /tmp/savolbor-demo.jsonl
	@./savolbor -port 8099 -data /tmp/savolbor-demo.jsonl -no-open >/dev/null 2>&1 & \
	  sleep 1; dev/seed.sh 8099; echo "open http://localhost:8099/host — stop it: lsof -ti tcp:8099 -sTCP:LISTEN | xargs kill"

# one zip per platform in dist/, each with the binary, workshop.sh and the readme
PLATFORMS := darwin/arm64 darwin/amd64 windows/amd64 linux/amd64
release: ui
	@rm -rf dist && mkdir -p dist
	@for p in $(PLATFORMS); do \
	  os=$${p%/*}; arch=$${p#*/}; bin=savolbor; [ $$os = windows ] && bin=savolbor.exe; \
	  name=savolbor-$$os-$$arch; mkdir -p dist/$$name; \
	  GOOS=$$os GOARCH=$$arch CGO_ENABLED=0 go build -o dist/$$name/$$bin . || exit 1; \
	  cp README.md workshop.sh dist/$$name/; \
	  (cd dist && zip -qr $$name.zip $$name) && rm -rf dist/$$name; \
	done
	@ls -lh dist
