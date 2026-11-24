import "server-only";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
let pool: pg.Pool | undefined;

type DbGlobal = typeof globalThis & { __pddPglite?: Promise<PGlite> };

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    pool ??= new pg.Pool({
      connectionString: databaseUrl,
      max: 5,
      statement_timeout: 15_000,
      idleTimeoutMillis: 10_000,
    });
    return (await pool.query(text, params)).rows as T[];
  }
  const local = await startLocal();
  return (await local.query<T>(text, params)).rows;
}

function startLocal(): Promise<PGlite> {
  const store = globalThis as DbGlobal;
  store.__pddPglite ??= createLocal().catch((error: unknown) => {
    store.__pddPglite = undefined;
    throw error;
  });
  return store.__pddPglite;
}

async function createLocal(): Promise<PGlite> {
  const db = new PGlite();
  const files = (await readdir("migrations").catch(() => []))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  return db;
}
