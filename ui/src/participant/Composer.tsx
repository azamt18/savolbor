import { useEffect, useState, type FormEvent } from "react";
import type { ApiError } from "../api";
import { storage, useT } from "../i18n";
import { MAX_NAME, MAX_TEXT, runes } from "../format";
import { SendIcon } from "../icons";

const SHOW_COUNTER_AT = 40;
const MAX_ROWS = 3;
const CHARS_PER_ROW = 34; // a phone-width row, to grow before the text scrolls

type Props = { onSend(text: string, name: string): Promise<ApiError | null> };

// rowsFor: one row while empty, then as many as the text needs, up to 3.
function rowsFor(text: string): number {
  if (text === "") return 1;
  const lines = text.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(runes(line) / CHARS_PER_ROW)), 0);
  return Math.min(MAX_ROWS, lines);
}

export function Composer({ onSend }: Props) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [name, setName] = useState(() => storage.get("savolbor_name") ?? "");
  const [naming, setNaming] = useState(false);
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

  const saveName = (v: string) => {
    setName(v);
    storage.set("savolbor_name", v.trim());
  };

  const status = sent ? t("sent") : left <= SHOW_COUNTER_AT ? t("charsLeft", { n: left }) : "";

  return (
    <form className="composer" onSubmit={submit}>
      {status && <p className={"composer-status" + (left < 0 ? " over" : "")} role="status">{status}</p>}
      <div className="composer-box">
        <textarea
          value={text}
          rows={rowsFor(text)}
          placeholder={t("askPlaceholder")}
          aria-label={t("askPlaceholder")}
          autoComplete="off"
          data-1p-ignore=""
          data-lpignore="true"
          data-bwignore=""
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        {naming ? (
          <input
            className="name-input"
            value={name}
            autoFocus
            maxLength={MAX_NAME * 2}
            placeholder={t("namePlaceholder")}
            aria-label={t("namePlaceholder")}
            autoComplete="off"
            data-1p-ignore=""
            data-lpignore="true"
            data-bwignore=""
            onChange={(e) => saveName(e.target.value)}
            onBlur={() => setNaming(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); setNaming(false); }
            }}
          />
        ) : (
          <button
            type="button"
            className="name-chip"
            aria-label={name.trim() ? `${t("namePlaceholder")}: ${name.trim()}` : t("addName")}
            onClick={() => setNaming(true)}
          >
            {name.trim() || t("nameChip")}
          </button>
        )}
        <button type="submit" className="send" aria-label={t("send")} disabled={!canSend}>
          <SendIcon />
        </button>
      </div>
    </form>
  );
}
