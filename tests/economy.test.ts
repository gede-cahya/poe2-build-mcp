import { describe, expect, test } from "vitest";
import { fetchLeagues } from "../src/engine/economy.js";

describe("Economy Engine", () => {
  test("fetches active leagues or returns fallback with divine ratio", async () => {
    const leagues = await fetchLeagues();
    expect(leagues.length).toBeGreaterThan(0);
    const standard = leagues.find((l) => l.name === "Standard");
    expect(standard).toBeDefined();
    expect(standard?.divineInExalts).toBeGreaterThan(0);
  });
});
