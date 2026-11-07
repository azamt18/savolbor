import { shortUrl } from "../format";

// JoinCard keeps a big join qr in front of the presenter, so it can be shown
// to someone at the front without switching to the projector.
export function JoinCard({ url }: { url: string }) {
  return (
    <section className="join-card">
      <img src={"/qr.png?u=" + encodeURIComponent(url)} alt={"QR " + shortUrl(url)} />
    </section>
  );
}
