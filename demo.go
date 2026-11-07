package main

import (
	"os"
	"path/filepath"

	"savolbor/qna"
)

// demoLog is where -demo keeps its questions: a temp file, so a demo never
// mixes with the day's real log. it starts fresh on every run.
func demoLog() string { return filepath.Join(os.TempDir(), "savolbor-demo.jsonl") }

// seedDemo fills an empty board with a cooking class: 8 open questions with
// votes, 1 answered, 1 hidden. same set as dev/seed.sh, without the http hop.
func seedDemo(b *qna.Board) error {
	if err := b.SetTitle("Plov pishirish darsi"); err != nil {
		return err
	}
	ask := func(name, text string, votes int) (string, error) {
		id, err := b.Post("demo-"+name+"-"+text, text, name)
		if err != nil {
			return "", err
		}
		for i := 0; i < votes; i++ {
			if err := b.Vote("demo-voter-"+string(rune('a'+i)), id); err != nil {
				return "", err
			}
		}
		return id, nil
	}
	open := []struct {
		name, text string
		votes      int
	}{
		{"Ali", "Plov uchun qaysi guruch yaxshi?", 6},
		{"Madina", "Zirvakni necha daqiqa qovurish kerak?", 5},
		{"Jasur", "Sabzini qanday toʻgʻrash kerak?", 4},
		{"", "Qozon oʻrniga oddiy kastryulkada boʻladimi?", 3},
		{"Dilnoza", "Goʻsht qachon solinadi?", 2},
		{"Sardor", "Piyoz qancha kerak?", 2},
		{"Nigora", "Retseptni qayerdan olsak boʻladi?", 1},
		{"", "Olovni qanday sozlaymiz?", 0},
	}
	for _, q := range open {
		if _, err := ask(q.name, q.text, q.votes); err != nil {
			return err
		}
	}
	done, err := ask("Ali", "Plov necha kishiga yetadi?", 3)
	if err != nil {
		return err
	}
	if err := b.SetAnswered(done, true); err != nil {
		return err
	}
	spam, err := ask("", "test test", 0)
	if err != nil {
		return err
	}
	return b.SetHidden(spam, true)
}
