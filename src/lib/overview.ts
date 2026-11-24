import "server-only";
import { sql } from "./db";
import { asBool, asNum } from "./http";
import { ITEM_LIST, type ItemKey, type ScoreMap } from "./rubric";
import { assignRanks, buildResult, type ResultCard } from "./results";
import { toIso } from "./time";

export type CandidateRow = {
  id: string;
  name: string;
  archived: boolean;
  sortOrder: number;
};

type ScoreRow = {
  candidate_id: string;
  judge_name: string;
  updated_at: unknown;
} & Record<ItemKey, unknown>;

export async function listCandidates(): Promise<CandidateRow[]> {
  const rows = await sql<{
    id: string;
    name: string;
    archived: unknown;
    sort_order: unknown;
  }>("select id, name, archived, sort_order from candidates order by sort_order asc, created_at asc");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    archived: asBool(row.archived),
    sortOrder: asNum(row.sort_order),
  }));
}

export async function loadResults(): Promise<{ candidates: CandidateRow[]; results: ResultCard[] }> {
  const candidates = await listCandidates();
  const scores = await sql<ScoreRow>(
    `select candidate_id, judge_name, updated_at,
            ppt_design, ppt_time, ppt_expression,
            pm_duty, pm_problem, tech_duty, tech_problem,
            dept_duty, dept_problem, talent_duty
     from scores
     order by judge_name asc`,
  );
  const byCandidate = new Map<string, ScoreRow[]>();
  for (const score of scores) {
    const list = byCandidate.get(score.candidate_id) ?? [];
    list.push(score);
    byCandidate.set(score.candidate_id, list);
  }
  const cards = candidates.map((candidate) =>
    buildResult(
      candidate,
      (byCandidate.get(candidate.id) ?? []).map((score) => {
        const map = {} as ScoreMap;
        for (const item of ITEM_LIST) map[item.key] = asNum(score[item.key]);
        return {
          judgeName: score.judge_name,
          scores: map,
          updatedAt: toIso(score.updated_at),
        };
      }),
    ),
  );
  return { candidates, results: assignRanks(cards) };
}
