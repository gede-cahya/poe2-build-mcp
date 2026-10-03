import { beforeAll, describe, expect, it } from "vitest";
import { GameDataLoader } from "../src/data/loader.js";

describe("GameDataLoader", () => {
  const loader = new GameDataLoader();

  beforeAll(async () => {
    await loader.init(false);
  });

  it("loads 12 base classes", () => {
    const classes = loader.listClasses();
    expect(classes.length).toBe(12);

    const warrior = loader.getClass("Warrior");
    expect(warrior).toBeDefined();
    expect(warrior?.name).toBe("Warrior");
    expect(warrior?.startHash).toBe(47175);
    expect(warrior?.ascendancies.length).toBeGreaterThanOrEqual(3);

    const monk = loader.getClass("Monk");
    expect(monk).toBeDefined();
    expect(monk?.ascendancies.some((a) => a.name === "Invoker")).toBe(true);
  });

  it("finds passives by id, hash, and search", () => {
    const melee17 = loader.getNodeById("melee17");
    expect(melee17).toBeDefined();
    expect(melee17?.name).toBe("Melee Damage");
    expect(melee17?.stats.length).toBeGreaterThan(0);

    const byHash = loader.getNodeByHash(melee17!.hash);
    expect(byHash?.id).toBe("melee17");

    const searchResults = loader.searchNodes({
      query: "lightning damage",
      limit: 10,
    });
    expect(searchResults.length).toBeGreaterThan(0);
    expect(
      searchResults.some((n) =>
        n.stats.some((s) => s.toLowerCase().includes("lightning"))
      )
    ).toBe(true);
  });

  it("indexes and retrieves gems", () => {
    const eq = loader.getGem("Earthquake");
    expect(eq).toBeDefined();
    expect(eq?.type).toBe("active");
    expect(eq?.id).toBe("Metadata/Items/Gems/SkillGemEarthquake");
    expect(eq?.tags).toContain("melee");

    const support = loader.getGem("Compressed Duration I");
    expect(support).toBeDefined();
    expect(support?.type).toBe("support");

    const searchResults = loader.searchGems({
      query: "slam",
      type: "active",
      limit: 10,
    });
    expect(searchResults.length).toBeGreaterThan(0);
  });

  it("searches unique items", () => {
    const uniques = loader.searchUniques({
      itemClass: "Body Armour",
      limit: 5,
    });
    expect(uniques.length).toBeGreaterThan(0);
    expect(uniques[0].itemClass).toBe("Body Armour");
  });
});
