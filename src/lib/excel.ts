import "server-only";
import ExcelJS from "exceljs";
import { GROUPS, ITEM_LIST } from "./rubric";
import type { ResultCard } from "./results";
import { formatShanghai } from "./time";

function excelText(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

const GROUP_SHORT = {
  ppt: "PPT呈现",
  pm: "项目管理",
  tech: "技术平台",
  dept: "部门事务",
  talent: "人才发展",
} as const;

function cellValue(count: number, average: number | null, trimmed: boolean): string | number {
  if (trimmed) {
    if (count < 3) return "人数不足";
    return average ?? "人数不足";
  }
  if (average === null) return "—";
  return average;
}

export async function buildWorkbook(results: readonly ResultCard[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PDD绩效答辩评分";
  workbook.created = new Date();

  const detail = workbook.addWorksheet("明细");
  detail.columns = [
    { header: "答辩人", key: "candidate", width: 18 },
    { header: "是否隐藏", key: "archived", width: 12 },
    { header: "评委", key: "judge", width: 16 },
    ...ITEM_LIST.map((item) => ({ header: item.short, key: item.key, width: 22 })),
    { header: "总分", key: "total", width: 10 },
    { header: "提交时间", key: "updated", width: 20 },
  ];
  for (const card of results) {
    for (const judge of card.judges) {
      const row: Record<string, string | number> = {
        candidate: excelText(card.name),
        archived: card.archived ? "已隐藏" : "",
        judge: excelText(judge.judgeName),
        total: judge.total,
        updated: formatShanghai(judge.updatedAt),
      };
      for (const item of ITEM_LIST) row[item.key] = judge.scores[item.key];
      detail.addRow(row);
    }
  }
  detail.getRow(1).font = { bold: true };
  detail.views = [{ state: "frozen", ySplit: 1 }];
  detail.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: detail.columns.length },
  };

  const summary = workbook.addWorksheet("汇总");
  const summaryColumns: { header: string; key: string; width: number }[] = [
    { header: "排名", key: "rank", width: 10 },
    { header: "答辩人", key: "candidate", width: 18 },
    { header: "是否隐藏", key: "archived", width: 12 },
    { header: "评委人数", key: "count", width: 12 },
    { header: "总分A_全部评委平均", key: "totalA", width: 22 },
    { header: "总分B_去极值平均", key: "totalB", width: 20 },
  ];
  for (const group of GROUPS) {
    const title = GROUP_SHORT[group.id];
    summaryColumns.push(
      { header: `${title}A`, key: `${group.id}A`, width: 16 },
      { header: `${title}B`, key: `${group.id}B`, width: 16 },
    );
  }
  for (const item of ITEM_LIST) {
    summaryColumns.push(
      { header: `${item.short}A`, key: `${item.key}A`, width: 22 },
      { header: `${item.short}B`, key: `${item.key}B`, width: 22 },
    );
  }
  summary.columns = summaryColumns;
  for (const card of results) {
    const row: Record<string, string | number> = {
      rank: card.rank ?? "",
      candidate: excelText(card.name),
      archived: card.archived ? "已隐藏" : "",
      count: card.judgeCount,
      totalA: cellValue(card.judgeCount, card.total.a, false),
      totalB: cellValue(card.judgeCount, card.total.b, true),
    };
    for (const group of GROUPS) {
      row[`${group.id}A`] = cellValue(card.judgeCount, card.groups[group.id].a, false);
      row[`${group.id}B`] = cellValue(card.judgeCount, card.groups[group.id].b, true);
    }
    for (const item of ITEM_LIST) {
      row[`${item.key}A`] = cellValue(card.judgeCount, card.items[item.key].a, false);
      row[`${item.key}B`] = cellValue(card.judgeCount, card.items[item.key].b, true);
    }
    summary.addRow(row);
  }
  summary.getRow(1).font = { bold: true };
  summary.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
