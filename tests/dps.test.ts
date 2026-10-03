import { describe, expect, test } from "vitest";
import { calculateDps } from "../src/engine/dps.js";

describe("DPS Engine", () => {
  test("calculates deterministic attack DPS with increased and more multipliers", () => {
    const result = calculateDps({
      skillName: "Earthquake",
      isSpell: false,
      baseDamage: {
        physical: { min: 100, max: 200 },
      },
      baseSpeed: 1.5,
      increasedDamagePercent: 100, // 2x
      moreDamageMultipliers: [1.3, 1.4], // 1.82x
      baseCritChance: 5.0,
      critMultiplierPercent: 150,
    });

    expect(result.skillName).toBe("Earthquake");
    expect(result.baseHitRange.average).toBe(150);
    // 150 * 2.0 * 1.82 = 546 average hit before crit
    expect(result.effectiveHitDamage.average).toBe(546);
    expect(result.actionsPerSecond).toBe(1.5);
    expect(result.totalDps).toBeGreaterThan(800);
    expect(result.summaryMarkdown).toContain("DPS Breakdown: **Earthquake**");
  });

  test("calculates spell DPS with cast time and added cold damage", () => {
    const result = calculateDps({
      skillName: "Ice Nova",
      isSpell: true,
      baseDamage: {
        cold: { min: 80, max: 120 },
      },
      addedDamage: {
        cold: { min: 20, max: 30 },
      },
      baseSpeed: 0.75, // 0.75s cast time
      increasedDamagePercent: 50,
    });

    expect(result.skillName).toBe("Ice Nova");
    // (80+120)/2 + (20+30)/2 = 100 + 25 = 125
    expect(result.baseHitRange.average).toBe(125);
    expect(result.actionsPerSecond).toBeCloseTo(1 / 0.75, 1);
    expect(result.totalDps).toBeGreaterThan(0);
  });
});
