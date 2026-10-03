/**
 * Core domain types for the PoE2 build MCP server.
 *
 * `GameData` is the processed, compact representation produced from the raw
 * upstream sources (GGG passive tree export + RePoE PoE2 data). It is cached on
 * disk as `gamedata.json` so the server starts fast.
 */

export const GAMEDATA_SCHEMA_VERSION = 1;

export type NodeKind =
  | "classStart"
  | "ascendancyStart"
  | "normal"
  | "attribute"
  | "notable"
  | "keystone"
  | "jewel"
  | "mastery";

export interface PassiveNode {
  /** Numeric skill hash used by the tree export (graph key). */
  hash: number;
  /** PassiveSkills table id, used by the in-game `.build` format. */
  id: string;
  name: string;
  stats: string[];
  kind: NodeKind;
  /** Set when the node belongs to an ascendancy sub-tree. */
  ascendancyId?: string;
  /** Undirected neighbours (hashes) — already filtered to valid nodes. */
  neighbors: number[];
  /** Base class indices that start on this node (class start nodes only). */
  classStartIndex?: number[];
  /** Node may only be allocated with this ascendancy / these nodes allocated. */
  unlockConstraint?: { nodes: number[]; ascendancy?: string };
  /** Extra passive points granted when allocated (some ascendancy nodes). */
  grantedPassivePoints?: number;
  /** Allocating this node is free (no point cost). */
  isFree?: boolean;
  isMultipleChoice?: boolean;
  isMultipleChoiceOption?: boolean;
  /** Name of the skill granted by this node, if any. */
  grantedSkill?: string;
  /** Anoint-only / disconnected nodes (cannot be reached by allocation). */
  isolated?: boolean;
  x: number;
  y: number;
}

export interface AscendancyInfo {
  id: string;
  name: string;
  /** Hash of the ascendancy start node (free). */
  startHash?: number;
}

export interface ClassInfo {
  index: number;
  name: string;
  /** Hash of the main-tree start node for this class. */
  startHash: number;
  ascendancies: AscendancyInfo[];
  /** False for classes not yet playable (no released ascendancies). */
  released: boolean;
  baseAttributes: { str: number; dex: number; int: number };
}

export type GemType = "active" | "spirit" | "support";

export interface GemInfo {
  /** BaseItemTypes id, e.g. `Metadata/Items/Gems/SkillGemEarthquake`. */
  id: string;
  name: string;
  type: GemType;
  color: string;
  tags: string[];
  requirementWeights: { str: number; dex: number; int: number };
  craftingLevel: number;
  craftingTypes: string[];
  /** Obtainable from Uncut gems (eligible for the `.build` format). */
  obtainable: boolean;
  /** Meta gems are not supported by the `.build` format (v1). */
  isMeta: boolean;
  isLineage: boolean;
  description: string;
  supportText?: string;
  /** Skill types of the primary granted skill (for support compatibility). */
  skillTypes: string[];
  minionTypes: string[];
  weaponRestrictions: string[];
  recommendedSupports: string[];
  /** Support-only: postfix type expressions (PoB semantics). */
  allowedTypes?: string[];
  excludedTypes?: string[];
  addedTypes?: string[];
}

export interface UniqueInfo {
  name: string;
  itemClass: string;
}

export interface GameData {
  schemaVersion: number;
  generatedAt: string;
  sources: {
    tree: string;
    repoe: string;
    repoeVersion?: string;
  };
  classes: ClassInfo[];
  nodes: Record<string, PassiveNode>;
  gems: Record<string, GemInfo>;
  uniques: UniqueInfo[];
  gemTags: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/* Build Planner `.build` format (Version 1, Experimental) — GGG docs  */
/* https://www.pathofexile.com/developer/docs/game#buildplanner        */
/* ------------------------------------------------------------------ */

export type LevelInterval = number | [number, number];

export interface BuildPassive {
  id: string;
  level_interval?: LevelInterval;
  weapon_set?: number;
  additional_text?: string;
}

export interface BuildSupport {
  id: string;
  level_interval?: LevelInterval;
  additional_text?: string;
}

export interface BuildSkill {
  id: string;
  level_interval?: LevelInterval;
  additional_text?: string;
  support_skills?: (string | BuildSupport)[];
}

export interface BuildInventorySlot {
  inventory_id: string;
  slot_x?: number;
  slot_y?: number;
  level_interval?: LevelInterval;
  unique_name?: string;
  additional_text?: string;
}

export interface BuildFile {
  name: string;
  author?: string;
  link?: string;
  description?: string;
  ascendancy?: string;
  passives?: (string | BuildPassive)[];
  skills?: (string | BuildSkill)[];
  inventory_slots?: BuildInventorySlot[];
}

/** Known `Inventories` ids usable in `inventory_slots`. */
export const INVENTORY_SLOTS: Record<string, string[]> = {
  Weapon1: ["weapon"],
  Offhand1: ["weapon", "offhand"],
  Weapon2: ["weapon"],
  Offhand2: ["weapon", "offhand"],
  Helm1: ["Helmet"],
  BodyArmour1: ["Body Armour"],
  Gloves1: ["Gloves"],
  Boots1: ["Boots"],
  Belt1: ["Belt"],
  Amulet1: ["Amulet"],
  Ring1: ["Ring"],
  Ring2: ["Ring"],
  Flask1: ["LifeFlask", "ManaFlask", "Flask"],
  Flask2: ["LifeFlask", "ManaFlask", "Flask"],
};
