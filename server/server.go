// Package server exposes the board over a small json api and sse.
package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/skip2/go-qrcode"

	"savolbor/qna"
)

const maxBody = 8 << 10

type Config struct {
	Board    *qna.Board
	AdminKey string
	JoinURL  string           // initial value; see SetJoinURL
	Static   fs.FS            // web.Static sub-tree "static"
	Now      func() time.Time // export date; defaults to time.Now
	Public   bool             // reachable from the internet: loopback no longer implies host
}

type Server struct {
	Config
	handler http.Handler

	mu      sync.RWMutex
	joinURL string
	qr      []byte
	// joinSubs get a signal when the join url changes, like board subscribers
	joinSubs map[chan struct{}]struct{}
}

func New(cfg Config) *Server {
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	s := &Server{Config: cfg, joinSubs: map[chan struct{}]struct{}{}}
	s.SetJoinURL(cfg.JoinURL)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", s.page("index.html"))
	mux.HandleFunc("GET /host", s.hostPage)
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServerFS(cfg.Static)))
	mux.HandleFunc("GET /qr.png", s.qrPNG)

	mux.HandleFunc("POST /api/questions", s.post)
	mux.HandleFunc("PATCH /api/questions/{id}", s.edit)
	mux.HandleFunc("DELETE /api/questions/{id}", s.delete)
	mux.HandleFunc("POST /api/questions/{id}/vote", s.vote)
	mux.HandleFunc("GET /api/events", s.events)
	mux.HandleFunc("GET /api/view", s.view)

	mux.HandleFunc("POST /api/host/questions/{id}/answered", s.host(s.toggle(cfg.Board.SetAnswered)))
	mux.HandleFunc("POST /api/host/questions/{id}/hidden", s.host(s.toggle(cfg.Board.SetHidden)))
	mux.HandleFunc("POST /api/host/highlight", s.host(s.highlight))
	mux.HandleFunc("GET /api/host/export.md", s.host(s.export))
	// loopback counts as host, so a page open in the presenter's browser must
	// not be able to post to localhost on their behalf
	cop := http.NewCrossOriginProtection()
	cop.SetDenyHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeErr(w, http.StatusForbidden, "forbidden")
	}))
	s.handler = cop.Handler(withDevice(mux))
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) { s.handler.ServeHTTP(w, r) }

// SetJoinURL changes the participant url (the laptop moved networks): the qr
// code is regenerated and every open stream gets a fresh snapshot.
func (s *Server) SetJoinURL(url string) {
	png, err := qrcode.Encode(url, qrcode.Medium, 512)
	if err != nil {
		slog.Warn("qr code", "url", url, "err", err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.joinURL, s.qr = url, png
	for ch := range s.joinSubs {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}

func (s *Server) join() (string, []byte) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.joinURL, s.qr
}

func (s *Server) subscribeJoin() (<-chan struct{}, func()) {
	ch := make(chan struct{}, 1)
	s.mu.Lock()
	s.joinSubs[ch] = struct{}{}
	s.mu.Unlock()
	return ch, func() {
		s.mu.Lock()
		delete(s.joinSubs, ch)
		s.mu.Unlock()
	}
}

func (s *Server) page(name string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFileFS(w, r, s.Static, name)
	}
}

func (s *Server) hostPage(w http.ResponseWriter, r *http.Request) {
	if !IsHost(r, s.AdminKey, !s.Public) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	if key := r.URL.Query().Get("key"); key != "" {
		setCookie(w, hostCookie, key)
		http.Redirect(w, r, "/host", http.StatusSeeOther)
		return
	}
	s.page("host.html")(w, r)
}

func (s *Server) host(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !IsHost(r, s.AdminKey, !s.Public) {
			writeErr(w, http.StatusForbidden, "forbidden")
			return
		}
		next(w, r)
	}
}

func (s *Server) qrPNG(w http.ResponseWriter, r *http.Request) {
	_, png := s.join()
	if png == nil {
		writeErr(w, http.StatusInternalServerError, "internal")
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "no-cache")
	w.Write(png)
}

func (s *Server) post(w http.ResponseWriter, r *http.Request) {
	var body struct{ Text, Name string }
	if !decode(w, r, &body) {
		return
	}
	id, err := s.Board.Post(DeviceID(r), body.Text, body.Name)
	if err != nil {
		writeBoardErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (s *Server) edit(w http.ResponseWriter, r *http.Request) {
	var body struct{ Text string }
	if !decode(w, r, &body) {
		return
	}
	reply(w, s.Board.Edit(DeviceID(r), r.PathValue("id"), body.Text))
}

func (s *Server) delete(w http.ResponseWriter, r *http.Request) {
	reply(w, s.Board.Delete(DeviceID(r), r.PathValue("id")))
}

func (s *Server) vote(w http.ResponseWriter, r *http.Request) {
	reply(w, s.Board.Vote(DeviceID(r), r.PathValue("id")))
}

func (s *Server) toggle(set func(id string, on bool) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct{ On bool }
		if !decode(w, r, &body) {
			return
		}
		reply(w, set(r.PathValue("id"), body.On))
	}
}

func (s *Server) highlight(w http.ResponseWriter, r *http.Request) {
	var body struct{ ID string }
	if !decode(w, r, &body) {
		return
	}
	reply(w, s.Board.Highlight(body.ID))
}

func (s *Server) export(w http.ResponseWriter, r *http.Request) {
	now := s.Now()
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="savolbor-%s.md"`, now.Format("2006-01-02")))
	fmt.Fprint(w, qna.ExportMarkdown(s.Board.View("", true), now))
}

func decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBody)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		writeErr(w, http.StatusBadRequest, "bad_request")
		return false
	}
	return true
}

func reply(w http.ResponseWriter, err error) {
	if err != nil {
		writeBoardErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeBoardErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, qna.ErrEmpty):
		writeErr(w, http.StatusBadRequest, "empty")
	case errors.Is(err, qna.ErrTooLong):
		writeErr(w, http.StatusBadRequest, "too_long")
	case errors.Is(err, qna.ErrRateLimited):
		writeErr(w, http.StatusTooManyRequests, "rate_limited")
	case errors.Is(err, qna.ErrNotFound):
		writeErr(w, http.StatusNotFound, "not_found")
	case errors.Is(err, qna.ErrNotOwner):
		writeErr(w, http.StatusForbidden, "not_owner")
	case errors.Is(err, qna.ErrAnswered):
		writeErr(w, http.StatusConflict, "answered")
	default:
		slog.Error("board command failed", "err", err)
		writeErr(w, http.StatusInternalServerError, "internal")
	}
}

func writeErr(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
