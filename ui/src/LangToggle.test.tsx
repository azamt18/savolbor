import { fireEvent, render, screen } from "@testing-library/react";
import { LangToggle } from "./LangToggle";
import { setLang } from "./i18n";

beforeEach(() => setLang("uz"));

test("each language button is just its flag, named for screen readers", () => {
  render(<LangToggle />);
  for (const name of ["Oʻzbekcha", "English"]) {
    const btn = screen.getByRole("button", { name });
    expect(btn.querySelector("svg.flag[aria-hidden='true']")).not.toBeNull();
    expect(btn.textContent).toBe("");
  }
});

test("clicking a flag button switches the language", () => {
  render(<LangToggle />);
  fireEvent.click(screen.getByRole("button", { name: "English" }));
  expect(screen.getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("true");
});
