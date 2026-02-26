export interface LatLng {
  lat: number;
  lng: number;
}

export interface GraphNode {
  id: string;
  position: LatLng;
  neighbors: { nodeId: string; weight: number }[];
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  startId: string;
  endId: string;
}

export interface AlgorithmResult {
  exploredOrder: string[];   // node IDs in order of exploration
  path: string[];            // node IDs forming the shortest path (empty if no path)
}
