package server

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"savolbor/qna"
)

func TestPresenceCountsStreamsAndRecentPolls(t *testing.T) {
	p := newPresence()
	t0 := time.Date(2026, 11, 7, 10, 0, 0, 0, time.UTC)
	c1, c2 := p.open("d1"), p.open("d1")
	if n := p.count(t0); n != 1 {
		t.Fatalf("two streams, one device: %d", n)
	}
	c1()
	c1() // closing twice must not go negative
	if n := p.count(t0); n != 1 {
		t.Fatalf("one stream left: %d", n)
	}
	c2()
	if n := p.count(t0); n != 0 {
		t.Fatalf("all closed: %d", n)
	}
	p.polled("d2", t0)
	if n := p.count(t0.Add(5 * time.Second)); n != 1 {
		t.Fatalf("poll 5s ago: %d", n)
	}
	if n := p.count(t0.Add(7 * time.Second)); n != 0 {
		t.Fatalf("poll 7s ago: %d", n)
	}
}

func hostView(t *testing.T, e *env, target string, cookies ...*http.Cookie) qna.View {
	t.Helper()
	w := e.do(t, "GET", target, "", cookies...)
	var v qna.View
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &v) != nil {
		t.Fatalf("%s: %d %s", target, w.Code, w.Body)
	}
	return v
}

func TestHostViewHasConnectedParticipantDoesNot(t *testing.T) {
	e := newEnv(t)
	first := e.do(t, "GET", "/api/view", "")
	dev := cookie(t, first, "savolbor_device")
	e.do(t, "GET", "/api/view", "", dev) // same phone polling again
	e.do(t, "GET", "/api/view", "")      // a second phone
	hostView(t, e, "/api/view?view=host&key="+adminKey)
	if v := hostView(t, e, "/api/view?view=host&key="+adminKey); v.Connected != 2 {
		t.Fatalf("connected %d, want 2 (host polls not counted)", v.Connected)
	}
	if v := hostView(t, e, "/api/view", dev); v.Connected != 0 {
		t.Fatalf("participant sees connected=%d", v.Connected)
	}
}

func TestPublicFlagInSnapshot(t *testing.T) {
	e := newEnv(t)
	if hostView(t, e, "/api/view").Public {
		t.Fatal("lan server reports public")
	}
	b := qna.NewBoard(func(qna.Event) error { return nil }, time.Now)
	pub := &env{board: b, h: New(Config{Board: b, AdminKey: adminKey, Public: true,
		JoinURL: "https://x.trycloudflare.com", Static: fs.FS(fstest.MapFS{})})}
	if !hostView(t, pub, "/api/view").Public {
		t.Fatal("public server does not report public")
	}
}

func TestTitleAndNextRoutesRequireHost(t *testing.T) {
	e := newEnv(t)
	id := postID(t, e.do(t, "POST", "/api/questions", `{"text":"q"}`))
	for _, path := range []string{"/api/host/title", "/api/host/next"} {
		if w := e.do(t, "POST", path, `{"title":"x"}`); w.Code != 403 {
			t.Fatalf("%s remote: %d", path, w.Code)
		}
	}
	host := &http.Cookie{Name: "savolbor_host", Value: adminKey}
	if w := e.do(t, "POST", "/api/host/title", `{"title":"  Agentlar  "}`, host); w.Code != 204 {
		t.Fatalf("title: %d %s", w.Code, w.Body)
	}
	if w := e.do(t, "POST", "/api/host/title", `{"title":"`+strings.Repeat("x", 81)+`"}`, host); w.Code != 400 || errCode(t, w) != "too_long" {
		t.Fatalf("long title: %d %s", w.Code, w.Body)
	}
	if v := hostView(t, e, "/api/view"); v.Title != "Agentlar" {
		t.Fatalf("title %q", v.Title)
	}
	w := e.do(t, "POST", "/api/host/next", "", host)
	var body struct{ ID string }
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &body) != nil || body.ID != id {
		t.Fatalf("next: %d %s", w.Code, w.Body)
	}
	w = e.do(t, "POST", "/api/host/next", "", host)
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &body) != nil || body.ID != "" {
		t.Fatalf("next on empty queue: %d %s", w.Code, w.Body)
	}
}
