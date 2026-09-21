import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export interface DB {
  query<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (db: DB) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function openDatabase(
  url?: string,
  localPath = process.env.LOCAL_DATABASE_PATH ?? "./.data/fitlens",
): Promise<DB> {
  if (url) {
    const pool = new pg.Pool({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: 15000,
    });
    const adapt = (client: pg.Pool | pg.PoolClient): DB => ({
      query: async (sql, params = []) => (await client.query(sql, params)).rows,
      transaction: async (fn) => {
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          const result = await fn(adapt(c));
          await c.query("COMMIT");
          return result;
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        } finally {
          c.release();
        }
      },
      close: () => pool.end(),
    });
    return adapt(pool);
  }
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "DATABASE_URL is required in production. Local storage is not durable on Render.",
    );
  if (localPath !== "memory://") await mkdir(localPath, { recursive: true });
  const pglite = new PGlite(localPath);
  await pglite.waitReady;
  const adapt = (client: Pick<PGlite, "query">): DB => ({
    query: async (sql, params = []) =>
      (await client.query(sql, params)).rows as any,
    transaction: (fn) => pglite.transaction((tx) => fn(adapt(tx))),
    close: () => pglite.close(),
  });
  return adapt(pglite);
}
export async function migrate(db: DB) {
  const schema = await readFile(
    fileURLToPath(new URL("./schema.sql", import.meta.url)),
    "utf8",
  );
  // Execute separately for PostgreSQL's extended-query protocol and PGlite alike.
  for (const statement of schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await db.query(statement);
}
