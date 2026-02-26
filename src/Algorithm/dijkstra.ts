import type { Graph, AlgorithmResult } from './types';

export function dijkstra(graph: Graph): AlgorithmResult {
  const { nodes, startId, endId } = graph;
  const exploredOrder: string[] = [];
  const dist = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const id of nodes.keys()) dist.set(id, Infinity);
  dist.set(startId, 0);
  parent.set(startId, null);

  // Simple priority queue via sorted array (adequate for 20x20 = 400 nodes)
  const pq: { id: string; cost: number }[] = [{ id: startId, cost: 0 }];

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const { id: current } = pq.shift()!;

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
        pq.push({ id: nodeId, cost: newDist });
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
