import { fireEvent, render, screen } from "@testing-library/react";
import { LangToggle } from "./LangToggle";
import { setLang } from "./i18n";

beforeEach(() => setLang("uz"));

test("each language button carries its flag next to the code; no globe", () => {
  const { container } = render(<LangToggle />);
  for (const code of ["uz", "en"]) {
    const btn = screen.getByRole("button", { name: code });
    expect(btn.querySelector("svg.flag[aria-hidden='true']")).not.toBeNull();
  }
  expect(container.querySelector(".lang-globe")).toBeNull();
});

test("clicking a flag button switches the language", () => {
  render(<LangToggle />);
  fireEvent.click(screen.getByRole("button", { name: "en" }));
  expect(screen.getByRole("button", { name: "en" }).getAttribute("aria-pressed")).toBe("true");
});
