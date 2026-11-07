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

test("host controls share one size class", () => {
  const cur = q({ text: "now" });
  mockBoard(view([cur, q()], { highlighted: cur.id }));
  const { container } = render(<HostApp />);
  const controls = container.querySelectorAll("header button, header a, .now-card button");
  expect(controls.length).toBeGreaterThan(5);
  controls.forEach((el) => {
    expect(el.classList.contains("btn"), el.outerHTML).toBe(true);
    expect(el.classList.contains("big"), el.outerHTML).toBe(false);
  });
});

test("export link explains the file format", () => {
  mockBoard(view([]));
  render(<HostApp />);
  const link = screen.getByRole("link", { name: "Download questions" });
  expect(link.getAttribute("title")).toMatch(/\.md/);
});

test("clear highlight says it goes back to the queue", () => {
  const cur = q({ text: "now" });
  mockBoard(view([cur], { highlighted: cur.id }));
  render(<HostApp />);
  expect(screen.getByRole("button", { name: "Back to queue" })).toBeTruthy();
  expect(screen.queryByText(/clear highlight/i)).toBeNull();
});

test("join qr shows under the now panel", () => {
  mockBoard(view([]));
  render(<HostApp />);
  const img = screen.getByRole("img", { name: /QR 192\.168\.1\.23:8080/ });
  expect(img.getAttribute("src")).toBe("/qr.png?u=" + encodeURIComponent("http://192.168.1.23:8080"));
  // a button that enlarges it, with the short address under it
  const card = img.closest(".join-card")!;
  expect(card.tagName).toBe("BUTTON");
  expect(card.textContent).toBe("192.168.1.23:8080");
});

test("top-bar actions carry an icon next to their label, hidden from screen readers", () => {
  mockBoard(view([a]));
  render(<HostApp />);
  const targets = [screen.getByRole("link", { name: /download questions/i }), screen.getByRole("button", { name: /projector/i })];
  for (const el of targets) expect(el.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  expect(screen.getByRole("group", { name: /til/ }).querySelector("svg")).not.toBeNull();
  expect(screen.getByRole("banner").querySelector(".logo svg")).not.toBeNull();
});

test("connected count is styled as the live-room signal", () => {
  mockBoard(view([a], { connected: 3 }));
  render(<HostApp />);
  expect(screen.getByText("3 connected").closest(".live")!.classList.contains("has-count")).toBe(true);
});
