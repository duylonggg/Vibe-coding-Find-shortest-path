import type { LatLng, Graph, GraphNode } from './types';

/** Haversine distance in km between two lat/lng points */
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

/** Build a gridSize×gridSize graph over the bounding box of start/end with 20% padding */
export function buildGraph(
  start: LatLng,
  end: LatLng,
  gridSize: number = 20
): Graph {
  const padding = 0.2;
  const minLat = Math.min(start.lat, end.lat);
  const maxLat = Math.max(start.lat, end.lat);
  const minLng = Math.min(start.lng, end.lng);
  const maxLng = Math.max(start.lng, end.lng);

  const latRange = (maxLat - minLat) || 1;
  const lngRange = (maxLng - minLng) || 1;

  const padLat = latRange * padding;
  const padLng = lngRange * padding;

  const gMinLat = minLat - padLat;
  const gMaxLat = maxLat + padLat;
  const gMinLng = minLng - padLng;
  const gMaxLng = maxLng + padLng;

  const nodes = new Map<string, GraphNode>();

  // Create grid nodes
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const lat = gMinLat + (row / (gridSize - 1)) * (gMaxLat - gMinLat);
      const lng = gMinLng + (col / (gridSize - 1)) * (gMaxLng - gMinLng);
      const id = `${row}_${col}`;
      nodes.set(id, { id, position: { lat, lng }, neighbors: [] });
    }
  }

  // Connect 8-directional neighbors
  const dirs = [
    [-1, -1], [-1, 0], [-1, 1],
    [0,  -1],          [0,  1],
    [1,  -1], [1,  0], [1,  1],
  ];

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const node = nodes.get(`${row}_${col}`)!;
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
          const neighbor = nodes.get(`${nr}_${nc}`)!;
          const weight = haversine(node.position, neighbor.position);
          node.neighbors.push({ nodeId: neighbor.id, weight });
        }
      }
    }
  }

  // Find nearest grid node to start and end
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

  return { nodes, startId, endId };
}
