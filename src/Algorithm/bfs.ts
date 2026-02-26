import type { Graph, AlgorithmResult } from './types';

export function bfs(graph: Graph): AlgorithmResult {
  const { nodes, startId, endId } = graph;
  const exploredOrder: string[] = [];
  const visited = new Set<string>();
  const parent = new Map<string, string | null>();
  const queue: string[] = [startId];

  visited.add(startId);
  parent.set(startId, null);

  while (queue.length > 0) {
    const current = queue.shift()!;
    exploredOrder.push(current);

    if (current === endId) break;

    const node = nodes.get(current)!;
    for (const { nodeId } of node.neighbors) {
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        parent.set(nodeId, current);
        queue.push(nodeId);
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
