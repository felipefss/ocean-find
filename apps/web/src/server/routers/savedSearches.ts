import { protectedProcedure, router } from "@/server/trpc";
import { db } from "@ocean-find/db";
import { savedSearches } from "@ocean-find/db";
import type { Job } from "@ocean-find/types";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export const savedSearchesRouter = router({
  save: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        query: z.string(),
        provinces: z.array(z.string()),
        results: z.custom<Job[]>(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const [saved] = await db
        .insert(savedSearches)
        .values({
          userId,
          name: input.name,
          query: input.query,
          provinces: input.provinces,
          results: input.results,
        })
        .returning();
      return saved;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id as string;
    return db
      .select({
        id: savedSearches.id,
        name: savedSearches.name,
        query: savedSearches.query,
        provinces: savedSearches.provinces,
        results: savedSearches.results,
        createdAt: savedSearches.createdAt,
      })
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId));
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      await db
        .delete(savedSearches)
        .where(and(eq(savedSearches.id, input.id), eq(savedSearches.userId, userId)));
      return { success: true };
    }),
});
