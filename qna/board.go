package qna

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

const (
	MaxTextLen = 280
	MaxNameLen = 40
)

type question struct {
	ID        string
	Text      string
	Name      string
	Author    string
	CreatedAt time.Time
	Voters    map[string]struct{}
	Edited    bool
	Answered  bool
	Hidden    bool
}

// Board is the in-memory q&a state. Every change goes through commit before
// it is applied, so the log and memory never disagree.
type Board struct {
	mu          sync.Mutex
	commit      func(Event) error
	now         func() time.Time
	questions   map[string]*question
	order       []string
	highlighted string
	subs        map[int]chan struct{}
	nextSub     int
}

func NewBoard(commit func(Event) error, now func() time.Time) *Board {
	return &Board{
		commit:    commit,
		now:       now,
		questions: map[string]*question{},
		subs:      map[int]chan struct{}{},
	}
}

// Apply replays a logged event: no commit, no notify.
func (b *Board) Apply(e Event) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.apply(e)
}

func (b *Board) apply(e Event) error {
	switch e.Type {
	case EvPost:
		b.questions[e.QID] = &question{
			ID: e.QID, Text: e.Text, Name: e.Name, Author: e.Device,
			CreatedAt: e.At, Voters: map[string]struct{}{},
		}
		b.order = append(b.order, e.QID)
		return nil
	case EvHighlight:
		b.highlighted = e.QID
		return nil
	}
	q, ok := b.questions[e.QID]
	if !ok {
		return fmt.Errorf("%s %s: %w", e.Type, e.QID, ErrNotFound)
	}
	switch e.Type {
	case EvEdit:
		q.Text, q.Edited = e.Text, true
	case EvDelete:
		delete(b.questions, e.QID)
		for i, id := range b.order {
			if id == e.QID {
				b.order = append(b.order[:i], b.order[i+1:]...)
				break
			}
		}
		if b.highlighted == e.QID {
			b.highlighted = ""
		}
	case EvVote:
		q.Voters[e.Device] = struct{}{}
	case EvAnswer:
		q.Answered = e.On
	case EvHide:
		q.Hidden = e.On
	default:
		return fmt.Errorf("unknown event type %q", e.Type)
	}
	return nil
}

// exec runs one command under the lock: check validates and returns the
// event to record (nil means a silent no-op).
func (b *Board) exec(check func(now time.Time) (*Event, error)) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := b.now()
	e, err := check(now)
	if err != nil || e == nil {
		return err
	}
	e.At = now
	if err := b.commit(*e); err != nil {
		return err
	}
	if err := b.apply(*e); err != nil {
		return err
	}
	for _, ch := range b.subs {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
	return nil
}

// visible returns a question participants may act on.
func (b *Board) visible(id string) (*question, error) {
	q, ok := b.questions[id]
	if !ok || q.Hidden {
		return nil, ErrNotFound
	}
	return q, nil
}

func (b *Board) owned(device, id string) (*question, error) {
	q, err := b.visible(id)
	if err != nil {
		return nil, err
	}
	if q.Author != device {
		return nil, ErrNotOwner
	}
	return q, nil
}

// cleanText trims s and enforces the max length in runes. When required is
// true an empty result is an error.
func cleanText(s string, max int, required bool) (string, error) {
	s = strings.TrimSpace(s)
	if required && s == "" {
		return "", ErrEmpty
	}
	if utf8.RuneCountInString(s) > max {
		return "", ErrTooLong
	}
	return s, nil
}

func (b *Board) Post(device, text, name string) (string, error) {
	var id string
	err := b.exec(func(time.Time) (*Event, error) {
		text, err := cleanText(text, MaxTextLen, true)
		if err != nil {
			return nil, err
		}
		name, err := cleanText(name, MaxNameLen, false)
		if err != nil {
			return nil, err
		}
		id = newID()
		return &Event{Type: EvPost, QID: id, Device: device, Text: text, Name: name}, nil
	})
	if err != nil {
		return "", err
	}
	return id, nil
}

func (b *Board) Edit(device, id, text string) error {
	return b.exec(func(time.Time) (*Event, error) {
		q, err := b.owned(device, id)
		if err != nil {
			return nil, err
		}
		if q.Answered {
			return nil, ErrAnswered
		}
		text, err := cleanText(text, MaxTextLen, true)
		if err != nil {
			return nil, err
		}
		return &Event{Type: EvEdit, QID: id, Device: device, Text: text}, nil
	})
}

func (b *Board) Delete(device, id string) error {
	return b.exec(func(time.Time) (*Event, error) {
		if _, err := b.owned(device, id); err != nil {
			return nil, err
		}
		return &Event{Type: EvDelete, QID: id, Device: device}, nil
	})
}

func (b *Board) Vote(device, id string) error {
	return b.exec(func(time.Time) (*Event, error) {
		q, err := b.visible(id)
		if err != nil {
			return nil, err
		}
		if _, voted := q.Voters[device]; voted {
			return nil, nil
		}
		return &Event{Type: EvVote, QID: id, Device: device}, nil
	})
}

func (b *Board) SetAnswered(id string, on bool) error {
	return b.hostToggle(EvAnswer, id, on)
}

func (b *Board) SetHidden(id string, on bool) error {
	return b.hostToggle(EvHide, id, on)
}

func (b *Board) hostToggle(t EventType, id string, on bool) error {
	return b.exec(func(time.Time) (*Event, error) {
		if _, ok := b.questions[id]; !ok {
			return nil, ErrNotFound
		}
		return &Event{Type: t, QID: id, Device: HostDevice, On: on}, nil
	})
}

// Highlight marks the question being answered now; "" clears it.
func (b *Board) Highlight(id string) error {
	return b.exec(func(time.Time) (*Event, error) {
		if id != "" {
			if _, ok := b.questions[id]; !ok {
				return nil, ErrNotFound
			}
		}
		return &Event{Type: EvHighlight, QID: id, Device: HostDevice}, nil
	})
}

// Subscribe returns a channel that receives a signal after each change.
// Bursts coalesce into one pending signal.
func (b *Board) Subscribe() (<-chan struct{}, func()) {
	b.mu.Lock()
	defer b.mu.Unlock()
	ch := make(chan struct{}, 1)
	key := b.nextSub
	b.nextSub++
	b.subs[key] = ch
	var once sync.Once
	return ch, func() {
		once.Do(func() {
			b.mu.Lock()
			delete(b.subs, key)
			b.mu.Unlock()
		})
	}
}

func newID() string {
	buf := make([]byte, 8)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}
