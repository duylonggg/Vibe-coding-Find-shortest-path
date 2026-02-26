import type { Graph, AlgorithmResult } from './types';

interface Edge { to: string; weight: number; }

/**
 * Hop-limited Dijkstra used as witness search during contraction.
 * Returns the shortest distance from `src` to `target` without passing through `skip`,
 * exploring at most `maxNodes` settled nodes and paths no longer than `maxCost`.
 */
function witnessSearch(
  adj: Map<string, Edge[]>,
  src: string,
  target: string,
  skip: string,
  maxCost: number,
  maxNodes = 50
): number {
  const dist = new Map<string, number>();
  dist.set(src, 0);
  const pq: { id: string; cost: number }[] = [{ id: src, cost: 0 }];
  const visited = new Set<string>();

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const { id: cur, cost } = pq.shift()!;
    if (visited.has(cur)) continue;
    if (cost > maxCost) break;
    visited.add(cur);
    if (cur === target) return cost;
    if (visited.size >= maxNodes) break;

    for (const { to, weight } of adj.get(cur) ?? []) {
      if (to === skip || visited.has(to)) continue;
      const nd = cost + weight;
      if (nd <= maxCost && nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        pq.push({ id: to, cost: nd });
      }
    }
  }
  return dist.get(target) ?? Infinity;
}

/**
 * Contraction Hierarchies (CH).
 *
 * Preprocessing (contraction):
 *   1. Order nodes by importance (approximated here by total degree).
 *   2. Contract each node v in order:
 *      – For every pair of remaining neighbours (u, w), run a witness search.
 *      – If no alternative path u → w exists (ignoring v), add a shortcut u→w.
 *   3. Build a directed "upward graph": every edge (u → v) with level(v) > level(u).
 *
 * Query:
 *   Bidirectional Dijkstra that only relaxes upward edges (forward from s, backward
 *   from t).  The meeting node with the lowest combined distance is on the optimal path.
 */
export function ch(graph: Graph): AlgorithmResult {
  const { nodes, startId, endId } = graph;
  const exploredOrder: string[] = [];
  const allIds = Array.from(nodes.keys());

  // ── Build mutable adjacency lists ────────────────────────────────────────────
  const fwdAdj = new Map<string, Edge[]>();
  const revAdj = new Map<string, Edge[]>();
  for (const id of allIds) { fwdAdj.set(id, []); revAdj.set(id, []); }
  for (const [id, node] of nodes) {
    for (const { nodeId, weight } of node.neighbors) {
      fwdAdj.get(id)!.push({ to: nodeId, weight });
      revAdj.get(nodeId)!.push({ to: id, weight });
    }
  }

  // ── Node ordering: sort by total degree (low degree = less important) ────────
  const order = [...allIds].sort((a, b) => {
    const da = (fwdAdj.get(a)?.length ?? 0) + (revAdj.get(a)?.length ?? 0);
    const db = (fwdAdj.get(b)?.length ?? 0) + (revAdj.get(b)?.length ?? 0);
    return da - db;
  });
  const level = new Map<string, number>();
  order.forEach((id, i) => level.set(id, i));

  // ── Contraction: add shortcut edges ─────────────────────────────────────────
  const contracted = new Set<string>();

  for (const v of order) {
    contracted.add(v);
    const inEdges  = (revAdj.get(v) ?? []).filter(e => !contracted.has(e.to));
    const outEdges = (fwdAdj.get(v) ?? []).filter(e => !contracted.has(e.to));

    for (const { to: u, weight: wu } of inEdges) {
      for (const { to: w, weight: wv } of outEdges) {
        if (u === w) continue;
        const scCost = wu + wv;
        // Only witness-search up to the shortcut cost
        const witness = witnessSearch(fwdAdj, u, w, v, scCost);
        if (witness > scCost) {
          fwdAdj.get(u)!.push({ to: w, weight: scCost });
          revAdj.get(w)!.push({ to: u, weight: scCost });
        }
      }
    }
  }

  // ── Build upward / downward CH edge sets ─────────────────────────────────────
  const upEdges   = new Map<string, Edge[]>();
  const downEdges = new Map<string, Edge[]>();
  for (const id of allIds) { upEdges.set(id, []); downEdges.set(id, []); }

  for (const [u, edges] of fwdAdj) {
    const lu = level.get(u)!;
    for (const { to: w, weight } of edges) {
      const lw = level.get(w)!;
      if (lw > lu) {
        upEdges.get(u)!.push({ to: w, weight });
        downEdges.get(w)!.push({ to: u, weight });
      }
    }
  }

  // ── Bidirectional Dijkstra on CH ─────────────────────────────────────────────
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

  while (pqF.length > 0 || pqB.length > 0) {
    // Forward step: relax upward edges from start
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

    // Backward step: relax downward edges (reversed = upward) from end
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
