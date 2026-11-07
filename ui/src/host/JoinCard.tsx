import { shortUrl } from "../format";
import { useT } from "../i18n";

const qrSrc = (url: string) => "/qr.png?u=" + encodeURIComponent(url);

export function JoinCard({ url, wifi }: { url: string; wifi?: string }) {
  const { t } = useT();
  return (
    <>
      <section className="join-card">
        <img src={qrSrc(url)} alt={"QR " + shortUrl(url)} />
      </section>
      <button type="button" className="btn quiet" onClick={() => window.print()}>{t("printCard")}</button>
      {/* hidden on screen; host.css shows only this for print */}
      <div className="print-card" aria-hidden="true">
        <img src={qrSrc(url)} alt="" />
        <p className="print-url">{shortUrl(url)}</p>
        {wifi && <p className="print-wifi">{t("wifiName", { name: wifi })}</p>}
        <p className="print-wifi">{t("sameWifi")}</p>
      </div>
    </>
  );
}
