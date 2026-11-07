import { useT, type Lang } from "./i18n";
import { FlagGb, FlagUz } from "./icons";

const FLAGS: Record<Lang, () => JSX.Element> = { uz: FlagUz, en: FlagGb };

export function LangToggle() {
  const { lang, setLang } = useT();
  return (
    <div className="lang" role="group" aria-label="til / language">
      {(["uz", "en"] as Lang[]).map((l) => {
        const Flag = FLAGS[l];
        return (
          <button key={l} type="button" className="btn" aria-pressed={lang === l} onClick={() => setLang(l)}>
            <Flag />
            {l}
          </button>
        );
      })}
    </div>
  );
}
