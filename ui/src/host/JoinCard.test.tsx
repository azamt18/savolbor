import { render, screen, fireEvent } from "@testing-library/react";
import { JoinCard } from "./JoinCard";
import { setLang } from "../i18n";

beforeEach(() => setLang("en"));

const URL = "http://192.168.1.23:8080";
const open = () => fireEvent.click(screen.getByRole("button", { name: "Enlarge QR code" }));

test("small card shows the qr with the short url under it, and no print button", () => {
  render(<JoinCard url={URL} />);
  expect(screen.getByRole("img", { name: /QR 192\.168\.1\.23:8080/ })).toBeTruthy();
  expect(screen.getByText("192.168.1.23:8080")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /print/i })).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("clicking the card opens a full-screen overlay with url and wi-fi", () => {
  render(<JoinCard url={URL} wifi="Hotel Guest" />);
  open();
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toContain("192.168.1.23:8080");
  expect(dialog.textContent).toContain("Wi-Fi: Hotel Guest");
  expect(dialog.querySelector("img")!.getAttribute("src")).toBe("/qr.png?u=" + encodeURIComponent(URL));
});

test("overlay omits the wi-fi line when no name is set", () => {
  render(<JoinCard url={URL} />);
  open();
  expect(screen.getByRole("dialog").textContent).not.toContain("Wi-Fi");
});

test("esc, a click anywhere and the close button all close it; focus returns to the card", () => {
  render(<JoinCard url={URL} />);
  const card = screen.getByRole("button", { name: "Enlarge QR code" });
  const closers: Array<() => void> = [
    () => fireEvent.keyDown(document, { key: "Escape" }),
    () => fireEvent.click(screen.getByRole("dialog")),
    () => fireEvent.click(screen.getByRole("button", { name: "Close" })),
  ];
  for (const close of closers) {
    open();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    close();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(card);
  }
});
