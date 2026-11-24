import { requireAdmin, settings } from "@/lib/auth";
import { fail, HttpError, json } from "@/lib/http";
import { loadResults } from "@/lib/overview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const row = await settings();
    if (!row) throw new HttpError(409, "请先设置管理员密码");
    const data = await loadResults();
    return json({ hallKey: row.hall_key, ...data });
  } catch (error) {
    return fail(error);
  }
}
