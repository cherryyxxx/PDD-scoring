import assert from "node:assert/strict";
import { ITEM_LIST, TOTAL_MAX, parseScores, totalOf, type ScoreMap } from "../src/lib/rubric.ts";
import { assignRanks, buildResult } from "../src/lib/results.ts";
import { formatAverage, formatTrimmed, trimmedMean } from "../src/lib/stats.ts";

assert.equal(TOTAL_MAX, 120);
assert.equal(ITEM_LIST.length, 10);

function band(index: 0 | 1 | 2): ScoreMap {
  const scores = {} as ScoreMap;
  for (const item of ITEM_LIST) scores[item.key] = item.choices[index].value;
  return scores;
}

const high = band(0);
const mid = band(1);
const low = band(2);
assert.equal(totalOf(high), 120);
assert.equal(totalOf(mid), 65);
assert.equal(totalOf(low), 20);
assert.equal(parseScores({ ...high, ppt_design: 4 }), null);

const edited = { ...high, ppt_design: 3 };
assert.equal(totalOf(edited), 118);

const two = buildResult({ id: "1", name: "陈一", archived: false }, [
  { judgeName: "评委甲", scores: high, updatedAt: "2026-11-24T02:00:00.000Z" },
  { judgeName: "评委乙", scores: mid, updatedAt: "2026-11-24T02:01:00.000Z" },
]);
assert.equal(two.total.a, 92.5);
assert.equal(two.total.b, null);
assert.equal(formatTrimmed(two.total.b, two.judgeCount), "人数不足");
assert.equal(formatAverage(two.total.a), "92.5");

const three = buildResult({ id: "1", name: "陈一", archived: false }, [
  { judgeName: "评委甲", scores: edited, updatedAt: "2026-11-24T02:02:00.000Z" },
  { judgeName: "评委乙", scores: mid, updatedAt: "2026-11-24T02:01:00.000Z" },
  { judgeName: "评委丙", scores: low, updatedAt: "2026-11-24T02:03:00.000Z" },
]);
assert.equal(three.judgeCount, 3);
assert.equal(three.total.a, 67.67);
assert.equal(three.total.b, 65);
assert.equal(three.items.ppt_design.a, 2.33);
assert.equal(three.items.ppt_design.b, 3);
assert.equal(three.groups.ppt.a, 8.33);
assert.equal(three.groups.ppt.b, 9);
assert.equal(trimmedMean([5, 5, 1]), 5);
assert.equal(trimmedMean([1, 2, 3, 4]), 2.5);
assert.equal(trimmedMean([10, 10]), null);

const ranked = assignRanks([
  three,
  buildResult({ id: "2", name: "林二", archived: false }, [
    { judgeName: "评委乙", scores: mid, updatedAt: "2026-11-24T02:01:00.000Z" },
  ]),
  buildResult({ id: "3", name: "空", archived: false }, []),
]);
assert.deepEqual(
  ranked.map((card) => [card.name, card.rank, card.total.a]),
  [
    ["陈一", 1, 67.67],
    ["林二", 2, 65],
    ["空", null, null],
  ],
);

console.log("check-results: ok");
