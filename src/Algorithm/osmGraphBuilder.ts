import type { LatLng, Graph, GraphNode } from './types';
import { haversine } from './graphBuilder';

interface OsmNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
}

interface OsmWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: Array<OsmNode | OsmWay>;
}

const OVERPASS_TIMEOUT_SECONDS = 30;

/** Maximum allowed bounding-box span (degrees) to keep queries fast. */
const MAX_BOX_DEGREES = 0.5;

// ── In-memory graph cache ────────────────────────────────────────────────────
interface CacheEntry {
  graph: Graph;
  south: number;
  north: number;
  west: number;
  east: number;
}

/** Keep up to 8 most-recently-used graphs in memory to avoid repeat Overpass fetches. */
const GRAPH_CACHE_MAX = 8;
const graphCache: CacheEntry[] = [];

function getCachedGraph(s: number, n: number, w: number, e: number): Graph | null {
  for (let i = graphCache.length - 1; i >= 0; i--) {
    const c = graphCache[i];
    // Accept cache hit when requested bbox fits within the cached bbox
    if (s >= c.south && n <= c.north && w >= c.west && e <= c.east) {
      // Move to end (most-recently-used)
      graphCache.push(graphCache.splice(i, 1)[0]);
      return c.graph;
    }
  }
  return null;
}

function setCachedGraph(s: number, n: number, w: number, e: number, graph: Graph): void {
  if (graphCache.length >= GRAPH_CACHE_MAX) {
    graphCache.shift(); // evict least-recently-used
  }
  graphCache.push({ graph, south: s, north: n, west: w, east: e });
}

// ── Background pre-fetch promise ─────────────────────────────────────────────
let _prefetchPromise: Promise<void> | null = null;

/**
 * Pre-fetch the road graph around a single point (called when the start
 * marker is placed so that data is already downloading when the user places
 * the end marker).
 */
export function prefetchAreaAround(center: LatLng, radiusDeg = 0.05): void {
  const s = center.lat - radiusDeg;
  const n = center.lat + radiusDeg;
  const w = center.lng - radiusDeg;
  const e = center.lng + radiusDeg;

  // Skip if the area is already cached
  if (getCachedGraph(s, n, w, e)) return;

  _prefetchPromise = (async () => {
    try {
      await _fetchAndCacheGraph(s, n, w, e);
    } catch {
      // Silently ignore prefetch failures – the main fetch will retry
    } finally {
      _prefetchPromise = null;
    }
  })();
}

async function _fetchAndCacheGraph(
  south: number,
  north: number,
  west: number,
  east: number
): Promise<Graph> {
  // Only fetch major navigable roads to reduce payload size
  const query =
    `[out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];` +
    `(way[highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|living_street|service)$"]` +
    `(${south.toFixed(6)},${west.toFixed(6)},${north.toFixed(6)},${east.toFixed(6)}););(._;>;);out body;`;

  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }
  const data: OverpassResponse = await response.json();

  // Separate nodes and ways
  const osmNodes = new Map<number, OsmNode>();
  const osmWays: OsmWay[] = [];

  for (const el of data.elements) {
    if (el.type === 'node') {
      osmNodes.set(el.id, el as OsmNode);
    } else if (el.type === 'way') {
      osmWays.push(el as OsmWay);
    }
  }

  if (osmNodes.size === 0 || osmWays.length === 0) {
    throw new Error('No road data found in this area. Try zooming in or choosing a different location.');
  }

  // Collect all OSM node IDs that appear in any road way
  const usedNodeIds = new Set<number>();
  for (const way of osmWays) {
    for (const nid of way.nodes) usedNodeIds.add(nid);
  }

  // Create graph nodes
  const nodes = new Map<string, GraphNode>();
  for (const nid of usedNodeIds) {
    const n = osmNodes.get(nid);
    if (!n) continue;
    const id = String(nid);
    nodes.set(id, { id, position: { lat: n.lat, lng: n.lon }, neighbors: [] });
  }

  // Connect consecutive nodes along each way
  for (const way of osmWays) {
    const oneWay =
      way.tags?.oneway === 'yes' ||
      way.tags?.oneway === '1' ||
      way.tags?.junction === 'roundabout';

    for (let i = 0; i < way.nodes.length - 1; i++) {
      const aId = String(way.nodes[i]);
      const bId = String(way.nodes[i + 1]);
      const a = nodes.get(aId);
      const b = nodes.get(bId);
      if (!a || !b) continue;

      const weight = haversine(a.position, b.position);

      if (!a.neighbors.some((nb) => nb.nodeId === bId)) {
        a.neighbors.push({ nodeId: bId, weight });
      }
      if (!oneWay && !b.neighbors.some((nb) => nb.nodeId === aId)) {
        b.neighbors.push({ nodeId: aId, weight });
      }
    }
  }

  // Store with placeholder start/end (snapping happens per-query in buildOsmGraph)
  const graph: Graph = { nodes, startId: '', endId: '' };
  setCachedGraph(south, north, west, east, graph);
  return graph;
}

/**
 * Fetch the road network from OpenStreetMap via the Overpass API and build
 * a Graph that can be consumed by the existing algorithm implementations.
 */
export async function buildOsmGraph(start: LatLng, end: LatLng): Promise<Graph> {
  const minLat = Math.min(start.lat, end.lat);
  const maxLat = Math.max(start.lat, end.lat);
  const minLng = Math.min(start.lng, end.lng);
  const maxLng = Math.max(start.lng, end.lng);

  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;
  const padLat = Math.max(latRange * 0.15, 0.005);
  const padLng = Math.max(lngRange * 0.15, 0.005);

  const south = minLat - padLat;
  const north = maxLat + padLat;
  const west  = minLng - padLng;
  const east  = maxLng + padLng;

  const latSpan = north - south;
  const lngSpan = east - west;
  if (latSpan > MAX_BOX_DEGREES || lngSpan > MAX_BOX_DEGREES) {
    throw new Error(
      `The area between your two points is too large (${latSpan.toFixed(2)}° × ${lngSpan.toFixed(2)}°). ` +
      `Please choose points that are closer together (max ~${MAX_BOX_DEGREES}° apart) to keep loading fast.`
    );
  }

  // Wait for any in-progress prefetch so we can benefit from its cache entry
  if (_prefetchPromise) {
    await _prefetchPromise.catch(() => {});
  }

  // Check cache before hitting the API
  const cached = getCachedGraph(south, north, west, east);
  let graphNodes: Map<string, GraphNode>;
  if (cached) {
    graphNodes = cached.nodes;
  } else {
    const fetched = await _fetchAndCacheGraph(south, north, west, east);
    graphNodes = fetched.nodes;
  }

  // Snap start and end to the nearest road node
  let startId = '';
  let endId = '';
  let minDistStart = Infinity;
  let minDistEnd = Infinity;

  for (const [id, node] of graphNodes) {
    const ds = haversine(node.position, start);
    const de = haversine(node.position, end);
    if (ds < minDistStart) { minDistStart = ds; startId = id; }
    if (de < minDistEnd)   { minDistEnd = de;   endId = id; }
  }

  if (!startId || !endId) {
    throw new Error('Could not snap start or end point to any road node. Try placing markers closer to a road.');
  }

  // Return a new Graph object with the correct startId/endId (nodes are shared)
  return { nodes: graphNodes, startId, endId };
}
