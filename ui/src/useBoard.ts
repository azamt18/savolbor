import { useCallback, useEffect, useRef, useState } from "react";
import { call, isApiError, type ApiError, type View } from "./api";

export type Status = "live" | "polling" | "offline";

const SSE_GRACE = 4000; // no snapshot by then: a proxy is buffering the stream
const POLL_EVERY = 2000;
const OFFLINE_AFTER = 5000; // brief blips don't flash "offline"

// useBoard owns the live connection for a page: the sse stream, or polling
// /api/view when the stream can't get through (tunnels, tls inspection).
export function useBoard({ host }: { host: boolean }) {
  const [view, setView] = useState<View | null>(null);
  const [polling, setPolling] = useState(false);
  const [offline, setOffline] = useState(false);
  const server = useRef<View | null>(null); // last snapshot from the server
  const current = useRef<View | null>(null);
  const refresh = useRef<() => void>(() => {});

  const show = (v: View | null) => { current.current = v; setView(v); };

  useEffect(() => {
    const query = host ? "?view=host" : "";
    let lastOk = Date.now();
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;

    const got = (v: View) => {
      lastOk = Date.now();
      server.current = v;
      show(v);
      setOffline(false);
    };

    const poll = async () => {
      try {
        const v = (await call("GET", "/api/view" + query)) as View;
        if (!stopped) got(v);
      } catch { /* the watchdog turns this into "offline" */ }
    };

    const es = new EventSource("/api/events" + query);
    let streamed = false;
    // a quiet stream only carries pings, which never reach onmessage, so an
    // open stream counts as alive
    let streamUp = false;
    es.onopen = () => { streamUp = true; };
    es.onerror = () => { streamUp = false; };
    const startPolling = () => {
      if (pollTimer) return;
      es.close();
      setPolling(true);
      refresh.current = poll;
      poll();
      pollTimer = setInterval(poll, POLL_EVERY);
    };
    es.onmessage = (e) => {
      streamed = streamUp = true;
      const v = JSON.parse(e.data) as View;
      got(v);
      // quick tunnels pass the first event, then hold the rest back
      if (v.public) startPolling();
    };
    // once polling, stay polling: a stream that stalled once will stall again
    const grace = setTimeout(() => { if (!streamed) startPolling(); }, SSE_GRACE);

    const watchdog = setInterval(() => {
      if (!pollTimer && streamUp) lastOk = Date.now();
      if (Date.now() - lastOk >= OFFLINE_AFTER) setOffline(true);
    }, 500);

    return () => {
      stopped = true;
      es.close();
      clearTimeout(grace);
      clearInterval(watchdog);
      clearInterval(pollTimer);
      refresh.current = () => {};
    };
  }, [host]);

  // act runs one command. optimistic shows its expected result at once; on
  // failure the last server snapshot comes back and the error is returned.
  const act = useCallback(async (fn: () => Promise<unknown>, optimistic?: (v: View) => View): Promise<ApiError | null> => {
    if (optimistic && current.current) show(optimistic(current.current));
    try {
      await fn();
      refresh.current();
      return null;
    } catch (e) {
      show(server.current);
      return isApiError(e) ? e : { status: 0, code: "internal" };
    }
  }, []);

  const status: Status = offline ? "offline" : polling ? "polling" : "live";
  return { view, status, act };
}
