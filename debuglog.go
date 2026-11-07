package main

import (
	"log/slog"
	"net/http"
	"time"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// Unwrap lets http.NewResponseController reach the real writer, so sse
// flushing keeps working behind the logger.
func (r *statusRecorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

// logRequests logs every request at debug level: who, what, status, time.
// sse streams log when the connection opens and again when it closes.
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		if r.URL.Path == "/api/events" {
			slog.Debug("stream open", "from", r.RemoteAddr, "query", r.URL.RawQuery, "ua", r.UserAgent())
		}
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		slog.Debug("request", "from", r.RemoteAddr, "method", r.Method, "path", r.URL.Path,
			"status", rec.status, "took", time.Since(start).Round(time.Millisecond))
	})
}
