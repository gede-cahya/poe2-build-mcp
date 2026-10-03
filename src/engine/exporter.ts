import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BuildFile } from "../types.js";

/**
 * Standard Steam AppID for Path of Exile 2.
 */
const POE2_STEAM_APP_ID = "2315204395";

/**
 * Attempts to automatically discover the user's PoE2 BuildPlanner directory.
 */
export function detectBuildPlannerDir(): string | null {
  if (process.env.POE2_BUILDPLANNER_DIR && fs.existsSync(process.env.POE2_BUILDPLANNER_DIR)) {
    return process.env.POE2_BUILDPLANNER_DIR;
  }

  const home = os.homedir();
  const platform = os.platform();

  if (platform === "win32") {
    const winPath = path.join(
      home,
      "Documents",
      "My Games",
      "Path of Exile 2",
      "BuildPlanner"
    );
    if (fs.existsSync(winPath)) return winPath;
  } else if (platform === "linux") {
    // Standard Steam Proton compatdata locations on Linux
    const candidates = [
      path.join(
        home,
        ".local/share/Steam/steamapps/compatdata",
        POE2_STEAM_APP_ID,
        "pfx/drive_c/users/steamuser/Documents/My Games/Path of Exile 2/BuildPlanner"
      ),
      path.join(
        home,
        ".steam/steam/steamapps/compatdata",
        POE2_STEAM_APP_ID,
        "pfx/drive_c/users/steamuser/Documents/My Games/Path of Exile 2/BuildPlanner"
      ),
      path.join(
        home,
        ".var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/compatdata",
        POE2_STEAM_APP_ID,
        "pfx/drive_c/users/steamuser/Documents/My Games/Path of Exile 2/BuildPlanner"
      ),
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }

    // Even if BuildPlanner subdir doesn't exist yet, check if My Games exists
    for (const c of candidates) {
      const parent = path.dirname(c);
      if (fs.existsSync(parent)) {
        return c; // We can create BuildPlanner subdirectory safely
      }
    }
  }

  return null;
}

/**
 * Sanitizes and cleans a build object into the strict PoE2 .build JSON format.
 */
export function formatBuildJson(build: BuildFile): string {
  const cleanBuild: Record<string, any> = {
    name: build.name,
  };

  if (build.author) cleanBuild.author = build.author;
  if (build.link) cleanBuild.link = build.link;
  if (build.description) cleanBuild.description = build.description;
  if (build.ascendancy) cleanBuild.ascendancy = build.ascendancy;
  if (build.passives && build.passives.length > 0) cleanBuild.passives = build.passives;
  if (build.skills && build.skills.length > 0) cleanBuild.skills = build.skills;
  if (build.inventory_slots && build.inventory_slots.length > 0) {
    cleanBuild.inventory_slots = build.inventory_slots;
  }

  return JSON.stringify(cleanBuild, null, 2);
}

/**
 * Exports a build object to a `.build` file on disk.
 */
export function exportBuildToFile(
  build: BuildFile,
  options?: {
    outputPath?: string;
    filename?: string;
    writeToGameDir?: boolean;
  }
): { filePath: string; content: string; inGameDir: boolean } {
  const content = formatBuildJson(build);

  const safeName = (build.name || "poe2-build")
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  const fileName = options?.filename || `${safeName}.build`;

  let targetDir: string;
  let inGameDir = false;

  if (options?.outputPath) {
    targetDir = path.dirname(options.outputPath);
    const finalPath = options.outputPath.endsWith(".build")
      ? options.outputPath
      : path.join(options.outputPath, fileName);
    fs.mkdirSync(path.dirname(finalPath), { recursive: true });
    fs.writeFileSync(finalPath, content, "utf-8");
    return { filePath: finalPath, content, inGameDir: false };
  }

  const detectedGameDir = detectBuildPlannerDir();
  if (options?.writeToGameDir && detectedGameDir) {
    targetDir = detectedGameDir;
    inGameDir = true;
  } else {
    // Default to local project export folder if no explicit path and not writing to game dir
    targetDir = path.resolve(process.cwd(), "builds");
  }

  fs.mkdirSync(targetDir, { recursive: true });
  const finalPath = path.join(targetDir, fileName);
  fs.writeFileSync(finalPath, content, "utf-8");

  return { filePath: finalPath, content, inGameDir };
}
