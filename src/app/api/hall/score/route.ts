import { randomUUID } from "node:crypto";
import { requireHall } from "@/lib/auth";
import { sql } from "@/lib/db";
import { asBool, asNum, fail, HttpError, json, readJson } from "@/lib/http";
import { normalizeId, normalizeName } from "@/lib/names";
import { ITEM_LIST, parseScores, totalOf, type ItemKey, type ScoreMap } from "@/lib/rubric";
import { toIso } from "@/lib/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_SCORES = 5000;

async function activeCandidate(id: string): Promise<{ id: string; name: string }> {
  const rows = await sql<{ id: string; name: string; archived: unknown }>(
    "select id, name, archived from candidates where id = $1",
    [id],
  );
  const row = rows[0];
  if (!row || asBool(row.archived)) throw new HttpError(404, "找不到该答辩人");
  return { id: row.id, name: row.name };
}

function mapScore(row: Record<ItemKey, unknown> & { total: unknown; updated_at: unknown }) {
  const scores = {} as ScoreMap;
  for (const item of ITEM_LIST) scores[item.key] = asNum(row[item.key]);
  return { scores, total: asNum(row.total), updatedAt: toIso(row.updated_at) };
}

export async function GET(request: Request) {
  try {
    await requireHall(request);
    const url = new URL(request.url);
    const candidateId = normalizeId(url.searchParams.get("candidateId"));
    const judgeName = normalizeName(url.searchParams.get("judgeName"));
    if (!candidateId || !judgeName) throw new HttpError(400, "请选择答辩人并填写评委姓名");
    await activeCandidate(candidateId);
    const rows = await sql<Record<ItemKey, unknown> & { total: unknown; updated_at: unknown }>(
      `select ppt_design, ppt_time, ppt_expression, pm_duty, pm_problem,
              tech_duty, tech_problem, dept_duty, dept_problem, talent_duty,
              total, updated_at
       from scores
       where candidate_id = $1 and judge_name = $2`,
      [candidateId, judgeName],
    );
    return json({ score: rows[0] ? mapScore(rows[0]) : null });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireHall(request);
    const body = (await readJson(request)) as {
      candidateId?: unknown;
      judgeName?: unknown;
      scores?: unknown;
    };
    const candidateId = normalizeId(body?.candidateId);
    const judgeName = normalizeName(body?.judgeName);
    const scores = parseScores(body?.scores);
    if (!candidateId || !judgeName || !scores) {
      throw new HttpError(400, "请完成全部 10 项，且每项只能选择给定分值");
    }
    await activeCandidate(candidateId);
    const total = totalOf(scores);
    const existing = await sql(
      "select id from scores where candidate_id = $1 and judge_name = $2",
      [candidateId, judgeName],
    );
    if (existing.length === 0) {
      const count = await sql<{ n: number }>("select count(*)::int as n from scores");
      if (Number(count[0]?.n ?? 0) >= MAX_SCORES) throw new HttpError(400, "评分数量已达上限");
    }
    await sql(
      `insert into scores (
         id, candidate_id, judge_name,
         ppt_design, ppt_time, ppt_expression,
         pm_duty, pm_problem,
         tech_duty, tech_problem,
         dept_duty, dept_problem,
         talent_duty, total
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
       )
       on conflict (candidate_id, judge_name) do update set
         ppt_design = excluded.ppt_design,
         ppt_time = excluded.ppt_time,
         ppt_expression = excluded.ppt_expression,
         pm_duty = excluded.pm_duty,
         pm_problem = excluded.pm_problem,
         tech_duty = excluded.tech_duty,
         tech_problem = excluded.tech_problem,
         dept_duty = excluded.dept_duty,
         dept_problem = excluded.dept_problem,
         talent_duty = excluded.talent_duty,
         total = excluded.total,
         updated_at = now()`,
      [
        randomUUID(),
        candidateId,
        judgeName,
        scores.ppt_design,
        scores.ppt_time,
        scores.ppt_expression,
        scores.pm_duty,
        scores.pm_problem,
        scores.tech_duty,
        scores.tech_problem,
        scores.dept_duty,
        scores.dept_problem,
        scores.talent_duty,
        total,
      ],
    );
    return json({ total, overwritten: existing.length > 0, judgeName });
  } catch (error) {
    return fail(error);
  }
}
