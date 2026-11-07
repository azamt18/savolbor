package server

import (
	"io/fs"
	"net/http/httptest"
	"testing"
	"testing/fstest"
	"time"

	"savolbor/qna"
)

func hostPageFrom(t *testing.T, h *Server, remote string, headers map[string]string, target string) int {
	t.Helper()
	req := httptest.NewRequest("GET", target, nil)
	req.RemoteAddr = remote
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w.Code
}

func TestTunnelledLoopbackIsNotHost(t *testing.T) {
	e := newEnv(t)
	// ngrok / cloudflared connect from loopback and add forwarding headers
	for _, hdr := range []string{"X-Forwarded-For", "Forwarded", "Cf-Connecting-Ip", "X-Real-Ip"} {
		if code := hostPageFrom(t, e.h, "127.0.0.1:4000", map[string]string{hdr: "203.0.113.9"}, "/host"); code != 403 {
			t.Fatalf("loopback with %s: %d, want 403", hdr, code)
		}
	}
	if code := hostPageFrom(t, e.h, "127.0.0.1:4000", nil, "/host"); code != 200 {
		t.Fatalf("plain loopback: %d, want 200", code)
	}
}

func TestPublicModeRequiresKeyEvenFromLoopback(t *testing.T) {
	b := qna.NewBoard(func(qna.Event) error { return nil }, time.Now)
	h := New(Config{Board: b, AdminKey: adminKey, JoinURL: "https://x.trycloudflare.com", Public: true,
		Static: fs.FS(fstest.MapFS{"host.html": {Data: []byte("presenter")}})})
	if code := hostPageFrom(t, h, "127.0.0.1:4000", nil, "/host"); code != 403 {
		t.Fatalf("public loopback without key: %d, want 403", code)
	}
	if code := hostPageFrom(t, h, "127.0.0.1:4000", nil, "/host?key="+adminKey); code != 303 {
		t.Fatalf("public loopback with key: %d, want 303", code)
	}
}
