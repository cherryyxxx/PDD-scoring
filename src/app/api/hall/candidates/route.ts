import { requireHall } from "@/lib/auth";
import { sql } from "@/lib/db";
import { asNum, fail, HttpError, json } from "@/lib/http";
import { normalizeName } from "@/lib/names";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireHall(request);
    const url = new URL(request.url);
    const rawName = url.searchParams.get("judgeName");
    const judgeName = rawName === null || rawName === "" ? "" : normalizeName(rawName);
    if (rawName && judgeName === null) throw new HttpError(400, "评委姓名不正确");
    const rows = await sql<{ id: string; name: string; total: unknown }>(
      `select c.id, c.name, s.total
       from candidates c
       left join scores s on s.candidate_id = c.id and s.judge_name = $1
       where c.archived = false
       order by c.sort_order asc, c.created_at asc`,
      [judgeName],
    );
    return json({
      candidates: rows.map((row) => ({
        id: row.id,
        name: row.name,
        total: row.total == null ? null : asNum(row.total),
      })),
    });
  } catch (error) {
    return fail(error);
  }
}
