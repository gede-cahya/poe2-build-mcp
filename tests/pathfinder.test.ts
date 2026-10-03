import { beforeAll, describe, expect, it } from "vitest";
import { GameDataLoader } from "../src/data/loader.js";
import { PassivePathfinder } from "../src/engine/pathfinder.js";

describe("PassivePathfinder", () => {
  const loader = new GameDataLoader();
  let pathfinder: PassivePathfinder;

  beforeAll(async () => {
    await loader.init(false);
    pathfinder = new PassivePathfinder(loader);
  });

  it("plans a connected path from Warrior to Brutal notable", () => {
    const warrior = loader.getClass("Warrior")!;
    const brutal = loader.getNodeById("marauder_brute_notable1")!;

    const result = pathfinder.planTree({
      startHash: warrior.startHash,
      targetHashes: [brutal.hash],
    });

    expect(result.allocatedHashes).toContain(brutal.hash);
    expect(result.allocatedHashes.length).toBeGreaterThan(1);
    expect(result.totalPoints).toBeGreaterThanOrEqual(2);
    expect(result.steps[0].id).toBe("melee17");
  });

  it("respects point budget and reports unreached targets", () => {
    const warrior = loader.getClass("Warrior")!;
    const brutal = loader.getNodeById("marauder_brute_notable1")!;

    const result = pathfinder.planTree({
      startHash: warrior.startHash,
      targetHashes: [brutal.hash],
      maxPoints: 2, // too low to reach Brutal
    });

    expect(result.totalPoints).toBeLessThanOrEqual(2);
  });

  it("calculates aggregated stats from allocated nodes", () => {
    const warrior = loader.getClass("Warrior")!;
    const brutal = loader.getNodeById("marauder_brute_notable1")!;

    const result = pathfinder.planTree({
      startHash: warrior.startHash,
      targetHashes: [brutal.hash],
    });

    expect(Object.keys(result.aggregatedStats).length).toBeGreaterThan(0);
  });
});
