package main

import (
	"path/filepath"
	"testing"
	"time"

	"savolbor/qna"
)

func TestSeedDemo(t *testing.T) {
	b := qna.NewBoard(func(qna.Event) error { return nil }, time.Now)
	if err := seedDemo(b); err != nil {
		t.Fatal(err)
	}
	v := b.View("", true)
	if v.Title != "Plov pishirish darsi" {
		t.Errorf("title = %q", v.Title)
	}
	open, answered, hidden, top := 0, 0, 0, 0
	for _, q := range v.Questions {
		switch {
		case q.Hidden:
			hidden++
		case q.Answered:
			answered++
		default:
			open++
		}
		top = max(top, q.Votes)
	}
	if open != 8 || answered != 1 || hidden != 1 {
		t.Errorf("open/answered/hidden = %d/%d/%d, want 8/1/1", open, answered, hidden)
	}
	if top != 6 {
		t.Errorf("top votes = %d, want 6", top)
	}
}

func TestDemoUsesItsOwnLog(t *testing.T) {
	o, err := parseOptions([]string{"-demo"})
	if err != nil {
		t.Fatal(err)
	}
	if !o.demo || filepath.Base(o.data) != "savolbor-demo.jsonl" {
		t.Errorf("demo=%v data=%q, want the demo log", o.demo, o.data)
	}
	o, _ = parseOptions([]string{"-demo", "-data", "mine.jsonl"})
	if o.data != "mine.jsonl" {
		t.Errorf("an explicit -data wins, got %q", o.data)
	}
	o, _ = parseOptions(nil)
	if o.demo || filepath.Base(o.data) == "savolbor-demo.jsonl" {
		t.Errorf("no -demo: demo=%v data=%q", o.demo, o.data)
	}
}
