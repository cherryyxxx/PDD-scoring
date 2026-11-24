export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return round2(sum / values.length);
}

/** Drop one highest and one lowest, then average. Null when fewer than 3 values. */
export function trimmedMean(values: readonly number[]): number | null {
  if (values.length < 3) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return mean(sorted.slice(1, -1));
}

export function formatAverage(value: number | null): string {
  if (value === null) return "—";
  return round2(value)
    .toFixed(2)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

export function formatTrimmed(value: number | null, count: number): string {
  if (count < 3) return "人数不足";
  return formatAverage(value);
}
