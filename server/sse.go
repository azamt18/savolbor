package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"savolbor/qna"
)

const pingEvery = 25 * time.Second

// events streams a full board snapshot on connect and after every change.
// Phones that sleep or drop wi-fi reconnect and get a fresh snapshot.
func (s *Server) events(w http.ResponseWriter, r *http.Request) {
	host, ok := s.viewer(w, r)
	if !ok {
		return
	}
	// subscribe before the first snapshot so no change slips in between
	updates, cancel := s.Board.Subscribe()
	defer cancel()
	if !host {
		// counted before this stream subscribes, so it doesn't poke itself
		closeStream := s.presence.open(DeviceID(r))
		s.pokeAll()
		defer func() { closeStream(); s.pokeAll() }()
	}
	poked, cancelPokes := s.subscribePokes()
	defer cancelPokes()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	rc := http.NewResponseController(w)
	fmt.Fprint(w, "retry: 2000\n")

	send := func() error {
		b, err := json.Marshal(s.snapshot(r, host))
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, "data: %s\n\n", b); err != nil {
			return err
		}
		return rc.Flush()
	}
	if send() != nil {
		return
	}
	ping := time.NewTicker(pingEvery)
	defer ping.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-updates:
			if send() != nil {
				return
			}
		case <-poked:
			if send() != nil {
				return
			}
		case <-ping.C:
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil || rc.Flush() != nil {
				return
			}
		}
	}
}

// viewer reads ?view=host and checks the caller may see it.
func (s *Server) viewer(w http.ResponseWriter, r *http.Request) (host, ok bool) {
	host = r.URL.Query().Get("view") == "host"
	if host && !IsHost(r, s.AdminKey, !s.Public) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return false, false
	}
	return host, true
}

func (s *Server) snapshot(r *http.Request, host bool) qna.View {
	v := s.Board.View(DeviceID(r), host)
	v.JoinURL, _ = s.join()
	v.Public = s.Public
	v.Wifi = s.Wifi
	if host {
		v.Connected = s.presence.count(s.Now())
	}
	return v
}

// view returns one snapshot. Pages poll it when a proxy between the phone
// and the laptop holds the sse stream back (corporate tls inspection, …).
func (s *Server) view(w http.ResponseWriter, r *http.Request) {
	host, ok := s.viewer(w, r)
	if !ok {
		return
	}
	if !host && s.presence.polled(DeviceID(r), s.Now()) {
		s.pokeAll() // a new phone: host streams show the new count
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, s.snapshot(r, host))
}
