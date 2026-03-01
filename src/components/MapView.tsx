import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import { ExploredCanvasLayer } from './ExploredCanvasLayer';
import L from 'leaflet';
import type { LatLng } from '../Algorithm/types';

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapEventsProps {
  onSetStart: (pos: LatLng) => void;
  onSetEnd: (pos: LatLng) => void;
}

function MapEvents({ onSetStart, onSetEnd }: MapEventsProps) {
  useMapEvents({
    click(e) {
      onSetEnd({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    contextmenu(e) {
      e.originalEvent.preventDefault();
      onSetStart({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

interface FlyToProps {
  center: LatLng;
  zoom: number;
}

function FlyTo({ center, zoom }: FlyToProps) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.lat, center.lng], zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}

/** A single rendered route: positions + display style. */
export interface RouteLayer {
  positions: LatLng[];
  color: string;
  weight: number;
  opacity: number;
}

interface MapViewProps {
  startPos: LatLng | null;
  endPos: LatLng | null;
  exploredPositions: LatLng[];
  /** Multiple routes to render.  Index 0 = primary (red), 1-2 = alternatives (purple). */
  routes: RouteLayer[];
  /** Index of the currently active (highlighted) route. */
  activeRouteIndex: number;
  onSetStart: (pos: LatLng) => void;
  onSetEnd: (pos: LatLng) => void;
  center: LatLng;
  zoom: number;
}

const MapView: React.FC<MapViewProps> = ({
  startPos,
  endPos,
  exploredPositions,
  routes,
  activeRouteIndex,
  onSetStart,
  onSetEnd,
  center,
  zoom,
}) => {
  // Render non-active routes first (underneath), active route last (on top)
  const sortedRoutes = [
    ...routes.map((r, i) => ({ ...r, origIndex: i })).filter((r) => r.origIndex !== activeRouteIndex),
    ...(routes[activeRouteIndex] ? [{ ...routes[activeRouteIndex], origIndex: activeRouteIndex }] : []),
  ];

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={{ width: '100%', height: '100vh' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        updateWhenIdle={false}
        keepBuffer={4}
        maxNativeZoom={19}
        maxZoom={19}
      />

      <FlyTo center={center} zoom={zoom} />
      <MapEvents onSetStart={onSetStart} onSetEnd={onSetEnd} />

      {startPos && (
        <Marker position={[startPos.lat, startPos.lng]} icon={greenIcon} />
      )}
      {endPos && (
        <Marker position={[endPos.lat, endPos.lng]} icon={redIcon} />
      )}

      <ExploredCanvasLayer positions={exploredPositions} />

      {sortedRoutes.map((route) =>
        route.positions.length > 1 ? (
          <Polyline
            key={route.origIndex}
            positions={route.positions.map((p) => [p.lat, p.lng])}
            pathOptions={{
              color: route.color,
              weight: route.weight,
              opacity: route.opacity,
            }}
          />
        ) : null
      )}
    </MapContainer>
  );
};

export default MapView;
