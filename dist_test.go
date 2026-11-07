package main

import (
	"io/fs"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"savolbor/qna"
	"savolbor/server"
	"savolbor/web"
)

func TestServesBuiltPages(t *testing.T) {
	dist, err := fs.Sub(web.Dist, "dist")
	if err != nil {
		t.Fatal(err)
	}
	assets, err := fs.ReadDir(dist, "assets")
	if err != nil || len(assets) == 0 {
		t.Fatalf("no built assets (run make ui): %v", err)
	}
	b := qna.NewBoard(func(qna.Event) error { return nil }, time.Now)
	h := server.New(server.Config{Board: b, AdminKey: "k", JoinURL: "http://x", Static: dist})
	get := func(path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("GET", path, nil)
		req.RemoteAddr = "127.0.0.1:1"
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		return w
	}
	for _, page := range []string{"/", "/host"} {
		if w := get(page); w.Code != 200 || !strings.Contains(w.Body.String(), `<div id="root">`) {
			t.Fatalf("GET %s: %d %.80q", page, w.Code, w.Body)
		}
	}
	if w := get("/assets/" + assets[0].Name()); w.Code != 200 {
		t.Fatalf("GET asset: %d", w.Code)
	}
}
