import { useEffect, useState } from "react";
import type { View } from "../api";
import { useT } from "../i18n";
import { shortUrl } from "../format";
import { highlightedQuestion, projectorSize, ranked } from "../select";

const NEXT_ON_STRIP = 2;
const CONTROLS_IDLE = 3000;

// useWake is true after any mouse move, touch or key press, and for a while
// after opening; it goes false when the presenter's hands are idle so the
// room never sees the controls.
function useWake(): boolean {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    let timer = setTimeout(() => setShown(false), CONTROLS_IDLE);
    const wake = () => {
      setShown(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShown(false), CONTROLS_IDLE);
    };
    const events = ["mousemove", "pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => document.addEventListener(e, wake));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => document.removeEventListener(e, wake));
    };
  }, []);
  return shown;
}

type Handlers = { onExit?(): void; onNext?(): void; onHide?(id: string): void };

function Qr({ url, className }: { url: string; className: string }) {
  // the query busts the image cache when the laptop's address changes
  return <img className={className} src={"/qr.png?u=" + encodeURIComponent(url)} alt={"QR " + shortUrl(url)} />;
}

export function Projector({ view, onExit, onNext, onHide }: { view: View } & Handlers) {
  const { t } = useT();
  const shown = useWake();
  const url = view.joinUrl ?? location.origin;
  const current = highlightedQuestion(view);
  const hasQueue = view.questions.some((q) => !q.answered && !q.hidden && q.id !== current?.id);
  const exit = (
    <div className={"pj-controls" + (shown ? " is-shown" : "")}>
      {onExit && (
        <button type="button" onClick={onExit}>{t("exitProjector")} <kbd>esc</kbd></button>
      )}
      {onNext && (current || hasQueue) && (
        <button type="button" className="primary" onClick={onNext}>
          {t(current ? "doneNext" : "answerNow")} <kbd>n</kbd>
        </button>
      )}
      {onHide && current && (
        <button type="button" onClick={() => onHide(current.id)}>{t("hide")} <kbd>x</kbd></button>
      )}
    </div>
  );

  if (!current) {
    return (
      <div className="projector pj-invite">
        {view.title && <p className="pj-title">{view.title}</p>}
        <h1 className="pj-headline">{t("inviteHeadline")}</h1>
        <Qr url={url} className="pj-qr-big" />
        <p className="pj-scan">{t("scanToAsk")}</p>
        <p className="pj-url">{shortUrl(url)}</p>
        {exit}
      </div>
    );
  }

  const next = ranked(view.questions.filter((q) => !q.answered && !q.hidden && q.id !== current.id)).slice(0, NEXT_ON_STRIP);
  return (
    <div className="projector pj-on">
      <section className="pj-band">
        {/* keyed by id: a new highlight remounts and plays the one entrance */}
        <div className="pj-now" key={current.id}>
          <p className="pj-label">{t("nowAnswering")}</p>
          <p className={"pj-text pj-" + projectorSize(current.text)}>{current.text}</p>
          <p className="pj-meta">▲ {current.votes} · {current.name || t("anonymous")}</p>
        </div>
      </section>
      <footer className="pj-strip">
        <div className="pj-next">
          {next.length > 0 && <p className="pj-next-label">{t("next")}</p>}
          <ol>
            {next.map((q) => (
              <li key={q.id}>
                <span className="pj-next-votes">{q.votes}</span>
                <span className="pj-next-text">{q.text}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="pj-join">
          <Qr url={url} className="pj-qr" />
          <p className="pj-url-small">{shortUrl(url)}</p>
        </div>
      </footer>
      {exit}
    </div>
  );
}
