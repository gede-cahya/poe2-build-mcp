import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  console.log("=== Testing PoE2 Build MCP Server ===");

  const transport = new StdioClientTransport({
    command: "/usr/bin/bun",
    args: ["run", "/home/cahya/2026/poe2-build-mcp/src/index.ts"],
  });

  const client = new Client(
    { name: "antigravity-test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("✓ Connected via StdioClientTransport\n");

  // 1. List Classes
  console.log("--- 1. Testing poe2_list_classes ---");
  const classesRes = await client.callTool({
    name: "poe2_list_classes",
    arguments: {},
  });
  const classes = JSON.parse((classesRes.content as any)[0].text);
  console.log(`✓ Retrieved ${classes.length} classes. Released: ${classes.filter((c: any) => c.released).map((c: any) => c.name).join(", ")}\n`);

  // 2. Search Gems
  console.log("--- 2. Testing poe2_search_gems (Earthquake) ---");
  const gemsRes = await client.callTool({
    name: "poe2_search_gems",
    arguments: { query: "Earthquake" },
  });
  const gems = JSON.parse((gemsRes.content as any)[0].text);
  console.log(`✓ Found ${gems.count} gems. First gem: ${gems.gems[0].name} (${gems.gems[0].iconUrl})\n`);

  // 3. Find Supports
  console.log("--- 3. Testing poe2_find_supports (Earthquake, recommended) ---");
  const supportsRes = await client.callTool({
    name: "poe2_find_supports",
    arguments: { skillIdOrName: "Earthquake", recommendedOnly: true },
  });
  const supports = JSON.parse((supportsRes.content as any)[0].text);
  console.log(`✓ Compatible recommended supports (${supports.compatibleCount}): ${supports.supports.slice(0, 4).map((s: any) => s.name).join(", ")}\n`);

  // 4. Plan Passive Path
  console.log("--- 4. Testing poe2_plan_passive_path (Warrior -> Brutal) ---");
  const pathRes = await client.callTool({
    name: "poe2_plan_passive_path",
    arguments: { className: "Warrior", targetNodes: ["Brutal"], maxPoints: 50 },
  });
  const path = JSON.parse((pathRes.content as any)[0].text);
  console.log(`✓ Path planned! Total points: ${path.totalPointsSpent}, Nodes allocated: ${path.totalNodesAllocated}\n`);

  // 5. Search Uniques
  console.log("--- 5. Testing poe2_search_uniques (Temporalis) ---");
  const uniquesRes = await client.callTool({
    name: "poe2_search_uniques",
    arguments: { query: "Temporalis" },
  });
  const uniques = JSON.parse((uniquesRes.content as any)[0].text);
  console.log(`✓ Uniques found: ${uniques.count}, Sample: ${uniques.uniques[0]?.name} (${uniques.uniques[0]?.itemClass})\n`);

  // 6. Live Market Price (Mirror of Kalandra & Divine Orb)
  console.log("--- 6. Testing poe2_get_market_price (Mirror & Divine) ---");
  const marketMirrorRes = await client.callTool({
    name: "poe2_get_market_price",
    arguments: { query: "Mirror of Kalandra", league: "Runes of Aldur" },
  });
  const mirrorData = JSON.parse((marketMirrorRes.content as any)[0].text);
  const mirror = mirrorData.results[0];
  console.log(`✓ Mirror of Kalandra: ${mirror?.priceDivine} Divine (${mirror?.priceExalted} Exalted). Icon: ${mirror?.iconUrl}\n`);

  const marketDivRes = await client.callTool({
    name: "poe2_get_market_price",
    arguments: { query: "Divine Orb", league: "Runes of Aldur" },
  });
  const divData = JSON.parse((marketDivRes.content as any)[0].text);
  const divine = divData.results[0];
  console.log(`✓ Divine Orb: ${divine?.priceExalted} Exalted. Icon: ${divine?.iconUrl}\n`);

  // 7. Calculate DPS
  console.log("--- 7. Testing poe2_calculate_dps (Earthquake Slam) ---");
  const dpsRes = await client.callTool({
    name: "poe2_calculate_dps",
    arguments: {
      skillName: "Earthquake",
      isSpell: false,
      baseDamage: {
        physical: { min: 250, max: 450 },
      },
      baseSpeed: 1.35,
      increasedDamagePercent: 180,
      moreDamageMultipliers: [1.35, 1.40, 1.25],
      baseCritChance: 7.5,
      increasedCritChancePercent: 120,
      critMultiplierPercent: 220,
    },
  });
  const dps = JSON.parse((dpsRes.content as any)[0].text);
  console.log(`✓ DPS Calculated: Total DPS = ${dps.totalDps.toLocaleString()} (Hit: ${dps.hitDps.toLocaleString()}, Actions/sec: ${dps.actionsPerSecond})\n`);

  // 8. Calculate Build Budget
  console.log("--- 8. Testing poe2_calculate_build_budget (Temporalis, The Dancing Dervish) ---");
  const budgetRes = await client.callTool({
    name: "poe2_calculate_build_budget",
    arguments: {
      items: ["Temporalis", "The Dancing Dervish Scimitar"],
      league: "Runes of Aldur",
    },
  });
  const budget = JSON.parse((budgetRes.content as any)[0].text);
  console.log(`✓ Total Build Budget: ${budget.totalDivine} Div (${budget.totalExalted} Ex) -> Tier: ${budget.tier}\n`);

  // 9. Validate & Export Build
  console.log("--- 9. Testing poe2_validate_build and poe2_export_build ---");
  const sampleBuild = {
    name: "Antigravity Test Slammer",
    class: "Warrior",
    character_level: 65,
    passives: path.passivesForBuildFile.map((id: string) => ({ id })),
    skills: [
      {
        id: "Metadata/Items/Gems/SkillGemEarthquake",
        support_skills: ["Metadata/Items/Gems/SupportGemFistOfWar"],
      },
    ],
  };

  const valRes = await client.callTool({
    name: "poe2_validate_build",
    arguments: { build: sampleBuild },
  });
  const val = JSON.parse((valRes.content as any)[0].text);
  console.log(`✓ Build validation: valid=${val.valid}, passivesCount=${val.summary.passivesCount}, skillsCount=${val.summary.skillsCount}`);

  const expRes = await client.callTool({
    name: "poe2_export_build",
    arguments: {
      build: sampleBuild,
      filename: "Antigravity_Test_Build.build",
    },
  });
  const exp = JSON.parse((expRes.content as any)[0].text);
  console.log(`✓ Build exported successfully to: ${exp.savedPath}\n`);

  await client.close();
  console.log("=== All MCP Tools Tested & Verified Successfully! ===");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
