import React, { useState, useEffect, useMemo, useRef } from 'react';
import MapView from '../components/MapView';
import SearchBar from '../components/SearchBar';
import Sidebar from '../components/Sidebar';
import type { AlgorithmType, LoadMode } from '../components/Sidebar';
import ProgressSlider from '../components/ProgressSlider';
import DarkModeToggle from '../components/DarkModeToggle';
import type { LatLng, AlgorithmResult } from '../Algorithm/types';

const DEFAULT_CENTER: LatLng = { lat: 20, lng: 0 };
const DEFAULT_ZOOM = 5;

// Messages the worker can send back to the main thread
type WorkerOutMessage =
  | { type: 'status'; message: string }
  | { type: 'result'; exploredOrder: string[]; path: string[]; nodePositions: Record<string, LatLng> }
  | { type: 'error'; message: string };

const ShortestPath: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [startPos, setStartPos] = useState<LatLng | null>(null);
  const [endPos, setEndPos] = useState<LatLng | null>(null);
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('aStar');
  const [loadMode, setLoadMode] = useState<LoadMode>('auto');
  const [result, setResult] = useState<AlgorithmResult | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [mapCenter, setMapCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [status, setStatus] = useState('Place a START (right-click) and END (left-click) marker on the map.');
  const [isLoading, setIsLoading] = useState(false);

  // Node positions (flat id → LatLng lookup) received from the worker.
  // Stored separately from the full graph so the heavy neighbor data stays in
  // the worker and never enters React state.
  const [nodePositions, setNodePositions] = useState<Record<string, LatLng>>({});

  // Persistent Web Worker – created once, lives for the page lifetime.
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../Algorithm/pathfinder.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      if (msg.type === 'status') {
        setStatus(msg.message);
      } else if (msg.type === 'result') {
        // React 18 batches these two setState calls into a single re-render
        setNodePositions(msg.nodePositions);
        const res: AlgorithmResult = { exploredOrder: msg.exploredOrder, path: msg.path };
        setResult(res);
        setCurrentStep(res.exploredOrder.length - 1);
        setIsLoading(false);
        if (res.path.length > 0) {
          setStatus(`Done! Explored ${res.exploredOrder.length} nodes. Path: ${res.path.length} nodes.`);
        } else {
          setStatus('No path found. The locations may not be connected by roads.');
        }
      } else if (msg.type === 'error') {
        setStatus(`Error: ${msg.message}`);
        setIsLoading(false);
      }
    };

    worker.onerror = (err) => {
      setStatus(`Worker error: ${err.message}`);
      setIsLoading(false);
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

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
          setMapCenter(DEFAULT_CENTER);
          setMapZoom(DEFAULT_ZOOM);
        }
      );
    }
  }, []);

  // Pre-fetch graph data as soon as a start marker is placed so that the
  // Overpass download is already in-flight (or cached) when the user clicks Run.
  useEffect(() => {
    if (startPos && workerRef.current) {
      workerRef.current.postMessage({ type: 'prefetch', center: startPos });
    }
  }, [startPos]);

  // Pre-fetch a small area around the end marker as well.
  useEffect(() => {
    if (endPos && workerRef.current) {
      workerRef.current.postMessage({ type: 'prefetch', center: endPos });
    }
  }, [endPos]);

  const handleRun = () => {
    if (!startPos || !endPos || !workerRef.current) return;
    setIsLoading(true);
    setResult(null);
    setNodePositions({});
    setCurrentStep(0);
    workerRef.current.postMessage({ type: 'run', start: startPos, end: endPos, algorithm, loadMode });
  };

  const handleClear = () => {
    setStartPos(null);
    setEndPos(null);
    setResult(null);
    setNodePositions({});
    setCurrentStep(0);
    setIsLoading(false);
    setStatus('Place a START (right-click) and END (left-click) marker on the map.');
  };

  const handleLocationFound = (lat: number, lng: number) => {
    setMapCenter({ lat, lng });
    setMapZoom(12);
  };

  // Compute displayed explored positions up to currentStep.
  const exploredPositions = useMemo<LatLng[]>(() => {
    if (!result) return [];
    return result.exploredOrder
      .slice(0, currentStep + 1)
      .map((id) => nodePositions[id])
      .filter((p): p is LatLng => p !== undefined);
  }, [result, currentStep, nodePositions]);

  // Show path only when slider is at the last step
  const pathPositions = useMemo<LatLng[]>(() => {
    if (!result || result.path.length === 0) return [];
    if (currentStep < result.exploredOrder.length - 1) return [];
    return result.path
      .map((id) => nodePositions[id])
      .filter((p): p is LatLng => p !== undefined);
  }, [result, currentStep, nodePositions]);

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
        loadMode={loadMode}
        onLoadModeChange={setLoadMode}
        onRun={handleRun}
        onClear={handleClear}
        canRun={!!startPos && !!endPos}
        status={status}
        isDark={isDark}
        isLoading={isLoading}
        startPos={startPos}
        endPos={endPos}
        onSetStart={setStartPos}
        onSetEnd={setEndPos}
      />
      <DarkModeToggle isDark={isDark} onToggle={() => setIsDark(d => !d)} />
    </div>
  );
};

export default ShortestPath;
