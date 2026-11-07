import { ranked, visibleList, withVote } from "./select";
import { q, view } from "./testing";

test("ranked matches go rule: votes desc, then oldest", () => {
  const a = q({ votes: 2 }), b = q({ votes: 5 }), c = q({ votes: 2 });
  expect(ranked([c, a, b]).map((x) => x.id)).toEqual([b.id, a.id, c.id]);
});

test("mine tab shows only mine", () => {
  const mine = q({ mine: true }), other = q(), mineDone = q({ mine: true, answered: true });
  const { open, answered } = visibleList(view([mine, other, mineDone]), "mine");
  expect(open.map((x) => x.id)).toEqual([mine.id]);
  expect(answered.map((x) => x.id)).toEqual([mineDone.id]);
});

test("new tab is newest first", () => {
  const a = q(), b = q({ votes: 9 });
  expect(visibleList(view([a, b]), "new").open.map((x) => x.id)).toEqual([b.id, a.id]);
});

test("highlighted is not repeated in open list", () => {
  const a = q({ votes: 3 }), b = q();
  const { open } = visibleList(view([a, b], { highlighted: a.id }), "top");
  expect(open.map((x) => x.id)).toEqual([b.id]);
});

test("hidden questions never listed", () => {
  const a = q({ hidden: true });
  expect(visibleList(view([a]), "top").open).toEqual([]);
});

test("withVote adds one vote once", () => {
  const a = q({ votes: 1 });
  const v = withVote(withVote(view([a]), a.id), a.id);
  expect(v.questions[0]).toMatchObject({ votes: 2, voted: true });
});

import { projectorSize } from "./select";

test("projectorSize thresholds by runes", () => {
  expect(projectorSize("a".repeat(89))).toBe("xl");
  expect(projectorSize("a".repeat(90))).toBe("xl");
  expect(projectorSize("a".repeat(91))).toBe("l");
  expect(projectorSize("a".repeat(180))).toBe("l");
  expect(projectorSize("a".repeat(181))).toBe("m");
  // 90 runes of uzbek text is far more than 90 utf-16 units / bytes
  expect(projectorSize("oʻ".repeat(45))).toBe("xl");
  expect(projectorSize("😀".repeat(90))).toBe("xl");
});
