package server

import (
	"bytes"
	"net/http/httptest"
	"testing"
)

func TestSetJoinURLUpdatesQRAndPushesSnapshot(t *testing.T) {
	e := newEnv(t)
	before := e.do(t, "GET", "/qr.png", "").Body.Bytes()

	srv := httptest.NewServer(e.h)
	t.Cleanup(srv.Close)
	_, next := stream(t, t.Context(), srv.URL+"/api/events")
	if v := next(); v.JoinURL != "http://192.168.1.23:8080" {
		t.Fatalf("initial joinUrl %q", v.JoinURL)
	}

	e.h.SetJoinURL("http://10.24.44.52:8080")
	if v := next(); v.JoinURL != "http://10.24.44.52:8080" {
		t.Fatalf("pushed joinUrl %q", v.JoinURL)
	}
	w := e.do(t, "GET", "/qr.png", "")
	if bytes.Equal(before, w.Body.Bytes()) {
		t.Fatal("qr code not regenerated")
	}
	if cc := w.Header().Get("Cache-Control"); cc != "no-cache" {
		t.Fatalf("qr Cache-Control %q", cc)
	}
}
