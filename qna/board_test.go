package qna

import (
	"errors"
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

var t0 = time.Date(2026, 11, 6, 10, 0, 0, 0, time.UTC)

type harness struct {
	b      *Board
	clock  time.Time
	events []Event
	fail   error
}

func newHarness() *harness {
	h := &harness{clock: t0}
	h.b = NewBoard(func(e Event) error {
		if h.fail != nil {
			return h.fail
		}
		h.events = append(h.events, e)
		return nil
	}, func() time.Time { return h.clock })
	return h
}

func (h *harness) advance(d time.Duration) { h.clock = h.clock.Add(d) }

func (h *harness) post(t *testing.T, device, text string) string {
	t.Helper()
	id, err := h.b.Post(device, text, "")
	if err != nil {
		t.Fatalf("post %q: %v", text, err)
	}
	h.advance(PostCooldown)
	return id
}

func TestPostAcceptsUzbek280Runes(t *testing.T) {
	h := newHarness()
	unit := "oʻgʻş😀" // 6 runes, 15 bytes
	text := strings.Repeat(unit, 46) + "salom"[:4] // 276 + 4 = 280 runes
	if n := utf8.RuneCountInString(text); n != 280 || len(text) <= 280 {
		t.Fatalf("fixture: %d runes, %d bytes", n, len(text))
	}
	if _, err := h.b.Post("d1", text, ""); err != nil {
		t.Fatalf("280 runes: want ok, got %v", err)
	}
	h.advance(PostCooldown)
	if _, err := h.b.Post("d1", text+"a", ""); !errors.Is(err, ErrTooLong) {
		t.Fatalf("281 runes: want ErrTooLong, got %v", err)
	}
	if _, err := h.b.Post("d1", "   ", ""); !errors.Is(err, ErrEmpty) {
		t.Fatalf("blank: want ErrEmpty, got %v", err)
	}
	if _, err := h.b.Post("d1", "ok", strings.Repeat("gʻ", 20)+"a"); !errors.Is(err, ErrTooLong) {
		t.Fatalf("41-rune name: want ErrTooLong, got %v", err)
	}
	if _, err := h.b.Post("d1", "ok", strings.Repeat("gʻ", 20)); err != nil {
		t.Fatalf("40-rune name: want ok, got %v", err)
	}
}

func TestPostRateLimit(t *testing.T) {
	h := newHarness()
	if _, err := h.b.Post("d1", "first", ""); err != nil {
		t.Fatal(err)
	}
	h.advance(19 * time.Second)
	if _, err := h.b.Post("d1", "second", ""); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("+19s: want ErrRateLimited, got %v", err)
	}
	h.clock = t0.Add(time.Second)
	if _, err := h.b.Post("d2", "other device", ""); err != nil {
		t.Fatalf("other device +1s: want ok, got %v", err)
	}
	h.clock = t0.Add(20 * time.Second)
	if _, err := h.b.Post("d1", "second", ""); err != nil {
		t.Fatalf("+20s: want ok, got %v", err)
	}
}

func TestEditOwnerOnlyUntilAnswered(t *testing.T) {
	h := newHarness()
	id := h.post(t, "d1", "original")
	if err := h.b.Vote("d2", id); err != nil {
		t.Fatal(err)
	}
	if err := h.b.Edit("d2", id, "hijack"); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("other device: want ErrNotOwner, got %v", err)
	}
	if err := h.b.Edit("d1", id, "  fixed typo  "); err != nil {
		t.Fatalf("author edit: %v", err)
	}
	q := h.b.questions[id]
	if q.Text != "fixed typo" || !q.Edited || len(q.Voters) != 1 {
		t.Fatalf("after edit: text=%q edited=%v voters=%d", q.Text, q.Edited, len(q.Voters))
	}
	if err := h.b.Edit("d1", id, ""); !errors.Is(err, ErrEmpty) {
		t.Fatalf("empty edit: want ErrEmpty, got %v", err)
	}
	if err := h.b.SetAnswered(id, true); err != nil {
		t.Fatal(err)
	}
	if err := h.b.Edit("d1", id, "too late"); !errors.Is(err, ErrAnswered) {
		t.Fatalf("answered: want ErrAnswered, got %v", err)
	}
}

