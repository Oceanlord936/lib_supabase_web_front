"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import type { Library } from "@/lib/types";

// Fix Leaflet default icon broken by webpack/Turbopack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type MapProps = {
  center: { lat: number; lng: number } | null;
  libraries: Library[];
  selectedPin?: { lat: number; lng: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
};

function ClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapCenterUpdater({ center }: { center: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], map.getZoom());
  }, [center, map]);
  return null;
}

export default function Map({ center, libraries, selectedPin, onMapClick }: MapProps) {
  const defaultCenter: [number, number] = center
    ? [center.lat, center.lng]
    : [45.5017, -73.5673];

  return (
    <MapContainer center={defaultCenter} zoom={13} className="h-[400px] w-full rounded-lg">
      <TileLayer
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onMapClick={onMapClick} />
      <MapCenterUpdater center={center} />

      {center && (
        <Marker position={[center.lat, center.lng]}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      {libraries.map((lib) => (
        <Marker key={lib.id} position={[lib.latitude, lib.longitude]}>
          <Popup>
            <strong>{lib.name}</strong>
            <br />
            {lib.address}
          </Popup>
        </Marker>
      ))}

      {selectedPin && (
        <Marker
          position={[selectedPin.lat, selectedPin.lng]}
          icon={L.divIcon({
            className: "",
            html: `<div style="width:16px;height:16px;background:red;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          })}
        >
          <Popup>Selected location</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
