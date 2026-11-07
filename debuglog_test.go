package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLogRequestsKeepsStatusAndFlush(t *testing.T) {
	h := logRequests(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
		if err := http.NewResponseController(w).Flush(); err != nil {
			t.Errorf("flush through logger: %v", err)
		}
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/api/events", nil))
	if w.Code != http.StatusTeapot || !w.Flushed {
		t.Fatalf("code=%d flushed=%v", w.Code, w.Flushed)
	}
}
