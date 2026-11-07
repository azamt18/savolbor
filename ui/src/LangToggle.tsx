import { useT, type Lang } from "./i18n";
import { FlagGb, FlagUz } from "./icons";

const FLAGS: Record<Lang, { Flag: () => JSX.Element; label: string }> = {
  uz: { Flag: FlagUz, label: "Oʻzbekcha" },
  en: { Flag: FlagGb, label: "English" },
};

export function LangToggle() {
  const { lang, setLang } = useT();
  return (
    <div className="lang" role="group" aria-label="til / language">
      {(["uz", "en"] as Lang[]).map((l) => {
        const { Flag, label } = FLAGS[l];
        return (
          <button key={l} type="button" className="btn" aria-label={label} aria-pressed={lang === l} onClick={() => setLang(l)}>
            <Flag />
          </button>
        );
      })}
    </div>
  );
}
