import { hashPassword, jsonWithSession, newHallKey, openSession, settings } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fail, HttpError, isUniqueViolation, readJson } from "@/lib/http";
import { normalizePassword } from "@/lib/names";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as { password?: unknown };
    const password = normalizePassword(body?.password);
    if (!password) throw new HttpError(400, "密码至少 6 位");
    if (await settings()) throw new HttpError(409, "管理员密码已设置，请直接登录");
    const passwordHash = await hashPassword(password);
    const hallKey = newHallKey();
    try {
      await sql(
        "insert into admin_settings (id, password_hash, hall_key) values (1, $1, $2)",
        [passwordHash, hallKey],
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new HttpError(409, "管理员密码已设置，请直接登录");
      throw error;
    }
    const token = await openSession();
    return jsonWithSession({ ok: true }, token);
  } catch (error) {
    return fail(error);
  }
}
