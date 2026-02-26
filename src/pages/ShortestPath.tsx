import React, { useState, useEffect, useMemo } from 'react';
import MapView from '../components/MapView';
import SearchBar from '../components/SearchBar';
import Sidebar from '../components/Sidebar';
import type { AlgorithmType } from '../components/Sidebar';
import ProgressSlider from '../components/ProgressSlider';
import type { LatLng, AlgorithmResult, Graph } from '../Algorithm/types';
import { buildOsmGraph } from '../Algorithm/osmGraphBuilder';
import { bfs } from '../Algorithm/bfs';
import { dijkstra } from '../Algorithm/dijkstra';
import { bidirectionalBfs } from '../Algorithm/bidirectionalBfs';
import { aStar } from '../Algorithm/aStar';

const DEFAULT_CENTER: LatLng = { lat: 20, lng: 0 };
const DEFAULT_ZOOM = 3;

const ShortestPath: React.FC = () => {
  const [startPos, setStartPos] = useState<LatLng | null>(null);
  const [endPos, setEndPos] = useState<LatLng | null>(null);
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('aStar');
  const [result, setResult] = useState<AlgorithmResult | null>(null);
  const [osmGraph, setOsmGraph] = useState<Graph | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [mapCenter, setMapCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [status, setStatus] = useState('Place a START (right-click) and END (left-click) marker on the map.');

  // Get user geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setMapZoom(12);
        },
        () => {
          // Fallback to default world view
          setMapCenter(DEFAULT_CENTER);
          setMapZoom(DEFAULT_ZOOM);
        }
      );
    }
  }, []);

  const handleRun = async () => {
    if (!startPos || !endPos) return;
    setStatus('Fetching road data from OpenStreetMap…');
    setResult(null);
    setOsmGraph(null);
    setCurrentStep(0);

    try {
      const graph = await buildOsmGraph(startPos, endPos);
      setOsmGraph(graph);
      setStatus(`Road network loaded (${graph.nodes.size} nodes). Running algorithm…`);

      let res: AlgorithmResult;

      switch (algorithm) {
        case 'bfs':           res = bfs(graph); break;
        case 'dijkstra':      res = dijkstra(graph); break;
        case 'bidirectionalBfs': res = bidirectionalBfs(graph); break;
        case 'aStar':         res = aStar(graph); break;
        default:              res = aStar(graph);
      }

      setResult(res);
      setCurrentStep(res.exploredOrder.length - 1);

      if (res.path.length > 0) {
        setStatus(`Done! Explored ${res.exploredOrder.length} nodes. Path: ${res.path.length} nodes.`);
      } else {
        setStatus('No path found. The locations may not be connected by roads.');
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Failed to fetch road data.'}`);
      console.error(err);
    }
  };

  const handleClear = () => {
    setStartPos(null);
    setEndPos(null);
    setResult(null);
    setOsmGraph(null);
    setCurrentStep(0);
    setStatus('Place a START (right-click) and END (left-click) marker on the map.');
  };

  const handleLocationFound = (lat: number, lng: number) => {
    setMapCenter({ lat, lng });
    setMapZoom(12);
  };

  // Compute displayed explored positions up to currentStep
  const exploredPositions = useMemo<LatLng[]>(() => {
    if (!result || !osmGraph) return [];
    return result.exploredOrder
      .slice(0, currentStep + 1)
      .map((id) => osmGraph.nodes.get(id)?.position)
      .filter((p): p is LatLng => p !== undefined);
  }, [result, currentStep, osmGraph]);

  // Show path only when slider is at the last step
  const pathPositions = useMemo<LatLng[]>(() => {
    if (!result || result.path.length === 0 || !osmGraph) return [];
    if (currentStep < result.exploredOrder.length - 1) return [];
    return result.path
      .map((id) => osmGraph.nodes.get(id)?.position)
      .filter((p): p is LatLng => p !== undefined);
  }, [result, currentStep, osmGraph]);

  const steps = result ? result.exploredOrder.length : 0;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <MapView
        startPos={startPos}
        endPos={endPos}
        exploredPositions={exploredPositions}
        pathPositions={pathPositions}
        onSetStart={setStartPos}
        onSetEnd={setEndPos}
        center={mapCenter}
        zoom={mapZoom}
      />
      <SearchBar onLocationFound={handleLocationFound} />
      <ProgressSlider
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
      />
      <Sidebar
        algorithm={algorithm}
        onAlgorithmChange={setAlgorithm}
        onRun={handleRun}
        onClear={handleClear}
        canRun={!!startPos && !!endPos}
        status={status}
      />
    </div>
  );
};

export default ShortestPath;
