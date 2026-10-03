import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportBuildToFile, formatBuildJson } from "../src/engine/exporter.js";
import type { BuildFile } from "../types.js";

describe("Build Exporter", () => {
  const sampleBuild: BuildFile = {
    name: "Lightning Monk",
    author: "Exile",
    ascendancy: "Monk2",
    passives: ["six704", "staff_crit_notable1"],
    skills: [
      {
        id: "Metadata/Items/Gems/SkillGemFallingThunder",
        support_skills: ["Metadata/Items/Gems/SupportGemFasterCasting"],
      },
    ],
  };

  it("formats build object to valid PoE2 JSON string", () => {
    const jsonStr = formatBuildJson(sampleBuild);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.name).toBe("Lightning Monk");
    expect(parsed.ascendancy).toBe("Monk2");
    expect(parsed.passives).toEqual(["six704", "staff_crit_notable1"]);
  });

  it("exports build to disk", () => {
    const tmpDir = path.join(os.tmpdir(), `poe2-test-${Date.now()}`);
    const outPath = path.join(tmpDir, "test.build");

    const result = exportBuildToFile(sampleBuild, {
      outputPath: outPath,
    });

    expect(fs.existsSync(result.filePath)).toBe(true);
    const content = fs.readFileSync(result.filePath, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.name).toBe("Lightning Monk");

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
