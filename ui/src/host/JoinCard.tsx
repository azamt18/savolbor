import { useT } from "../i18n";
import { shortUrl } from "../format";

// JoinCard keeps the join qr in front of the presenter, so it can be shown
// to someone at the front without switching to the projector.
export function JoinCard({ url }: { url: string }) {
  const { t } = useT();
  return (
    <section className="join-card" aria-label={t("scanToAsk")}>
      <img src={"/qr.png?u=" + encodeURIComponent(url)} alt={"QR " + shortUrl(url)} />
      <div>
        <p className="now-label">{t("scanToAsk")}</p>
        <p className="join-url">{shortUrl(url)}</p>
      </div>
    </section>
  );
}
