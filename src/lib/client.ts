export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; hallKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    headers["x-pdd-request"] = "1";
  }
  if (options.hallKey) headers["x-hall-key"] = options.hallKey;
  const response = await fetch(path, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    credentials: "same-origin",
  });
  const data = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "请求失败");
  }
  return data as T;
}
