import { render, screen, fireEvent } from "@testing-library/react";
import { JoinCard } from "./JoinCard";
import { setLang } from "../i18n";

beforeEach(() => setLang("en"));

test("print button prints the page", () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  render(<JoinCard url="http://192.168.1.23:8080" />);
  fireEvent.click(screen.getByRole("button", { name: "Print join card" }));
  expect(print).toHaveBeenCalledOnce();
  print.mockRestore();
});

test("print card has qr, short url, the wi-fi line and the wi-fi name only when set", () => {
  const { container, rerender } = render(<JoinCard url="http://192.168.1.23:8080" wifi="Hotel Guest" />);
  const card = container.querySelector(".print-card")!;
  expect(card.querySelector("img")!.getAttribute("src")).toBe("/qr.png?u=" + encodeURIComponent("http://192.168.1.23:8080"));
  expect(card.textContent).toContain("192.168.1.23:8080");
  expect(card.textContent).toContain("Join the same Wi-Fi");
  expect(card.textContent).toContain("Wi-Fi: Hotel Guest");
  rerender(<JoinCard url="http://192.168.1.23:8080" />);
  expect(container.querySelector(".print-card")!.textContent).not.toContain("Wi-Fi: ");
});
