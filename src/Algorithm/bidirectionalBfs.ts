import type { Graph, AlgorithmResult } from './types';

export function bidirectionalBfs(graph: Graph): AlgorithmResult {
  const { nodes, startId, endId } = graph;
  const exploredOrder: string[] = [];

  const visitedF = new Set<string>();
  const visitedB = new Set<string>();
  const parentF = new Map<string, string | null>();
  const parentB = new Map<string, string | null>();

  visitedF.add(startId); parentF.set(startId, null);
  visitedB.add(endId);   parentB.set(endId, null);

  const queueF: string[] = [startId];
  const queueB: string[] = [endId];

  let meetingNode: string | null = null;

  while (queueF.length > 0 || queueB.length > 0) {
    // Forward step
    if (queueF.length > 0) {
      const cur = queueF.shift()!;
      exploredOrder.push(cur);
      if (visitedB.has(cur)) { meetingNode = cur; break; }
      for (const { nodeId } of nodes.get(cur)!.neighbors) {
        if (!visitedF.has(nodeId)) {
          visitedF.add(nodeId);
          parentF.set(nodeId, cur);
          queueF.push(nodeId);
          if (visitedB.has(nodeId)) { meetingNode = nodeId; break; }
        }
      }
      if (meetingNode) break;
    }

    // Backward step
    if (queueB.length > 0) {
      const cur = queueB.shift()!;
      exploredOrder.push(cur);
      if (visitedF.has(cur)) { meetingNode = cur; break; }
      for (const { nodeId } of nodes.get(cur)!.neighbors) {
        if (!visitedB.has(nodeId)) {
          visitedB.add(nodeId);
          parentB.set(nodeId, cur);
          queueB.push(nodeId);
          if (visitedF.has(nodeId)) { meetingNode = nodeId; break; }
        }
      }
      if (meetingNode) break;
    }
  }

  // Reconstruct path through meeting node
  const path: string[] = [];
  if (meetingNode) {
    // Forward half
    const fwd: string[] = [];
    let cur: string | null = meetingNode;
    while (cur !== null) {
      fwd.unshift(cur);
      cur = parentF.get(cur) ?? null;
    }
    // Backward half
    const bwd: string[] = [];
    let b: string | null = parentB.get(meetingNode) ?? null;
    while (b !== null) {
      bwd.push(b);
      b = parentB.get(b) ?? null;
    }
    path.push(...fwd, ...bwd);
  }

  return { exploredOrder, path };
}
