package main

import (
	"context"
	"testing"
	"time"
)

func TestWatchJoinURLReportsOnlyChanges(t *testing.T) {
	seq := []string{"http://a:1", "http://a:1", "http://b:1", "http://b:1", "http://c:1"}
	i := 0
	lookup := func() string {
		u := seq[min(i, len(seq)-1)]
		i++
		return u
	}
	ctx, cancel := context.WithCancel(t.Context())
	var got []string
	done := make(chan struct{})
	go func() {
		watchJoinURL(ctx, time.Millisecond, "http://a:1", lookup, func(u string) {
			got = append(got, u)
			if len(got) == 2 {
				cancel()
			}
		})
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		cancel()
		t.Fatal("watcher did not stop")
	}
	if len(got) != 2 || got[0] != "http://b:1" || got[1] != "http://c:1" {
		t.Fatalf("changes = %v", got)
	}
}
