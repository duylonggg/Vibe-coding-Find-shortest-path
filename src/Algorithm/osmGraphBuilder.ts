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

// ── IndexedDB persistent cache ───────────────────────────────────────────────

const IDB_DB_NAME = 'osm-graph-cache';
const IDB_STORE_NAME = 'overpass-responses';
/** Cache TTL: 24 hours */
const IDB_TTL_MS = 24 * 60 * 60 * 1000;
const IDB_VERSION = 1;

interface IDBCacheEntry {
  elements: Array<OsmNode | OsmWay>;
  ts: number;
}

let _idb: IDBDatabase | null = null;

function _openIDB(): Promise<IDBDatabase> {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE_NAME)) {
        req.result.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => { _idb = req.result; resolve(req.result); };
    req.onerror = () => reject(req.error);
  });
}

async function _idbGet(key: string): Promise<IDBCacheEntry | null> {
  try {
    const db = await _openIDB();
    return new Promise((resolve) => {
      const req = db.transaction(IDB_STORE_NAME, 'readonly').objectStore(IDB_STORE_NAME).get(key);
      req.onsuccess = () => {
        const val = req.result as IDBCacheEntry | undefined;
        resolve(!val || Date.now() - val.ts > IDB_TTL_MS ? null : val);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function _idbSet(key: string, elements: Array<OsmNode | OsmWay>): Promise<void> {
  try {
    const db = await _openIDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      tx.objectStore(IDB_STORE_NAME).put({ elements, ts: Date.now() } satisfies IDBCacheEntry, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* silently ignore IDB errors */ }
}

/** Maximum allowed bounding-box span (degrees). ~2° ≈ 220 km. */
const MAX_BOX_DEGREES = 2.0;

// ── Spatial grid index ───────────────────────────────────────────────────────

/** Maximum number of grid rings to search before giving up. */
const SPATIAL_MAX_RINGS = 12;

/**
 * Lightweight 2-D spatial grid that partitions nodes into fixed-size cells,
 * reducing nearest-node lookup from O(n) to roughly O(1) for typical road
 * densities.  A cell size of 0.002° ≈ 200 m is a good default for city roads.
 */
export class SpatialGrid {
  private readonly cells: Map<string, string[]> = new Map();
  private readonly cellSize: number;

  constructor(cellSize = 0.002) {
    this.cellSize = cellSize;
  }

  private key(lat: number, lng: number): string {
    return `${Math.floor(lat / this.cellSize)},${Math.floor(lng / this.cellSize)}`;
  }

  add(id: string, lat: number, lng: number): void {
    const k = this.key(lat, lng);
    let bucket = this.cells.get(k);
    if (!bucket) { bucket = []; this.cells.set(k, bucket); }
    bucket.push(id);
  }

  /**
   * Returns the ID of the node nearest to (lat, lng) using squared planar
   * distance.  Expands search rings and terminates after ring r once the
   * best found squared distance is ≤ (r × cellSize)², guaranteeing that no
   * cell in ring r+1 or beyond can contain a closer node.
   */
  nearestId(lat: number, lng: number, nodes: Map<string, GraphNode>): string {
    const baseRow = Math.floor(lat / this.cellSize);
    const baseCol = Math.floor(lng / this.cellSize);
    let bestId = '';
    let bestDist = Infinity;

    for (let r = 0; r <= SPATIAL_MAX_RINGS; r++) {
      for (let dr = -r; dr <= r; dr++) {
        for (let dc = -r; dc <= r; dc++) {
          // Only visit border cells of the current ring
          if (r > 0 && Math.abs(dr) < r && Math.abs(dc) < r) continue;
          const bucket = this.cells.get(`${baseRow + dr},${baseCol + dc}`);
          if (!bucket) continue;
          for (const id of bucket) {
            const p = nodes.get(id)!.position;
            const d = (p.lat - lat) ** 2 + (p.lng - lng) ** 2;
            if (d < bestDist) { bestDist = d; bestId = id; }
          }
        }
      }
      // After processing ring r: any node in ring r+1 or beyond is at
      // Euclidean distance strictly greater than r × cellSize from the query.
      // If bestDist ≤ (r × cellSize)², no further ring can improve it.
      const bound = r * this.cellSize;
      if (bestId !== '' && bestDist <= bound * bound) break;
    }
    return bestId;
  }
}

/**
 * Choose the Overpass highway filter based on the size of the requested area.
 * Larger areas use only major roads to keep the response payload manageable.
 */
function getRoadTypePattern(latSpan: number, lngSpan: number): string {
  const maxSpan = Math.max(latSpan, lngSpan);
  if (maxSpan > 1.5) {
    // Very large area (~170 km+): major roads only
    return 'motorway|trunk|primary|motorway_link|trunk_link|primary_link';
  } else if (maxSpan > 0.5) {
    // Medium area: major + secondary roads
    return 'motorway|trunk|primary|secondary|motorway_link|trunk_link|primary_link|secondary_link';
  }
  // Small area: all navigable road types
  return 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|living_street|service';
}

/** Timeout (s) scales with the requested area to avoid premature Overpass rejections. */
function getOverpassTimeout(latSpan: number, lngSpan: number): number {
  const maxSpan = Math.max(latSpan, lngSpan);
  if (maxSpan > 1.5) return 90;
  if (maxSpan > 0.5) return 60;
  return 30;
}

// ── In-memory graph cache ────────────────────────────────────────────────────
interface CacheEntry {
  graph: Graph;
  index: SpatialGrid;
  south: number;
  north: number;
  west: number;
  east: number;
}

/** Keep up to 8 most-recently-used graphs in memory to avoid repeat Overpass fetches. */
const GRAPH_CACHE_MAX = 8;
const graphCache: CacheEntry[] = [];

function getCachedEntry(s: number, n: number, w: number, e: number): CacheEntry | null {
  for (let i = graphCache.length - 1; i >= 0; i--) {
    const c = graphCache[i];
    // Accept cache hit when requested bbox fits within the cached bbox
    if (s >= c.south && n <= c.north && w >= c.west && e <= c.east) {
      // Move to end (most-recently-used)
      graphCache.push(graphCache.splice(i, 1)[0]);
      return c;
    }
  }
  return null;
}

function setCachedEntry(s: number, n: number, w: number, e: number, graph: Graph, index: SpatialGrid): void {
  if (graphCache.length >= GRAPH_CACHE_MAX) {
    graphCache.shift(); // evict least-recently-used
  }
  graphCache.push({ graph, index, south: s, north: n, west: w, east: e });
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
  if (getCachedEntry(s, n, w, e)) return;

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
  east: number,
  latSpan?: number,
  lngSpan?: number
): Promise<{ graph: Graph; index: SpatialGrid }> {
  const effectiveLatSpan = latSpan ?? north - south;
  const effectiveLngSpan = lngSpan ?? east - west;
  const roadPattern = getRoadTypePattern(effectiveLatSpan, effectiveLngSpan);
  const timeout = getOverpassTimeout(effectiveLatSpan, effectiveLngSpan);

  // Cache key rounded to ~1 km precision
  const idbKey = `bbox:${south.toFixed(3)},${north.toFixed(3)},${west.toFixed(3)},${east.toFixed(3)}:${roadPattern}`;

  let elements: Array<OsmNode | OsmWay>;

  // ── 1. Try IndexedDB persistent cache first ──────────────────────────────
  const cached = await _idbGet(idbKey);
  if (cached) {
    console.log(`[OSM] bbox IDB cache hit (${cached.elements.length} elements)`);
    elements = cached.elements;
  } else {
    // ── 2. Use optimized Overpass query: ways get full body (tags), nodes
    //    get skeleton only (id + lat/lon, no tags) via `out skel qt`.
    //    This significantly reduces response payload vs the previous
    //    `(._;>;);out body;` pattern.
    const query =
      `[out:json][timeout:${timeout}];` +
      `(way[highway~"^(${roadPattern})$"]` +
      `(${south.toFixed(6)},${west.toFixed(6)},${north.toFixed(6)},${east.toFixed(6)}););` +
      `out body;>;out skel qt;`;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    const t0 = performance.now();
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
    }
    const tFetch = performance.now();
    console.log(`[OSM] bbox fetch: ${(tFetch - t0).toFixed(0)}ms`);

    const data: OverpassResponse = await response.json();
    const tParse = performance.now();
    console.log(`[OSM] bbox parse: ${(tParse - tFetch).toFixed(0)}ms, elements: ${data.elements.length}`);

    elements = data.elements;
    // Persist to IndexedDB asynchronously (do not block graph building)
    _idbSet(idbKey, elements);
  }

  // ── 3. Separate nodes and ways ───────────────────────────────────────────
  const osmNodes = new Map<number, OsmNode>();
  const osmWays: OsmWay[] = [];

  for (const el of elements) {
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

  // ── 4. Build graph ───────────────────────────────────────────────────────
  const tBuildStart = performance.now();

  // Create graph nodes
  const nodes = new Map<string, GraphNode>();
  for (const nid of usedNodeIds) {
    const n = osmNodes.get(nid);
    if (!n) continue;
    const id = String(nid);
    nodes.set(id, { id, position: { lat: n.lat, lng: n.lon }, neighbors: [] });
  }

  // Track added edges in a Set to avoid O(degree) duplicate scans per insertion
  const edgeSet = new Set<string>();

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

      const keyAB = `${aId}→${bId}`;
      if (!edgeSet.has(keyAB)) {
        edgeSet.add(keyAB);
        a.neighbors.push({ nodeId: bId, weight });
      }
      if (!oneWay) {
        const keyBA = `${bId}→${aId}`;
        if (!edgeSet.has(keyBA)) {
          edgeSet.add(keyBA);
          b.neighbors.push({ nodeId: aId, weight });
        }
      }
    }
  }

  const tBuildEnd = performance.now();
  console.log(`[OSM] bbox build: ${(tBuildEnd - tBuildStart).toFixed(0)}ms, nodes: ${nodes.size}, ways: ${osmWays.length}`);

  // Store with placeholder start/end (snapping happens per-query in buildOsmGraph)
  const graph: Graph = { nodes, startId: '', endId: '' };
  // Build spatial index for fast nearest-node lookup
  const index = new SpatialGrid();
  for (const [id, node] of nodes) {
    index.add(id, node.position.lat, node.position.lng);
  }
  setCachedEntry(south, north, west, east, graph, index);
  return { graph, index };
}

// ── Corridor width constants ─────────────────────────────────────────────────

/** Corridor half-width (metres) for long routes (> 100 km straight-line). */
const CORRIDOR_WIDTH_LONG_M  = 5000;
/** Corridor half-width (metres) for medium routes (20–100 km). */
const CORRIDOR_WIDTH_MED_M   = 3000;
/** Corridor half-width (metres) for short routes (< 20 km). */
const CORRIDOR_WIDTH_SHORT_M = 1500;
/** Distance threshold (km) between short and medium corridor widths. */
const CORRIDOR_THRESH_SHORT_KM = 20;
/** Distance threshold (km) between medium and long corridor widths. */
const CORRIDOR_THRESH_LONG_KM  = 100;

// ── Shared graph-building helper ─────────────────────────────────────────────

/**
 * Parse an OverpassResponse into a Graph + SpatialGrid without caching.
 * Shared between the bbox and corridor fetch paths.
 */
function _parseOverpassResponse(
  data: OverpassResponse,
  noDataError: string
): { graph: Graph; index: SpatialGrid } {
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
    throw new Error(noDataError);
  }

  const usedNodeIds = new Set<number>();
  for (const way of osmWays) {
    for (const nid of way.nodes) usedNodeIds.add(nid);
  }

  const nodes = new Map<string, GraphNode>();
  for (const nid of usedNodeIds) {
    const n = osmNodes.get(nid);
    if (!n) continue;
    const id = String(nid);
    nodes.set(id, { id, position: { lat: n.lat, lng: n.lon }, neighbors: [] });
  }

  const edgeSet = new Set<string>();
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

      const keyAB = `${aId}→${bId}`;
      if (!edgeSet.has(keyAB)) {
        edgeSet.add(keyAB);
        a.neighbors.push({ nodeId: bId, weight });
      }
      if (!oneWay) {
        const keyBA = `${bId}→${aId}`;
        if (!edgeSet.has(keyBA)) {
          edgeSet.add(keyBA);
          b.neighbors.push({ nodeId: aId, weight });
        }
      }
    }
  }

  const graph: Graph = { nodes, startId: '', endId: '' };
  const index = new SpatialGrid();
  for (const [id, node] of nodes) {
    index.add(id, node.position.lat, node.position.lng);
  }
  return { graph, index };
}

/**
 * Fetch road data along a corridor (Overpass `around` polyline) between start
 * and end, then build and return a ready-to-use Graph.
 *
 * Unlike the bounding-box approach, this works for long-distance routes because
 * it only loads roads within a narrow strip around the direct line, rather than
 * filling an entire rectangular area.
 */
export async function buildOsmGraphCorridor(start: LatLng, end: LatLng): Promise<Graph> {
  const latSpan = Math.abs(end.lat - start.lat) || 0.01;
  const lngSpan = Math.abs(end.lng - start.lng) || 0.01;
  const roadPattern = getRoadTypePattern(latSpan, lngSpan);
  const timeout = getOverpassTimeout(latSpan, lngSpan);

  // Corridor half-width scales with distance to allow realistic detours.
  const distKm = haversine(start, end);
  const corridorMeters =
    distKm > CORRIDOR_THRESH_LONG_KM  ? CORRIDOR_WIDTH_LONG_M  :
    distKm > CORRIDOR_THRESH_SHORT_KM ? CORRIDOR_WIDTH_MED_M   :
                                        CORRIDOR_WIDTH_SHORT_M;

  // Benefit from any already-in-progress prefetch before firing the main request
  if (_prefetchPromise) {
    await _prefetchPromise.catch(() => {});
  }

  // ── 1. Try IndexedDB persistent cache first ──────────────────────────────
  const idbKey = `corridor:${start.lat.toFixed(3)},${start.lng.toFixed(3)},${end.lat.toFixed(3)},${end.lng.toFixed(3)}:${corridorMeters}:${roadPattern}`;
  const cachedIDB = await _idbGet(idbKey);

  let data: OverpassResponse;
  if (cachedIDB) {
    console.log(`[OSM] corridor IDB cache hit (${cachedIDB.elements.length} elements)`);
    data = { elements: cachedIDB.elements };
  } else {
    // ── 2. Use optimized Overpass query: ways get full body (tags), nodes
    //    get skeleton only (id + lat/lon, no tags) via `out skel qt`.
    const query =
      `[out:json][timeout:${timeout}];` +
      `(way[highway~"^(${roadPattern})$"]` +
      `(around:${corridorMeters},${start.lat},${start.lng},${end.lat},${end.lng}););` +
      `out body;>;out skel qt;`;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    const t0 = performance.now();
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
    }
    const tFetch = performance.now();
    console.log(`[OSM] corridor fetch: ${(tFetch - t0).toFixed(0)}ms, dist: ${distKm.toFixed(1)}km, width: ${corridorMeters}m`);

    data = await response.json();
    const tParse = performance.now();
    console.log(`[OSM] corridor parse: ${(tParse - tFetch).toFixed(0)}ms, elements: ${data.elements.length}`);

    // Persist to IndexedDB asynchronously
    _idbSet(idbKey, data.elements);
  }

  const tBuildStart = performance.now();
  const { graph, index } = _parseOverpassResponse(
    data,
    'No road data found along the corridor. Try choosing different points or switching to Radius mode.'
  );
  console.log(`[OSM] corridor build: ${(performance.now() - tBuildStart).toFixed(0)}ms, nodes: ${graph.nodes.size}`);

  const startId = index.nearestId(start.lat, start.lng, graph.nodes);
  const endId   = index.nearestId(end.lat,   end.lng,   graph.nodes);

  if (!startId || !endId) {
    throw new Error('Could not snap start or end point to any road node. Try placing markers closer to a road.');
  }

  return { nodes: graph.nodes, startId, endId };
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
  const cachedEntry = getCachedEntry(south, north, west, east);
  let graphNodes: Map<string, GraphNode>;
  let spatialIndex: SpatialGrid;

  if (cachedEntry) {
    graphNodes = cachedEntry.graph.nodes;
    spatialIndex = cachedEntry.index;
  } else {
    const fetched = await _fetchAndCacheGraph(south, north, west, east, latSpan, lngSpan);
    graphNodes = fetched.graph.nodes;
    spatialIndex = fetched.index;
  }

  // Snap start and end to the nearest road node using the spatial index.
  const startId = spatialIndex.nearestId(start.lat, start.lng, graphNodes);
  const endId   = spatialIndex.nearestId(end.lat,   end.lng,   graphNodes);

  if (!startId || !endId) {
    throw new Error('Could not snap start or end point to any road node. Try placing markers closer to a road.');
  }

  // Return a new Graph object with the correct startId/endId (nodes are shared)
  return { nodes: graphNodes, startId, endId };
}
