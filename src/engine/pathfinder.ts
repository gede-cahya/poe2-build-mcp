import type { GameDataLoader } from "../data/loader.js";
import type { PassiveNode } from "../types.js";

export interface PathStep {
  hash: number;
  id: string;
  name: string;
  kind: PassiveNode["kind"];
  cost: number;
}

export interface PathPlanResult {
  allocatedHashes: number[];
  allocatedNodes: PassiveNode[];
  steps: PathStep[];
  totalPoints: number;
  unreachedTargets: Array<{ hash: number; id: string; name: string }>;
  aggregatedStats: Record<string, number>;
  rawStats: string[];
}

export class PassivePathfinder {
  constructor(private loader: GameDataLoader) {}

  /**
   * Finds the shortest path from any node in `startSet` to `targetHash`.
   */
  public shortestPath(
    startSet: Set<number>,
    targetHash: number,
    allowedAscendancyId?: string
  ): number[] | null {
    if (startSet.has(targetHash)) return [targetHash];

    const queue: number[] = Array.from(startSet);
    const dist = new Map<number, number>();
    const prev = new Map<number, number>();

    for (const s of queue) {
      dist.set(s, 0);
    }

    let head = 0;
    let found = false;

    while (head < queue.length) {
      const curr = queue[head++];
      if (curr === targetHash) {
        found = true;
        break;
      }

      const currNode = this.loader.getNodeByHash(curr);
      if (!currNode) continue;

      for (const next of currNode.neighbors) {
        if (dist.has(next)) continue;
        const nextNode = this.loader.getNodeByHash(next);
        if (!nextNode || nextNode.isolated) continue;

        // Do not traverse into other class starts
        if (nextNode.kind === "classStart" && !startSet.has(next)) continue;

        // Do not traverse into ascendancies other than the allowed one
        if (
          nextNode.ascendancyId &&
          nextNode.ascendancyId !== allowedAscendancyId &&
          !startSet.has(next)
        ) {
          continue;
        }

        dist.set(next, dist.get(curr)! + 1);
        prev.set(next, curr);
        queue.push(next);
      }
    }

    if (!found) return null;

    const path: number[] = [];
    let curr: number | undefined = targetHash;
    while (curr !== undefined && !startSet.has(curr)) {
      path.push(curr);
      curr = prev.get(curr);
    }

    return path.reverse();
  }

  /**
   * Plans an optimal connected passive tree from class start to a set of target nodes.
   */
  public planTree(options: {
    startHash: number;
    targetHashes: number[];
    ascendancyStartHash?: number;
    ascendancyId?: string;
    initialAllocatedHashes?: number[];
    maxPoints?: number;
  }): PathPlanResult {
    const { startHash, targetHashes, ascendancyStartHash, ascendancyId } = options;
    const maxPoints = options.maxPoints ?? 120;

    const allocated = new Set<number>(options.initialAllocatedHashes || []);
    allocated.add(startHash);
    if (ascendancyStartHash) {
      allocated.add(ascendancyStartHash);
    }

    const remaining = new Set<number>(targetHashes);
    const steps: PathStep[] = [];
    const unreached: Array<{ hash: number; id: string; name: string }> = [];

    // Greedily connect the closest target to the current allocated component
    while (remaining.size > 0) {
      let bestTarget: number | null = null;
      let bestPath: number[] | null = null;
      let bestDist = Number.POSITIVE_INFINITY;

      for (const t of remaining) {
        const path = this.shortestPath(allocated, t, ascendancyId);
        if (path && path.length < bestDist) {
          bestDist = path.length;
          bestPath = path;
          bestTarget = t;
        }
      }

      if (!bestPath || bestTarget === null) {
        for (const t of remaining) {
          const node = this.loader.getNodeByHash(t);
          unreached.push({
            hash: t,
            id: node?.id || String(t),
            name: node?.name || "Unknown",
          });
        }
        break;
      }

      // Calculate point cost of this path
      let stepCost = 0;
      for (const hash of bestPath) {
        if (!allocated.has(hash)) {
          const node = this.loader.getNodeByHash(hash);
          if (
            node &&
            !node.isFree &&
            node.kind !== "classStart" &&
            node.kind !== "ascendancyStart"
          ) {
            stepCost += 1;
          }
        }
      }

      const currentPoints = steps.reduce((sum, s) => sum + s.cost, 0);
      if (currentPoints + stepCost > maxPoints) {
        // Cannot afford to reach this target within maxPoints budget
        for (const t of remaining) {
          const node = this.loader.getNodeByHash(t);
          unreached.push({
            hash: t,
            id: node?.id || String(t),
            name: node?.name || "Unknown",
          });
        }
        break;
      }

      for (const hash of bestPath) {
        if (!allocated.has(hash)) {
          const node = this.loader.getNodeByHash(hash);
          if (node) {
            const cost =
              node.isFree ||
              node.kind === "classStart" ||
              node.kind === "ascendancyStart"
                ? 0
                : 1;
            steps.push({
              hash,
              id: node.id,
              name: node.name,
              kind: node.kind,
              cost,
            });
          }
          allocated.add(hash);
        }
      }

      remaining.delete(bestTarget);
    }

    // Filter out root start nodes from allocated nodes output
    const nonStartHashes = Array.from(allocated).filter(
      (h) => h !== startHash && h !== ascendancyStartHash
    );

    const allocatedNodes: PassiveNode[] = [];
    const rawStats: string[] = [];
    const aggregatedStats: Record<string, number> = {};

    for (const h of nonStartHashes) {
      const node = this.loader.getNodeByHash(h);
      if (node) {
        allocatedNodes.push(node);
        for (const stat of node.stats) {
          rawStats.push(stat);
          // Simple heuristic aggregation for +N and N% stats
          const match = stat.match(/([+-]?\d+(?:\.\d+)?%?)\s+(?:to\s+|increased\s+|reduced\s+)?(.+)/i);
          if (match) {
            const num = Number.parseFloat(match[1].replace("%", ""));
            const key = match[2].trim();
            if (!Number.isNaN(num)) {
              aggregatedStats[key] = (aggregatedStats[key] || 0) + num;
            }
          }
        }
      }
    }

    const totalPoints = steps.reduce((sum, s) => sum + s.cost, 0);

    return {
      allocatedHashes: nonStartHashes,
      allocatedNodes,
      steps,
      totalPoints,
      unreachedTargets: unreached,
      aggregatedStats,
      rawStats,
    };
  }
}
