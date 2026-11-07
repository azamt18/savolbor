package server

import (
	"encoding/json"
	"testing"

	"savolbor/qna"
)

func TestViewEndpointForPolling(t *testing.T) {
	e := newEnv(t)
	id := postID(t, e.do(t, "POST", "/api/questions", `{"text":"visible"}`))
	hid := postID(t, e.do(t, "POST", "/api/questions", `{"text":"hidden"}`))
	_ = id
	if err := e.board.SetHidden(hid, true); err != nil {
		t.Fatal(err)
	}
	w := e.do(t, "GET", "/api/view", "")
	var v qna.View
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &v) != nil {
		t.Fatalf("view: %d %s", w.Code, w.Body)
	}
	if len(v.Questions) != 1 || v.JoinURL != "http://192.168.1.23:8080" {
		t.Fatalf("participant view %+v", v)
	}
	if cc := w.Header().Get("Cache-Control"); cc != "no-store" {
		t.Fatalf("Cache-Control %q", cc)
	}
	if w := e.do(t, "GET", "/api/view?view=host", ""); w.Code != 403 {
		t.Fatalf("remote host view: %d", w.Code)
	}
	w = e.do(t, "GET", "/api/view?view=host&key="+adminKey, "")
	if json.Unmarshal(w.Body.Bytes(), &v) != nil || len(v.Questions) != 2 {
		t.Fatalf("host view: %d %s", w.Code, w.Body)
	}
}
