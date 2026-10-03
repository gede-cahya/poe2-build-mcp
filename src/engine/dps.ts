/**
 * PoE2 DPS Calculation Engine
 *
 * Implements deterministic calculation for attack and spell damage,
 * taking into account base damage, flat added damage, increased/more modifiers,
 * attack/cast speed, critical strike chance & multiplier, and enemy mitigation.
 */

export interface DamageRange {
  min: number;
  max: number;
}

export interface DamageBreakdown {
  physical?: DamageRange;
  fire?: DamageRange;
  cold?: DamageRange;
  lightning?: DamageRange;
  chaos?: DamageRange;
}

export interface DpsCalculationInput {
  skillName: string;
  isSpell?: boolean;
  baseDamage?: DamageBreakdown;
  /** Flat added damage from gear, gems, or buffs */
  addedDamage?: DamageBreakdown;
  /** Base weapon attack speed (attacks per second) or spell cast time (seconds) */
  baseSpeed: number;
  /** Total sum of % increased / decreased attack speed or cast speed */
  increasedSpeedPercent?: number;
  /** Product of more attack/cast speed multipliers (e.g. 1.20 for 20% more) */
  moreSpeedMultiplier?: number;
  /** Total sum of % increased / decreased damage (e.g. 150 for 150% inc damage) */
  increasedDamagePercent?: number;
  /** Array of more damage multipliers from supports/passives (e.g. [1.35, 1.40, 1.25]) */
  moreDamageMultipliers?: number[];
  /** Base critical strike chance percentage (e.g. 5.0 for 5%) */
  baseCritChance?: number;
  /** Total sum of % increased critical strike chance */
  increasedCritChancePercent?: number;
  /** Critical strike multiplier percentage (base is 150 for 150% in PoE2) */
  critMultiplierPercent?: number;
  /** Average base Damage Over Time DPS (e.g. Bleed, Ignite, Poison) */
  dotBaseDps?: number;
  /** Total enemy elemental / chaos resistance percentage (0 by default) */
  enemyResistancePercent?: number;
}

export interface DpsCalculationResult {
  skillName: string;
  baseHitRange: { min: number; max: number; average: number };
  effectiveHitDamage: { min: number; max: number; average: number };
  actionsPerSecond: number;
  effectiveCritChance: number;
  effectiveCritMultiplier: number;
  averageHitWithCrits: number;
  hitDps: number;
  dotDps: number;
  totalDps: number;
  multipliers: {
    increasedMultiplier: number;
    moreMultiplier: number;
    combinedDamageMultiplier: number;
  };
  summaryMarkdown: string;
}

