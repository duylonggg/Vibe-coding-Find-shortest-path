import type { Graph, AlgorithmResult } from './types';
import { MinHeap } from './minHeap';

export function dijkstra(graph: Graph): AlgorithmResult {
  const { nodes, startId, endId } = graph;
  const exploredOrder: string[] = [];
  const dist = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const id of nodes.keys()) dist.set(id, Infinity);
  dist.set(startId, 0);
  parent.set(startId, null);

  const pq = new MinHeap();
  pq.push(startId, 0);

  while (pq.size > 0) {
    const { id: current } = pq.pop()!;

    if (visited.has(current)) continue;
    visited.add(current);
    exploredOrder.push(current);

    if (current === endId) break;

    const node = nodes.get(current)!;
    for (const { nodeId, weight } of node.neighbors) {
      if (visited.has(nodeId)) continue;
      const newDist = dist.get(current)! + weight;
      if (newDist < dist.get(nodeId)!) {
        dist.set(nodeId, newDist);
        parent.set(nodeId, current);
        pq.push(nodeId, newDist);
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
