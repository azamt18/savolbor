import { useEffect, useRef, useState } from "react";
import type { ApiError, QuestionView } from "../api";
import { useT } from "../i18n";
import { ago, MAX_TEXT, runes } from "../format";
import { MoreIcon, UpIcon } from "../icons";

type Props = {
  q: QuestionView;
  now: number;
  onVote(id: string): Promise<ApiError | null>;
  onEdit(id: string, text: string): Promise<ApiError | null>;
  onDelete(id: string): Promise<ApiError | null>;
};

export function VotePill({ q, onVote }: Pick<Props, "q" | "onVote">) {
  const { t } = useT();
  return (
    <button
      type="button"
      className="vote"
      aria-pressed={q.voted}
      aria-label={`${t(q.voted ? "voted" : "vote")}, ${q.votes}`}
      disabled={q.voted}
      onClick={() => onVote(q.id)}
    >
      <UpIcon />
      <span className="vote-n">{q.votes}</span>
    </button>
  );
}

export function QuestionRow({ q, now, onVote, onEdit, onDelete }: Props) {
  const { t } = useT();
  const [mode, setMode] = useState<"view" | "menu" | "edit" | "confirm">("view");
  const [draft, setDraft] = useState(q.text);
  const menuRef = useRef<HTMLDivElement>(null);

  // close the menu on an outside tap
  useEffect(() => {
    if (mode !== "menu") return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMode("view");
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [mode]);

  const save = async () => {
    if (draft.trim() === q.text) return setMode("view");
    if (!(await onEdit(q.id, draft))) setMode("view");
  };

  return (
    <li id={"q-" + q.id} className={"row" + (q.answered ? " is-answered" : "")}>
      <div className="row-main">
        {mode === "edit" ? (
          <div className="edit">
            <textarea
              className="q-text"
              value={draft}
              rows={3}
              autoFocus
              aria-label={t("edit")}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="row-actions">
              <button type="button" className="btn primary" disabled={!draft.trim() || runes(draft.trim()) > MAX_TEXT} onClick={save}>{t("save")}</button>
              <button type="button" className="btn" onClick={() => { setDraft(q.text); setMode("view"); }}>{t("cancel")}</button>
            </div>
          </div>
        ) : (
          <p className="q-text">{q.text}</p>
        )}
        <p className="meta">
          <span>{q.name || t("anonymous")}</span>
          {q.mine && <span> ({t("you")})</span>}
          <span aria-hidden="true"> · </span>
          <span>{ago(q.createdAt, now, t)}</span>
          {q.edited && <span>, {t("edited")}</span>}
        </p>
        {mode === "confirm" && (
          <div className="confirm" role="group">
            <span>{t("confirmDelete")}</span>
            <button type="button" className="btn danger" onClick={() => onDelete(q.id)}>{t("delete")}</button>
            <button type="button" className="btn" onClick={() => setMode("view")}>{t("cancel")}</button>
          </div>
        )}
      </div>
      <div className="row-side">
        <VotePill q={q} onVote={onVote} />
        {q.mine && (
          <div className="menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="icon-btn"
              aria-label={t("more")}
              aria-haspopup="menu"
              aria-expanded={mode === "menu"}
              onClick={() => setMode(mode === "menu" ? "view" : "menu")}
            >
              <MoreIcon />
            </button>
            {mode === "menu" && (
              <div className="menu" role="menu">
                {!q.answered && (
                  <button type="button" role="menuitem" onClick={() => { setDraft(q.text); setMode("edit"); }}>{t("edit")}</button>
                )}
                <button type="button" role="menuitem" onClick={() => setMode("confirm")}>{t("delete")}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
