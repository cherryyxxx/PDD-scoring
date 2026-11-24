import { requireAdmin } from "@/lib/auth";
import { buildWorkbook } from "@/lib/excel";
import { fail } from "@/lib/http";
import { loadResults } from "@/lib/overview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const { results } = await loadResults();
    const file = await buildWorkbook(results);
    const filename = encodeURIComponent("PDD绩效答辩评分.xlsx");
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="pdd-scores.xlsx"; filename*=UTF-8''${filename}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
