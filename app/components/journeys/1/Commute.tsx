// @ts-nocheck
"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import type { CommuteRoutesByTime } from "../../../journeys/types";


mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

// ── Fixed route ────────────────────────────────────────────────────────────────
const ORIGIN: [number, number] = [-122.4443, 47.2529];      // Tacoma
const DESTINATION: [number, number] = [-122.3321, 47.6062]; // Downtown Seattle

const ORIGIN_LABEL = "Tacoma";
const DESTINATION_LABEL = "Downtown Seattle";

const TIME_OPTIONS = [
  { label: "Morning peak", sublabel: "7:30 AM", time: "07:30", icon: "🌅" },
  { label: "Midday",       sublabel: "12:00 PM", time: "12:00", icon: "☀️" },
  { label: "Evening peak", sublabel: "5:30 PM",  time: "17:30", icon: "🌆" },
];

// ── Congestion colours (same as MapRoute2) ─────────────────────────────────────
const CONGESTION_COLORS = {
  unknown:  "#B2B2B2",
  low:      "#78B24A",
  moderate: "#FF9619",
  heavy:    "#EB7360",
  severe:   "#A82D19",
};

type CongestionLevel = keyof typeof CONGESTION_COLORS;

function gradientFromAnnotation(annotation: any) {
  const levels: CongestionLevel[] = annotation?.congestion || [];
  if (!levels.length) return ["literal", CONGESTION_COLORS.unknown];

  const stops: any[] = ["interpolate", ["linear"], ["line-progress"]];
  const n = levels.length;
  for (let i = 0; i < n; i++) {
    let p = n === 1 ? 1 : i / (n - 1);
    if (stops.length >= 4 && p <= stops[stops.length - 2]) p += 0.0001;
    stops.push(p, CONGESTION_COLORS[levels[i]] ?? CONGESTION_COLORS.unknown);
  }
  return stops;
}

