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
  // Only fetch the road types appropriate for this area size
  const query =
    `[out:json][timeout:${timeout}];` +
    `(way[highway~"^(${roadPattern})$"]` +
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
