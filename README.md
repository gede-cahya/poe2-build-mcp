# PoE2 Build Generator MCP Server (Powered by Bun)

A high-performance Model Context Protocol (MCP) server running on **Bun** that empowers AI assistants (Antigravity, Claude Desktop, Cursor, etc.) to design, validate, optimize (DPS & Budget), and export character builds for **Path of Exile 2 (Patch 0.5.5+)** using grounded official game data and real-time live economy pricing.

Instead of hallucinating passive nodes, skill gems, or prices, the AI queries official passive tree data (from GGG), datamined game information (from RePoE), and live market rates (from poe2scout) to:
1. Search and match real skill & support gems with official CDN icons.
2. Evaluate support gem compatibility using PoE2's type tagging and allowed/excluded logic.
3. Calculate optimal connected passive tree paths using graph pathfinding.
4. Calculate deterministic skill DPS with attack/cast speed, flat added damage, increased%, more% multipliers, and crits.
5. Fetch real-time market prices for currencies (Mirror of Kalandra, Divine Orb, Exalted Orb) and unique items.
6. Calculate total build budget and cost tiers (Budget, Mid-Tier, Endgame, Mirror-Tier).
7. Validate builds against official GGG rules (connectivity, ascendancy match, points spent, meta gems warning).
8. Export directly to the official in-game Build Planner (`.build`) JSON format so the build appears instantly in your game client.

---

## Architecture & Performance

- **Runtime**: **Bun** (native TypeScript execution, sub-20ms cold start, native test runner)
- **Data Grounding**: Official GGG tree export (Patch 0.5.5) + RePoE engine v4.5.5.2 (< 50ms startup, 2.25MB cached binary)
- **Live Economy**: Real-time integration with `api.poe2scout.com` for active leagues (Runes of Aldur, Standard, etc.)
- **Engine**: Steiner-tree pathfinding, compatibility validator, deterministic DPS calculator, budget estimator, and `.build` file exporter.

---

## Quickstart with Bun

### 1. Install dependencies
```bash
cd /home/cahya/2026/poe2-build-mcp
bun install
```

### 2. Configure with your AI client (Antigravity / Claude Desktop)

Add the server to your MCP configuration file (`mcp_config.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "poe2-build": {
      "command": "/usr/bin/bun",
      "args": [
        "run",
        "/home/cahya/2026/poe2-build-mcp/src/index.ts"
      ]
    }
  }
}
```

*Tip: With Bun, there is no need to pre-build or transpile to JavaScript — Bun runs `src/index.ts` directly with native TypeScript support!*

---

## Available MCP Tools (13 Tools)

| Tool | Category | Description |
|---|---|---|
| `poe2_list_classes` | Classes | Lists all 12 classes, start node hashes, base attributes, and released Ascendancies. |
| `poe2_search_gems` | Gems & Images | Search active, spirit, and support gems with weapon tags and icon URLs. |
| `poe2_get_gem` | Gems & Images | Full gem metadata: BaseItemTypes ID, tags, requirements, recommended supports, and icon URLs. |
| `poe2_find_supports` | Compatibility | Finds all compatible support gems for an active skill using PoE2 type tags and recommendations. |
| `poe2_search_passives` | Passive Tree | Search passive tree nodes by stat modifiers (e.g. `lightning damage`, `spell suppression`), name, or kind. |
| `poe2_plan_passive_path` | Pathfinding | Graph pathfinding from a class start to target notables/keystones, returning exact passive IDs and point costs. |
| `poe2_search_uniques` | Items & Images | Search unique items by name or equipment slot with icon URLs. |
| `poe2_get_market_price` | Live Economy | Real-time prices and currency exchange rates (Mirror, Divine, Exalt) and unique items in active leagues. |
| `poe2_calculate_dps` | DPS Engine | Deterministic DPS calculation with base damage, added flat, % inc, % more, speed, crit chance & multi. |
| `poe2_calculate_build_budget` | Economy Engine | Calculates total build cost in Divine Orbs & Exalts, classifying into Budget/Mid/Endgame/Mirror tiers. |
| `poe2_validate_build` | Validation | Validates a complete build file against official GGG rules, passive tree connectivity, and support compatibility. |
| `poe2_export_build` | Exporter | Validates and exports the build to the official `.build` JSON format, optionally saving to game folder. |
| `poe2_refresh_data` | Updater | Re-downloads the latest passive tree and RePoE data from GitHub and updates the local cache. |

---

## In-Game Build Planner Integration

The `.build` file format is natively recognized by Path of Exile 2's Build Planner.

### File Placement Locations
- **Linux (Steam / Proton)**:
  `~/.local/share/Steam/steamapps/compatdata/2315204395/pfx/drive_c/users/steamuser/Documents/My Games/Path of Exile 2/BuildPlanner/`
- **Windows**:
  `C:\Users\<Username>\Documents\My Games\Path of Exile 2\BuildPlanner\`
- **Custom Location**:
  Set the environment variable `POE2_BUILDPLANNER_DIR`.

When calling `poe2_export_build` with `"writeToGameDir": true`, the server automatically detects your Proton/Windows directory and saves the file there.

---

## Available Prompt

- **`create_build`**:
  Input: `className`, `mainSkill` (optional), `playstyle` (optional), `budgetOrLevel` (optional).
  Guides the AI through the complete build creation, pathfinding, DPS calculation, and budget workflow.

---

## Development & Testing with Bun

```bash
# Run unit test suite (17 tests in ~200ms)
bun test

# Run end-to-end MCP client integration test
bun run scripts/test-mcp-client.ts

# Export Antigravity lazy JSON schemas
bun run scripts/export-schemas.ts

# Run in watch mode for development
bun run dev

# Re-download data from GitHub
bun run refresh-data
```
