import type { Graph, AlgorithmResult } from './types';
import { haversine } from './graphBuilder';
import { MinHeap } from './minHeap';

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
  const startH = haversine(nodes.get(startId)!.position, endPos);
  fScore.set(startId, startH);
  parent.set(startId, null);

  const open = new MinHeap();
  open.push(startId, startH);

  while (open.size > 0) {
    const { id: current } = open.pop()!;

    if (visited.has(current)) continue;
    visited.add(current);
    exploredOrder.push(current);

    if (current === endId) break;

    for (const { nodeId, weight } of nodes.get(current)!.neighbors) {
      if (visited.has(nodeId)) continue;
      const tentative = gScore.get(current)! + weight;
      if (tentative < gScore.get(nodeId)!) {
        gScore.set(nodeId, tentative);
        const f = tentative + haversine(nodes.get(nodeId)!.position, endPos);
        fScore.set(nodeId, f);
        parent.set(nodeId, current);
        open.push(nodeId, f);
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