func TestDeleteOwnerOnlyClearsHighlight(t *testing.T) {
	h := newHarness()
	id := h.post(t, "d1", "question")
	if err := h.b.Highlight(id); err != nil {
		t.Fatal(err)
	}
	if err := h.b.Delete("d2", id); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("other device: want ErrNotOwner, got %v", err)
	}
	if err := h.b.Delete("d1", id); err != nil {
		t.Fatal(err)
	}
	if _, ok := h.b.questions[id]; ok || len(h.b.order) != 0 {
		t.Fatal("question still present after delete")
	}
	if h.b.highlighted != "" {
		t.Fatalf("highlight not cleared: %q", h.b.highlighted)
	}
	if err := h.b.Delete("d1", id); !errors.Is(err, ErrNotFound) {
		t.Fatalf("second delete: want ErrNotFound, got %v", err)
	}
}

func TestVoteOncePerDevice(t *testing.T) {
	h := newHarness()
	id := h.post(t, "d1", "question")
	before := len(h.events)
	for range 2 {
		if err := h.b.Vote("d2", id); err != nil {
			t.Fatal(err)
		}
	}
	if n := len(h.b.questions[id].Voters); n != 1 {
		t.Fatalf("voters = %d, want 1", n)
	}
	if n := len(h.events) - before; n != 1 {
		t.Fatalf("vote events committed = %d, want 1", n)
	}
	if err := h.b.Vote("d2", "nope"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown id: want ErrNotFound, got %v", err)
	}
	if err := h.b.SetHidden(id, true); err != nil {
		t.Fatal(err)
	}
	if err := h.b.Vote("d3", id); !errors.Is(err, ErrNotFound) {
		t.Fatalf("hidden: want ErrNotFound, got %v", err)
	}
}

func TestCommitFailureLeavesStateUntouched(t *testing.T) {
	h := newHarness()
	h.fail = errors.New("disk full")
	if _, err := h.b.Post("d1", "question", ""); !errors.Is(err, h.fail) {
		t.Fatalf("want commit error, got %v", err)
	}
	if len(h.b.questions) != 0 || len(h.b.order) != 0 {
		t.Fatal("board changed despite commit failure")
	}
	h.fail = nil
	if _, err := h.b.Post("d1", "question", ""); err != nil {
		t.Fatalf("failed post must not start the cooldown: %v", err)
	}
}

func TestReplayRebuildsState(t *testing.T) {
	h := newHarness()
	a := h.post(t, "d1", "alpha")
	b := h.post(t, "d2", "beta")
	c := h.post(t, "d3", "gamma")
	d := h.post(t, "d4", "delta")
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(h.b.Vote("d2", a))
	must(h.b.Vote("d3", a))
	must(h.b.Edit("d2", b, "beta edited"))
	must(h.b.SetAnswered(a, true))
	must(h.b.SetHidden(c, true))
	must(h.b.Delete("d4", d))
	must(h.b.Highlight(b))

	fresh := NewBoard(func(Event) error { t.Fatal("replay must not commit"); return nil }, func() time.Time { return h.clock })
	for _, e := range h.events {
		must(fresh.Apply(e))
	}
	if len(fresh.order) != 3 || fresh.order[0] != a || fresh.order[1] != b || fresh.order[2] != c {
		t.Fatalf("order = %v", fresh.order)
	}
	qa, qb := fresh.questions[a], fresh.questions[b]
	if len(qa.Voters) != 2 || !qa.Answered {
		t.Fatalf("alpha: voters=%d answered=%v", len(qa.Voters), qa.Answered)
	}
	if qb.Text != "beta edited" || !qb.Edited || qb.Author != "d2" {
		t.Fatalf("beta: %+v", qb)
	}
	if !fresh.questions[c].Hidden {
		t.Fatal("gamma should be hidden")
	}
	if fresh.highlighted != b {
		t.Fatalf("highlight = %q, want %q", fresh.highlighted, b)
	}
	// replay restores the cooldown: d3 posted at t0+40s
	if !fresh.lastPost["d3"].Equal(t0.Add(40 * time.Second)) {
		t.Fatalf("lastPost[d3] = %v", fresh.lastPost["d3"])
	}
	fresh.now = func() time.Time { return t0.Add(50 * time.Second) }
	if _, err := fresh.Post("d3", "too soon", ""); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("want ErrRateLimited after replay, got %v", err)
	}
}

func TestSubscribeCoalesces(t *testing.T) {
	h := newHarness()
	updates, cancel := h.b.Subscribe()
	defer cancel()
	id := h.post(t, "d1", "question")
	_ = h.b.Vote("d2", id)
	_ = h.b.Highlight(id)
	select {
	case <-updates:
	default:
		t.Fatal("expected one pending update")
	}
	select {
	case <-updates:
		t.Fatal("updates should coalesce into one")
	default:
	}
	cancel()
	if _, err := h.b.Post("d2", "after cancel", ""); err != nil {
		t.Fatal(err)
	}
}
