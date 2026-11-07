package qna

import (
	"errors"
	"strings"
	"testing"
)

func TestSetTitle(t *testing.T) {
	h := newHarness()
	if err := h.b.SetTitle("  " + strings.Repeat("oʻ", 40) + "  "); err != nil {
		t.Fatalf("80 runes: %v", err)
	}
	if err := h.b.SetTitle(strings.Repeat("a", 81)); !errors.Is(err, ErrTooLong) {
		t.Fatalf("81 runes: want ErrTooLong, got %v", err)
	}
	if got := h.b.View("", false).Title; got != strings.Repeat("oʻ", 40) {
		t.Fatalf("title %q", got)
	}
	fresh := NewBoard(nil, nil)
	for _, e := range h.events {
		if err := fresh.Apply(e); err != nil {
			t.Fatal(err)
		}
	}
	if fresh.View("", false).Title != h.b.View("", false).Title {
		t.Fatal("replay lost the title")
	}
	if err := h.b.SetTitle(""); err != nil || h.b.View("", false).Title != "" {
		t.Fatalf("clear: %v", err)
	}
}

func vote(t *testing.T, h *harness, id string, n int) {
	t.Helper()
	for i := range n {
		if err := h.b.Vote("v"+string(rune('a'+i)), id); err != nil {
			t.Fatal(err)
		}
	}
}

func questionByID(v View, id string) QuestionView {
	for _, q := range v.Questions {
		if q.ID == id {
			return q
		}
	}
	return QuestionView{}
}

func TestNextAnswersAndHighlightsTopRemaining(t *testing.T) {
	h := newHarness()
	q1, q2, q3 := h.post(t, "d1", "one"), h.post(t, "d2", "two"), h.post(t, "d3", "three")
	vote(t, h, q1, 5)
	vote(t, h, q2, 3)
	vote(t, h, q3, 7)
	h.b.SetHidden(q3, true)
	h.b.Highlight(q1)

	got, err := h.b.Next()
	if err != nil || got != q2 {
		t.Fatalf("Next = %q, %v; want q2", got, err)
	}
	v := h.b.View("", true)
	if !questionByID(v, q1).Answered || v.Highlighted != q2 {
		t.Fatalf("q1 answered=%v highlighted=%q", questionByID(v, q1).Answered, v.Highlighted)
	}
	if q := questionByID(v, q3); q.Answered || !q.Hidden {
		t.Fatalf("q3 touched: %+v", q)
	}
}

func TestNextFromNothingHighlighted(t *testing.T) {
	h := newHarness()
	q1, q2 := h.post(t, "d1", "one"), h.post(t, "d2", "two")
	vote(t, h, q2, 1)
	got, err := h.b.Next()
	if err != nil || got != q2 {
		t.Fatalf("Next = %q, %v; want q2", got, err)
	}
	for _, q := range h.b.View("", true).Questions {
		if q.Answered {
			t.Fatalf("%s answered, want none (q1=%s)", q.ID, q1)
		}
	}
}

func TestNextOnLastQuestionClears(t *testing.T) {
	h := newHarness()
	q1 := h.post(t, "d1", "one")
	h.b.Highlight(q1)
	got, err := h.b.Next()
	if err != nil || got != "" {
		t.Fatalf("Next = %q, %v; want empty", got, err)
	}
	v := h.b.View("", false)
	if v.Highlighted != "" || !questionByID(v, q1).Answered {
		t.Fatalf("highlighted=%q answered=%v", v.Highlighted, questionByID(v, q1).Answered)
	}
}
