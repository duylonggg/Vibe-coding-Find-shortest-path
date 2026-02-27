import React, { useState, useEffect, useMemo, useRef } from 'react';
import MapView from '../components/MapView';
import SearchBar from '../components/SearchBar';
import Sidebar from '../components/Sidebar';
import type { AlgorithmType } from '../components/Sidebar';
import ProgressSlider from '../components/ProgressSlider';
import DarkModeToggle from '../components/DarkModeToggle';
import type { LatLng, AlgorithmResult, Graph } from '../Algorithm/types';
import { buildOsmGraph, prefetchAreaAround } from '../Algorithm/osmGraphBuilder';
import { bfs } from '../Algorithm/bfs';
import { dijkstra } from '../Algorithm/dijkstra';
import { bidirectionalBfs } from '../Algorithm/bidirectionalBfs';
import { aStar } from '../Algorithm/aStar';
import { alt } from '../Algorithm/alt';
import { ch } from '../Algorithm/ch';
import { cch } from '../Algorithm/cch';

const DEFAULT_CENTER: LatLng = { lat: 20, lng: 0 };
const DEFAULT_ZOOM = 5;

const ShortestPath: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [startPos, setStartPos] = useState<LatLng | null>(null);
  const [endPos, setEndPos] = useState<LatLng | null>(null);
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('aStar');
  const [result, setResult] = useState<AlgorithmResult | null>(null);
  const [osmGraph, setOsmGraph] = useState<Graph | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [mapCenter, setMapCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [status, setStatus] = useState('Place a START (right-click) and END (left-click) marker on the map.');
  const [isLoading, setIsLoading] = useState(false);

  // Ref to track latest prefetch request so stale results are dropped
  const prefetchRef = useRef<{ startPos: LatLng; endPos: LatLng } | null>(null);

  // Toggle dark mode class on <html> element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

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

  // Pre-fetch graph data as soon as a start marker is placed so that the
  // Overpass download is already in-flight (or cached) when the user clicks Run.
  useEffect(() => {
    if (startPos) {
      prefetchAreaAround(startPos);
    }
  }, [startPos]);

  // When both markers are placed, kick off a background graph fetch so that
  // clicking Run will hit the cache instead of waiting for the network.
  useEffect(() => {
    if (!startPos || !endPos) return;
    const snap = { startPos, endPos };
    prefetchRef.current = snap;
    setStatus('Road data loading in background… Click Run when ready.');
    buildOsmGraph(startPos, endPos)
      .then(() => {
        // Only update status if this is still the current request
        if (prefetchRef.current === snap) {
          setStatus('Road data ready. Click Run to find the shortest path.');
        }
      })
      .catch(() => {
        if (prefetchRef.current === snap) {
          setStatus('Place a START (right-click) and END (left-click) marker on the map.');
        }
      });
  }, [startPos, endPos]);

  const handleRun = async () => {
    if (!startPos || !endPos) return;
    setIsLoading(true);
    setStatus('Loading road network…');
    setResult(null);
    setOsmGraph(null);
    setCurrentStep(0);

    try {
      const graph = await buildOsmGraph(startPos, endPos);
      setOsmGraph(graph);
      setStatus(`Road network loaded (${graph.nodes.size} nodes). Running algorithm…`);

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
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    prefetchRef.current = null;
    setStartPos(null);
    setEndPos(null);
    setResult(null);
    setOsmGraph(null);
    setCurrentStep(0);
    setIsLoading(false);
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
      <SearchBar onLocationFound={handleLocationFound} isDark={isDark} />
      <ProgressSlider
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        isDark={isDark}
      />
      <Sidebar
        algorithm={algorithm}
        onAlgorithmChange={setAlgorithm}
        onRun={handleRun}
        onClear={handleClear}
        canRun={!!startPos && !!endPos}
        status={status}
        isDark={isDark}
        isLoading={isLoading}
      />
      <DarkModeToggle isDark={isDark} onToggle={() => setIsDark(d => !d)} />
    </div>
  );
};

export default ShortestPath;
