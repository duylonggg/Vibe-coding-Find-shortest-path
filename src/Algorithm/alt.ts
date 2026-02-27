import type { Graph, AlgorithmResult } from './types';
import { haversine } from './graphBuilder';
import { MinHeap } from './minHeap';

/** Run single-source Dijkstra from `sourceId`, returning distances to all nodes. */
function singleSourceDijkstra(nodes: Graph['nodes'], sourceId: string): Map<string, number> {
  const dist = new Map<string, number>();
  for (const id of nodes.keys()) dist.set(id, Infinity);
  dist.set(sourceId, 0);
  const visited = new Set<string>();
  const pq = new MinHeap();
  pq.push(sourceId, 0);

  while (pq.size > 0) {
    const { id: cur } = pq.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const { nodeId, weight } of nodes.get(cur)!.neighbors) {
      if (visited.has(nodeId)) continue;
      const nd = dist.get(cur)! + weight;
      if (nd < dist.get(nodeId)!) {
        dist.set(nodeId, nd);
        pq.push(nodeId, nd);
      }
    }
  }
  return dist;
}

/**
 * ALT Algorithm – A* with Landmarks and Triangle-inequality heuristic.
 *
 * Preprocessing:
 *   1. Select k landmark nodes spread at geographic extremes of the graph.
 *   2. Run single-source Dijkstra from every landmark to obtain d(L, v) for all v.
 *
 * Heuristic (admissible lower bound):
 *   For each landmark L:
 *     h_L(v) = d(L, t) − d(L, v)   (triangle inequality: d(v,t) ≥ d(L,t) − d(L,v))
 *   h(v) = max(haversine(v, t), max_L h_L(v))
 *
 * Query: A* with the improved heuristic h(v).
 */
export function alt(graph: Graph): AlgorithmResult {
  const { nodes, startId, endId } = graph;
  const exploredOrder: string[] = [];
  const allIds = Array.from(nodes.keys());

  // ── Landmark selection: 4 geographically extreme nodes ──────────────────────
  const byLat = [...allIds].sort(
    (a, b) => nodes.get(a)!.position.lat - nodes.get(b)!.position.lat
  );
  const byLng = [...allIds].sort(
    (a, b) => nodes.get(a)!.position.lng - nodes.get(b)!.position.lng
  );
  const landmarks = [
    ...new Set([byLat[0], byLat[byLat.length - 1], byLng[0], byLng[byLng.length - 1]]),
  ];

  // ── Preprocessing: Dijkstra from every landmark ──────────────────────────────
  const lmDists = landmarks.map((lm) => singleSourceDijkstra(nodes, lm));

  const endPos = nodes.get(endId)!.position;

  // ── ALT heuristic ────────────────────────────────────────────────────────────
  function h(id: string): number {
    let bound = haversine(nodes.get(id)!.position, endPos);
    for (const dists of lmDists) {
      const dLT = dists.get(endId) ?? Infinity;
      const dLV = dists.get(id) ?? Infinity;
      if (dLT < Infinity && dLV < Infinity) {
        // Triangle inequality: d(v,t) ≥ d(L,t) − d(L,v)
        bound = Math.max(bound, dLT - dLV);
      }
    }
    return Math.max(0, bound);
  }

  // ── A* with ALT heuristic ────────────────────────────────────────────────────
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const id of nodes.keys()) {
    gScore.set(id, Infinity);
    fScore.set(id, Infinity);
  }
  gScore.set(startId, 0);
  const startF = h(startId);
  fScore.set(startId, startF);
  parent.set(startId, null);

  const open = new MinHeap();
  open.push(startId, startF);

  while (open.size > 0) {
    const { id: cur } = open.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    exploredOrder.push(cur);
    if (cur === endId) break;

    for (const { nodeId, weight } of nodes.get(cur)!.neighbors) {
      if (visited.has(nodeId)) continue;
      const tg = gScore.get(cur)! + weight;
      if (tg < gScore.get(nodeId)!) {
        gScore.set(nodeId, tg);
        const f = tg + h(nodeId);
        fScore.set(nodeId, f);
        parent.set(nodeId, cur);
        open.push(nodeId, f);
      }
    }
  }

  // ── Path reconstruction ──────────────────────────────────────────────────────
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
