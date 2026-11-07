package main

import (
	"reflect"
	"testing"
)

func TestOpenCommandPerOS(t *testing.T) {
	const u = "http://localhost:8080/host"
	cases := map[string][]string{
		"darwin":  {"open", u},
		"linux":   {"xdg-open", u},
		"freebsd": {"xdg-open", u},
		"windows": {"rundll32", "url.dll,FileProtocolHandler", u},
	}
	for goos, want := range cases {
		name, args := openCommand(goos, u)
		if got := append([]string{name}, args...); !reflect.DeepEqual(got, want) {
			t.Errorf("%s: got %v, want %v", goos, got, want)
		}
	}
}

func TestPresenterURL(t *testing.T) {
	if got, want := presenterURL(8080, "abc", false), "http://localhost:8080/host"; got != want {
		t.Errorf("lan: got %q, want %q", got, want)
	}
	// localhost is not host in public mode, so the key link is what opens
	if got, want := presenterURL(9000, "abc", true), "http://localhost:9000/host?key=abc"; got != want {
		t.Errorf("public: got %q, want %q", got, want)
	}
}

func TestParseOptionsNoOpen(t *testing.T) {
	o, err := parseOptions(nil)
	if err != nil || o.noOpen || o.port != 8080 {
		t.Fatalf("defaults: %+v, %v", o, err)
	}
	o, err = parseOptions([]string{"-no-open", "-port", "9000", "-wifi", "Hotel"})
	if err != nil || !o.noOpen || o.port != 9000 || o.wifi != "Hotel" {
		t.Fatalf("flags: %+v, %v", o, err)
	}
	if _, err := parseOptions([]string{"-nope"}); err == nil {
		t.Fatal("unknown flag accepted")
	}
}
