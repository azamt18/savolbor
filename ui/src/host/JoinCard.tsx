import { useCallback, useEffect, useRef, useState } from "react";
import { shortUrl } from "../format";
import { useT } from "../i18n";

const qrSrc = (url: string) => "/qr.png?u=" + encodeURIComponent(url);

// JoinCard is the small qr under the now panel. Clicking it opens the qr
// full screen, for a room to scan from its seats.
export function JoinCard({ url, wifi }: { url: string; wifi?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const card = useRef<HTMLButtonElement>(null);

  // focus goes back to the card once the overlay is gone
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) card.current?.focus();
    wasOpen.current = open;
  }, [open]);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button ref={card} type="button" className="join-card" aria-label={t("enlargeQr")} onClick={() => setOpen(true)}>
        <img src={qrSrc(url)} alt={"QR " + shortUrl(url)} />
        <span className="join-url">{shortUrl(url)}</span>
      </button>
      {open && <QrOverlay url={url} wifi={wifi} onClose={close} />}
    </>
  );
}

function QrOverlay({ url, wifi, onClose }: { url: string; wifi?: string; onClose(): void }) {
  const { t } = useT();
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // the × is the only control: keep focus on it
      if (e.key === "Tab") {
        e.preventDefault();
        closeBtn.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="qr-overlay" role="dialog" aria-modal="true" aria-label={t("enlargeQr")} onClick={onClose}>
      <button ref={closeBtn} type="button" className="qr-close" aria-label={t("close")} onClick={onClose}>×</button>
      <img src={qrSrc(url)} alt={"QR " + shortUrl(url)} />
      <p className="qr-url">{shortUrl(url)}</p>
      {wifi && <p className="qr-wifi">{t("wifiName", { name: wifi })}</p>}
    </div>
  );
}
