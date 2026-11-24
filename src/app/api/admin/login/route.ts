import { jsonWithSession, openSession, settings, verifyPassword } from "@/lib/auth";
import { fail, HttpError, readJson } from "@/lib/http";
import { normalizePassword } from "@/lib/names";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as { password?: unknown };
    const password = normalizePassword(body?.password);
    if (!password) throw new HttpError(400, "密码不正确");
    const row = await settings();
    if (!row) throw new HttpError(409, "请先设置管理员密码");
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) throw new HttpError(401, "密码不正确");
    const token = await openSession();
    return jsonWithSession({ ok: true }, token);
  } catch (error) {
    return fail(error);
  }
}
