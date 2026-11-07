import { useEffect, useRef, useState } from "react";
import { api, type ApiError, type QuestionView } from "../api";
import { errorKey, storage, useT } from "../i18n";
import { useBoard } from "../useBoard";
import { highlightedQuestion, newest, ranked } from "../select";
import { useNow } from "../useNow";
import { MAX_TITLE } from "../format";
import { LangToggle } from "../LangToggle";
import { DownloadIcon, LogoIcon, ScreenIcon } from "../icons";
import { Queue, type HostTab } from "./Queue";
import { NowPanel } from "./NowPanel";
import { useShortcuts } from "./useShortcuts";
import { Projector } from "./Projector";
import { JoinCard } from "./JoinCard";

function lists(questions: QuestionView[]): Record<HostTab, QuestionView[]> {
  return {
    queue: ranked(questions.filter((q) => !q.answered && !q.hidden)),
    answered: newest(questions.filter((q) => q.answered && !q.hidden)),
    hidden: newest(questions.filter((q) => q.hidden)),
  };
}

export function HostApp() {
  const { t } = useT();
  const { view, status, act } = useBoard({ host: true });
  const now = useNow();
  const [tab, setTab] = useState<HostTab>("queue");
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState<ApiError | null>(null);
  const [projector, setProjectorState] = useState(() => storage.get("savolbor_projector") === "1");

  const setProjector = (on: boolean) => {
    setProjectorState(on);
    storage.set("savolbor_projector", on ? "1" : "0");
  };
  useEffect(() => { document.body.classList.toggle("is-projector", projector); }, [projector]);

  const run = async (fn: () => Promise<unknown>) => setError(await act(fn));

  const all = view?.questions ?? [];
  const byTab = lists(all);
  const list = byTab[tab];
  const current = view ? highlightedQuestion(view) : undefined;
  const top = byTab.queue.find((q) => q.id !== current?.id);

  // keep the selection on a row that exists; default to the first
  const sel = list.some((q) => q.id === selected) ? selected : list[0]?.id;
  const move = (d: number) => {
    if (!list.length) return;
    const i = Math.max(0, list.findIndex((q) => q.id === sel));
    const next = list[Math.min(list.length - 1, Math.max(0, i + d))];
    setSelected(next.id);
    document.getElementById("h-" + next.id)?.scrollIntoView?.({ block: "nearest" });
  };

  const next = () => run(() => api.next());
  const answerNow = (id: string) => run(() => api.highlight(id));
  const hide = (id: string, on: boolean) => run(() => api.hidden(id, on));
  const answered = (id: string, on: boolean) => run(() => api.answered(id, on));

  useShortcuts({
    j: () => move(1),
    k: () => move(-1),
    Enter: () => { if (sel && tab === "queue") answerNow(sel); },
    n: next,
    x: () => { if (sel && tab !== "hidden") hide(sel, true); },
    p: () => setProjector(!projector),
    Escape: () => setProjector(false),
  });

  return (
    <div className="host">
      <header className="bar">
        <span className="logo"><LogoIcon /></span>
        <span className="brand">{t("title")}</span>
        <TitleInput value={view?.title ?? ""} onSave={(title) => run(() => api.title(title))} />
        <span className={"live" + (status === "offline" ? " is-off" : "")} role="status">
          <span className="dot" aria-hidden="true" />
          {status === "offline" ? t("offline") : t("connected", { n: view?.connected ?? 0 })}
        </span>
        <a className="btn" href="/api/host/export.md" download title={t("exportHint")}><DownloadIcon />{t("export")}</a>
        <button type="button" className="btn" onClick={() => setProjector(true)}>
          <ScreenIcon />{t("projector")} <kbd>p</kbd>
        </button>
        <LangToggle />
      </header>

      {error && <p className="error host-error" role="alert">{t(errorKey(error.code))}</p>}

      <main className="hgrid">
        <aside className="host-side">
          <NowPanel
            current={current}
            top={top}
            now={now}
            onNext={next}
            onHide={(id) => hide(id, true)}
            onClear={() => run(() => api.highlight(""))}
          />
          <JoinCard url={view?.joinUrl ?? location.origin} wifi={view?.wifi} />
        </aside>
        <Queue
          tab={tab}
          setTab={setTab}
          counts={{ queue: byTab.queue.length, answered: byTab.answered.length, hidden: byTab.hidden.length }}
          list={list}
          selected={sel}
          highlighted={current?.id}
          now={now}
          onSelect={setSelected}
          onAnswerNow={answerNow}
          onAnswered={answered}
          onHidden={hide}
        />
      </main>

      <footer className="hfoot">{t("shortcuts")}</footer>
      {projector && view && (
        <Projector view={view} onExit={() => setProjector(false)} onNext={next} onHide={(id) => hide(id, true)} />
      )}
    </div>
  );
}

// TitleInput saves on enter or blur, never per keystroke. While it isn't
// being edited it follows the server's value.
function TitleInput({ value, onSave }: { value: string; onSave(title: string): void }) {
  const { t } = useT();
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  const saved = useRef(value);

  useEffect(() => {
    saved.current = value;
    if (!editing.current) setDraft(value);
  }, [value]);

  const save = () => {
    editing.current = false;
    const next = draft.trim();
    if (next === saved.current) return;
    saved.current = next;
    onSave(next);
  };

  return (
    <input
      className="title-input"
      value={draft}
      maxLength={MAX_TITLE}
      placeholder={t("sessionTitlePlaceholder")}
      aria-label={t("sessionTitle")}
      onFocus={() => { editing.current = true; }}
      onChange={(e) => { editing.current = true; setDraft(e.target.value); }}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") { save(); e.currentTarget.blur(); }
        if (e.key === "Escape") { setDraft(saved.current); editing.current = false; }
      }}
    />
  );
}
