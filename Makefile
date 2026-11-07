.PHONY: ui build test dev seed

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
