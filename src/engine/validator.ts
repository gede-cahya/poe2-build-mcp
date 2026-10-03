import type { GameDataLoader } from "../data/loader.js";
import {
  type BuildFile,
  type BuildPassive,
  type BuildSkill,
  type BuildSupport,
  INVENTORY_SLOTS,
  type PassiveNode,
} from "../types.js";
import { checkSupportCompatibility } from "./compatibility.js";

export interface ValidationIssue {
  type: "error" | "warning";
  field: string;
  message: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    name: string;
    ascendancy?: string;
    className?: string;
    totalPassives: number;
    ascendancyPassives: number;
    pointsSpent: number;
    totalSkills: number;
    totalSupports: number;
    inventorySlots: number;
    connected: boolean;
  };
}

export class BuildValidator {
  constructor(private loader: GameDataLoader) {}

  public validate(build: BuildFile): ValidationReport {
    const issues: ValidationIssue[] = [];

    // 1. Basic properties
    if (!build.name || typeof build.name !== "string" || build.name.trim().length === 0) {
      issues.push({
        type: "error",
        field: "name",
        message: "Build name is required and cannot be empty.",
      });
    }

    // 2. Ascendancy check
    let matchedClass: any = null;
    let ascendancyInfo: any = null;

    if (build.ascendancy) {
      const match = this.loader.getAscendancy(build.ascendancy);
      if (!match) {
        issues.push({
          type: "error",
          field: "ascendancy",
          message: `Unknown ascendancy '${build.ascendancy}'. Check poe2_list_classes for valid ascendancy IDs.`,
        });
      } else {
        ascendancyInfo = match.ascendancy;
        matchedClass = match.classInfo;
      }
    }

    // 3. Passives validation
    const passives = build.passives || [];
    const passiveNodes: PassiveNode[] = [];
    const passiveHashes = new Set<number>();
    let ascendancyPassiveCount = 0;
    let pointsSpent = 0;

    for (let i = 0; i < passives.length; i++) {
      const p = passives[i];
      const id = typeof p === "string" ? p : p?.id;

      if (!id || typeof id !== "string") {
        issues.push({
          type: "error",
          field: `passives[${i}]`,
          message: `Passive at index ${i} is missing a valid 'id'.`,
        });
        continue;
      }

      const node = this.loader.getNodeById(id);
      if (!node) {
        issues.push({
          type: "error",
          field: `passives[${i}]`,
          message: `Unknown passive ID '${id}'.`,
        });
        continue;
      }

      passiveNodes.push(node);
      passiveHashes.add(node.hash);

      if (!node.isFree) {
        pointsSpent += 1;
      }

      if (node.ascendancyId) {
        ascendancyPassiveCount += 1;
        if (ascendancyInfo && node.ascendancyId !== ascendancyInfo.id) {
          issues.push({
            type: "error",
            field: `passives[${i}]`,
            message: `Passive '${node.name}' (${id}) belongs to ascendancy '${node.ascendancyId}', but build uses '${ascendancyInfo.id}'.`,
          });
        }
      }
    }

    // 4. Connectivity check
    let isConnected = true;
    if (passiveNodes.length > 0 && matchedClass) {
      const reachable = new Set<number>();
      const queue: number[] = [matchedClass.startHash];
      if (ascendancyInfo?.startHash) {
        queue.push(ascendancyInfo.startHash);
      }

      for (const q of queue) reachable.add(q);

      let head = 0;
      while (head < queue.length) {
        const curr = queue[head++];
        const currNode = this.loader.getNodeByHash(curr);
        if (!currNode) continue;

        for (const next of currNode.neighbors) {
          if (passiveHashes.has(next) && !reachable.has(next)) {
            reachable.add(next);
            queue.push(next);
          }
        }
      }

      const disconnected = passiveNodes.filter(
        (n) => !reachable.has(n.hash) && !n.isolated
      );

      if (disconnected.length > 0) {
        isConnected = false;
        issues.push({
          type: "warning",
          field: "passives",
          message: `${disconnected.length} passive node(s) are not connected to class start (${matchedClass.name}) or ascendancy start: ${disconnected
            .slice(0, 5)
            .map((n) => `${n.name} (${n.id})`)
            .join(", ")}${disconnected.length > 5 ? "..." : ""}`,
        });
      }
    }

    // 5. Skills validation
    const skills = build.skills || [];
    let totalSupports = 0;

    for (let i = 0; i < skills.length; i++) {
      const s = skills[i];
      const skillId = typeof s === "string" ? s : s?.id;

      if (!skillId || typeof skillId !== "string") {
        issues.push({
          type: "error",
          field: `skills[${i}]`,
          message: `Skill at index ${i} is missing a valid 'id'.`,
        });
        continue;
      }

      const gem = this.loader.getGem(skillId);
      if (!gem) {
        issues.push({
          type: "error",
          field: `skills[${i}]`,
          message: `Unknown skill gem ID '${skillId}'.`,
        });
        continue;
      }

      if (gem.type === "support") {
        issues.push({
          type: "error",
          field: `skills[${i}]`,
          message: `'${gem.name}' (${skillId}) is a support gem and cannot be placed at top-level skills list.`,
        });
      }

      if (gem.isMeta) {
        issues.push({
          type: "warning",
          field: `skills[${i}]`,
          message: `'${gem.name}' is a meta gem. PoE2 .build v1 documentation explicitly states: 'Meta gems are currently not supported.'`,
        });
      }

      // Check supports
      const supports = typeof s === "object" && s !== null ? s.support_skills || [] : [];
      totalSupports += supports.length;

      for (let j = 0; j < supports.length; j++) {
        const sup = supports[j];
        const supId = typeof sup === "string" ? sup : sup?.id;

        if (!supId || typeof supId !== "string") {
          issues.push({
            type: "error",
            field: `skills[${i}].support_skills[${j}]`,
            message: `Support at index ${j} for skill '${gem.name}' is missing an 'id'.`,
          });
          continue;
        }

        const supGem = this.loader.getGem(supId);
        if (!supGem) {
          issues.push({
            type: "error",
            field: `skills[${i}].support_skills[${j}]`,
            message: `Unknown support gem ID '${supId}'.`,
          });
          continue;
        }

        if (supGem.type !== "support") {
          issues.push({
            type: "error",
            field: `skills[${i}].support_skills[${j}]`,
            message: `'${supGem.name}' is a ${supGem.type} gem, not a support gem.`,
          });
          continue;
        }

        const { compatible, reasons } = checkSupportCompatibility(gem, supGem);
        if (!compatible) {
          issues.push({
            type: "warning",
            field: `skills[${i}].support_skills[${j}]`,
            message: `Support '${supGem.name}' may not be compatible with '${gem.name}': ${reasons.join("; ")}`,
          });
        }
      }
    }

    // 6. Inventory slots validation
    const inventorySlots = build.inventory_slots || [];
    for (let i = 0; i < inventorySlots.length; i++) {
      const slot = inventorySlots[i];
      if (!slot.inventory_id) {
        issues.push({
          type: "error",
          field: `inventory_slots[${i}]`,
          message: "Inventory slot requires 'inventory_id'.",
        });
        continue;
      }

      if (!INVENTORY_SLOTS[slot.inventory_id]) {
        issues.push({
          type: "warning",
          field: `inventory_slots[${i}]`,
          message: `Unrecognized inventory_id '${slot.inventory_id}'. Common slots: ${Object.keys(INVENTORY_SLOTS).join(", ")}.`,
        });
      }

      if (slot.unique_name) {
        const matches = this.loader.searchUniques({ query: slot.unique_name, limit: 1 });
        if (matches.length === 0) {
          issues.push({
            type: "warning",
            field: `inventory_slots[${i}].unique_name`,
            message: `Unique item '${slot.unique_name}' not found in unique items database.`,
          });
        }
      }
    }

    const errors = issues.filter((i) => i.type === "error").map((i) => `[${i.field}] ${i.message}`);
    const warnings = issues.filter((i) => i.type === "warning").map((i) => `[${i.field}] ${i.message}`);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      summary: {
        name: build.name || "Untitled",
        ascendancy: ascendancyInfo?.name || build.ascendancy,
        className: matchedClass?.name,
        totalPassives: passiveNodes.length,
        ascendancyPassives: ascendancyPassiveCount,
        pointsSpent,
        totalSkills: skills.length,
        totalSupports,
        inventorySlots: inventorySlots.length,
        connected: isConnected,
      },
    };
  }
}
