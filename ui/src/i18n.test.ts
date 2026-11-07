import { dict, format } from "./i18n";

test("uz and en have the same keys", () => {
  expect(Object.keys(dict.uz).sort()).toEqual(Object.keys(dict.en).sort());
});

test("no value is empty", () => {
  for (const lang of ["uz", "en"] as const) {
    for (const [k, v] of Object.entries(dict[lang])) expect(v.trim(), `${lang}.${k}`).not.toBe("");
  }
});

test("uzbek uses the modifier letter turned comma", () => {
  const all = Object.values(dict.uz).join(" ");
  expect(all).not.toMatch(/[oOgG]['‘’`]/);
  expect(all).toContain("oʻ");
});

test("format fills vars", () => {
  expect(format("{n} ta, {m}", { n: 3, m: "x" })).toBe("3 ta, x");
});

test("errorKey falls back to internal", async () => {
  const { errorKey } = await import("./i18n");
  expect(errorKey("not_found")).toBe("err_not_found");
  expect(errorKey("weird")).toBe("err_internal");
});
