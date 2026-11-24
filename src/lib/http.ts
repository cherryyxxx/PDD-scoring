import "server-only";
import { NextResponse } from "next/server";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function fail(error: unknown): NextResponse {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  console.error(error instanceof Error ? error.message : "request failed");
  return json({ error: "服务器繁忙，请稍后再试" }, 500);
}

export async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get("x-pdd-request") !== "1") {
    throw new HttpError(400, "请求无效");
  }
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    throw new HttpError(415, "请使用 JSON 提交");
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 20_000) {
    throw new HttpError(413, "请求过大");
  }
  const text = await request.text();
  if (text.length > 20_000) throw new HttpError(413, "请求过大");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "请求格式不正确");
  }
}

export function asBool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

export function asNum(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505";
}
