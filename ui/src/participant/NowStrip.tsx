import { useState } from "react";
import type { ApiError, QuestionView } from "../api";
import { useT } from "../i18n";
import { VotePill } from "./QuestionRow";

export function NowStrip({ q, onVote }: { q: QuestionView; onVote(id: string): Promise<ApiError | null> }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <section className="now" aria-label={t("nowAnswering")}>
      <button type="button" className="now-body" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="now-label">{t("nowAnswering")}</span>
        <span className={"q-text" + (open ? "" : " clamp")}>{q.text}</span>
        <span className="meta">{q.name || t("anonymous")}</span>
      </button>
      <VotePill q={q} onVote={onVote} />
    </section>
  );
}
