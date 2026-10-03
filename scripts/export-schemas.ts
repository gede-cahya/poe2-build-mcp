import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

async function main() {
  const targetDir = "/home/cahya/.gemini/antigravity/mcp/poe2-build";
  await fs.mkdir(targetDir, { recursive: true });

  const transport = new StdioClientTransport({
    command: "/usr/bin/bun",
    args: ["run", "/home/cahya/2026/poe2-build-mcp/src/index.ts"],
  });

  const client = new Client(
    { name: "schema-exporter", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("Connected to poe2-build server. Fetching tools...");

  const res = await client.listTools();
  console.log(`Found ${res.tools.length} tools.`);

  for (const tool of res.tools) {
    const filePath = path.join(targetDir, `${tool.name}.json`);
    const schemaContent = {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    };
    await fs.writeFile(filePath, JSON.stringify(schemaContent, null, 2) + "\n");
    console.log(`Exported schema: ${tool.name} -> ${filePath}`);
  }

  await client.close();
  console.log("Export completed successfully!");
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
