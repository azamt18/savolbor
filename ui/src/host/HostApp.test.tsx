import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { HostApp } from "./HostApp";
import { useBoard } from "../useBoard";
import { q, view } from "../testing";
import { setLang } from "../i18n";
import type { View } from "../api";

vi.mock("../useBoard", () => ({ useBoard: vi.fn() }));

let fetchMock: ReturnType<typeof vi.fn>;

function mockBoard(v: View) {
  vi.mocked(useBoard).mockReturnValue({
    view: v, status: "live",
    act: vi.fn(async (fn: () => Promise<unknown>) => { await fn(); return null; }),
  });
}

const calls = () => fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url} ${init?.body ?? ""}`.trim());

beforeEach(() => {
  setLang("en");
  try { localStorage.clear(); } catch { /* */ }
  fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ id: "" }), { status: 200 })));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function key(k: string, target: Element | Document = document.body) {
  await act(async () => { target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); });
}

const a = q({ votes: 5, text: "top one" });
const b = q({ votes: 1, text: "second" });

test("shortcuts ignored while typing in title", async () => {
  mockBoard(view([a, b]));
  render(<HostApp />);
  const title = screen.getByLabelText(/session title/i);
  title.focus();
  for (const k of ["j", "x", "p", "n"]) await key(k, title);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(document.body.classList.contains("is-projector")).toBe(false);
  expect(document.getElementById("h-" + a.id)!.getAttribute("aria-current")).toBe("true");
});

test("j/k moves selection and enter highlights", async () => {
  mockBoard(view([a, b]));
  render(<HostApp />);
  await key("j");
  expect(document.getElementById("h-" + b.id)!.getAttribute("aria-current")).toBe("true");
  await key("k");
  await key("j");
  await key("Enter");
  expect(calls()).toContain(`POST /api/host/highlight {"id":"${b.id}"}`);
});

test("x hides the selected question", async () => {
  mockBoard(view([a, b]));
  render(<HostApp />);
  await key("x");
  expect(calls()).toContain(`POST /api/host/questions/${a.id}/hidden {"on":true}`);
});

test("done-next posts to /api/host/next", async () => {
  mockBoard(view([a, b], { highlighted: a.id }));
  render(<HostApp />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /done, next/i })); });
  expect(calls()).toContain("POST /api/host/next");
  await key("n");
  expect(calls().filter((c) => c === "POST /api/host/next")).toHaveLength(2);
});

test("without a highlight the main button answers the top question", async () => {
  mockBoard(view([b, a]));
  render(<HostApp />);
  const panel = screen.getByRole("region", { name: /now answering/i });
  await act(async () => { fireEvent.click(within(panel).getByRole("button", { name: /answer now/i })); });
  expect(calls()).toContain("POST /api/host/next");
});

test("hidden tab offers unhide", async () => {
  const h = q({ hidden: true, text: "rude" });
  mockBoard(view([a, h]));
  render(<HostApp />);
  expect(screen.queryByText("rude")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: /hidden/i }));
  const row = screen.getByText("rude").closest("li")!;
  await act(async () => { fireEvent.click(within(row).getByRole("button", { name: /unhide/i })); });
  expect(calls()).toContain(`POST /api/host/questions/${h.id}/hidden {"on":false}`);
});

test("title saves on enter, not on every key", async () => {
  mockBoard(view([]));
  render(<HostApp />);
  const title = screen.getByLabelText(/session title/i);
  fireEvent.change(title, { target: { value: "Agentlar" } });
  expect(fetchMock).not.toHaveBeenCalled();
  await act(async () => { fireEvent.keyDown(title, { key: "Enter" }); });
  expect(calls()).toContain('POST /api/host/title {"title":"Agentlar"}');
});

test("connected count shows on the host page", () => {
  mockBoard(view([], { connected: 23 }));
  render(<HostApp />);
  expect(screen.getByText("23 connected")).toBeTruthy();
});
