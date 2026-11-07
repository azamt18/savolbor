import { ago } from "./format";
import { translate, type Lang } from "./i18n";

test("ago uses 24h clock regardless of browser locale", () => {
  const spy = vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
  const created = new Date(2026, 10, 7, 19, 23); // local time
  const now = created.getTime() + 2 * 60 * 60_000;
  for (const lang of ["uz", "en"] as Lang[]) {
    expect(ago(created.toISOString(), now, (k, v) => translate(lang, k, v))).toBe("19:23");
  }
  const morning = new Date(2026, 10, 7, 7, 5);
  expect(ago(morning.toISOString(), morning.getTime() + 3 * 3600_000, (k, v) => translate("en", k, v))).toBe("07:05");
  spy.mockRestore();
});

test("ago under an hour is relative", () => {
  const created = new Date(2026, 10, 7, 10, 0);
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate("en", k, v);
  expect(ago(created.toISOString(), created.getTime() + 30_000, t)).toBe("just now");
  expect(ago(created.toISOString(), created.getTime() + 59 * 60_000, t)).toBe("59 min ago");
});
