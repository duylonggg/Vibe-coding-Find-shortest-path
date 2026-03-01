import { buildOsmGraph, buildOsmGraphCorridor, prefetchAreaAround } from './osmGraphBuilder';
import { haversine } from './graphBuilder';
import type { LatLng, AlgorithmResult } from './types';
import { bfs } from './bfs';
import { dijkstra } from './dijkstra';
import { bidirectionalBfs } from './bidirectionalBfs';
import { aStar } from './aStar';
import { alt } from './alt';
import { ch } from './ch';
import { cch } from './cch';
import { yenKShortestPaths, computePathDistanceKm } from './yenKSP';

/** Straight-line distance (km) above which the auto mode switches to corridor loading.
 *  Lowered from 222 km to 30 km: corridor-based fetching fetches only roads within a
 *  narrow strip around the route line, dramatically cutting Overpass payload for
 *  medium and long routes compared to the full bounding-box approach. */
const AUTO_CORRIDOR_THRESHOLD_KM = 30;

// Minimal interface for the DedicatedWorkerGlobalScope APIs we use, avoiding
// a full `/// <reference lib="webworker" />` which conflicts with the DOM lib.
interface WorkerContext {
  onmessage: ((e: MessageEvent<InMessage>) => void) | null;
  postMessage(data: OutMessage): void;
}

type InMessage =
  | { type: 'prefetch'; center: LatLng }
  | { type: 'run'; start: LatLng; end: LatLng; algorithm: string; loadMode?: 'radius' | 'corridor' | 'auto' };

type OutMessage =
  | { type: 'status'; message: string }
  | { type: 'result'; exploredOrder: string[]; path: string[]; paths: string[][]; distances: number[]; nodePositions: Record<string, LatLng> }
  | { type: 'error'; message: string };

const ctx = self as unknown as WorkerContext;

ctx.onmessage = async (e: MessageEvent<InMessage>) => {
  const msg = e.data;

  if (msg.type === 'prefetch') {
    prefetchAreaAround(msg.center);
    return;
  }

  if (msg.type === 'run') {
    const { start, end, algorithm, loadMode } = msg;
    try {
      ctx.postMessage({ type: 'status', message: 'Loading road network…' });

      const distKm = haversine(start, end);
      const useCorridorMode = loadMode === 'corridor' || (loadMode === 'auto' && distKm > AUTO_CORRIDOR_THRESHOLD_KM);
      console.log(`[worker] dist=${distKm.toFixed(1)}km, mode=${loadMode}, corridor=${useCorridorMode}`);

      const tNet0 = performance.now();
      const graph = useCorridorMode
        ? await buildOsmGraphCorridor(start, end)
        : await buildOsmGraph(start, end);
      const tNet1 = performance.now();
      console.log(`[worker] graph ready in ${(tNet1 - tNet0).toFixed(0)}ms, nodes: ${graph.nodes.size}`);

      ctx.postMessage({ type: 'status', message: `Road network loaded (${graph.nodes.size} nodes). Running algorithm…` });

      const tAlgo0 = performance.now();
      let res: AlgorithmResult;
      switch (algorithm) {
        case 'bfs':              res = bfs(graph); break;
        case 'dijkstra':         res = dijkstra(graph); break;
        case 'bidirectionalBfs': res = bidirectionalBfs(graph); break;
        case 'aStar':            res = aStar(graph); break;
        case 'alt':              res = alt(graph); break;
        case 'ch':               res = ch(graph); break;
        case 'cch':              res = cch(graph); break;
        default:                 res = aStar(graph);
      }
      const tAlgo1 = performance.now();
      console.log(`[worker] algorithm ${algorithm} finished in ${(tAlgo1 - tAlgo0).toFixed(0)}ms, explored: ${res.exploredOrder.length}, path: ${res.path.length}`);

      // ── K=3 shortest paths via Yen's algorithm ──────────────────────────
      ctx.postMessage({ type: 'status', message: 'Computing alternative routes…' });
      const tYen0 = performance.now();
      const kPaths = yenKShortestPaths(graph, 3);
      const tYen1 = performance.now();
      console.log(`[worker] Yen K=3 in ${(tYen1 - tYen0).toFixed(0)}ms, found ${kPaths.length} paths`);

      const paths    = kPaths.map((p) => p.path);
      const distances = kPaths.map((p) => computePathDistanceKm(p.path, graph.nodes));

      // Serialize only the node positions needed for rendering – explored nodes
      // and all path nodes – keeping the full graph out of React state.
      const neededIds = new Set([...res.exploredOrder, ...paths.flat()]);
      const nodePositions: Record<string, LatLng> = {};
      for (const id of neededIds) {
        const node = graph.nodes.get(id);
        if (node) nodePositions[id] = node.position;
      }

      // Primary path for backward-compatible `path` field
      const primaryPath = paths.length > 0 ? paths[0] : res.path;

      ctx.postMessage({
        type: 'result',
        exploredOrder: res.exploredOrder,
        path: primaryPath,
        paths,
        distances,
        nodePositions,
      });
    } catch (err) {
      ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : 'Failed to fetch road data.' });
    }
  }
};
