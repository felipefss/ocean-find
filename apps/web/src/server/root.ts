import { router } from "@/server/trpc";
import { bookmarksRouter } from "./routers/bookmarks";
import { employersRouter } from "./routers/employers";
import { savedSearchesRouter } from "./routers/savedSearches";

export const appRouter = router({
  bookmarks: bookmarksRouter,
  savedSearches: savedSearchesRouter,
  employers: employersRouter,
});

export type AppRouter = typeof appRouter;
