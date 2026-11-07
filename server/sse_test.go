package server

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"savolbor/qna"
)

// stream opens an sse connection through a real loopback server and returns
// a function that reads the next snapshot.
func stream(t *testing.T, ctx context.Context, url string) (*http.Response, func() qna.View) {
	t.Helper()
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { res.Body.Close() })
	rd := bufio.NewReader(res.Body)
	next := func() qna.View {
		t.Helper()
		for {
			line, err := rd.ReadString('\n')
			if err != nil {
				t.Fatalf("read stream: %v", err)
			}
			if data, ok := strings.CutPrefix(line, "data: "); ok {
				var v qna.View
				if err := json.Unmarshal([]byte(data), &v); err != nil {
					t.Fatalf("bad snapshot %q: %v", data, err)
				}
				return v
			}
		}
	}
	return res, next
}

func TestSSESendsSnapshotOnConnect(t *testing.T) {
	e := newEnv(t)
	postID(t, e.do(t, "POST", "/api/questions", `{"text":"before connect"}`))
	srv := httptest.NewServer(e.h)
	t.Cleanup(srv.Close)
	res, next := stream(t, t.Context(), srv.URL+"/api/events")
	if ct := res.Header.Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("content type %q", ct)
	}
	v := next()
	if len(v.Questions) != 1 || v.Questions[0].Text != "before connect" || v.JoinURL != "http://192.168.1.23:8080" {
		t.Fatalf("snapshot %+v", v)
	}
}

func TestSSEPushesAfterPost(t *testing.T) {
	e := newEnv(t)
	srv := httptest.NewServer(e.h)
	t.Cleanup(srv.Close)
	_, next := stream(t, t.Context(), srv.URL+"/api/events")
	if v := next(); len(v.Questions) != 0 {
		t.Fatalf("first snapshot %+v", v)
	}
	postID(t, e.do(t, "POST", "/api/questions", `{"text":"live"}`))
	if v := next(); len(v.Questions) != 1 || v.Questions[0].Text != "live" {
		t.Fatalf("pushed snapshot %+v", v)
	}
}

func TestSSEHostViewRequiresHost(t *testing.T) {
	e := newEnv(t)
	w := e.do(t, "GET", "/api/events?view=host", "")
	if w.Code != 403 || errCode(t, w) != "forbidden" {
		t.Fatalf("remote host stream: %d %s", w.Code, w.Body)
	}
	id := postID(t, e.do(t, "POST", "/api/questions", `{"text":"hidden"}`))
	if err := e.board.SetHidden(id, true); err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(e.h)
	t.Cleanup(srv.Close)
	_, next := stream(t, t.Context(), srv.URL+"/api/events?view=host")
	if v := next(); len(v.Questions) != 1 || !v.Questions[0].Hidden {
		t.Fatalf("host snapshot %+v", v)
	}
}

func TestSSEUnsubscribesOnDisconnect(t *testing.T) {
	e := newEnv(t)
	srv := httptest.NewServer(e.h)
	t.Cleanup(srv.Close)
	ctx, cancel := context.WithCancel(t.Context())
	_, next := stream(t, ctx, srv.URL+"/api/events")
	next()
	cancel()
	done := make(chan struct{})
	go func() {
		for i := range 5 {
			e.board.Post("d"+string(rune('a'+i)), "after disconnect", "")
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("posting blocked after client disconnected")
	}
}
