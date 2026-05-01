import { describe, expect, it, vi } from "vitest";
import { createEmployerCache } from "../../lib/employer-cache.js";

describe("createEmployerCache", () => {
  it("reuses the cached matcher inside the ttl window", async () => {
    const loader = vi.fn().mockResolvedValueOnce([{ id: "1", name: "Acme", province: "NB" }]);

    const cache = createEmployerCache({ ttlMs: 300_000, loadEmployers: loader });

    const first = await cache.getMatcher();
    const second = await cache.getMatcher();

    expect(first).toBe(second);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("reloads once the ttl expires", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce([{ id: "1", name: "Acme", province: "NB" }])
      .mockResolvedValueOnce([{ id: "2", name: "Bravo", province: "NS" }]);

    const cache = createEmployerCache({ ttlMs: 1, loadEmployers: loader });

    await cache.getMatcher();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await cache.getMatcher();

    expect(loader).toHaveBeenCalledTimes(2);
  });
});
