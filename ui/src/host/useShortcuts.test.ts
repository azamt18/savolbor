import { renderHook } from "@testing-library/react";
import { useShortcuts } from "./useShortcuts";

function press(key: string, target: EventTarget = document.body, init: KeyboardEventInit = {}) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
}

test("runs the mapped action", () => {
  const j = vi.fn();
  renderHook(() => useShortcuts({ j }));
  press("j");
  expect(j).toHaveBeenCalledTimes(1);
});

test("ignored in inputs, textareas, contenteditable and with modifiers", () => {
  const j = vi.fn();
  renderHook(() => useShortcuts({ j }));
  const input = document.body.appendChild(document.createElement("input"));
  const area = document.body.appendChild(document.createElement("textarea"));
  const editable = document.body.appendChild(document.createElement("div"));
  editable.setAttribute("contenteditable", "true");
  press("j", input);
  press("j", area);
  press("j", editable);
  press("j", document.body, { metaKey: true });
  press("j", document.body, { ctrlKey: true });
  press("j", document.body, { altKey: true });
  expect(j).not.toHaveBeenCalled();
});

test("Escape still works inside inputs", () => {
  const esc = vi.fn();
  renderHook(() => useShortcuts({ Escape: esc }));
  const input = document.body.appendChild(document.createElement("input"));
  press("Escape", input);
  expect(esc).toHaveBeenCalledTimes(1);
});
