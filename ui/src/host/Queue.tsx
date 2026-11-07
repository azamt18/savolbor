import type { QuestionView } from "../api";
import { useT } from "../i18n";
import { ago } from "../format";

export type HostTab = "queue" | "answered" | "hidden";

type Props = {
  tab: HostTab;
  setTab(t: HostTab): void;
  counts: Record<HostTab, number>;
  list: QuestionView[];
  selected?: string;
  highlighted?: string;
  now: number;
  onSelect(id: string): void;
  onAnswerNow(id: string): void;
  onAnswered(id: string, on: boolean): void;
  onHidden(id: string, on: boolean): void;
};

const TABS: { id: HostTab; key: "queue" | "answered" | "hidden" }[] = [
  { id: "queue", key: "queue" },
  { id: "answered", key: "answered" },
  { id: "hidden", key: "hidden" },
];

export function Queue(p: Props) {
  const { t } = useT();
  return (
    <section className="queue">
      <div className="tabs" role="tablist">
        {TABS.map(({ id, key }) => (
          <button key={id} type="button" role="tab" aria-selected={p.tab === id} onClick={() => p.setTab(id)}>
            {t(key)} <span className="n">{p.counts[id]}</span>
          </button>
        ))}
      </div>
      {p.list.length === 0 && <p className="hint">{t("queueEmpty")}</p>}
      <ol className="hrows">
        {p.list.map((q) => (
          <li
            key={q.id}
            id={"h-" + q.id}
            aria-current={q.id === p.selected}
            className={q.id === p.highlighted ? "is-now" : undefined}
            onClick={() => p.onSelect(q.id)}
          >
            <span className="hvotes" aria-label={`${q.votes} ${t("vote")}`}>{q.votes}</span>
            <div className="hbody">
              <p className="q-text">{q.text}</p>
              <p className="meta">
                {q.name || t("anonymous")} · {ago(q.createdAt, p.now, t)}
                {q.edited && `, ${t("edited")}`}
              </p>
            </div>
            <div className="hactions" onClick={(e) => e.stopPropagation()}>
              {p.tab === "queue" && (
                <>
                  {q.id !== p.highlighted && (
                    <button type="button" className="btn" onClick={() => p.onAnswerNow(q.id)}>{t("answerNow")}</button>
                  )}
                  <button type="button" className="btn" onClick={() => p.onHidden(q.id, true)}>{t("hide")}</button>
                </>
              )}
              {p.tab === "answered" && (
                <button type="button" className="btn" onClick={() => p.onAnswered(q.id, false)}>{t("unmarkAnswered")}</button>
              )}
              {p.tab === "hidden" && (
                <button type="button" className="btn" onClick={() => p.onHidden(q.id, false)}>{t("unhide")}</button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
