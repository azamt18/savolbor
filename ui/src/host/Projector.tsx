import type { View } from "../api";
import { useT } from "../i18n";
import { shortUrl } from "../format";
import { highlightedQuestion, projectorSize, ranked } from "../select";

const NEXT_ON_STRIP = 2;

function Qr({ url, className }: { url: string; className: string }) {
  // the query busts the image cache when the laptop's address changes
  return <img className={className} src={"/qr.png?u=" + encodeURIComponent(url)} alt={"QR " + shortUrl(url)} />;
}

export function Projector({ view, onExit }: { view: View; onExit?(): void }) {
  const { t } = useT();
  const url = view.joinUrl ?? location.origin;
  const current = highlightedQuestion(view);
  const exit = onExit && (
    <button type="button" className="pj-exit" onClick={onExit}>{t("exitProjector")}</button>
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
