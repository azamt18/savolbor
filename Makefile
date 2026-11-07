.PHONY: ui build test dev

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
