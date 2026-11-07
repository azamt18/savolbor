// Pure list logic shared by the participant page, /host and the projector.
import type { QuestionView, View } from "./api";

export type Tab = "top" | "new" | "mine";

const time = (q: QuestionView) => Date.parse(q.createdAt);

// ranked: votes desc, then oldest first — the same rule as qna.Ranked.
export function ranked(qs: QuestionView[]): QuestionView[] {
  return [...qs].sort((a, b) => b.votes - a.votes || time(a) - time(b));
}

export function newest(qs: QuestionView[]): QuestionView[] {
  return [...qs].sort((a, b) => time(b) - time(a));
}

// visibleList splits a view for one tab. The highlighted question is shown
// on its own, so it is left out of open.
export function visibleList(v: View, tab: Tab): { open: QuestionView[]; answered: QuestionView[] } {
  let qs = v.questions.filter((q) => !q.hidden);
  if (tab === "mine") qs = qs.filter((q) => q.mine);
  const open = qs.filter((q) => !q.answered && q.id !== v.highlighted);
  return {
    open: tab === "top" ? ranked(open) : newest(open),
    answered: newest(qs.filter((q) => q.answered)),
  };
}

// withVote is the optimistic version of a vote: +1, once.
export function withVote(v: View, id: string): View {
  return {
    ...v,
    questions: v.questions.map((q) => (q.id === id && !q.voted ? { ...q, votes: q.votes + 1, voted: true } : q)),
  };
}

export function highlightedQuestion(v: View): QuestionView | undefined {
  return v.highlighted ? v.questions.find((q) => q.id === v.highlighted && !q.hidden) : undefined;
}

// projectorSize steps the projector's type down as questions get longer, so
// a 280-character question still fits above the fold at 1280×720.
export function projectorSize(text: string): "xl" | "l" | "m" {
  const n = [...text].length;
  return n <= 90 ? "xl" : n <= 180 ? "l" : "m";
}
