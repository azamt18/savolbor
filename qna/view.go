package qna

import (
	"cmp"
	"slices"
	"time"
)

// QuestionView is what a client sees. It never carries the author's device id.
type QuestionView struct {
	ID        string    `json:"id"`
	Text      string    `json:"text"`
	Name      string    `json:"name,omitempty"`
	Votes     int       `json:"votes"`
	CreatedAt time.Time `json:"createdAt"`
	Voted     bool      `json:"voted"`
	Mine      bool      `json:"mine"`
	Edited    bool      `json:"edited"`
	Answered  bool      `json:"answered"`
	Hidden    bool      `json:"hidden,omitempty"`
}

type View struct {
	Questions   []QuestionView `json:"questions"` // creation order; never nil
	Highlighted string         `json:"highlighted,omitempty"`
	Title       string         `json:"title,omitempty"`
	JoinURL     string         `json:"joinUrl,omitempty"`   // filled by server
	Connected   int            `json:"connected,omitempty"` // host view only, filled by server
	Public      bool           `json:"public,omitempty"`    // filled by server
	Wifi        string         `json:"wifi,omitempty"`      // -wifi flag, filled by server
}

// View returns a snapshot for one device. host=true includes hidden questions.
func (b *Board) View(device string, host bool) View {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.view(device, host)
}

func (b *Board) view(device string, host bool) View {
	v := View{Questions: make([]QuestionView, 0, len(b.order)), Highlighted: b.highlighted, Title: b.title}
	for _, id := range b.order {
		q := b.questions[id]
		if q.Hidden && !host {
			continue
		}
		_, voted := q.Voters[device]
		v.Questions = append(v.Questions, QuestionView{
			ID: q.ID, Text: q.Text, Name: q.Name, Votes: len(q.Voters), CreatedAt: q.CreatedAt,
			Voted: voted, Mine: device != "" && q.Author == device,
			Edited: q.Edited, Answered: q.Answered, Hidden: q.Hidden,
		})
	}
	if !host && v.Highlighted != "" && b.questions[v.Highlighted].Hidden {
		v.Highlighted = ""
	}
	return v
}

// Ranked returns a copy sorted by votes (most first), ties going to the
// oldest question so early askers are not pushed down by later ones.
func Ranked(qs []QuestionView) []QuestionView {
	out := slices.Clone(qs)
	slices.SortStableFunc(out, func(a, b QuestionView) int {
		if c := cmp.Compare(b.Votes, a.Votes); c != 0 {
			return c
		}
		return a.CreatedAt.Compare(b.CreatedAt)
	})
	return out
}
