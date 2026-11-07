package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const pingEvery = 25 * time.Second

// events streams a full board snapshot on connect and after every change.
// Phones that sleep or drop wi-fi reconnect and get a fresh snapshot.
func (s *Server) events(w http.ResponseWriter, r *http.Request) {
	host := r.URL.Query().Get("view") == "host"
	if host && !IsHost(r, s.AdminKey, !s.Public) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	device := DeviceID(r)
	// subscribe before the first snapshot so no change slips in between
	updates, cancel := s.Board.Subscribe()
	defer cancel()
	moved, cancelJoin := s.subscribeJoin()
	defer cancelJoin()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	rc := http.NewResponseController(w)
	fmt.Fprint(w, "retry: 2000\n")

	send := func() error {
		v := s.Board.View(device, host)
		v.JoinURL, _ = s.join()
		b, err := json.Marshal(v)
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
		case <-moved:
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
