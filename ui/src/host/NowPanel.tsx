import type { QuestionView } from "../api";
import { useT } from "../i18n";
import { ago } from "../format";

type Props = {
  current?: QuestionView;
  top?: QuestionView;
  now: number;
  onNext(): void;
  onHide(id: string): void;
  onClear(): void;
};

export function NowPanel({ current, top, now, onNext, onHide, onClear }: Props) {
  const { t } = useT();
  return (
    <section className={"nowpanel" + (current ? " is-on" : "")} aria-label={t("nowAnswering")}>
      <h2 className="now-label">{t("nowAnswering")}</h2>
      {current ? (
        <>
          <p className="now-text q-text">{current.text}</p>
          <p className="meta">
            ▲ {current.votes} · {current.name || t("anonymous")} · {ago(current.createdAt, now, t)}
          </p>
          <div className="now-actions">
            <button type="button" className="hbtn primary big" onClick={onNext}>{t("doneNext")}</button>
            <button type="button" className="hbtn" onClick={() => onHide(current.id)}>{t("hide")}</button>
            <button type="button" className="hbtn quiet" onClick={onClear}>{t("unhighlight")}</button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">{t("nothingNow")}</p>
          {top && (
            <div className="now-actions">
              <button type="button" className="hbtn primary big" onClick={onNext}>{t("answerNow")}</button>
              <span className="meta clamp1">{top.text}</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
