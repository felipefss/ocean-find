import { publicProcedure, router } from "@/server/trpc";
import { designatedEmployers, getDb } from "@ocean-find/db";
import { sql } from "drizzle-orm";

export const employersRouter = router({
  count: publicProcedure.query(async () => {
    const db = getDb();
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(designatedEmployers);
    return result[0]?.count ?? 0;
  }),
});
