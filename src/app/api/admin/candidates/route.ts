import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { asBool, fail, HttpError, isUniqueViolation, json, readJson } from "@/lib/http";
import { normalizeId, normalizeName } from "@/lib/names";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_CANDIDATES = 300;

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await readJson(request)) as { name?: unknown };
    const name = normalizeName(body?.name);
    if (!name) throw new HttpError(400, "请填写答辩人姓名");
    const count = await sql<{ n: number }>("select count(*)::int as n from candidates");
    if (Number(count[0]?.n ?? 0) >= MAX_CANDIDATES) {
      throw new HttpError(400, "答辩人数量已达上限");
    }
    const dup = await sql("select id from candidates where archived = false and name = $1", [name]);
    if (dup.length > 0) throw new HttpError(409, "已有同名答辩人");
    const id = randomUUID();
    try {
      await sql(
        `insert into candidates (id, name, sort_order)
         values ($1, $2, (select coalesce(max(sort_order), 0) + 1 from candidates))`,
        [id, name],
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new HttpError(409, "已有同名答辩人");
      throw error;
    }
    return json({ candidate: { id, name, archived: false } });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = (await readJson(request)) as {
      id?: unknown;
      name?: unknown;
      archived?: unknown;
    };
    const id = normalizeId(body?.id);
    if (!id) throw new HttpError(400, "找不到该答辩人");
    const current = await sql<{ name: string; archived: unknown }>(
      "select name, archived from candidates where id = $1",
      [id],
    );
    if (!current[0]) throw new HttpError(404, "找不到该答辩人");

    const hasName = Object.prototype.hasOwnProperty.call(body ?? {}, "name");
    const hasArchived = Object.prototype.hasOwnProperty.call(body ?? {}, "archived");
    if (!hasName && !hasArchived) throw new HttpError(400, "没有要修改的内容");

    const name = hasName ? normalizeName(body.name) : current[0].name;
    if (!name) throw new HttpError(400, "请填写答辩人姓名");
    if (hasArchived && typeof body.archived !== "boolean") {
      throw new HttpError(400, "隐藏状态不正确");
    }
    const archived = hasArchived ? body.archived === true : asBool(current[0].archived);

    if (!archived) {
      const dup = await sql("select id from candidates where archived = false and name = $1 and id <> $2", [
        name,
        id,
      ]);
      if (dup.length > 0) throw new HttpError(409, "已有同名答辩人");
    }

    try {
      if (hasName && hasArchived) {
        await sql("update candidates set name = $1, archived = $2 where id = $3", [name, archived, id]);
      } else if (hasName) {
        await sql("update candidates set name = $1 where id = $2", [name, id]);
      } else {
        await sql("update candidates set archived = $1 where id = $2", [archived, id]);
      }
    } catch (error) {
      if (isUniqueViolation(error)) throw new HttpError(409, "已有同名答辩人");
      throw error;
    }
    return json({ candidate: { id, name, archived } });
  } catch (error) {
    return fail(error);
  }
}
