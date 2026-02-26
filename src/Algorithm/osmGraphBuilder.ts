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

  const south = (minLat - padLat).toFixed(6);
  const north = (maxLat + padLat).toFixed(6);
  const west  = (minLng - padLng).toFixed(6);
  const east  = (maxLng + padLng).toFixed(6);

  const latSpan = parseFloat(north) - parseFloat(south);
  const lngSpan = parseFloat(east) - parseFloat(west);
  if (latSpan > MAX_BOX_DEGREES || lngSpan > MAX_BOX_DEGREES) {
    throw new Error(
      `The area between your two points is too large (${latSpan.toFixed(2)}° × ${lngSpan.toFixed(2)}°). ` +
      `Please choose points that are closer together (max ~${MAX_BOX_DEGREES}° apart) to keep loading fast.`
    );
  }

  const query = `[out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];(way[highway](${south},${west},${north},${east}););(._;>;);out body;`;
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

  // Snap start and end to the nearest road node
  let startId = '';
  let endId = '';
  let minDistStart = Infinity;
  let minDistEnd = Infinity;

  for (const [id, node] of nodes) {
    const ds = haversine(node.position, start);
    const de = haversine(node.position, end);
    if (ds < minDistStart) { minDistStart = ds; startId = id; }
    if (de < minDistEnd)   { minDistEnd = de;   endId = id; }
  }

  if (!startId || !endId) {
    throw new Error('Could not snap start or end point to any road node. Try placing markers closer to a road.');
  }

  return { nodes, startId, endId };
}
