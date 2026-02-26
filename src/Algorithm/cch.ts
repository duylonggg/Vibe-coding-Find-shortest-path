import type { Graph, AlgorithmResult } from './types';

interface Edge { to: string; weight: number; }

/**
 * Customizable Contraction Hierarchies (CCH).
 *
 * CCH separates the problem into three phases, making it efficient for
 * scenarios where edge weights change frequently (e.g. real-time traffic):
 *
 * Phase 1 – Ordering (topology-only, weight-independent):
 *   Assign each node a rank using a BFS-based ordering.  Only graph
 *   structure matters here; edge weights are completely ignored.
 *
 * Phase 2 – Customization (weight-dependent, fast):
 *   Initialize CCH edge weights from the original graph and propagate them
 *   through "upward triangles":
 *     for each node v (low → high rank):
 *       for each pair of higher-ranked CCH neighbours (u1, u2):
 *         w(u1, u2) = min(w(u1, u2),  w(u1, v) + w(v, u2))
 *   This step can be re-run cheaply whenever weights change without
 *   rebuilding the CH order or shortcut topology.
 *
 * Phase 3 – Query:
 *   Bidirectional Dijkstra restricted to upward CCH edges (from s) and
 *   downward CCH edges traversed in reverse (from t).
 */
export function cch(graph: Graph): AlgorithmResult {
  const { nodes, startId, endId } = graph;
  const exploredOrder: string[] = [];
  const allIds = Array.from(nodes.keys());

  // ── Phase 1: Topology-based ordering (BFS from startId) ─────────────────────
  // Build an undirected adjacency list (topology only, no weights).
  const topoAdj = new Map<string, string[]>();
  for (const id of allIds) topoAdj.set(id, []);
  for (const [id, node] of nodes) {
    for (const { nodeId } of node.neighbors) {
      topoAdj.get(id)!.push(nodeId);
      if (!topoAdj.get(nodeId)!.includes(id)) topoAdj.get(nodeId)!.push(id);
    }
  }

  const rank = new Map<string, number>();
  {
    const visited = new Set<string>();
    const queue: string[] = [startId];
    visited.add(startId);
    let r = 0;
    while (queue.length > 0) {
      const cur = queue.shift()!;
      rank.set(cur, r++);
      for (const nb of topoAdj.get(cur) ?? []) {
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
      }
    }
    // Assign ranks to any disconnected nodes.
    for (const id of allIds) { if (!rank.has(id)) rank.set(id, r++); }
  }

  // Nodes sorted by ascending rank (low rank contracted first).
  const order = [...allIds].sort((a, b) => rank.get(a)! - rank.get(b)!);

  // ── Phase 2: Customization ───────────────────────────────────────────────────
  // Each CCH edge (u → v) with rank(u) < rank(v) stores the current best weight.
  // upW[u][v]   = weight of the upward CCH edge u → v  (rank(v) > rank(u))
  // downW[v][u] = same weight, accessible from the higher-rank node v for queries
  const upW   = new Map<string, Map<string, number>>();
  const downW = new Map<string, Map<string, number>>();
  for (const id of allIds) { upW.set(id, new Map()); downW.set(id, new Map()); }

  // Seed CCH edges from the original directed graph.
  for (const [id, node] of nodes) {
    for (const { nodeId, weight } of node.neighbors) {
      const rA = rank.get(id)!;
      const rB = rank.get(nodeId)!;
      const [lo, hi, w] = rA < rB ? [id, nodeId, weight] : [nodeId, id, weight];
      const existing = upW.get(lo)!.get(hi);
      if (existing === undefined || weight < existing) {
        upW.get(lo)!.set(hi, w);
        downW.get(hi)!.set(lo, w);
      }
    }
  }

  // Triangle relaxation: process nodes from low → high rank.
  // For each v, collect all higher-ranked CCH neighbours; relax pairwise edges.
  for (const v of order) {
    const rV = rank.get(v)!;

    // Higher-ranked CCH neighbours of v (stored in upW[v]).
    const hi: { id: string; w: number }[] = [];
    for (const [u, wU] of upW.get(v)!) {
      if (rank.get(u)! > rV) hi.push({ id: u, w: wU });
    }

    // Also collect lower-ranked nodes whose upW points to v (i.e. v is their
    // higher-ranked neighbour).  Those contribute to upward triangles via v.
    for (let i = 0; i < hi.length; i++) {
      for (let j = i + 1; j < hi.length; j++) {
        const { id: u1, w: w1 } = hi[i];
        const { id: u2, w: w2 } = hi[j];
        const r1 = rank.get(u1)!;
        const r2 = rank.get(u2)!;
        const [lo2, hi2, wLo, wHi] =
          r1 < r2 ? [u1, u2, w1, w2] : [u2, u1, w2, w1];

        // Relax the (lo2 → hi2) edge via path lo2 → v → hi2.
        const via = wLo + wHi;
        if (via < (upW.get(lo2)!.get(hi2) ?? Infinity)) {
          upW.get(lo2)!.set(hi2, via);
          downW.get(hi2)!.set(lo2, via);
        }
      }
    }
  }

  // ── Phase 3: Bidirectional Dijkstra on CCH ───────────────────────────────────
  const distF = new Map<string, number>();
  const distB = new Map<string, number>();
  const parentF = new Map<string, string | null>();
  const parentB = new Map<string, string | null>();
  const visitedF = new Set<string>();
  const visitedB = new Set<string>();

  for (const id of allIds) { distF.set(id, Infinity); distB.set(id, Infinity); }
  distF.set(startId, 0);
  distB.set(endId, 0);
  parentF.set(startId, null);
  parentB.set(endId, null);

  const pqF: { id: string; cost: number }[] = [{ id: startId, cost: 0 }];
  const pqB: { id: string; cost: number }[] = [{ id: endId, cost: 0 }];

  let bestDist = Infinity;
  let meetingNode: string | null = null;

  // Build a flat edge list for the query.
  const upEdges   = new Map<string, Edge[]>();
  const downEdges = new Map<string, Edge[]>();
  for (const id of allIds) { upEdges.set(id, []); downEdges.set(id, []); }
  for (const [lo, neighbours] of upW) {
    for (const [hi, w] of neighbours) {
      if (w < Infinity) {
        upEdges.get(lo)!.push({ to: hi, weight: w });
        downEdges.get(hi)!.push({ to: lo, weight: w });
      }
    }
  }

  while (pqF.length > 0 || pqB.length > 0) {
    // Forward: relax upward CCH edges from s
    if (pqF.length > 0) {
      pqF.sort((a, b) => a.cost - b.cost);
      const { id: cur, cost } = pqF.shift()!;
      if (!visitedF.has(cur) && cost <= bestDist) {
        visitedF.add(cur);
        exploredOrder.push(cur);
        const total = cost + (distB.get(cur) ?? Infinity);
        if (total < bestDist) { bestDist = total; meetingNode = cur; }
        for (const { to, weight } of upEdges.get(cur) ?? []) {
          if (visitedF.has(to)) continue;
          const nd = cost + weight;
          if (nd < (distF.get(to) ?? Infinity)) {
            distF.set(to, nd);
            parentF.set(to, cur);
            pqF.push({ id: to, cost: nd });
          }
        }
      }
    }

    // Backward: relax downward CCH edges (reversed = upward) from t
    if (pqB.length > 0) {
      pqB.sort((a, b) => a.cost - b.cost);
      const { id: cur, cost } = pqB.shift()!;
      if (!visitedB.has(cur) && cost <= bestDist) {
        visitedB.add(cur);
        exploredOrder.push(cur);
        const total = (distF.get(cur) ?? Infinity) + cost;
        if (total < bestDist) { bestDist = total; meetingNode = cur; }
        for (const { to, weight } of downEdges.get(cur) ?? []) {
          if (visitedB.has(to)) continue;
          const nd = cost + weight;
          if (nd < (distB.get(to) ?? Infinity)) {
            distB.set(to, nd);
            parentB.set(to, cur);
            pqB.push({ id: to, cost: nd });
          }
        }
      }
    }
  }

  // ── Path reconstruction through meeting node ─────────────────────────────────
  const path: string[] = [];
  if (meetingNode) {
    const fwd: string[] = [];
    let cur: string | null = meetingNode;
    while (cur !== null) { fwd.unshift(cur); cur = parentF.get(cur) ?? null; }
    const bwd: string[] = [];
    let b: string | null = parentB.get(meetingNode) ?? null;
    while (b !== null) { bwd.push(b); b = parentB.get(b) ?? null; }
    path.push(...fwd, ...bwd);
  }

  return { exploredOrder, path };
}
