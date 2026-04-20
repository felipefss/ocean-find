import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  drizzleCalls: 0,
  neonCalls: [] as string[],
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn((url: string) => {
    state.neonCalls.push(url);
    return { url };
  }),
}));

vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: vi.fn(() => {
    state.drizzleCalls += 1;
    return { tag: "db-instance" };
  }),
}));

describe("getDb", () => {
  beforeEach(() => {
    vi.resetModules();
    state.drizzleCalls = 0;
    state.neonCalls = [];
    process.env.DATABASE_URL = "";
  });

  it("does not throw when importing the module without DATABASE_URL", async () => {
    await expect(import("./client")).resolves.toBeDefined();
  });

  it("throws when getDb is called without DATABASE_URL", async () => {
    const { getDb } = await import("./client");

    expect(() => getDb()).toThrow("DATABASE_URL environment variable is not set");
  });

  it("creates and caches the db instance on first access", async () => {
    process.env.DATABASE_URL = "postgres://example";
    const { getDb } = await import("./client");

    const first = getDb();
    const second = getDb();

    expect(first).toBe(second);
    expect(state.neonCalls).toEqual(["postgres://example"]);
    expect(state.drizzleCalls).toBe(1);
  });
});
