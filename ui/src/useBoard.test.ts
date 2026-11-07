import { act, renderHook } from "@testing-library/react";
import { useBoard } from "./useBoard";
import { ApiError, call } from "./api";
import { withVote } from "./select";
import { q, view } from "./testing";
import type { View } from "./api";

class FakeEventSource {
  static all: FakeEventSource[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  closed = false;
  constructor(public url: string) { FakeEventSource.all.push(this); }
  close() { this.closed = true; }
  emit(v: View) { this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(v) })); }
}

let fetchMock: ReturnType<typeof vi.fn>;

function respond(status: number, body?: unknown) {
  return Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.all = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const es = () => FakeEventSource.all[FakeEventSource.all.length - 1];

test("opens the host stream for host pages", () => {
  renderHook(() => useBoard({ host: true }));
  expect(es().url).toBe("/api/events?view=host");
});

test("switches to polling when no snapshot in 4s", async () => {
  fetchMock.mockImplementation(() => respond(200, view([q()])));
  const { result } = renderHook(() => useBoard({ host: false }));
  await act(async () => { vi.advanceTimersByTime(3999); });
  expect(fetchMock).not.toHaveBeenCalled();
  await act(async () => { vi.advanceTimersByTime(1); });
  expect(es().closed).toBe(true);
  expect(fetchMock).toHaveBeenCalledWith("/api/view", expect.anything());
  expect(result.current.status).toBe("polling");
  expect(result.current.view?.questions).toHaveLength(1);
  await act(async () => { vi.advanceTimersByTime(2000); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("stays on sse when a snapshot arrives in time", async () => {
  const { result } = renderHook(() => useBoard({ host: false }));
  act(() => es().emit(view([q()])));
  await act(async () => { vi.advanceTimersByTime(10_000); });
  expect(es().closed).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(result.current.status).toBe("live");
});

test("a broken stream goes offline after 5s", async () => {
  const { result } = renderHook(() => useBoard({ host: false }));
  act(() => es().emit(view([])));
  act(() => es().onerror?.());
  await act(async () => { vi.advanceTimersByTime(4000); });
  expect(result.current.status).toBe("live");
  await act(async () => { vi.advanceTimersByTime(1500); });
  expect(result.current.status).toBe("offline");
});

test("polls from the start when view.public", async () => {
  fetchMock.mockImplementation(() => respond(200, view([], { public: true })));
  const { result } = renderHook(() => useBoard({ host: false }));
  await act(async () => { es().emit(view([], { public: true })); });
  expect(es().closed).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(result.current.status).toBe("polling");
});

test("status offline only after 5s without a snapshot", async () => {
  fetchMock.mockImplementation(() => Promise.reject(new TypeError("network")));
  const { result } = renderHook(() => useBoard({ host: false }));
  await act(async () => { vi.advanceTimersByTime(4900); });
  expect(result.current.status).not.toBe("offline");
  await act(async () => { vi.advanceTimersByTime(1200); });
  expect(result.current.status).toBe("offline");
  fetchMock.mockImplementation(() => respond(200, view([])));
  await act(async () => { vi.advanceTimersByTime(2000); });
  expect(result.current.status).toBe("polling");
});

test("rolls back optimistic vote on 404 and returns not_found", async () => {
  const a = q();
  const { result } = renderHook(() => useBoard({ host: false }));
  act(() => es().emit(view([a])));
  let finish!: () => void;
  fetchMock.mockImplementation(() => new Promise<Response>((res) => {
    finish = () => res(new Response(JSON.stringify({ error: "not_found" }), { status: 404 }));
  }));
  let pending!: Promise<ApiError | null>;
  act(() => { pending = result.current.act(() => call("POST", `/api/questions/${a.id}/vote`), (v) => withVote(v, a.id)); });
  expect(result.current.view?.questions[0]).toMatchObject({ votes: 1, voted: true });
  let err: ApiError | null = null;
  await act(async () => { finish(); err = await pending; });
  expect(err).toEqual({ status: 404, code: "not_found" });
  expect(result.current.view?.questions[0]).toMatchObject({ votes: 0, voted: false });
});

test("call maps network failure to code network", async () => {
  fetchMock.mockImplementation(() => Promise.reject(new TypeError("x")));
  await expect(call("POST", "/api/questions", { text: "a" })).rejects.toEqual({ status: 0, code: "network" });
});
