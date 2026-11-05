import { neon } from "@neondatabase/serverless";

/**
 * Tiny driver seam so the same queries run on Neon in production and on
 * PGlite (in-process WASM Postgres) for local testing.
 *
 *   DATABASE_URL=postgres://…      → Neon over HTTP
 *   DATABASE_URL=pglite:<dir>      → PGlite stored in <dir>, schema auto-applied
 */

export type Query = { text: string; params: unknown[] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

type Driver = {
  query(q: Query): Promise<Row[]>;
  transaction(qs: Query[]): Promise<void>;
};

/** Tagged template → parameterised query. Values never touch the SQL text. */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Query {
  const text = strings.reduce((acc, s, i) => acc + `$${i}` + s);
  return { text, params: values };
}

function neonDriver(url: string): Driver {
  const client = neon(url);
  return {
    query: (q) => client.query(q.text, q.params) as Promise<Row[]>,
    transaction: async (qs) => {
      await client.transaction(qs.map((q) => client.query(q.text, q.params)));
    },
  };
}

// Kept on globalThis so dev hot-reloads reuse one PGlite instance.
const g = globalThis as { __mjPglite?: Promise<Driver> };

async function pgliteDriver(dir: string): Promise<Driver> {
  const [{ PGlite }, fs, path] = await Promise.all([
    import("@electric-sql/pglite"),
    import("node:fs/promises"),
    import("node:path"),
  ]);
  const db = new PGlite(dir);
  const schema = await fs.readFile(path.join(process.cwd(), "scripts/mj-schema.sql"), "utf8");
  await db.exec(schema);
  return {
    query: async (q) => (await db.query<Row>(q.text, q.params)).rows,
    transaction: async (qs) => {
      await db.transaction(async (tx) => {
        for (const q of qs) await tx.query(q.text, q.params);
      });
    },
  };
}

function driver(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  if (url.startsWith("pglite:")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("pglite: DATABASE_URL is for local testing only.");
    }
    g.__mjPglite ??= pgliteDriver(url.slice("pglite:".length));
    return g.__mjPglite;
  }
  return Promise.resolve(neonDriver(url));
}

export async function run(q: Query): Promise<Row[]> {
  return (await driver()).query(q);
}

export async function runTransaction(qs: Query[]): Promise<void> {
  return (await driver()).transaction(qs);
}
