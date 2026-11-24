export type ItemKey =
  | "ppt_design"
  | "ppt_time"
  | "ppt_expression"
  | "pm_duty"
  | "pm_problem"
  | "tech_duty"
  | "tech_problem"
  | "dept_duty"
  | "dept_problem"
  | "talent_duty";

export type GroupId = "ppt" | "pm" | "tech" | "dept" | "talent";

export type Choice = {
  label: "优秀" | "中等" | "待提高";
  value: number;
};

export type RubricItem = {
  key: ItemKey;
  label: string;
  short: string;
  max: number;
  standard?: string;
  choices: readonly Choice[];
};

export type RubricGroup = {
  id: GroupId;
  title: string;
  max: number;
  hint?: string;
  items: readonly RubricItem[];
};

export const DUTY_HINT =
  "阐述该块工作中个人职责与贡献、工作完成度；问题解决是发现问题、找到根本原因、提出解决与优化的方案。优秀约对应表上的 20% 档，中等 60% 档，待提高 20% 档。";

function choices(values: readonly [number, number, number]): readonly Choice[] {
  return [
    { label: "优秀", value: values[0] },
    { label: "中等", value: values[1] },
    { label: "待提高", value: values[2] },
  ];
}

export const GROUPS: readonly RubricGroup[] = [
  {
    id: "ppt",
    title: "PPT呈现",
    max: 15,
    items: [
      {
        key: "ppt_design",
        label: "内容与设计",
        short: "PPT-内容与设计",
        max: 5,
        standard: "Slides布局美观，字体/字号统一，逻辑清晰，重点突出。",
        choices: choices([5, 3, 1]),
      },
      {
        key: "ppt_time",
        label: "时间控制",
        short: "PPT-时间控制",
        max: 5,
        standard: "偏离预期 ＜0.5 min 5分；0.5–1 min 3分；＞1 min 1分。",
        choices: choices([5, 3, 1]),
      },
      {
        key: "ppt_expression",
        label: "表达能力",
        short: "PPT-表达能力",
        max: 5,
        standard: "表达自信流畅，条理清晰。",
        choices: choices([5, 3, 1]),
      },
    ],
  },
  {
    id: "pm",
    title: "项目管理，下游工艺开发/表征，中试生产（适用中试团队）",
    max: 35,
    hint: DUTY_HINT,
    items: [
      {
        key: "pm_duty",
        label: "职责与贡献",
        short: "项目-职责与贡献",
        max: 25,
        choices: choices([25, 15, 5]),
      },
      {
        key: "pm_problem",
        label: "问题解决与改善",
        short: "项目-问题解决与改善",
        max: 10,
        choices: choices([10, 5, 1]),
      },
    ],
  },
  {
    id: "tech",
    title: "技术平台",
    max: 25,
    hint: DUTY_HINT,
    items: [
      {
        key: "tech_duty",
        label: "职责与贡献",
        short: "技术-职责与贡献",
        max: 15,
        choices: choices([15, 8, 2]),
      },
      {
        key: "tech_problem",
        label: "问题解决与改善",
        short: "技术-问题解决与改善",
        max: 10,
        choices: choices([10, 5, 1]),
      },
    ],
  },
  {
    id: "dept",
    title: "部门事务，跨部门沟通",
    max: 25,
    hint: DUTY_HINT,
    items: [
      {
        key: "dept_duty",
        label: "职责与贡献",
        short: "部门-职责与贡献",
        max: 15,
        choices: choices([15, 8, 2]),
      },
      {
        key: "dept_problem",
        label: "问题解决与改善",
        short: "部门-问题解决与改善",
        max: 10,
        choices: choices([10, 5, 1]),
      },
    ],
  },
  {
    id: "talent",
    title: "人才发展与团队建设",
    max: 20,
    hint: DUTY_HINT,
    items: [
      {
        key: "talent_duty",
        label: "职责与贡献",
        short: "人才-职责与贡献",
        max: 20,
        choices: choices([20, 10, 5]),
      },
    ],
  },
];

export const ITEM_LIST: readonly RubricItem[] = GROUPS.flatMap((group) => group.items);

export const TOTAL_MAX = GROUPS.reduce((sum, group) => sum + group.max, 0);

export type ScoreMap = Record<ItemKey, number>;

export function emptyChoices(): Partial<ScoreMap> {
  return {};
}

export function parseScores(input: unknown): ScoreMap | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const scores = {} as ScoreMap;
  for (const item of ITEM_LIST) {
    const value = source[item.key];
    if (typeof value !== "number" || !Number.isInteger(value)) return null;
    if (!item.choices.some((choice) => choice.value === value)) return null;
    scores[item.key] = value;
  }
  return scores;
}

export function totalOf(scores: ScoreMap): number {
  return ITEM_LIST.reduce((sum, item) => sum + scores[item.key], 0);
}

export function groupTotal(groupId: GroupId, scores: ScoreMap): number {
  const group = GROUPS.find((item) => item.id === groupId);
  if (!group) return 0;
  return group.items.reduce((sum, item) => sum + scores[item.key], 0);
}
