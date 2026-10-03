import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ClassInfo,
  GameData,
  GemInfo,
  PassiveNode,
  UniqueInfo,
} from "../types.js";
import { GAMEDATA_SCHEMA_VERSION } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = path.resolve(__dirname, "../../cache");
export const GAMEDATA_PATH = path.join(CACHE_DIR, "gamedata.json");
export const RAW_DIR = path.join(CACHE_DIR, "raw");

const TREE_URL =
  "https://raw.githubusercontent.com/grindinggear/poe2-skilltree-export/main/data.json";
const REPOE_BASE = "https://repoe-fork.github.io/poe2/";
const REPOE_FILES = [
  "skill_gems.min.json",
  "skills.min.json",
  "base_items.min.json",
  "uniques.min.json",
  "gem_tags.min.json",
  "ascendancies.min.json",
  "characters.min.json",
];

const CLASS_START_HASHES: Record<number, number> = {
  0: 47175, // Marauder
  6: 47175, // Warrior
  1: 54447, // Witch
  7: 54447, // Sorceress
  2: 50459, // Ranger
  8: 50459, // Huntress
  3: 50986, // Duelist
  9: 50986, // Mercenary
  4: 44683, // Shadow
  10: 44683, // Monk
  5: 61525, // Templar
  11: 61525, // Druid
};

async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
}

/**
 * Downloads raw data from upstream sources if missing or forced,
 * then parses and generates `cache/gamedata.json`.
 */
export async function refreshGameData(forceDownload = false): Promise<GameData> {
  fs.mkdirSync(RAW_DIR, { recursive: true });

  const treeRawPath = path.join(RAW_DIR, "tree.json");
  if (forceDownload || !fs.existsSync(treeRawPath)) {
    console.error("[poe2-mcp] Downloading official PoE2 skill tree data...");
    await downloadFile(TREE_URL, treeRawPath);
  }

  for (const filename of REPOE_FILES) {
    const filePath = path.join(RAW_DIR, filename);
    if (forceDownload || !fs.existsSync(filePath)) {
      console.error(`[poe2-mcp] Downloading RePoE file: ${filename}...`);
      await downloadFile(`${REPOE_BASE}${filename}`, filePath);
    }
  }

  console.error("[poe2-mcp] Parsing and compiling game data...");
  const rawTree = JSON.parse(fs.readFileSync(treeRawPath, "utf-8"));
  const rawSkillGems = JSON.parse(
    fs.readFileSync(path.join(RAW_DIR, "skill_gems.min.json"), "utf-8")
  );
  const rawSkills = JSON.parse(
    fs.readFileSync(path.join(RAW_DIR, "skills.min.json"), "utf-8")
  );
  const rawUniques = JSON.parse(
    fs.readFileSync(path.join(RAW_DIR, "uniques.min.json"), "utf-8")
  );
  const rawGemTags = JSON.parse(
    fs.readFileSync(path.join(RAW_DIR, "gem_tags.min.json"), "utf-8")
  );

  return compileGameData({
    rawTree,
    rawSkillGems,
    rawSkills,
    rawUniques,
    rawGemTags,
  });
}

