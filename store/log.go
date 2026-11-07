// Package store persists board events as an append-only json-lines file.
package store

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"sync"

	"savolbor/qna"
)

type Log struct {
	mu sync.Mutex
	f  *os.File
}

// Open creates the file if missing and returns the events already in it.
// Lines that fail to parse (a torn write after a crash) are skipped.
func Open(path string) (*Log, []qna.Event, error) {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_RDWR, 0o644)
	if err != nil {
		return nil, nil, err
	}
	var events []qna.Event
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 64*1024), 1<<20)
	for n := 1; sc.Scan(); n++ {
		line := sc.Bytes()
		if len(line) == 0 {
			continue
		}
		var e qna.Event
		if err := json.Unmarshal(line, &e); err != nil {
			slog.Warn("skipping unreadable log line", "file", path, "line", n, "err", err)
			continue
		}
		events = append(events, e)
	}
	if err := sc.Err(); err != nil {
		f.Close()
		return nil, nil, fmt.Errorf("read %s: %w", path, err)
	}
	if err := terminateLastLine(f); err != nil {
		f.Close()
		return nil, nil, err
	}
	return &Log{f: f}, events, nil
}

// terminateLastLine writes a newline if the file ends mid-line, so the next
// event starts on a line of its own.
func terminateLastLine(f *os.File) error {
	size, err := f.Seek(0, io.SeekEnd)
	if err != nil || size == 0 {
		return err
	}
	last := make([]byte, 1)
	if _, err := f.ReadAt(last, size-1); err != nil {
		return err
	}
	if last[0] == '\n' {
		return nil
	}
	_, err = f.Write([]byte{'\n'})
	return err
}

// Append writes one event and syncs it to disk.
func (l *Log) Append(e qna.Event) error {
	b, err := json.Marshal(e)
	if err != nil {
		return err
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if _, err := l.f.Write(append(b, '\n')); err != nil {
		return err
	}
	return l.f.Sync()
}

func (l *Log) Close() error {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.f.Close()
}
