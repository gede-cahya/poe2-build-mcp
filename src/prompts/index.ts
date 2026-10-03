import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerAllPrompts(server: McpServer): void {
  server.registerPrompt(
    "create_build",
    {
      description:
        "Guides the AI assistant through designing an optimal, validated Path of Exile 2 build using grounded game data.",
      argsSchema: {
        className: z
          .string()
          .describe("Target base class (e.g. Warrior, Monk, Sorceress, Ranger, Witch, Mercenary)"),
        mainSkill: z
          .string()
          .optional()
          .describe("Desired primary skill gem (e.g. Earthquake, Falling Thunder, Spark, Boneshatter)"),
        playstyle: z
          .string()
          .optional()
          .describe("Playstyle or archetype (e.g. Slam, Bleed, Lightning Crit, Spellcaster, Tanky Leveling)"),
        budgetOrLevel: z
          .string()
          .optional()
          .describe("Target progression level: 'leveling' (acts), 'early-maps' (level 70), 'endgame' (level 90+)"),
      },
    },
    async (args) => {
      const { className, mainSkill, playstyle, budgetOrLevel } = args;

      const instructions = `You are a Path of Exile 2 Theorycrafter and Build Engineer.

Target Specifications:
- Class: ${className}
${mainSkill ? `- Desired Skill: ${mainSkill}` : "- Primary Skill: (Choose the best fit for this archetype)"}
${playstyle ? `- Playstyle/Theme: ${playstyle}` : ""}
${budgetOrLevel ? `- Target Progression: ${budgetOrLevel}` : "- Target Progression: Endgame (level 80-90)"}

Follow this exact 5-step workflow using the PoE2 MCP tools:

1. CLASS & ASCENDANCY:
   - Call \`poe2_list_classes\` to verify the released Ascendancies for ${className} and their start nodes.
   - Choose the most synergistic Ascendancy.

2. GEM SETUP:
   - If a skill wasn't specified, use \`poe2_search_gems\` to find active skills that match the playstyle.
   - For each skill, call \`poe2_find_supports\` to pick 2-5 compatible support gems. Prioritize GGG recommended supports unless an advanced combo is clearly superior.
   - Note: Do NOT use meta-gems as the main skill, as the PoE2 .build v1 format does not yet support meta-gems.

3. PASSIVE TREE PATHFINDING:
   - Use \`poe2_search_passives\` to find key notables and keystones relevant to the damage scaling and defenses (e.g., life, armour, spell suppression, ailment chance).
   - Call \`poe2_plan_passive_path\` with the class name and target notables. The engine will calculate the optimal shortest path and return valid passive IDs.

4. GEAR & INVENTORY SLOTS:
   - Recommend gear stat priorities for each slot (Weapon1, BodyArmour1, Boots1, etc.).
   - If helpful, use \`poe2_search_uniques\` to find 1-2 accessible unique items that elevate the build.

5. VALIDATION & EXPORT:
   - Call \`poe2_validate_build\` to verify the complete build structure.
   - If valid, call \`poe2_export_build\` to generate the final .build file (and optionally write it to the game directory).
`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: instructions,
            },
          },
        ],
      };
    }
  );
}
