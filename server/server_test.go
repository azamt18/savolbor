package server

import (
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"savolbor/qna"
)

const adminKey = "secretkey"

type env struct {
	board *qna.Board
	h     http.Handler
	clock time.Time
}

func newEnv(t *testing.T) *env {
	t.Helper()
	e := &env{clock: time.Date(2026, 11, 6, 10, 0, 0, 0, time.UTC)}
	e.board = qna.NewBoard(func(qna.Event) error { return nil }, func() time.Time { return e.clock })
	static := fstest.MapFS{
		"index.html": {Data: []byte("participant")},
		"host.html":  {Data: []byte("presenter")},
		"app.js":     {Data: []byte("js")},
	}
	e.h = New(Config{Board: e.board, AdminKey: adminKey, JoinURL: "http://192.168.1.23:8080", Static: fs.FS(static), Now: func() time.Time { return e.clock }})
	return e
}

// do sends a request from a remote participant unless remote is overridden.
func (e *env) do(t *testing.T, method, target, body string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, target, r)
	req.RemoteAddr = "192.168.1.50:1234"
	for _, c := range cookies {
		req.AddCookie(c)
	}
	w := httptest.NewRecorder()
	e.h.ServeHTTP(w, req)
	return w
}

func cookie(t *testing.T, w *httptest.ResponseRecorder, name string) *http.Cookie {
	t.Helper()
	for _, c := range w.Result().Cookies() {
		if c.Name == name {
			return c
		}
	}
	t.Fatalf("no %s cookie in response", name)
	return nil
}

func errCode(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	var body struct{ Error string }
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("error body %q: %v", w.Body.String(), err)
	}
	return body.Error
}

func postID(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	if w.Code != http.StatusCreated {
		t.Fatalf("post: %d %s", w.Code, w.Body)
	}
	var body struct{ ID string }
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil || body.ID == "" {
		t.Fatalf("post body %q", w.Body)
	}
	return body.ID
}

func TestFirstRequestSetsDeviceCookie(t *testing.T) {
	e := newEnv(t)
	w := e.do(t, "GET", "/", "")
	if w.Code != 200 || w.Body.String() != "participant" {
		t.Fatalf("GET /: %d %q", w.Code, w.Body)
	}
	c := cookie(t, w, "savolbor_device")
	if !c.HttpOnly || c.SameSite != http.SameSiteLaxMode || c.Path != "/" || len(c.Value) != 32 {
		t.Fatalf("cookie attrs: %+v", c)
	}
	w2 := e.do(t, "GET", "/", "", c)
	for _, c2 := range w2.Result().Cookies() {
		if c2.Name == "savolbor_device" {
			t.Fatal("known device must not get a new cookie")
		}
	}
}

func TestPostAndEditFlow(t *testing.T) {
	e := newEnv(t)
	alice := &http.Cookie{Name: "savolbor_device", Value: strings.Repeat("a", 32)}
	bob := &http.Cookie{Name: "savolbor_device", Value: strings.Repeat("b", 32)}
	id := postID(t, e.do(t, "POST", "/api/questions", `{"text":"salom?","name":"ali"}`, alice))
	if w := e.do(t, "PATCH", "/api/questions/"+id, `{"text":"salom!"}`, alice); w.Code != 204 {
		t.Fatalf("edit: %d %s", w.Code, w.Body)
	}
	w := e.do(t, "PATCH", "/api/questions/"+id, `{"text":"hijack"}`, bob)
	if w.Code != 403 || errCode(t, w) != "not_owner" {
		t.Fatalf("other edit: %d %s", w.Code, w.Body)
	}
	if w := e.do(t, "POST", "/api/questions/"+id+"/vote", "", bob); w.Code != 204 {
		t.Fatalf("vote: %d", w.Code)
	}
	if w := e.do(t, "PATCH", "/api/questions/"+id, `not json`, alice); w.Code != 400 || errCode(t, w) != "bad_request" {
		t.Fatalf("bad json: %d %s", w.Code, w.Body)
	}
	if w := e.do(t, "DELETE", "/api/questions/nope", "", alice); w.Code != 404 || errCode(t, w) != "not_found" {
		t.Fatalf("delete unknown: %d %s", w.Code, w.Body)
	}
	if w := e.do(t, "DELETE", "/api/questions/"+id, "", alice); w.Code != 204 {
		t.Fatalf("delete: %d", w.Code)
	}
}

func TestHTMLTextReturnedRaw(t *testing.T) {
	e := newEnv(t)
	payload := `<img src=x onerror=alert(1)>`
	postID(t, e.do(t, "POST", "/api/questions", `{"text":"<img src=x onerror=alert(1)>"}`))
	if got := e.board.View("", true).Questions[0].Text; got != payload {
		t.Fatalf("text = %q", got)
	}
}

func TestRateLimitReturns429(t *testing.T) {
	e := newEnv(t)
	c := &http.Cookie{Name: "savolbor_device", Value: strings.Repeat("c", 32)}
	postID(t, e.do(t, "POST", "/api/questions", `{"text":"one"}`, c))
	w := e.do(t, "POST", "/api/questions", `{"text":"two"}`, c)
	if w.Code != 429 || errCode(t, w) != "rate_limited" {
		t.Fatalf("second post: %d %s", w.Code, w.Body)
	}
	if w := e.do(t, "POST", "/api/questions", `{"text":"   "}`); w.Code != 400 || errCode(t, w) != "empty" {
		t.Fatalf("empty: %d %s", w.Code, w.Body)
	}
	big := `{"text":"` + strings.Repeat("x", 9000) + `"}`
	if w := e.do(t, "POST", "/api/questions", big); w.Code != 400 {
		t.Fatalf("oversized body: %d %s", w.Code, w.Body)
	}
}

