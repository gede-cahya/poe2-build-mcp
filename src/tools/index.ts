import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { refreshGameData } from "../data/fetcher.js";
import { type GameDataLoader, globalLoader } from "../data/loader.js";
import { findCompatibleSupports } from "../engine/compatibility.js";
import { exportBuildToFile } from "../engine/exporter.js";
import { PassivePathfinder } from "../engine/pathfinder.js";
import { BuildValidator } from "../engine/validator.js";
import type { BuildFile } from "../types.js";

export function registerAllTools(
  server: McpServer,
  loader: GameDataLoader = globalLoader
): void {
  const pathfinder = new PassivePathfinder(loader);
  const validator = new BuildValidator(loader);

  // 1. poe2_list_classes
  server.registerTool(
    "poe2_list_classes",
    {
      description:
        "List all 12 Path of Exile 2 base classes, their playable status, start node hashes, base attributes, and released Ascendancies.",
      inputSchema: z.object({}),
    },
    async () => {
      const classes = loader.listClasses();
      const output = classes.map((c) => ({
        index: c.index,
        name: c.name,
        released: c.released,
        startHash: c.startHash,
        baseAttributes: c.baseAttributes,
        ascendancies: c.ascendancies.map((a) => ({
          id: a.id,
          name: a.name,
          startHash: a.startHash,
        })),
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      };
    }
  );

  // 2. poe2_search_gems
  server.registerTool(
    "poe2_search_gems",
    {
      description:
        "Search PoE2 skill gems and support gems by name, keyword, tag, type, or weapon crafting type.",
      inputSchema: z.object({
        query: z.string().optional().describe("Search query for gem name, ID, or description"),
        type: z
          .enum(["active", "spirit", "support"])
          .optional()
          .describe("Filter by gem type: active, spirit, or support"),
        tag: z.string().optional().describe("Filter by gem tag (e.g. fire, attack, spell, melee, bow, minion)"),
        craftingType: z
          .string()
          .optional()
          .describe("Filter by weapon/skill craft category (e.g. Mace, Bow, Crossbow, Occult, Quarterstaff)"),
        color: z.enum(["r", "g", "b", "w"]).optional().describe("Gem socket color: r (red), g (green), b (blue), w (white)"),
        obtainableOnly: z
          .boolean()
          .optional()
          .default(true)
          .describe("Filter only to gems obtainable via uncut gems in player builds"),
        limit: z.number().optional().default(25).describe("Maximum results to return"),
      }),
    },
    async (args) => {
      const results = loader.searchGems(args);
      const summary = results.map((g) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        color: g.color,
        craftingLevel: g.craftingLevel,
        craftingTypes: g.craftingTypes,
        tags: g.tags,
        isMeta: g.isMeta,
        description: g.description ? `${g.description.slice(0, 140)}...` : undefined,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: summary.length,
                gems: summary,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 3. poe2_get_gem
  server.registerTool(
    "poe2_get_gem",
    {
      description:
        "Get detailed information for a specific skill or support gem by its exact BaseItemTypes ID or display name.",
      inputSchema: z.object({
        idOrName: z
          .string()
          .describe("Exact BaseItemTypes ID (e.g. 'Metadata/Items/Gems/SkillGemEarthquake') or display name (e.g. 'Earthquake')"),
      }),
    },
    async (args) => {
      const gem = loader.getGem(args.idOrName);
      if (!gem) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Gem not found for '${args.idOrName}'. Use poe2_search_gems to find available gems.`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(gem, null, 2) }],
      };
    }
  );

  // 4. poe2_find_supports
  server.registerTool(
    "poe2_find_supports",
    {
      description:
        "Find all support gems that can support a given active/spirit skill, using PoE2 type tags, allowed/excluded expressions, and GGG recommendations.",
      inputSchema: z.object({
        skillIdOrName: z
          .string()
          .describe("Active or spirit gem name or ID (e.g. 'Earthquake' or 'Metadata/Items/Gems/SkillGemEarthquake')"),
        recommendedOnly: z
          .boolean()
          .optional()
          .default(false)
          .describe("Only return GGG's officially recommended support gems"),
        limit: z.number().optional().default(30).describe("Maximum results to return"),
      }),
    },
    async (args) => {
      const activeGem = loader.getGem(args.skillIdOrName);
      if (!activeGem) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Active skill gem not found for '${args.skillIdOrName}'.`,
            },
          ],
        };
      }

      const allSupports = loader.searchGems({
        type: "support",
        obtainableOnly: true,
        limit: 1000,
      });

      const matches = findCompatibleSupports(activeGem, allSupports, {
        recommendedOnly: args.recommendedOnly,
      }).slice(0, args.limit);

      const output = matches.map((m) => ({
        id: m.support.id,
        name: m.support.name,
        color: m.support.color,
        craftingLevel: m.support.craftingLevel,
        isRecommended: m.isRecommended,
        tags: m.support.tags,
        supportText: m.support.supportText,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                skill: activeGem.name,
                skillId: activeGem.id,
                skillTypes: activeGem.skillTypes,
                compatibleCount: output.length,
                supports: output,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 5. poe2_search_passives
  server.registerTool(
    "poe2_search_passives",
    {
      description:
        "Search passive skill tree nodes by stat modifiers, node name, or kind (keystone, notable, attribute, mastery, jewel).",
      inputSchema: z.object({
        query: z.string().optional().describe("Search query for passive name, stat keyword (e.g. 'lightning damage', 'spell suppression', 'stun')"),
        kind: z
          .enum(["keystone", "notable", "attribute", "mastery", "jewel", "normal"])
          .optional()
          .describe("Filter by node category"),
        ascendancyId: z.string().optional().describe("Filter by specific Ascendancy ID (e.g. 'Warrior1', 'Monk2')"),
        limit: z.number().optional().default(25).describe("Maximum results to return"),
      }),
    },
    async (args) => {
      const results = loader.searchNodes(args);
      const summary = results.map((n) => ({
        hash: n.hash,
        id: n.id,
        name: n.name,
        kind: n.kind,
        ascendancyId: n.ascendancyId,
        stats: n.stats,
        isFree: n.isFree ? true : undefined,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: summary.length,
                passives: summary,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 6. poe2_plan_passive_path
  server.registerTool(
    "poe2_plan_passive_path",
    {
      description:
        "Calculates an optimal connected passive tree path from a starting class to a set of target notables/keystones. Solves node connections and returns exact passive IDs for the .build file.",
      inputSchema: z.object({
        className: z.string().describe("Character base class name (e.g. 'Warrior', 'Monk', 'Sorceress', 'Ranger', 'Witch', 'Mercenary')"),
        targetNodes: z
          .array(z.string())
          .describe("List of target passive node names or IDs to reach (e.g. ['Brutal', 'Zealot\'s Oath', 'marauder_brute_notable1'])"),
        ascendancy: z.string().optional().describe("Optional Ascendancy ID or name (e.g. 'Titan' or 'Warrior1')"),
        maxPoints: z.number().optional().default(120).describe("Maximum passive points budget (default: 120)"),
      }),
    },
    async (args) => {
      const cls = loader.getClass(args.className);
      if (!cls) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unknown class '${args.className}'. Call poe2_list_classes for available classes.`,
            },
          ],
        };
      }

      let ascStartHash: number | undefined;
      let ascId: string | undefined;

      if (args.ascendancy) {
        const ascMatch = loader.getAscendancy(args.ascendancy);
        if (ascMatch) {
          ascId = ascMatch.ascendancy.id;
          ascStartHash = ascMatch.ascendancy.startHash;
        }
      }

      // Resolve target node names or IDs to numeric hashes
      const targetHashes: number[] = [];
      const notFoundTargets: string[] = [];

      for (const t of args.targetNodes) {
        const byId = loader.getNodeById(t);
        if (byId) {
          targetHashes.push(byId.hash);
          continue;
        }

        const byName = loader.findNodesByName(t);
        if (byName.length > 0) {
          // Prefer notable or keystone if multiple exist
          const preferred =
            byName.find((n) => n.kind === "notable" || n.kind === "keystone") ||
            byName[0];
          targetHashes.push(preferred.hash);
          continue;
        }

        notFoundTargets.push(t);
      }

      if (targetHashes.length === 0) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `No valid target nodes found from: ${args.targetNodes.join(", ")}. Check names with poe2_search_passives.`,
            },
          ],
        };
      }

      const plan = pathfinder.planTree({
        startHash: cls.startHash,
        targetHashes,
        ascendancyStartHash: ascStartHash,
        ascendancyId: ascId,
        maxPoints: args.maxPoints,
      });

      const passiveIds = plan.allocatedNodes.map((n) => n.id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                className: cls.name,
                ascendancy: ascId,
                totalPointsSpent: plan.totalPoints,
                totalNodesAllocated: plan.allocatedNodes.length,
                notFoundTargets: notFoundTargets.length > 0 ? notFoundTargets : undefined,
                unreachedTargets: plan.unreachedTargets.length > 0 ? plan.unreachedTargets : undefined,
                passivesForBuildFile: passiveIds,
                allocationSteps: plan.steps.map((s) => ({
                  id: s.id,
                  name: s.name,
                  kind: s.kind,
                  cost: s.cost,
                })),
                aggregatedStats: plan.aggregatedStats,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 7. poe2_search_uniques
  server.registerTool(
    "poe2_search_uniques",
    {
      description: "Search PoE2 unique items by name or item slot category (e.g. Body Armour, Helmet, Ring, Mace, Bow).",
      inputSchema: z.object({
        query: z.string().optional().describe("Unique item name query"),
        itemClass: z.string().optional().describe("Item category (e.g. 'Body Armour', 'Boots', 'Mace', 'Ring')"),
        limit: z.number().optional().default(25).describe("Maximum results to return"),
      }),
    },
    async (args) => {
      const results = loader.searchUniques(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: results.length,
                uniques: results,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 8. poe2_validate_build
  server.registerTool(
    "poe2_validate_build",
    {
      description:
        "Validates a complete PoE2 build file against official GGG schema rules: checks passives connectivity, gem IDs, support gem compatibility, and meta gems.",
      inputSchema: z.object({
        build: z
          .union([z.string(), z.record(z.string(), z.any())])
          .describe("The full BuildFile JSON object or serialized JSON string"),
      }),
    },
    async (args) => {
      let buildObj: BuildFile;
      if (typeof args.build === "string") {
        try {
          buildObj = JSON.parse(args.build);
        } catch (err: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `Invalid JSON syntax: ${err.message}` }],
          };
        }
      } else {
        buildObj = args.build as unknown as BuildFile;
      }

      const report = validator.validate(buildObj);
      return {
        content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
      };
    }
  );

  // 9. poe2_export_build
  server.registerTool(
    "poe2_export_build",
    {
      description:
        "Validates and exports a PoE2 build to the official in-game Build Planner (.build) format. Can write directly to the user's Steam/Proton directory so it appears immediately in-game.",
      inputSchema: z.object({
        build: z
          .union([z.string(), z.record(z.string(), z.any())])
          .describe("The full BuildFile JSON object or serialized JSON string"),
        filename: z.string().optional().describe("Optional custom filename (e.g. 'My_Titan_Build.build')"),
        outputPath: z.string().optional().describe("Explicit target path on disk to save the file"),
        writeToGameDir: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, automatically saves into the detected PoE2 BuildPlanner directory"),
      }),
    },
    async (args) => {
      let buildObj: BuildFile;
      if (typeof args.build === "string") {
        try {
          buildObj = JSON.parse(args.build);
        } catch (err: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `Invalid JSON syntax: ${err.message}` }],
          };
        }
      } else {
        buildObj = args.build as unknown as BuildFile;
      }

      const report = validator.validate(buildObj);
      if (!report.valid) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Build validation failed with ${report.errors.length} error(s):\n${report.errors.join("\n")}`,
            },
          ],
        };
      }

      const result = exportBuildToFile(buildObj, {
        filename: args.filename,
        outputPath: args.outputPath,
        writeToGameDir: args.writeToGameDir,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                savedPath: result.filePath,
                inGameDir: result.inGameDir,
                warnings: report.warnings.length > 0 ? report.warnings : undefined,
                summary: report.summary,
                buildContent: JSON.parse(result.content),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 10. poe2_refresh_data
  server.registerTool(
    "poe2_refresh_data",
    {
      description:
        "Forces a re-download of latest skill tree and RePoE game data from GitHub, regenerating the local cache.",
      inputSchema: z.object({
        forceDownload: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether to force redownloading all raw files from GitHub"),
      }),
    },
    async (args) => {
      try {
        const data = await refreshGameData(args.forceDownload);
        await loader.init(false);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  generatedAt: data.generatedAt,
                  classesCount: data.classes.length,
                  nodesCount: Object.keys(data.nodes).length,
                  gemsCount: Object.keys(data.gems).length,
                  uniquesCount: data.uniques.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to refresh game data: ${err.message}` }],
        };
      }
    }
  );
}
