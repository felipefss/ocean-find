import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

let dbInstance: ReturnType<typeof createDb> | undefined;

export function getDb() {
  if (!dbInstance) {
    dbInstance = createDb();
  }

  return dbInstance;
}

export * from "./schema";
