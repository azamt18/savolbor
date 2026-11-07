package server

import (
	"sync"
	"time"
)

// pollWindow is how long a polling phone still counts as connected. Pages
// poll every 2s, so 6s survives two missed polls.
const pollWindow = 6 * time.Second

// presence counts participant devices: an open sse stream or a recent poll.
type presence struct {
	mu      sync.Mutex
	streams map[string]int
	polls   map[string]time.Time
}

func newPresence() *presence {
	return &presence{streams: map[string]int{}, polls: map[string]time.Time{}}
}

// open registers one stream for device; the returned func closes it and is
// safe to call more than once.
func (p *presence) open(device string) func() {
	p.mu.Lock()
	p.streams[device]++
	p.mu.Unlock()
	var once sync.Once
	return func() {
		once.Do(func() {
			p.mu.Lock()
			defer p.mu.Unlock()
			if p.streams[device]--; p.streams[device] <= 0 {
				delete(p.streams, device)
			}
		})
	}
}

// polled records a poll and reports whether the device is newly counted.
func (p *presence) polled(device string, at time.Time) (fresh bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	last, seen := p.polls[device]
	_, streaming := p.streams[device]
	p.polls[device] = at
	return !streaming && (!seen || at.Sub(last) > pollWindow)
}

func (p *presence) count(now time.Time) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	n := len(p.streams)
	for device, at := range p.polls {
		if now.Sub(at) > pollWindow {
			delete(p.polls, device)
			continue
		}
		if _, streaming := p.streams[device]; !streaming {
			n++
		}
	}
	return n
}
