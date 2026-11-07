// Package qna holds the event-sourced question board.
package qna

import "time"

type EventType string

const (
	EvPost      EventType = "post"
	EvEdit      EventType = "edit"
	EvDelete    EventType = "delete"
	EvVote      EventType = "vote"
	EvAnswer    EventType = "answer"
	EvHide      EventType = "hide"
	EvHighlight EventType = "highlight"
)

// Event is one change to the board. It is the unit written to the log and
// replayed on start.
type Event struct {
	Type   EventType `json:"type"`
	At     time.Time `json:"at"`
	QID    string    `json:"qid,omitempty"`
	Device string    `json:"device,omitempty"` // "host" for presenter events
	Text   string    `json:"text,omitempty"`
	Name   string    `json:"name,omitempty"`
	On     bool      `json:"on,omitempty"` // answer/hide toggles
}

// HostDevice marks events issued by the presenter.
const HostDevice = "host"
