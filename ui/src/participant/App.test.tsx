import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "./App";
import { QuestionRow } from "./QuestionRow";
import { Composer } from "./Composer";
import { useBoard } from "../useBoard";
import { q, view } from "../testing";
import { setLang } from "../i18n";
import type { View } from "../api";

vi.mock("../useBoard", () => ({ useBoard: vi.fn() }));

function mockBoard(v: View) {
  const act = vi.fn(async (fn: () => Promise<unknown>) => { await fn(); return null; });
  vi.mocked(useBoard).mockReturnValue({ view: v, status: "live", act });
  return act;
}

beforeEach(() => {
  setLang("en");
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ id: "new" }), { status: 201 }))));
});
afterEach(() => vi.unstubAllGlobals());

const noop = async () => null;

test("vote pill shows voted state and is disabled after voting", () => {
  const { rerender } = render(<QuestionRow q={q({ votes: 2 })} now={Date.now()} onVote={noop} onEdit={noop} onDelete={noop} />);
  const pill = screen.getByRole("button", { name: /upvote/i });
  expect(pill).toHaveProperty("disabled", false);
  expect(pill.getAttribute("aria-pressed")).toBe("false");
  rerender(<QuestionRow q={q({ votes: 3, voted: true })} now={Date.now()} onVote={noop} onEdit={noop} onDelete={noop} />);
  const voted = screen.getByRole("button", { name: /you upvoted/i });
  expect(voted).toHaveProperty("disabled", true);
  expect(voted.getAttribute("aria-pressed")).toBe("true");
  expect(voted.textContent).toContain("3");
});

test("menu only on mine", () => {
  mockBoard(view([q({ mine: true, text: "mine" }), q({ text: "theirs" })]));
  render(<App />);
  expect(screen.getAllByRole("button", { name: /more actions/i })).toHaveLength(1);
  const row = screen.getByText("mine").closest("li")!;
  expect(within(row).getByRole("button", { name: /more actions/i })).toBeTruthy();
});

test("edit hidden when answered", () => {
  mockBoard(view([q({ mine: true, answered: true, text: "done one" })]));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
  expect(screen.queryByRole("menuitem", { name: /edit/i })).toBeNull();
  expect(screen.getByRole("menuitem", { name: /delete/i })).toBeTruthy();
});

test("delete asks inline before deleting", async () => {
  const act = mockBoard(view([q({ mine: true, text: "mine" })]));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
  fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
  expect(act).not.toHaveBeenCalled();
  expect(screen.getByText(/delete this question/i)).toBeTruthy();
  await act_(() => fireEvent.click(screen.getByRole("button", { name: /^delete$/i })));
  expect(act).toHaveBeenCalledTimes(1);
});

test("long unbroken text gets the wrap class", () => {
  const long = "https://example.com/" + "a".repeat(260);
  render(<QuestionRow q={q({ text: long })} now={Date.now()} onVote={noop} onEdit={noop} onDelete={noop} />);
  expect(screen.getByText(long).classList.contains("q-text")).toBe(true);
});

test("question text is never parsed as html", () => {
  mockBoard(view([q({ text: "<img src=x onerror=alert(1)>" })]));
  const { container } = render(<App />);
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
});

test("send clears textarea and keeps name", async () => {
  const send = vi.fn(async () => null);
  render(<Composer onSend={send} />);
  fireEvent.click(screen.getByRole("button", { name: /add your name/i }));
  fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: "Dilnoza" } });
  const box = screen.getByPlaceholderText(/type your question/i) as HTMLTextAreaElement;
  fireEvent.change(box, { target: { value: "Agent xotirasi qanday ishlaydi?" } });
  await act_(() => fireEvent.click(screen.getByRole("button", { name: /^send$/i })));
  expect(send).toHaveBeenCalledWith("Agent xotirasi qanday ishlaydi?", "Dilnoza");
  expect(box.value).toBe("");
  expect((screen.getByPlaceholderText(/your name/i) as HTMLInputElement).value).toBe("Dilnoza");
  expect(screen.getByText("Sent")).toBeTruthy();
});

test("counter appears only near the limit and counts runes", () => {
  render(<Composer onSend={noop} />);
  const box = screen.getByPlaceholderText(/type your question/i);
  fireEvent.change(box, { target: { value: "a".repeat(200) } });
  expect(screen.queryByText(/characters left/)).toBeNull();
  fireEvent.change(box, { target: { value: "oʻ".repeat(120) + "😀".repeat(5) } }); // 245 runes
  expect(screen.getByText("35 characters left")).toBeTruthy();
});

async function act_(fn: () => void) {
  await act(async () => { fn(); });
}
