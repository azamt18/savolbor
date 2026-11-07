package qna

import (
	"fmt"
	"strings"
	"time"
)

// ExportMarkdown renders unanswered questions by votes, then answered ones.
// Hidden questions are left out.
func ExportMarkdown(v View, date time.Time) string {
	var open, done []QuestionView
	for _, q := range Ranked(v.Questions) {
		switch {
		case q.Hidden:
		case q.Answered:
			done = append(done, q)
		default:
			open = append(open, q)
		}
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "# savolbor — %s\n", date.Format("2006-01-02"))
	section := func(title string, qs []QuestionView) {
		fmt.Fprintf(&sb, "\n## %s\n\n", title)
		if len(qs) == 0 {
			sb.WriteString("_none_\n")
		}
		for _, q := range qs {
			fmt.Fprintf(&sb, "- **%d** · %s", q.Votes, strings.Join(strings.Fields(q.Text), " "))
			if q.Name != "" {
				fmt.Fprintf(&sb, " — %s", q.Name)
			}
			sb.WriteString("\n")
		}
	}
	section("unanswered", open)
	section("answered", done)
	return sb.String()
}
