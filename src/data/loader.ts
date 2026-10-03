import fs from "node:fs";
import type {
  ClassInfo,
  GameData,
  GemInfo,
  PassiveNode,
  UniqueInfo,
} from "../types.js";
import { GAMEDATA_PATH, refreshGameData } from "./fetcher.js";

export class GameDataLoader {
  private data: GameData | null = null;
  private nodesById = new Map<string, PassiveNode>();
  private nodesByName = new Map<string, PassiveNode[]>();
  private gemsById = new Map<string, GemInfo>();
  private gemsByName = new Map<string, GemInfo>();
  private classesByName = new Map<string, ClassInfo>();
  private ascendanciesById = new Map<string, { ascendancy: any; classInfo: ClassInfo }>();

  public async init(autoRefresh = true): Promise<GameData> {
    if (this.data) return this.data;

    if (!fs.existsSync(GAMEDATA_PATH)) {
      if (autoRefresh) {
        this.data = await refreshGameData(false);
      } else {
        throw new Error(
          `Game data not found at ${GAMEDATA_PATH}. Run refreshGameData() first.`
        );
      }
    } else {
      const raw = fs.readFileSync(GAMEDATA_PATH, "utf-8");
      this.data = JSON.parse(raw) as GameData;
    }

    this.buildIndexes();
    return this.data;
  }

  public getData(): GameData {
    if (!this.data) {
      throw new Error("GameDataLoader not initialized. Call init() first.");
    }
    return this.data;
  }

  private buildIndexes(): void {
    if (!this.data) return;

    this.nodesById.clear();
    this.nodesByName.clear();
    this.gemsById.clear();
    this.gemsByName.clear();
    this.classesByName.clear();
    this.ascendanciesById.clear();

    for (const node of Object.values(this.data.nodes)) {
      this.nodesById.set(node.id, node);
      const lowerName = node.name.toLowerCase();
      if (!this.nodesByName.has(lowerName)) {
        this.nodesByName.set(lowerName, []);
      }
      this.nodesByName.get(lowerName)!.push(node);
    }

    for (const gem of Object.values(this.data.gems)) {
      this.gemsById.set(gem.id, gem);
      this.gemsByName.set(gem.name.toLowerCase(), gem);
    }

    for (const cls of this.data.classes) {
      this.classesByName.set(cls.name.toLowerCase(), cls);
      for (const asc of cls.ascendancies) {
        this.ascendanciesById.set(asc.id.toLowerCase(), {
          ascendancy: asc,
          classInfo: cls,
        });
        this.ascendanciesById.set(asc.name.toLowerCase(), {
          ascendancy: asc,
          classInfo: cls,
        });
      }
    }
  }

  public listClasses(): ClassInfo[] {
    return this.getData().classes;
  }

  public getClass(nameOrIndex: string | number): ClassInfo | undefined {
    this.getData();
    if (typeof nameOrIndex === "number") {
      return this.data!.classes.find((c) => c.index === nameOrIndex);
    }
    return this.classesByName.get(nameOrIndex.toLowerCase());
  }

  public getAscendancy(idOrName: string) {
    this.getData();
    return this.ascendanciesById.get(idOrName.toLowerCase());
  }

  public getNodeByHash(hash: number | string): PassiveNode | undefined {
    this.getData();
    return this.data!.nodes[String(hash)];
  }

  public getNodeById(id: string): PassiveNode | undefined {
    this.getData();
    return this.nodesById.get(id);
  }

  public findNodesByName(name: string): PassiveNode[] {
    this.getData();
    return this.nodesByName.get(name.toLowerCase()) || [];
  }

  public searchNodes(options: {
    query?: string;
    kind?: PassiveNode["kind"];
    ascendancyId?: string;
    limit?: number;
  }): PassiveNode[] {
    this.getData();
    const query = options.query?.toLowerCase().trim();
    const limit = options.limit ?? 25;
    const results: PassiveNode[] = [];

    for (const node of Object.values(this.data!.nodes)) {
      if (options.kind && node.kind !== options.kind) continue;
      if (options.ascendancyId && node.ascendancyId !== options.ascendancyId) continue;
      if (!options.ascendancyId && node.ascendancyId && !query?.includes("ascendancy")) {
        // default to hiding ascendancy nodes unless explicitly filtered or queried
        if (!options.kind && !options.ascendancyId) continue;
      }

      if (query) {
        const matchesName = node.name.toLowerCase().includes(query);
        const matchesId = node.id.toLowerCase().includes(query);
        const matchesStats = node.stats.some((s) => s.toLowerCase().includes(query));
        if (!matchesName && !matchesId && !matchesStats) continue;
      }

      results.push(node);
      if (results.length >= limit) break;
    }

    return results;
  }

  public getGem(idOrName: string): GemInfo | undefined {
    this.getData();
    return this.gemsById.get(idOrName) || this.gemsByName.get(idOrName.toLowerCase());
  }

  public searchGems(options: {
    query?: string;
    type?: GemInfo["type"];
    tag?: string;
    craftingType?: string;
    color?: string;
    obtainableOnly?: boolean;
    limit?: number;
  }): GemInfo[] {
    this.getData();
    const query = options.query?.toLowerCase().trim();
    const limit = options.limit ?? 25;
    const obtainableOnly = options.obtainableOnly ?? true;
    const results: GemInfo[] = [];

    for (const gem of Object.values(this.data!.gems)) {
      if (obtainableOnly && !gem.obtainable) continue;
      if (options.type && gem.type !== options.type) continue;
      if (options.color && gem.color !== options.color) continue;
      if (options.tag && !gem.tags.includes(options.tag.toLowerCase())) continue;
      if (
        options.craftingType &&
        !gem.craftingTypes.some((t) =>
          t.toLowerCase().includes(options.craftingType!.toLowerCase())
        )
      ) {
        continue;
      }

      if (query) {
        const matchesName = gem.name.toLowerCase().includes(query);
        const matchesId = gem.id.toLowerCase().includes(query);
        const matchesDesc = gem.description.toLowerCase().includes(query);
        const matchesTag = gem.tags.some((t) => t.toLowerCase().includes(query));
        if (!matchesName && !matchesId && !matchesDesc && !matchesTag) continue;
      }

      results.push(gem);
      if (results.length >= limit) break;
    }

    return results;
  }

  public searchUniques(options: {
    query?: string;
    itemClass?: string;
    limit?: number;
  }): UniqueInfo[] {
    this.getData();
    const query = options.query?.toLowerCase().trim();
    const limit = options.limit ?? 25;
    const results: UniqueInfo[] = [];

    for (const item of this.data!.uniques) {
      if (
        options.itemClass &&
        !item.itemClass.toLowerCase().includes(options.itemClass.toLowerCase())
      ) {
        continue;
      }
      if (query && !item.name.toLowerCase().includes(query)) {
        continue;
      }
      results.push(item);
      if (results.length >= limit) break;
    }

    return results;
  }
}

export const globalLoader = new GameDataLoader();
