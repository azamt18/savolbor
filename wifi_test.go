package main

import "testing"

func TestWifiLine(t *testing.T) {
	if got := wifiLine(""); got != "" {
		t.Fatalf("empty ssid printed %q", got)
	}
	if got, want := wifiLine("Hotel Guest"), "  wi-fi:            Hotel Guest\n"; got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}
