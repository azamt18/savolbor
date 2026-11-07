import { useEffect, useRef, useState } from "react";
import { api, type ApiError } from "../api";
import { errorKey, storage, useT } from "../i18n";
import { useBoard } from "../useBoard";
import { highlightedQuestion, visibleList, withVote, type Tab } from "../select";
import { useNow } from "../useNow";
import { LangToggle } from "../LangToggle";
import { LogoIcon } from "../icons";
import { QuestionRow } from "./QuestionRow";
import { NowStrip } from "./NowStrip";
import { Composer } from "./Composer";

const TABS: { id: Tab; key: "top" | "newest" | "mine" }[] = [
  { id: "top", key: "top" },
  { id: "new", key: "newest" },
  { id: "mine", key: "mine" },
];

export function App() {
  const { t } = useT();
  const { view, status, act } = useBoard({ host: false });
  const now = useNow();
  const [tab, setTab] = useState<Tab>("top");
  const [error, setError] = useState<ApiError | null>(null);
  const scrollTo = useRef<string | null>(null);
  const [hintSeen, setHintSeen] = useState(() => storage.get("savolbor_hint") === "1");
  const dismissHint = () => {
    setHintSeen(true);
    storage.set("savolbor_hint", "1");
  };

  // scroll a just-sent question into view once its snapshot arrives
  useEffect(() => {
    const id = scrollTo.current;
    const el = id && document.getElementById("q-" + id);
    if (el) {
      scrollTo.current = null;
      el.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }
  }, [view]);

  useEffect(() => { document.title = view?.title ? `${view.title} · ${t("title")}` : t("title"); }, [view?.title, t]);

  const run = async (fn: () => Promise<unknown>, optimistic?: Parameters<typeof act>[1]) => {
    const err = await act(fn, optimistic);
    setError(err);
    return err;
  };

  const vote = (id: string) => run(() => api.vote(id), (v) => withVote(v, id));
  const edit = (id: string, text: string) => run(() => api.edit(id, text));
  const remove = (id: string) => run(() => api.remove(id));
  const send = (text: string, name: string) =>
    run(async () => {
      const { id } = await api.ask(text, name);
      scrollTo.current = id;
    });

  const lists = view ? visibleList(view, tab) : { open: [], answered: [] };
  const now_ = view ? highlightedQuestion(view) : undefined;
  const empty = view !== null && view.questions.length === 0;
  const row = (q: (typeof lists.open)[number]) => (
    <QuestionRow key={q.id} q={q} now={now} onVote={vote} onEdit={edit} onDelete={remove} />
  );

  return (
    <div className="page">
      <header className="bar">
        <span className="logo"><LogoIcon /></span>
        <h1 className="brand page-bar-title">
          {view?.title ? (
            <>
              {view.title} <span className="brand-sub">{t("title")}</span>
            </>
          ) : t("title")}
        </h1>
        <span className={"live" + (status === "offline" ? " is-off" : "")} role="status">
          <span className="dot" aria-hidden="true" />
          {status === "offline" ? t("offline") : <span className="sr-only">live</span>}
        </span>
        <LangToggle />
      </header>

      <main className="column">
        {!hintSeen && (
          <p className="first-hint">
            <span>{t("firstHint")}</span>
            <button type="button" className="btn quiet" onClick={dismissHint}>{t("dismiss")}</button>
          </p>
        )}
        {now_ && <NowStrip q={now_} onVote={vote} />}

        {!empty && (
          <div className="tabs" role="tablist" aria-label={t("title")}>
            {TABS.map(({ id, key }) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {t(key)}
              </button>
            ))}
          </div>
        )}

        {empty && <p className="empty">{t("empty")}</p>}
        {!empty && tab === "mine" && lists.open.length + lists.answered.length === 0 && (
          <p className="empty">{t("emptyMine")}</p>
        )}

        <ol className="rows">{lists.open.map(row)}</ol>

        {lists.answered.length > 0 && (
          <details className="answered">
            <summary>{t("answeredCount", { n: lists.answered.length })}</summary>
            <ol className="rows">{lists.answered.map(row)}</ol>
          </details>
        )}
      </main>

      <footer className="dock">
        {error && <p className="error" role="alert">{t(errorKey(error.code))}</p>}
        <Composer onSend={send} />
      </footer>
    </div>
  );
}
