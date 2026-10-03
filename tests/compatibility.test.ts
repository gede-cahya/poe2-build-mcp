import { beforeAll, describe, expect, it } from "vitest";
import { GameDataLoader } from "../src/data/loader.js";
import {
  checkSupportCompatibility,
  findCompatibleSupports,
} from "../src/engine/compatibility.js";

describe("Support Gem Compatibility", () => {
  const loader = new GameDataLoader();

  beforeAll(async () => {
    await loader.init(false);
  });

  it("identifies compatible and recommended supports for Earthquake", () => {
    const eq = loader.getGem("Earthquake");
    expect(eq).toBeDefined();

    const fistOfWar = loader.getGem("Fist of War I");
    expect(fistOfWar).toBeDefined();

    const result = checkSupportCompatibility(eq!, fistOfWar!);
    expect(result.compatible).toBe(true);
    expect(result.isRecommended).toBe(true);

    const compDuration = loader.getGem("Compressed Duration I");
    expect(compDuration).toBeDefined();
    const result2 = checkSupportCompatibility(eq!, compDuration!);
    expect(result2.compatible).toBe(true);
  });

  it("finds all compatible supports for a skill with recommendations prioritized", () => {
    const eq = loader.getGem("Earthquake")!;
    const allSupports = loader.searchGems({
      type: "support",
      obtainableOnly: true,
      limit: 1000,
    });

    const matches = findCompatibleSupports(eq, allSupports);
    expect(matches.length).toBeGreaterThan(20);

    // The first elements must be recommended supports
    expect(matches[0].isRecommended).toBe(true);
  });
});