export function calculateDps(input: DpsCalculationInput): DpsCalculationResult {
  const types: (keyof DamageBreakdown)[] = [
    "physical",
    "fire",
    "cold",
    "lightning",
    "chaos",
  ];

  let minBaseTotal = 0;
  let maxBaseTotal = 0;

  for (const t of types) {
    const base = input.baseDamage?.[t] || { min: 0, max: 0 };
    const added = input.addedDamage?.[t] || { min: 0, max: 0 };
    minBaseTotal += base.min + added.min;
    maxBaseTotal += base.max + added.max;
  }

  // If no damage breakdown was provided, fallback to standard default
  if (minBaseTotal === 0 && maxBaseTotal === 0) {
    minBaseTotal = 100;
    maxBaseTotal = 150;
  }

  const avgBase = (minBaseTotal + maxBaseTotal) / 2;

  // Multipliers
  const incPercent = input.increasedDamagePercent ?? 0;
  const incMult = 1 + incPercent / 100;

  const moreList = input.moreDamageMultipliers ?? [];
  const moreMult = moreList.reduce((acc, val) => acc * val, 1);

  const combinedDamageMult = incMult * moreMult;

  // Resistance reduction (e.g. 20% res = 0.8x damage)
  const enemyRes = input.enemyResistancePercent ?? 0;
  const resFactor = Math.max(0, 1 - enemyRes / 100);

  const effectiveMinHit = minBaseTotal * combinedDamageMult * resFactor;
  const effectiveMaxHit = maxBaseTotal * combinedDamageMult * resFactor;
  const effectiveAvgHit = avgBase * combinedDamageMult * resFactor;

  // Speed calculation
  let actionsPerSecond: number;
  if (input.isSpell) {
    // baseSpeed is cast time in seconds
    const castTime = input.baseSpeed > 0 ? input.baseSpeed : 0.8;
    const speedInc = 1 + (input.increasedSpeedPercent ?? 0) / 100;
    const speedMore = input.moreSpeedMultiplier ?? 1;
    const effectiveCastTime = castTime / (speedInc * speedMore);
    actionsPerSecond = 1 / effectiveCastTime;
  } else {
    // baseSpeed is attacks per second
    const attackSpeed = input.baseSpeed > 0 ? input.baseSpeed : 1.2;
    const speedInc = 1 + (input.increasedSpeedPercent ?? 0) / 100;
    const speedMore = input.moreSpeedMultiplier ?? 1;
    actionsPerSecond = attackSpeed * speedInc * speedMore;
  }

  // Critical strike calculation
  const baseCrit = input.baseCritChance ?? 5.0;
  const incCrit = 1 + (input.increasedCritChancePercent ?? 0) / 100;
  const effectiveCritChance = Math.min(100, Math.max(0, baseCrit * incCrit));
  const effectiveCritMultiplier = (input.critMultiplierPercent ?? 150) / 100;

  // Average hit taking crits into account
  const critWeight = effectiveCritChance / 100;
  const avgHitWithCrits =
    effectiveAvgHit * (1 - critWeight) +
    effectiveAvgHit * effectiveCritMultiplier * critWeight;

  const hitDps = avgHitWithCrits * actionsPerSecond;

  // DoT DPS
  const baseDot = input.dotBaseDps ?? 0;
  const dotDps = baseDot * combinedDamageMult * resFactor;

  const totalDps = hitDps + dotDps;

  const summaryMarkdown = [
    `### ⚔️ DPS Breakdown: **${input.skillName}**`,
    `- **Total DPS:** **${Math.round(totalDps).toLocaleString()}** (Hit: ${Math.round(hitDps).toLocaleString()} | DoT: ${Math.round(dotDps).toLocaleString()})`,
    `- **Hit Damage:** ${Math.round(effectiveMinHit).toLocaleString()} - ${Math.round(effectiveMaxHit).toLocaleString()} (Avg: ${Math.round(effectiveAvgHit).toLocaleString()})`,
    `- **Avg Hit with Crits:** **${Math.round(avgHitWithCrits).toLocaleString()}**`,
    `- **Attack/Cast Rate:** ${actionsPerSecond.toFixed(2)} / sec`,
    `- **Crit Chance / Multiplier:** ${effectiveCritChance.toFixed(1)}% / ${(effectiveCritMultiplier * 100).toFixed(0)}%`,
    `- **Damage Scaling:** +${incPercent}% Increased, x${moreMult.toFixed(2)} More (${moreList.length} supports)`,
  ].join("\n");

  return {
    skillName: input.skillName,
    baseHitRange: {
      min: minBaseTotal,
      max: maxBaseTotal,
      average: avgBase,
    },
    effectiveHitDamage: {
      min: Math.round(effectiveMinHit),
      max: Math.round(effectiveMaxHit),
      average: Math.round(effectiveAvgHit),
    },
    actionsPerSecond: Number(actionsPerSecond.toFixed(2)),
    effectiveCritChance: Number(effectiveCritChance.toFixed(2)),
    effectiveCritMultiplier: Number(effectiveCritMultiplier.toFixed(2)),
    averageHitWithCrits: Math.round(avgHitWithCrits),
    hitDps: Math.round(hitDps),
    dotDps: Math.round(dotDps),
    totalDps: Math.round(totalDps),
    multipliers: {
      increasedMultiplier: Number(incMult.toFixed(2)),
      moreMultiplier: Number(moreMult.toFixed(2)),
      combinedDamageMultiplier: Number(combinedDamageMult.toFixed(2)),
    },
    summaryMarkdown,
  };
}
