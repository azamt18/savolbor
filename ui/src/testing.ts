// test helpers shared by the ui tests
import type { QuestionView, View } from "./api";

let seq = 0;
export function q(over: Partial<QuestionView> = {}): QuestionView {
  seq++;
  return {
    id: "q" + seq, text: "savol " + seq, votes: 0,
    createdAt: new Date(Date.UTC(2026, 10, 7, 10, 0, seq)).toISOString(),
    voted: false, mine: false, edited: false, answered: false, ...over,
  };
}

export function view(questions: QuestionView[], over: Partial<View> = {}): View {
  return { questions, joinUrl: "http://192.168.1.23:8080", ...over };
}
