import { render, screen } from "@testing-library/react";
import { Projector } from "./Projector";
import { q, view } from "../testing";
import { setLang } from "../i18n";

beforeEach(() => setLang("en"));

test("no highlight shows the invite with qr and title", () => {
  render(<Projector view={view([q()], { title: "Agentlar" })} />);
  expect(screen.getByText("Got a question?")).toBeTruthy();
  expect(screen.getByText("Agentlar")).toBeTruthy();
  const img = screen.getByRole("img") as HTMLImageElement;
  expect(img.getAttribute("src")).toBe("/qr.png?u=" + encodeURIComponent("http://192.168.1.23:8080"));
  expect(screen.getByText("192.168.1.23:8080")).toBeTruthy();
});

test("done-next on last question shows invite", () => {
  // after Next on the last question: it is answered and nothing is highlighted
  render(<Projector view={view([q({ answered: true, text: "last" })], { highlighted: "" })} />);
  expect(screen.getByText("Got a question?")).toBeTruthy();
  expect(screen.queryByText("last")).toBeNull();
});

test("highlight fills the band; next strip shows two from the queue", () => {
  const now = q({ text: "now one", votes: 4 });
  const others = [q({ text: "n1", votes: 3 }), q({ text: "n2", votes: 2 }), q({ text: "n3", votes: 1 }), q({ text: "hid", votes: 9, hidden: true })];
  render(<Projector view={view([now, ...others], { highlighted: now.id })} />);
  expect(screen.getByText("now one").className).toContain("pj-xl");
  expect(screen.getByText("n1")).toBeTruthy();
  expect(screen.getByText("n2")).toBeTruthy();
  expect(screen.queryByText("n3")).toBeNull();
  expect(screen.queryByText("hid")).toBeNull();
  expect(screen.queryByText("Got a question?")).toBeNull();
});

test("280-char question uses size m", () => {
  const long = q({ text: "x".repeat(280) });
  render(<Projector view={view([long], { highlighted: long.id })} />);
  expect(screen.getByText("x".repeat(280)).className).toContain("pj-m");
});

test("hidden highlight falls back to the invite", () => {
  const h = q({ hidden: true, text: "rude" });
  render(<Projector view={view([h], { highlighted: h.id })} />);
  expect(screen.getByText("Got a question?")).toBeTruthy();
});
