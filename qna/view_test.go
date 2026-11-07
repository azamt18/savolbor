package qna

import (
	"testing"
	"time"
)

func TestViewHidesHiddenForParticipants(t *testing.T) {
	h := newHarness()
	a := h.post(t, "d1", "visible")
	b := h.post(t, "d1", "hidden one")
	if err := h.b.SetHidden(b, true); err != nil {
		t.Fatal(err)
	}
	v := h.b.View("d2", false)
	if len(v.Questions) != 1 || v.Questions[0].ID != a {
		t.Fatalf("participant view: %+v", v.Questions)
	}
	hv := h.b.View("", true)
	if len(hv.Questions) != 2 || !hv.Questions[1].Hidden {
		t.Fatalf("host view: %+v", hv.Questions)
	}
	if empty := NewBoard(nil, time.Now).View("d1", false); empty.Questions == nil {
		t.Fatal("Questions must never be nil")
	}
}

func TestViewMineAndVoted(t *testing.T) {
	h := newHarness()
	id := h.post(t, "d1", "q")
	if err := h.b.Vote("d2", id); err != nil {
		t.Fatal(err)
	}
	if err := h.b.Highlight(id); err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		device      string
		mine, voted bool
	}{{"d1", true, false}, {"d2", false, true}, {"d3", false, false}}
	for _, c := range cases {
		v := h.b.View(c.device, false)
		q := v.Questions[0]
		if q.Mine != c.mine || q.Voted != c.voted || q.Votes != 1 || v.Highlighted != id {
			t.Fatalf("%s: %+v highlighted=%q", c.device, q, v.Highlighted)
		}
	}
}

func TestRankedVotesThenOldest(t *testing.T) {
	qs := []QuestionView{
		{ID: "old1", Votes: 2, CreatedAt: t0},
		{ID: "top", Votes: 5, CreatedAt: t0.Add(3 * time.Minute)},
		{ID: "new1", Votes: 2, CreatedAt: t0.Add(2 * time.Minute)},
		{ID: "zero", Votes: 0, CreatedAt: t0.Add(-time.Minute)},
	}
	got := Ranked(qs)
	want := []string{"top", "old1", "new1", "zero"}
	for i, id := range want {
		if got[i].ID != id {
			t.Fatalf("rank %d = %s, want %s (all: %+v)", i, got[i].ID, id, got)
		}
	}
	if qs[0].ID != "old1" {
		t.Fatal("Ranked must not modify its input")
	}
}

func TestExportMarkdownExact(t *testing.T) {
	v := View{Questions: []QuestionView{
		{ID: "1", Text: "anonymous question here", Votes: 2, CreatedAt: t0},
		{ID: "2", Text: "what is event sourcing?", Votes: 7, CreatedAt: t0, Answered: true},
		{ID: "3", Text: "how does sse reconnect?", Name: "dilnoza", Votes: 5, CreatedAt: t0.Add(time.Minute)},
		{ID: "4", Text: "spam", Votes: 9, CreatedAt: t0, Hidden: true},
	}}
	want := `# savolbor — 2026-11-06

## unanswered

- **5** · how does sse reconnect? — dilnoza
- **2** · anonymous question here

## answered

- **7** · what is event sourcing?
`
	if got := ExportMarkdown(v, t0); got != want {
		t.Fatalf("got:\n%s\nwant:\n%s", got, want)
	}
	empty := "# savolbor — 2026-11-06\n\n## unanswered\n\n_none_\n\n## answered\n\n_none_\n"
	if got := ExportMarkdown(View{}, t0); got != empty {
		t.Fatalf("empty got:\n%q", got)
	}
}
