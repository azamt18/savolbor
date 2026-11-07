package store

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"savolbor/qna"
)

var t0 = time.Date(2026, 11, 6, 10, 0, 0, 0, time.UTC)

func TestAppendThenReopen(t *testing.T) {
	path := filepath.Join(t.TempDir(), "s.jsonl")
	l, events, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 0 {
		t.Fatalf("new file: %d events", len(events))
	}
	want := []qna.Event{
		{Type: qna.EvPost, At: t0, QID: "a", Device: "d1", Text: "oʻzbekcha savol?"},
		{Type: qna.EvVote, At: t0.Add(time.Second), QID: "a", Device: "d2"},
		{Type: qna.EvEdit, At: t0.Add(2 * time.Second), QID: "a", Device: "d1", Text: "edited"},
	}
	for _, e := range want {
		if err := l.Append(e); err != nil {
			t.Fatal(err)
		}
	}
	if err := l.Close(); err != nil {
		t.Fatal(err)
	}
	l, got, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	if len(got) != len(want) {
		t.Fatalf("got %d events, want %d", len(got), len(want))
	}
	for i := range want {
		g, w := got[i], want[i]
		if g.Type != w.Type || g.QID != w.QID || g.Text != w.Text || !g.At.Equal(w.At) {
			t.Fatalf("event %d: got %+v, want %+v", i, g, w)
		}
	}
}

func TestTruncatedLastLineIsSkipped(t *testing.T) {
	path := filepath.Join(t.TempDir(), "s.jsonl")
	data := `{"type":"post","at":"2026-11-06T10:00:00Z","qid":"a","device":"d1","text":"one"}
{"type":"vote","at":"2026-11-06T10:00:01Z","qid":"a","device":"d2"}
{"type":"po`
	if err := os.WriteFile(path, []byte(data), 0o644); err != nil {
		t.Fatal(err)
	}
	l, events, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 2 {
		t.Fatalf("got %d events, want 2", len(events))
	}
	if err := l.Append(qna.Event{Type: qna.EvPost, At: t0, QID: "b", Device: "d3", Text: "two"}); err != nil {
		t.Fatal(err)
	}
	l.Close()
	l, events, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	if len(events) != 3 || events[2].QID != "b" {
		t.Fatalf("after append: %+v", events)
	}
}

func TestOpenCreatesMissingFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "new.jsonl")
	l, _, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("file not created: %v", err)
	}
}
