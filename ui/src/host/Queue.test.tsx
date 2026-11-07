import { fireEvent, render, screen, within } from "@testing-library/react";
import { Queue } from "./Queue";
import { q } from "../testing";
import { setLang } from "../i18n";

beforeEach(() => setLang("en"));

const rows = [q({ text: "first" }), q({ text: "second" }), q({ text: "third" })];

function setup(over: Partial<Parameters<typeof Queue>[0]> = {}) {
  const noop = () => {};
  return render(
    <Queue
      tab="queue" setTab={noop} counts={{ queue: 3, answered: 0, hidden: 0 }}
      list={rows} selected={rows[1].id} now={Date.now()}
      onSelect={noop} onAnswered={noop} onHidden={noop}
      {...over}
    />,
  );
}

const rowOf = (text: string) => screen.getByText(text).closest("li")!;

test("action buttons render only on the selected row", () => {
  setup();
  expect(within(rowOf("second")).getByRole("button", { name: "Hide" })).toBeTruthy();
  expect(within(rowOf("second")).queryByRole("button", { name: "Answer now" })).toBeNull();
  expect(within(rowOf("first")).queryByRole("button")).toBeNull();
  expect(within(rowOf("third")).queryByRole("button")).toBeNull();
});

test("hovering another row reveals its actions too", () => {
  setup();
  fireEvent.mouseEnter(rowOf("third"));
  expect(within(rowOf("third")).getByRole("button", { name: "Hide" })).toBeTruthy();
  fireEvent.mouseLeave(rowOf("third"));
  expect(within(rowOf("third")).queryByRole("button")).toBeNull();
});

test("the row being answered carries a chip, others do not", () => {
  setup({ highlighted: rows[0].id });
  expect(within(rowOf("first")).getByText("Now")).toBeTruthy();
  expect(within(rowOf("second")).queryByText("Now")).toBeNull();
});
