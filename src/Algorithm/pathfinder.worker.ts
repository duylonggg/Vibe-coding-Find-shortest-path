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

/** Straight-line distance (km) above which the auto mode switches to corridor loading. */
const AUTO_CORRIDOR_THRESHOLD_KM = 222;

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
  | { type: 'result'; exploredOrder: string[]; path: string[]; nodePositions: Record<string, LatLng> }
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

      const graph = loadMode === 'corridor' || (loadMode === 'auto' && haversine(start, end) > AUTO_CORRIDOR_THRESHOLD_KM)
        ? await buildOsmGraphCorridor(start, end)
        : await buildOsmGraph(start, end);
      ctx.postMessage({ type: 'status', message: `Road network loaded (${graph.nodes.size} nodes). Running algorithm…` });

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

      // Serialize only the node positions needed for rendering – nodes in
      // exploredOrder and path – keeping the full graph out of React state.
      const neededIds = new Set([...res.exploredOrder, ...res.path]);
      const nodePositions: Record<string, LatLng> = {};
      for (const id of neededIds) {
        const node = graph.nodes.get(id);
        if (node) nodePositions[id] = node.position;
      }

      ctx.postMessage({ type: 'result', exploredOrder: res.exploredOrder, path: res.path, nodePositions });
    } catch (err) {
      ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : 'Failed to fetch road data.' });
    }
  }
};
