const CONTROL = /[\u0000-\u001f\u007f]/;

export function normalizeName(input: unknown, max = 40): string | null {
  if (typeof input !== "string") return null;
  const name = input.replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > max) return null;
  if (CONTROL.test(name)) return null;
  return name;
}

export function normalizePassword(input: unknown): string | null {
  if (typeof input !== "string") return null;
  if (input.length < 6 || input.length > 72) return null;
  if (input.trim().length < 6) return null;
  if (CONTROL.test(input)) return null;
  return input;
}

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const id = input.trim();
  if (!ID_RE.test(id)) return null;
  return id.toLowerCase();
}
