import { isAdmin, settings } from "@/lib/auth";
import { fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const row = await settings();
    const needsSetup = row === null;
    const authenticated = needsSetup ? false : await isAdmin();
    return json({ needsSetup, authenticated });
  } catch (error) {
    return fail(error);
  }
}
