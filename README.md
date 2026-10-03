# PoE2 Build Generator MCP Server (Powered by Bun)

A high-performance Model Context Protocol (MCP) server running on **Bun** that empowers AI assistants (Antigravity, Claude Desktop, Cursor, etc.) to design, validate, and export character builds for **Path of Exile 2** using grounded, official game data.

Instead of hallucinating passive nodes or skill gems, the AI queries official passive tree data (from GGG) and datamined game information (from RePoE) to:
1. Search and match real skill & support gems
2. Evaluate support gem compatibility using PoE2's type tagging and allowed/excluded logic
3. Calculate optimal connected passive tree paths using graph pathfinding
4. Validate builds against official GGG rules (connectivity, ascendancy match, points spent, meta gems warning)
5. Export directly to the official in-game Build Planner (`.build`) JSON format so the build appears instantly in your game client.

---

## Architecture & Performance

- **Runtime**: **Bun** (native TypeScript execution, sub-20ms cold start, native test runner)
- **Reasoning**: Handled by the connected AI client (Antigravity, Claude, etc.)
- **Grounded Data**: Handled by this MCP server via fast in-memory indexes (2.25MB cached binary)
- **Engine**: Pathfinding (Steiner-tree approximation), compatibility validator, and `.build` file exporter.

---

## Quickstart with Bun

### 1. Install dependencies
```bash
cd /home/cahya/2026/poe2-build-mcp
bun install
```

### 2. Configure with your AI client (Antigravity / Claude Desktop)

Add the server to your MCP configuration file (`mcpSettings.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "poe2-build": {
      "command": "bun",
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

## Available MCP Tools

| Tool | Description |
|---|---|
| `poe2_list_classes` | Lists all 12 classes, start node hashes, base attributes, and released Ascendancies. |
| `poe2_search_gems` | Search active, spirit, and support gems by name, keyword, tag (e.g. `attack`, `spell`, `minion`), color, or weapon type. |
| `poe2_get_gem` | Retrieve full metadata for a gem: exact BaseItemTypes ID, tags, requirements, recommended supports, and descriptions. |
| `poe2_find_supports` | Finds all compatible support gems for an active skill using PoE2 type tags, highlighting GGG recommendations. |
| `poe2_search_passives` | Search passive tree nodes by stat modifiers (e.g. `lightning damage`, `spell suppression`), name, or kind (`keystone`, `notable`, `attribute`). |
| `poe2_plan_passive_path` | Graph pathfinding from a class start to target notables/keystones, returning exact passive IDs and point costs. |
| `poe2_search_uniques` | Search unique items by name or equipment slot for build gear planning. |
| `poe2_validate_build` | Validates a complete build file against official GGG rules, passive tree connectivity, and support compatibility. |
| `poe2_export_build` | Validates and exports the build to the official `.build` JSON format, optionally writing directly to the game's BuildPlanner folder. |
| `poe2_refresh_data` | Re-downloads the latest passive tree and RePoE data from GitHub and updates the local cache. |

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
  Guides the AI through the 5-step build creation workflow.

---

## Development & Testing with Bun

```bash
# Run unit test suite (14 tests in ~80ms)
bun test

# Run in watch mode for development
bun run dev

# Bundle standalone build (optional)
bun run build

# Test MCP interactively via Inspector
bun run inspect

# Re-download data from GitHub
bun run refresh-data
```
