package main

import (
	"context"
	"fmt"
	"time"
)

// joinURLFor builds the participant url from the best lan address right now.
func joinURLFor(port int) string {
	host := "localhost"
	if best, _ := pickLANIP(lanInterfaces()); best != nil {
		host = best.String()
	}
	return fmt.Sprintf("http://%s:%d", host, port)
}

// watchJoinURL polls lookup every interval and calls onChange whenever the
// url differs from the last one seen, until ctx ends. Laptops change address
// when they switch wi-fi, wake from sleep or the dhcp lease renews.
func watchJoinURL(ctx context.Context, every time.Duration, current string, lookup func() string, onChange func(string)) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if u := lookup(); u != current {
				current = u
				onChange(u)
			}
		}
	}
}