function formatMinutes(mins: number | null): string {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr${h > 1 ? "s" : ""}`;
  return `${h} hr${h > 1 ? "s" : ""} ${m} min`;
}

// ── Component ──────────────────────────────────────────────────────────────────
const ElenaCommuteMap: React.FC<{ routesByTime: CommuteRoutesByTime }> = ({
  routesByTime,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const originMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedTime, setSelectedTime] = useState(0); // index into TIME_OPTIONS
  const [travelTime, setTravelTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Init map ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-122.15, 47.43],   // midpoint Tacoma–Seattle
      zoom: 9.5,
      cooperativeGestures: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      setMapLoaded(true);

      // Fixed markers
      originMarkerRef.current = new mapboxgl.Marker({ color: "#1d4ed8" })
        .setLngLat(ORIGIN)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(ORIGIN_LABEL))
        .addTo(map);

      destMarkerRef.current = new mapboxgl.Marker({ color: "#dc2626" })
        .setLngLat(DESTINATION)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(DESTINATION_LABEL))
        .addTo(map);
    });

    mapRef.current = map;
    return () => map.remove();
  }, []);

  const applyRoute = useCallback((timeIdx: number) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    setLoading(true);
    setError(null);
    setTravelTime(null);

    const route = routesByTime[TIME_OPTIONS[timeIdx].time];
    if (!route) {
      setError("Could not load route. Please try again.");
      setLoading(false);
      return;
    }

    setTravelTime(Math.round(route.duration / 60));

    // ── Draw / update route layer ─────────────────────────────────────────────
    const annotation = route.legs?.[0]?.annotation || {};
    const gradient = gradientFromAnnotation(annotation);
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: route.geometry, properties: {} }],
    };

    if (map.getLayer("elena-route")) {
      // Update existing source
      (map.getSource("elena-route") as mapboxgl.GeoJSONSource).setData(geojson);
      map.setPaintProperty("elena-route", "line-gradient", gradient);
      // Re-assert visibility (guards against shader recompilation quirk)
      map.setLayoutProperty("elena-route", "visibility", "visible");
    } else {
      map.addSource("elena-route", {
        type: "geojson",
        lineMetrics: true,
        data: geojson,
      });
      map.addLayer(
        {
          id: "elena-route",
          type: "line",
          source: "elena-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-gradient": gradient,
            "line-width": 6,
            "line-opacity": 0.9,
          },
        },
        "road-label"
      );
    }

    // Fit to route bounds
    const bbox = turf.bbox(turf.lineString(route.geometry.coordinates));
    map.fitBounds(bbox as [number, number, number, number], {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      maxZoom: 13,
      duration: 800,
    });

    setLoading(false);
  }, [routesByTime]);

  // Fetch on map load
  useEffect(() => {
    if (mapLoaded) applyRoute(selectedTime);
  }, [mapLoaded, selectedTime, applyRoute]);

  // ── Legend items ──────────────────────────────────────────────────────────────
  const legend: { label: string; color: string }[] = [
    { label: "Free flow",  color: CONGESTION_COLORS.low },
    { label: "Moderate",   color: CONGESTION_COLORS.moderate },
    { label: "Heavy",      color: CONGESTION_COLORS.heavy },
    { label: "Severe",     color: CONGESTION_COLORS.severe },
  ];

  return (
    <div className="flex flex-col gap-3 w-full h-full" style={{ fontFamily: "Encode Sans Compressed, sans-serif" }}>

      {/* ── Time picker ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">
          Depart at:
        </span>
        <div className="flex gap-2 flex-wrap">
          {TIME_OPTIONS.map((opt, idx) => (
            <button
              key={opt.time}
              onClick={() => setSelectedTime(idx)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all
                ${selectedTime === idx
                  ? "bg-black text-white border-black shadow"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"}
              `}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
              <span className={`text-xs ${selectedTime === idx ? "text-gray-300" : "text-gray-400"}`}>
                {opt.sublabel}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Map + overlay ──────────────────────────────────────────────────── */}
      <div className="relative flex-1 rounded-lg overflow-hidden border border-gray-200 shadow-sm" style={{ minHeight: 420 }}>

        <div ref={mapContainerRef} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />

        {/* Travel time badge — top left */}
        <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-100 px-4 py-3 min-w-[160px]">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-0.5">
            {ORIGIN_LABEL} → {DESTINATION_LABEL}
          </p>
          <div className="flex items-baseline gap-2">
            {loading ? (
              <span className="text-gray-400 text-sm flex items-center gap-1">
                <TinySpinner /> Calculating…
              </span>
            ) : error ? (
              <span className="text-red-500 text-sm">{error}</span>
            ) : (
              <>
                <span className="text-2xl font-bold text-gray-900">
                  {formatMinutes(travelTime)}
                </span>
                <span className="text-xs text-gray-400">with traffic</span>
              </>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {TIME_OPTIONS[selectedTime].label} · {TIME_OPTIONS[selectedTime].sublabel}
          </p>
        </div>

        {/* Congestion legend — bottom left */}
        <div className="absolute bottom-8 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow border border-gray-100 px-3 py-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
            Traffic
          </p>
          <div className="flex flex-col gap-1">
            {legend.map((l) => (
              <div key={l.label} className="flex items-center gap-2">
                <div className="w-6 h-2 rounded-full" style={{ background: l.color }} />
                <span className="text-xs text-gray-600">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Route label — top right */}
        <div className="absolute top-3 right-12 z-10 bg-white/90 backdrop-blur-sm rounded-full border border-gray-200 shadow px-3 py-1 text-xs font-medium text-gray-600">
          I-5 Corridor · PSRC region
        </div>

      </div>

    </div>
  );
};

function TinySpinner() {
  return (
    <svg
      className="inline-block animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      width="14" height="14" viewBox="0 0 24 24" fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export default ElenaCommuteMap;
