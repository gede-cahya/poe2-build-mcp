import { beforeAll, describe, expect, it } from "vitest";
import { GameDataLoader } from "../src/data/loader.js";
import { BuildValidator } from "../src/engine/validator.js";
import type { BuildFile } from "../types.js";

describe("BuildValidator", () => {
  const loader = new GameDataLoader();
  let validator: BuildValidator;

  beforeAll(async () => {
    await loader.init(false);
    validator = new BuildValidator(loader);
  });

  it("validates official GGG Titan Warrior example build", () => {
    const titanWarrior: BuildFile = {
      name: "Titan Warrior",
      author: "Grinding Gear Games",
      ascendancy: "Warrior1",
      passives: [
        "melee17",
        "melee18",
        "melee25",
        "melee44",
        "melee46",
        "marauder_brute_notable1",
        {
          id: "strength17",
          additional_text: "<m>{<red>{Strength +5 is recommended}}",
        },
      ],
      skills: [
        {
          id: "Metadata/Items/Gems/SkillGemEarthquake",
          support_skills: [
            "Metadata/Items/Gems/SupportGemFastForward",
            "Metadata/Items/Gems/SupportGemAftershock",
          ],
        },
      ],
      inventory_slots: [
        {
          inventory_id: "Weapon1",
          additional_text: "<silver>{Any Two Handed Mace}",
        },
      ],
    };

    const report = validator.validate(titanWarrior);
    expect(report.valid).toBe(true);
    expect(report.errors.length).toBe(0);
    expect(report.summary.className).toBe("Warrior");
    expect(report.summary.ascendancy).toBe("Titan");
    expect(report.summary.totalSkills).toBe(1);
    expect(report.summary.totalSupports).toBe(2);
  });

  it("flags missing name and invalid passive IDs as errors", () => {
    const invalidBuild: BuildFile = {
      name: "",
      passives: ["this_passive_does_not_exist_12345"],
    };

    const report = validator.validate(invalidBuild);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("name"))).toBe(true);
    expect(report.errors.some((e) => e.includes("this_passive_does_not_exist_12345"))).toBe(true);
  });

  it("flags invalid support placement", () => {
    const badSkillBuild: BuildFile = {
      name: "Test Build",
      skills: [
        {
          id: "Metadata/Items/Gems/SupportGemFastForward", // Placing a support gem at root
        },
      ],
    };

    const report = validator.validate(badSkillBuild);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("support gem and cannot be placed at top-level"))).toBe(true);
  });
});
