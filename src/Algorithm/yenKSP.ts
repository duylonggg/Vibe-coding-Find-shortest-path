import type { Graph, GraphNode } from './types';
import { MinHeap } from './minHeap';

/**
 * Run Dijkstra from a custom start with node/edge exclusions.
 * Does NOT mutate the graph – exclusions are applied at traversal time.
 */
function dijkstraWithExclusions(
  nodes: Map<string, GraphNode>,
  startId: string,
  endId: string,
  removedNodes: Set<string>,
  removedEdges: Map<string, Set<string>>,
): { path: string[]; cost: number } {
  const dist = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const visited = new Set<string>();
  const pq = new MinHeap();

  dist.set(startId, 0);
  parent.set(startId, null);
  pq.push(startId, 0);

  while (pq.size > 0) {
    const { id: current } = pq.pop()!;

    if (visited.has(current)) continue;
    if (removedNodes.has(current)) continue;
    visited.add(current);

    if (current === endId) break;

    const node = nodes.get(current);
    if (!node) continue;

    const edgesToRemove = removedEdges.get(current);
    for (const { nodeId, weight } of node.neighbors) {
      if (visited.has(nodeId)) continue;
      if (removedNodes.has(nodeId)) continue;
      if (edgesToRemove?.has(nodeId)) continue;

      const newDist = (dist.get(current) ?? Infinity) + weight;
      if (newDist < (dist.get(nodeId) ?? Infinity)) {
        dist.set(nodeId, newDist);
        parent.set(nodeId, current);
        pq.push(nodeId, newDist);
      }
    }
  }

  const path: string[] = [];
  if (parent.has(endId)) {
    let cur: string | null = endId;
    while (cur !== null) {
      path.unshift(cur);
      cur = parent.get(cur) ?? null;
    }
  }

  return { path, cost: dist.get(endId) ?? Infinity };
}

/**
 * Compute the sum of edge weights along a path.
 * Uses stored neighbor weights (haversine distances set at graph-build time).
 */
function pathCost(path: string[], nodes: Map<string, GraphNode>): number {
  let cost = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const node = nodes.get(path[i]);
    if (!node) continue;
    const edge = node.neighbors.find((n) => n.nodeId === path[i + 1]);
    if (edge) cost += edge.weight;
  }
  return cost;
}

/**
 * Yen's K-Shortest Loopless Paths algorithm.
 *
 * Returns up to K shortest loopless paths (sorted by cost) from
 * graph.startId to graph.endId.  Uses Dijkstra with exclusions as
 * the inner subroutine – the graph is never mutated.
 *
 * Reference: Yen, Jin Y. (1971).  "Finding the K Shortest Loopless Paths
 * in a Network."  Management Science.
 */
export function yenKShortestPaths(
  graph: Graph,
  K: number,
): { path: string[]; cost: number }[] {
  const { nodes, startId, endId } = graph;

  const A: { path: string[]; cost: number }[] = [];
  // Candidates: kept sorted by cost (ascending). Using a plain array is fine
  // for K=3 since the candidate list stays small.
  const B: { path: string[]; cost: number }[] = [];

  // ── Step 0: find the first (shortest) path ───────────────────────────────
  const first = dijkstraWithExclusions(nodes, startId, endId, new Set(), new Map());
  if (first.path.length === 0) return [];
  A.push(first);

  // ── Steps 1 … K-1 ────────────────────────────────────────────────────────
  for (let k = 1; k < K; k++) {
    const prevPath = A[k - 1].path;

    for (let i = 0; i < prevPath.length - 1; i++) {
      const spurNode = prevPath[i];
      const rootPath = prevPath.slice(0, i + 1); // root path up to spurNode
      const rootKey  = rootPath.join('\0');

      // Edges to suppress: for every accepted path whose root equals rootPath,
      // remove the outgoing edge from spurNode to its successor.
      const removedEdges = new Map<string, Set<string>>();
      for (const { path: aPath } of A) {
        if (aPath.length > i && aPath.slice(0, i + 1).join('\0') === rootKey) {
          const v = aPath[i + 1];
          if (!removedEdges.has(spurNode)) removedEdges.set(spurNode, new Set());
          removedEdges.get(spurNode)!.add(v);
        }
      }

      // Nodes to suppress: all root-path nodes except spurNode itself
      const removedNodes = new Set<string>(rootPath.slice(0, -1));

      // Find shortest spur path from spurNode to endId
      const spur = dijkstraWithExclusions(nodes, spurNode, endId, removedNodes, removedEdges);
      if (spur.path.length === 0) continue;

      // Total path = root[0..i-1] + spur[0..end]
      const totalPath = [...rootPath.slice(0, -1), ...spur.path];
      const totalCost = pathCost(totalPath, nodes);
      const key = totalPath.join('\0');

      const inA = A.some((p) => p.path.join('\0') === key);
      const inB = B.some((p) => p.path.join('\0') === key);
      if (!inA && !inB) {
        B.push({ path: totalPath, cost: totalCost });
        B.sort((a, b) => a.cost - b.cost);
      }
    }

    if (B.length === 0) break;
    A.push(B.shift()!);
  }

  return A;
}

/**
 * Compute the total haversine-distance (km) of a path using stored
 * edge weights in the graph (weights are already in km from graph-build time).
 */
export function computePathDistanceKm(
  path: string[],
  nodes: Map<string, GraphNode>,
): number {
  return pathCost(path, nodes);
}
