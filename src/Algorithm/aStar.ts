import type { Graph, AlgorithmResult } from './types';
import { haversine } from './graphBuilder';

export function aStar(graph: Graph): AlgorithmResult {
  const { nodes, startId, endId } = graph;
  const exploredOrder: string[] = [];

  const endPos = nodes.get(endId)!.position;

  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const id of nodes.keys()) {
    gScore.set(id, Infinity);
    fScore.set(id, Infinity);
  }
  gScore.set(startId, 0);
  fScore.set(startId, haversine(nodes.get(startId)!.position, endPos));
  parent.set(startId, null);

  const open: string[] = [startId];

  while (open.length > 0) {
    // Pick node with lowest fScore
    open.sort((a, b) => fScore.get(a)! - fScore.get(b)!);
    const current = open.shift()!;

    if (visited.has(current)) continue;
    visited.add(current);
    exploredOrder.push(current);

    if (current === endId) break;

    for (const { nodeId, weight } of nodes.get(current)!.neighbors) {
      if (visited.has(nodeId)) continue;
      const tentative = gScore.get(current)! + weight;
      if (tentative < gScore.get(nodeId)!) {
        gScore.set(nodeId, tentative);
        fScore.set(nodeId, tentative + haversine(nodes.get(nodeId)!.position, endPos));
        parent.set(nodeId, current);
        open.push(nodeId);
      }
    }
  }

  // Reconstruct path
  const path: string[] = [];
  if (parent.has(endId)) {
    let cur: string | null = endId;
    while (cur !== null) {
      path.unshift(cur);
      cur = parent.get(cur) ?? null;
    }
  }

  return { exploredOrder, path };
}