func TestHostRoutesForbiddenForRemoteWithoutKey(t *testing.T) {
	e := newEnv(t)
	id := postID(t, e.do(t, "POST", "/api/questions", `{"text":"q"}`))
	for _, tc := range []struct{ method, path, body string }{
		{"GET", "/host", ""},
		{"POST", "/api/host/questions/" + id + "/answered", `{"on":true}`},
		{"POST", "/api/host/questions/" + id + "/hidden", `{"on":true}`},
		{"POST", "/api/host/highlight", `{"id":"` + id + `"}`},
		{"GET", "/api/host/export.md", ""},
		{"GET", "/host?key=wrong", ""},
	} {
		w := e.do(t, tc.method, tc.path, tc.body)
		if w.Code != 403 || errCode(t, w) != "forbidden" {
			t.Fatalf("%s %s: %d %s", tc.method, tc.path, w.Code, w.Body)
		}
	}
	w := e.do(t, "GET", "/api/host/export.md", "", &http.Cookie{Name: "savolbor_host", Value: "wrong"})
	if w.Code != 403 {
		t.Fatalf("wrong host cookie: %d", w.Code)
	}
}

func TestHostKeyQuerySetsCookieAndRedirects(t *testing.T) {
	e := newEnv(t)
	w := e.do(t, "GET", "/host?key="+adminKey, "")
	if w.Code != http.StatusSeeOther || w.Header().Get("Location") != "/host" {
		t.Fatalf("redirect: %d %q", w.Code, w.Header().Get("Location"))
	}
	c := cookie(t, w, "savolbor_host")
	if c.Value != adminKey || !c.HttpOnly || c.SameSite != http.SameSiteLaxMode {
		t.Fatalf("host cookie: %+v", c)
	}
	w = e.do(t, "GET", "/host", "", c)
	if w.Code != 200 || w.Body.String() != "presenter" {
		t.Fatalf("host page with cookie: %d %q", w.Code, w.Body)
	}
	id := postID(t, e.do(t, "POST", "/api/questions", `{"text":"q"}`))
	if w := e.do(t, "POST", "/api/host/questions/"+id+"/answered", `{"on":true}`, c); w.Code != 204 {
		t.Fatalf("answer with cookie: %d %s", w.Code, w.Body)
	}
	if !e.board.View("", true).Questions[0].Answered {
		t.Fatal("not answered")
	}
}

func TestHostAllowedFromLoopback(t *testing.T) {
	e := newEnv(t)
	srv := httptest.NewServer(e.h)
	defer srv.Close()
	res, err := http.Get(srv.URL + "/host")
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if res.StatusCode != 200 || string(b) != "presenter" {
		t.Fatalf("loopback host: %d %q", res.StatusCode, b)
	}
	res, err = http.Post(srv.URL+"/api/host/highlight", "application/json", strings.NewReader(`{"id":""}`))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 204 {
		t.Fatalf("loopback highlight: %d", res.StatusCode)
	}
}

func TestExportDownload(t *testing.T) {
	e := newEnv(t)
	postID(t, e.do(t, "POST", "/api/questions", `{"text":"q","name":"dilnoza"}`))
	w := e.do(t, "GET", "/api/host/export.md?key="+adminKey, "")
	if w.Code != 200 {
		t.Fatalf("export: %d %s", w.Code, w.Body)
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/markdown") {
		t.Fatalf("content type %q", ct)
	}
	if cd := w.Header().Get("Content-Disposition"); cd != `attachment; filename="savolbor-2026-11-06.md"` {
		t.Fatalf("disposition %q", cd)
	}
	if !strings.Contains(w.Body.String(), "- **0** · q — dilnoza") {
		t.Fatalf("body %q", w.Body)
	}
}

func TestStaticAndQR(t *testing.T) {
	e := newEnv(t)
	if w := e.do(t, "GET", "/static/app.js", ""); w.Code != 200 || w.Body.String() != "js" {
		t.Fatalf("static: %d %q", w.Code, w.Body)
	}
	w := e.do(t, "GET", "/qr.png", "")
	if w.Code != 200 || w.Header().Get("Content-Type") != "image/png" || !strings.HasPrefix(w.Body.String(), "\x89PNG") {
		t.Fatalf("qr: %d %q", w.Code, w.Header().Get("Content-Type"))
	}
}

func TestCrossSiteWritesRejected(t *testing.T) {
	e := newEnv(t)
	id := postID(t, e.do(t, "POST", "/api/questions", `{"text":"q"}`))
	// a malicious page open in the presenter's browser posts to localhost
	req := httptest.NewRequest("POST", "/api/host/questions/"+id+"/hidden", strings.NewReader(`{"on":true}`))
	req.RemoteAddr = "127.0.0.1:5555"
	req.Header.Set("Sec-Fetch-Site", "cross-site")
	req.Header.Set("Origin", "https://evil.example")
	w := httptest.NewRecorder()
	e.h.ServeHTTP(w, req)
	if w.Code != 403 || errCode(t, w) != "forbidden" {
		t.Fatalf("cross-site write: %d %s", w.Code, w.Body)
	}
	if e.board.View("", true).Questions[0].Hidden {
		t.Fatal("question hidden by a cross-site request")
	}
	// same-origin browser requests still work
	req = httptest.NewRequest("POST", "/api/host/questions/"+id+"/hidden", strings.NewReader(`{"on":true}`))
	req.RemoteAddr = "127.0.0.1:5555"
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	w = httptest.NewRecorder()
	e.h.ServeHTTP(w, req)
	if w.Code != 204 {
		t.Fatalf("same-origin write: %d %s", w.Code, w.Body)
	}
}
