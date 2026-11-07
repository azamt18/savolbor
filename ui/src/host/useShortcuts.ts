import { useEffect, useRef } from "react";

const typing = (t: EventTarget | null) =>
  t instanceof Element && t.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") !== null;

// Enter and space belong to a focused control (button, link, tab, summary).
const control = (t: EventTarget | null) =>
  t instanceof Element && t.closest("button, a[href], summary, [role='button'], [role='tab']") !== null;

// useShortcuts binds single keys on the document. Keys typed into a field
// stay letters (only Escape passes through), and any ctrl/meta/alt combo
// belongs to the browser.
export function useShortcuts(map: Record<string, () => void>) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== "Escape" && typing(e.target)) return;
      if ((e.key === "Enter" || e.key === " ") && control(e.target)) return;
      const fn = ref.current[e.key];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
