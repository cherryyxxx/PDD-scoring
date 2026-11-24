import { clearSessionResponse, requireAdmin } from "@/lib/auth";
import { fail, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await readJson(request);
    await requireAdmin();
    return clearSessionResponse();
  } catch (error) {
    return fail(error);
  }
}
