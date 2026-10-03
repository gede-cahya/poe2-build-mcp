#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { globalLoader } from "./data/loader.js";
import { registerAllPrompts } from "./prompts/index.js";
import { registerAllTools } from "./tools/index.js";

async function main() {
  // Check CLI arguments for manual refresh
  if (process.argv.includes("--refresh") || process.argv.includes("refresh")) {
    const { refreshGameData } = await import("./data/fetcher.js");
    console.error("[poe2-mcp] Refreshing game data from upstream sources...");
    await refreshGameData(true);
    console.error("[poe2-mcp] Data refresh completed successfully.");
    process.exit(0);
  }

  // Initialize data loader from cache
  try {
    await globalLoader.init(true);
  } catch (err: any) {
    console.error(`[poe2-mcp] Error loading PoE2 game data: ${err.message}`);
    process.exit(1);
  }

  const server = new McpServer({
    name: "poe2-build-mcp",
    version: "0.1.0",
  });

  registerAllTools(server, globalLoader);
  registerAllPrompts(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[poe2-mcp] Server running on stdio transport.");
}

main().catch((err) => {
  console.error("[poe2-mcp] Fatal error:", err);
  process.exit(1);
});