export function compileGameData(inputs: {
  rawTree: any;
  rawSkillGems: any;
  rawSkills: any;
  rawUniques: any;
  rawGemTags: any;
}): GameData {
  const { rawTree, rawSkillGems, rawSkills, rawUniques, rawGemTags } = inputs;

  // 1. Process classes
  const classes: ClassInfo[] = (rawTree.classes || []).map((c: any, idx: number) => {
    const startHash = CLASS_START_HASHES[idx] ?? 0;
    const ascendancies = (c.ascendancies || [])
      .filter((a: any) => a && a.id)
      .map((a: any) => {
        const startNode = Object.values(rawTree.nodes as Record<string, any>).find(
          (n: any) => n.ascendancyId === a.id && n.isAscendancyStart
        );
        return {
          id: a.id,
          name: a.name || a.id,
          startHash: startNode ? Number(startNode.skill) : undefined,
        };
      });

    return {
      index: idx,
      name: c.name,
      startHash,
      ascendancies,
      released: ascendancies.length > 0,
      baseAttributes: {
        str: c.base_str || 0,
        dex: c.base_dex || 0,
        int: c.base_int || 0,
      },
    };
  });

  // 2. Build undirected neighbor adjacency map
  const adj = new Map<number, Set<number>>();
  for (const [k, n] of Object.entries(rawTree.nodes as Record<string, any>)) {
    const u = Number.parseInt(k, 10);
    if (Number.isNaN(u)) continue;
    if (!adj.has(u)) adj.set(u, new Set());
    const connected = [...(n.out || []), ...(n.in || [])];
    for (const vStr of connected) {
      const v = Number.parseInt(vStr, 10);
      if (Number.isNaN(v)) continue;
      const target = rawTree.nodes[vStr];
      if (target && target.id !== null) {
        adj.get(u)!.add(v);
      }
    }
  }

  // 3. Process passive nodes
  const nodes: Record<string, PassiveNode> = {};
  for (const [k, n] of Object.entries(rawTree.nodes as Record<string, any>)) {
    if (n.id === null) continue; // skip unreleased / dummy nodes
    const hash = Number.parseInt(k, 10);
    if (Number.isNaN(hash)) continue;

    let kind: PassiveNode["kind"] = "normal";
    if (n.classStartIndex !== undefined) kind = "classStart";
    else if (n.isAscendancyStart) kind = "ascendancyStart";
    else if (n.isKeystone) kind = "keystone";
    else if (n.isNotable) kind = "notable";
    else if (n.isMastery) kind = "mastery";
    else if (n.isJewelSocket) kind = "jewel";
    else if (n.isGenericAttribute) kind = "attribute";

    const neighbors = Array.from(adj.get(hash) || []);
    nodes[String(hash)] = {
      hash,
      id: n.id,
      name: n.name || "",
      stats: n.stats || [],
      kind,
      ascendancyId: n.ascendancyId,
      neighbors,
      classStartIndex: n.classStartIndex,
      unlockConstraint: n.unlockConstraint,
      grantedPassivePoints: n.grantedPassivePoints,
      isFree: Boolean(n.isFree),
      isMultipleChoice: Boolean(n.isMultipleChoice),
      isMultipleChoiceOption: Boolean(n.isMultipleChoiceOption),
      grantedSkill: n.grantedSkill?.name,
      isolated: Boolean(n.isBlighted) || neighbors.length === 0,
      x: Math.round(n.x || 0),
      y: Math.round(n.y || 0),
    };
  }

  // 4. Process skill & support gems
  const gems: Record<string, GemInfo> = {};
  for (const [key, g] of Object.entries(rawSkillGems as Record<string, any>)) {
    const id = g.base_item?.id || key;
    const name = g.base_item?.display_name || id;
    const primarySkillKey = g.grants_skills?.[0];
    const primarySkill = primarySkillKey ? rawSkills[primarySkillKey] : null;
    const activeSkill = primarySkill?.active_skill;
    const supportGem = primarySkill?.support_gem;

    const skillTypes: string[] = activeSkill?.types || [];
    const minionTypes: string[] = activeSkill?.minion_types || [];
    const weaponRestrictions: string[] = activeSkill?.weapon_restrictions || [];
    const isMeta =
      skillTypes.includes("Meta") ||
      (g.gem_type === "spirit" && name.toLowerCase().includes("meta"));

    gems[id] = {
      id,
      name,
      type: g.gem_type as GemInfo["type"],
      color: g.color || "w",
      tags: g.tags || [],
      requirementWeights: {
        str: g.requirement_weights?.strength || 0,
        dex: g.requirement_weights?.dexterity || 0,
        int: g.requirement_weights?.intelligence || 0,
      },
      craftingLevel: g.crafting_level ?? 0,
      craftingTypes: g.crafting_types || [],
      obtainable: g.crafting_level !== 0 && !name.startsWith("[DNT"),
      isMeta,
      isLineage: Boolean(g.is_lineage),
      description: activeSkill?.description || g.support_text || "",
      supportText: g.support_text,
      skillTypes,
      minionTypes,
      weaponRestrictions,
      recommendedSupports: g.recommended_supports || [],
      allowedTypes: supportGem?.allowed_types,
      excludedTypes: supportGem?.excluded_types,
      addedTypes: supportGem?.added_types,
    };
  }

  // 5. Process unique items
  const uniqueList: UniqueInfo[] = Object.values(rawUniques as Record<string, any>).map(
    (u: any) => ({
      name: u.name,
      itemClass: u.item_class,
    })
  );

  const gamedata: GameData = {
    schemaVersion: GAMEDATA_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sources: {
      tree: "grindinggear/poe2-skilltree-export",
      repoe: "repoe-fork/repoe",
    },
    classes,
    nodes,
    gems,
    uniques: uniqueList,
    gemTags: rawGemTags,
  };

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(GAMEDATA_PATH, JSON.stringify(gamedata));
  return gamedata;
}
