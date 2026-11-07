import { useEffect, useState, type FormEvent } from "react";
import type { ApiError } from "../api";
import { storage, useT } from "../i18n";
import { MAX_NAME, MAX_TEXT, runes } from "../format";
import { SendIcon } from "../icons";

const SHOW_COUNTER_AT = 40;

type Props = { onSend(text: string, name: string): Promise<ApiError | null> };

export function Composer({ onSend }: Props) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [name, setName] = useState(() => storage.get("savolbor_name") ?? "");
  const [nameOpen, setNameOpen] = useState(() => name !== "");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!sent) return;
    const id = setTimeout(() => setSent(false), 2000);
    return () => clearTimeout(id);
  }, [sent]);

  const left = MAX_TEXT - runes(text.trim());
  const canSend = text.trim() !== "" && left >= 0 && !busy;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    setBusy(true);
    // names are capped at 40 runes on the server; trim here instead of failing
    const err = await onSend(text.trim(), [...name.trim()].slice(0, MAX_NAME).join(""));
    setBusy(false);
    if (!err) {
      setText("");
      setSent(true);
    }
  };

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-box">
        <textarea
          value={text}
          rows={focused || text ? 4 : 1}
          placeholder={t("askPlaceholder")}
          aria-label={t("askPlaceholder")}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <button type="submit" className="send" aria-label={t("send")} disabled={!canSend}>
          <SendIcon />
        </button>
      </div>
      <div className="composer-foot">
        {nameOpen ? (
          <input
            className="name"
            value={name}
            maxLength={MAX_NAME * 2}
            placeholder={t("namePlaceholder")}
            aria-label={t("namePlaceholder")}
            autoComplete="name"
            onChange={(e) => {
              setName(e.target.value);
              storage.set("savolbor_name", e.target.value);
            }}
          />
        ) : (
          <button type="button" className="link" onClick={() => setNameOpen(true)}>+ {t("addName")}</button>
        )}
        <span className="composer-status" role="status">
          {sent ? t("sent") : left <= SHOW_COUNTER_AT ? (
            <span className={left < 0 ? "over" : undefined}>{t("charsLeft", { n: left })}</span>
          ) : null}
        </span>
      </div>
    </form>
  );
}
