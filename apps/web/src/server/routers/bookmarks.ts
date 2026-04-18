import { protectedProcedure, router } from "@/server/trpc";
import { db } from "@ocean-find/db";
import { bookmarks } from "@ocean-find/db";
import type { Job } from "@ocean-find/types";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export const bookmarksRouter = router({
  add: protectedProcedure
    .input(z.object({ jobData: z.custom<Job>() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const [bookmark] = await db
        .insert(bookmarks)
        .values({ userId, jobData: input.jobData })
        .returning();
      return bookmark;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id as string;
    return db.select().from(bookmarks).where(eq(bookmarks.userId, userId));
  }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      await db
        .delete(bookmarks)
        .where(and(eq(bookmarks.id, input.id), eq(bookmarks.userId, userId)));
      return { success: true };
    }),
});
