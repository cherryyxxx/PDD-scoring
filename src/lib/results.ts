import {
  GROUPS,
  ITEM_LIST,
  groupTotal,
  totalOf,
  type GroupId,
  type ItemKey,
  type ScoreMap,
} from "./rubric";
import { mean, trimmedMean } from "./stats";

export type Agg = {
  a: number | null;
  b: number | null;
};

export type JudgeRow = {
  judgeName: string;
  scores: ScoreMap;
  groups: Record<GroupId, number>;
  total: number;
  updatedAt: string;
};

export type ResultCard = {
  id: string;
  name: string;
  archived: boolean;
  judgeCount: number;
  rank: number | null;
  total: Agg;
  groups: Record<GroupId, Agg>;
  items: Record<ItemKey, Agg>;
  judges: JudgeRow[];
};

export type JudgeInput = {
  judgeName: string;
  scores: ScoreMap;
  updatedAt: string;
};

function aggregate(values: number[]): Agg {
  return { a: mean(values), b: trimmedMean(values) };
}

export function buildResult(
  candidate: { id: string; name: string; archived: boolean },
  judges: readonly JudgeInput[],
): ResultCard {
  const rows: JudgeRow[] = judges.map((judge) => {
    const groups = {} as Record<GroupId, number>;
    for (const group of GROUPS) {
      groups[group.id] = groupTotal(group.id, judge.scores);
    }
    return {
      judgeName: judge.judgeName,
      scores: judge.scores,
      groups,
      total: totalOf(judge.scores),
      updatedAt: judge.updatedAt,
    };
  });

  const items = {} as Record<ItemKey, Agg>;
  for (const item of ITEM_LIST) {
    items[item.key] = aggregate(rows.map((row) => row.scores[item.key]));
  }
  const groups = {} as Record<GroupId, Agg>;
  for (const group of GROUPS) {
    groups[group.id] = aggregate(rows.map((row) => row.groups[group.id]));
  }

  return {
    id: candidate.id,
    name: candidate.name,
    archived: candidate.archived,
    judgeCount: rows.length,
    rank: null,
    total: aggregate(rows.map((row) => row.total)),
    groups,
    items,
    judges: rows,
  };
}

export function assignRanks(cards: readonly ResultCard[]): ResultCard[] {
  const ranked = cards
    .filter((card) => card.judgeCount > 0 && card.total.a !== null)
    .slice()
    .sort((a, b) => {
      const delta = (b.total.a ?? 0) - (a.total.a ?? 0);
      if (delta !== 0) return delta;
      return a.name.localeCompare(b.name, "zh");
    });
  let lastScore: number | null = null;
  let lastRank = 0;
  const withRank = ranked.map((card, index) => {
    const score = card.total.a;
    const rank = score !== null && score === lastScore ? lastRank : index + 1;
    lastScore = score;
    lastRank = rank;
    return { ...card, rank };
  });
  const unranked = cards
    .filter((card) => card.judgeCount === 0 || card.total.a === null)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "zh"));
  return [...withRank, ...unranked];
}
