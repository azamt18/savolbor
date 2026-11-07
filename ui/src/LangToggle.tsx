import { useT, type Lang } from "./i18n";

export function LangToggle() {
  const { lang, setLang } = useT();
  return (
    <div className="lang" role="group" aria-label="til / language">
      {(["uz", "en"] as Lang[]).map((l) => (
        <button key={l} type="button" className="btn" aria-pressed={lang === l} onClick={() => setLang(l)}>{l}</button>
      ))}
    </div>
  );
}
