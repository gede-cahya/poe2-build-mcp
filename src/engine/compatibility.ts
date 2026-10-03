import type { GemInfo } from "../types.js";

export interface CompatibilityResult {
  compatible: boolean;
  isRecommended: boolean;
  reasons: string[];
}

/**
 * Evaluates a reverse Polish / boolean token expression against a set of types.
 *
 * Example tokens:
 *   ["Attack", "Bow", "AND"] -> requires both Attack and Bow
 *   ["AppliesCurse"]         -> requires AppliesCurse
 *   ["CrossbowSkill", "CrossbowAmmoSkill"] (no operators) -> any matches
 */
export function evalTypeExpression(
  tokens: string[] | undefined,
  skillTypes: Set<string>,
  defaultMode: "any" | "all" = "any"
): boolean {
  if (!tokens || tokens.length === 0) return true;

  const hasOps = tokens.some((t) => t === "AND" || t === "OR" || t === "NOT");
  if (!hasOps) {
    return defaultMode === "any"
      ? tokens.some((t) => skillTypes.has(t))
      : tokens.every((t) => skillTypes.has(t));
  }

  const stack: boolean[] = [];
  for (const token of tokens) {
    if (token === "AND") {
      const b = stack.pop() ?? false;
      const a = stack.pop() ?? false;
      stack.push(a && b);
    } else if (token === "OR") {
      const b = stack.pop() ?? false;
      const a = stack.pop() ?? false;
      stack.push(a || b);
    } else if (token === "NOT") {
      const a = stack.pop() ?? false;
      stack.push(!a);
    } else {
      stack.push(skillTypes.has(token));
    }
  }

  return stack.pop() ?? true;
}

/**
 * Checks if a support gem can support an active/spirit skill.
 */
export function checkSupportCompatibility(
  activeGem: GemInfo,
  supportGem: GemInfo
): CompatibilityResult {
  const reasons: string[] = [];
  const isRecommended = activeGem.recommendedSupports.includes(supportGem.id);

  if (supportGem.type !== "support") {
    return {
      compatible: false,
      isRecommended: false,
      reasons: [`${supportGem.name} is a ${supportGem.type} gem, not a support gem`],
    };
  }

  if (activeGem.type === "support") {
    return {
      compatible: false,
      isRecommended: false,
      reasons: ["Cannot socket support gems into another support gem"],
    };
  }

  const skillTypes = new Set(activeGem.skillTypes);

  // Check allowed types
  if (supportGem.allowedTypes && supportGem.allowedTypes.length > 0) {
    const allowed = evalTypeExpression(supportGem.allowedTypes, skillTypes, "any");
    if (!allowed) {
      reasons.push(
        `Requires skill types matching: [${supportGem.allowedTypes.join(", ")}]. Skill types are: [${activeGem.skillTypes.join(", ")}]`
      );
    }
  }

  // Check excluded types (if excluded condition matches, the support is forbidden)
  if (supportGem.excludedTypes && supportGem.excludedTypes.length > 0) {
    const excluded = evalTypeExpression(supportGem.excludedTypes, skillTypes, "any");
    if (excluded) {
      reasons.push(
        `Skill has excluded types: [${supportGem.excludedTypes.join(", ")}]`
      );
    }
  }

  const compatible = reasons.length === 0;
  return {
    compatible,
    isRecommended,
    reasons,
  };
}

/**
 * Finds all compatible supports for a given active skill.
 */
export function findCompatibleSupports(
  activeGem: GemInfo,
  allSupports: GemInfo[],
  options?: { recommendedOnly?: boolean }
): Array<{ support: GemInfo; isRecommended: boolean }> {
  const results: Array<{ support: GemInfo; isRecommended: boolean }> = [];

  for (const sup of allSupports) {
    if (sup.type !== "support") continue;
    const { compatible, isRecommended } = checkSupportCompatibility(activeGem, sup);
    if (!compatible) continue;
    if (options?.recommendedOnly && !isRecommended) continue;

    results.push({ support: sup, isRecommended });
  }

  // Sort recommended first, then by crafting level / name
  results.sort((a, b) => {
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;
    if (a.support.craftingLevel !== b.support.craftingLevel) {
      return a.support.craftingLevel - b.support.craftingLevel;
    }
    return a.support.name.localeCompare(b.support.name);
  });

  return results;
}
