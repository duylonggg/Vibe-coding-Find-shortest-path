import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Polyline, useMapEvents, useMap } from 'react-leaflet';
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

interface MapViewProps {
  startPos: LatLng | null;
  endPos: LatLng | null;
  exploredPositions: LatLng[];
  pathPositions: LatLng[];
  onSetStart: (pos: LatLng) => void;
  onSetEnd: (pos: LatLng) => void;
  center: LatLng;
  zoom: number;
}

const MapView: React.FC<MapViewProps> = ({
  startPos,
  endPos,
  exploredPositions,
  pathPositions,
  onSetStart,
  onSetEnd,
  center,
  zoom,
}) => {
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
      />

      <FlyTo center={center} zoom={zoom} />
      <MapEvents onSetStart={onSetStart} onSetEnd={onSetEnd} />

      {startPos && (
        <Marker position={[startPos.lat, startPos.lng]} icon={greenIcon} />
      )}
      {endPos && (
        <Marker position={[endPos.lat, endPos.lng]} icon={redIcon} />
      )}

      {exploredPositions.map((pos, i) => (
        <CircleMarker
          key={`exp-${i}`}
          center={[pos.lat, pos.lng]}
          radius={4}
          pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.5, weight: 1 }}
        />
      ))}

      {pathPositions.length > 1 && (
        <Polyline
          positions={pathPositions.map((p) => [p.lat, p.lng])}
          pathOptions={{ color: '#16a34a', weight: 4, opacity: 0.9 }}
        />
      )}
    </MapContainer>
  );
};

export default MapView;
