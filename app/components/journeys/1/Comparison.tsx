// @ts-nocheck
"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import { worsenRoute } from "../../worsenRoute";
import type { JourneyRouteData } from "../../../journeys/types";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

// ── Fixed route ────────────────────────────────────────────────────────────────
const ORIGIN: [number, number]      = [-122.4443, 47.2529]; // Tacoma
const DESTINATION: [number, number] = [-122.3321, 47.6062]; // Downtown Seattle
const ORIGIN_LABEL      = "Tacoma";
const DESTINATION_LABEL = "Downtown Seattle";

// ── Forecast years ────────────────────────────────────────────────────────────
const FORECAST_YEARS = [2030, 2040, 2050] as const;
type ForecastYear = typeof FORECAST_YEARS[number];

// ── Congestion colours ────────────────────────────────────────────────────────
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

function gradientFromAdjusted(adjusted: string[]) {
  if (!adjusted.length) return ["literal", CONGESTION_COLORS.unknown];
  const stops: any[] = ["interpolate", ["linear"], ["line-progress"]];
  const n = adjusted.length;
  for (let i = 0; i < n; i++) {
    let p = n === 1 ? 1 : i / (n - 1);
    if (stops.length >= 4 && p <= stops[stops.length - 2]) p += 0.0001;
    stops.push(p, CONGESTION_COLORS[adjusted[i] as CongestionLevel] ?? CONGESTION_COLORS.unknown);
  }
  return stops;
}

// Interpolate multiplier between base year and 2050
function projectTime(
  baseMinutes: number,
  multiplier2050: number,
  year: ForecastYear,
  baseYear = 2025
): number {
  if (year === 2050) return baseMinutes * multiplier2050;
  const t = Math.max(0, Math.min(1, (year - baseYear) / (2050 - baseYear)));
  return baseMinutes * (1 + (multiplier2050 - 1) * t);
}

function formatMinutes(mins: number | null): string {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr${h > 1 ? "s" : ""}`;
  return `${h} hr${h > 1 ? "s" : ""} ${m} min`;
}

function TinySpinner() {
  return (
    <svg className="inline-block animate-spin" xmlns="http://www.w3.org/2000/svg"
      width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

// ── Shared map init helper ─────────────────────────────────────────────────────
function initMap(container: HTMLDivElement): mapboxgl.Map {
  const map = new mapboxgl.Map({
    container,
    style: "mapbox://styles/mapbox/streets-v11",
    center: [-122.15, 47.43],
    zoom: 9.5,
    cooperativeGestures: true,
  });
  map.addControl(new mapboxgl.NavigationControl(), "top-right");
  return map;
}

function addMarkers(map: mapboxgl.Map) {
  new mapboxgl.Marker({ color: "#1d4ed8" })
    .setLngLat(ORIGIN)
    .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(ORIGIN_LABEL))
    .addTo(map);
  new mapboxgl.Marker({ color: "#dc2626" })
    .setLngLat(DESTINATION)
    .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(DESTINATION_LABEL))
    .addTo(map);
}

function drawRoute(
  map: mapboxgl.Map,
  layerId: string,
  geojson: GeoJSON.FeatureCollection,
  gradient: any
) {
  const sourceId = `${layerId}-src`;
  if (map.getLayer(layerId)) {
    (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojson);
    map.setPaintProperty(layerId, "line-gradient", gradient);
    map.setLayoutProperty(layerId, "visibility", "visible"); // shader quirk guard
  } else {
    map.addSource(sourceId, { type: "geojson", lineMetrics: true, data: geojson });
    map.addLayer(
      {
        id: layerId,
        type: "line",
        source: sourceId,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-gradient": gradient, "line-width": 6, "line-opacity": 0.9 },
      },
      "road-label"
    );
  }
}

// ── Legend ────────────────────────────────────────────────────────────────────
const LEGEND = [
  { label: "Free flow", color: CONGESTION_COLORS.low },
  { label: "Moderate",  color: CONGESTION_COLORS.moderate },
  { label: "Heavy",     color: CONGESTION_COLORS.heavy },
  { label: "Severe",    color: CONGESTION_COLORS.severe },
];

// ── Component ──────────────────────────────────────────────────────────────────
const ElenaForecastMap: React.FC<{
  route: JourneyRouteData;
  multiplier: number | null;
}> = ({
  route,
  multiplier,
}) => {
  const todayContainerRef    = useRef<HTMLDivElement | null>(null);
  const forecastContainerRef = useRef<HTMLDivElement | null>(null);
  const todayMapRef          = useRef<mapboxgl.Map | null>(null);
  const forecastMapRef       = useRef<mapboxgl.Map | null>(null);

  const [todayLoaded,    setTodayLoaded]    = useState(false);
  const [forecastLoaded, setForecastLoaded] = useState(false);

  const [forecastYear, setForecastYear] = useState<ForecastYear>(2050);

  const [todayTime,    setTodayTime]    = useState<number | null>(null);
  const [forecastTime, setForecastTime] = useState<number | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // ── Init maps ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!todayContainerRef.current || !forecastContainerRef.current) return;

    const tMap = initMap(todayContainerRef.current);
    const fMap = initMap(forecastContainerRef.current);

    tMap.on("load", () => { addMarkers(tMap); setTodayLoaded(true); });
    fMap.on("load", () => { addMarkers(fMap); setForecastLoaded(true); });

    todayMapRef.current    = tMap;
    forecastMapRef.current = fMap;

    return () => { tMap.remove(); fMap.remove(); };
  }, []);

  useEffect(() => {
    if (!todayLoaded || !forecastLoaded) return;
    if (!route) {
      setError("Could not load route data. Please try again.");
      return;
    }

    setLoading(true);
    setError(null);
    applyRoutesToMaps(route, multiplier, forecastYear);
    setLoading(false);
  }, [todayLoaded, forecastLoaded, route, multiplier, forecastYear]);

  // ── Apply routes to both maps ──────────────────────────────────────────────
  const applyRoutesToMaps = useCallback((
    route: any,
    multiplier: number | null,
    year: ForecastYear
  ) => {
    const tMap = todayMapRef.current;
    const fMap = forecastMapRef.current;
    if (!tMap || !fMap || !route) return;

    const annotation  = route.legs?.[0]?.annotation || {};
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: route.geometry, properties: {} }],
    };

    // Today map — real congestion gradient
    const todayGradient = gradientFromAnnotation(annotation);
    drawRoute(tMap, "today-route", geojson, todayGradient);

    const trafficMin = Math.round(route.duration / 60);
    setTodayTime(trafficMin);

    // Forecast map — worsened gradient
    if (multiplier != null) {
      const projectedMin = Math.round(projectTime(trafficMin, multiplier, year));
      const deltaMin     = Math.max(0, projectedMin - trafficMin);
      setForecastTime(projectedMin);

      let forecastGradient: any;
      if (deltaMin > 0) {
        const wr = worsenRoute(route, {
          targetDeltaMinutes: deltaMin,
          seed: 42,
          preferHighways: true,
        });
        forecastGradient = gradientFromAdjusted(wr.adjustedLevels);
      } else {
        forecastGradient = todayGradient;
      }
      drawRoute(fMap, "forecast-route", geojson, forecastGradient);
    } else {
      // No multiplier — show same as today
      drawRoute(fMap, "forecast-route", geojson, todayGradient);
      setForecastTime(trafficMin);
    }

    // Fit both maps to route bounds
    const bbox = turf.bbox(turf.lineString(route.geometry.coordinates)) as
      [number, number, number, number];
    const fitOpts = { padding: { top: 60, bottom: 60, left: 60, right: 60 }, maxZoom: 13, duration: 800 };
    tMap.fitBounds(bbox, fitOpts);
    fMap.fitBounds(bbox, fitOpts);
  }, []);

  // ── Derived display values ────────────────────────────────────────────────
  const timeDelta = (todayTime != null && forecastTime != null)
    ? Math.round(forecastTime - todayTime)
    : null;

  const pctIncrease = (todayTime != null && forecastTime != null && todayTime > 0)
    ? Math.round(((forecastTime - todayTime) / todayTime) * 100)
    : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col gap-3 w-full"
      style={{ fontFamily: "Encode Sans Compressed, sans-serif" }}
    >

      {/* ── Forecast year selector ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">
          Forecast year:
        </span>
        <div className="flex gap-2">
          {FORECAST_YEARS.map((year) => (
            <button
              key={year}
              onClick={() => setForecastYear(year)}
              className={`
                px-5 py-2 rounded-lg border text-sm font-semibold transition-all
                ${forecastYear === year
                  ? "bg-black text-white border-black shadow"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"}
              `}
            >
              {year}
            </button>
          ))}
        </div>

        {/* Delta pill */}
        {timeDelta != null && !loading && (
          <div className="sm:ml-auto flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-4 py-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12"
              fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 13V3M8 3l-4 4m4-4l4 4" />
            </svg>
            <span className="text-sm font-semibold text-red-700">
              +{formatMinutes(timeDelta)} longer by {forecastYear}
            </span>
            {pctIncrease != null && (
              <span className="text-xs text-red-400">({pctIncrease}% increase)</span>
            )}
          </div>
        )}
      </div>

      {/* ── Dual maps ───────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-2" style={{ height: 460 }}>

        {/* Today map */}
        <div className="flex-1 relative rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div ref={todayContainerRef} style={{ width: "100%", height: "100%" }} />

          {/* Badge */}
          <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-100 px-4 py-3 min-w-[150px]">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-0.5">Today</p>
            <div className="flex items-baseline gap-1">
              {loading ? (
                <span className="text-gray-400 text-sm flex items-center gap-1">
                  <TinySpinner /> Loading…
                </span>
              ) : (
                <>
                  <span className="text-2xl font-bold text-gray-900">
                    {formatMinutes(todayTime)}
                  </span>
                  <span className="text-xs text-gray-400">with traffic</span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Morning peak · 7:30 AM</p>
          </div>

          {/* Legend */}
          <Legend />
        </div>

        {/* Forecast map */}
        <div className="flex-1 relative rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div ref={forecastContainerRef} style={{ width: "100%", height: "100%" }} />

          {/* Badge */}
          <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-100 px-4 py-3 min-w-[150px]">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-0.5">
              {forecastYear} — No action
            </p>
            <div className="flex items-baseline gap-1">
              {loading ? (
                <span className="text-gray-400 text-sm flex items-center gap-1">
                  <TinySpinner /> Loading…
                </span>
              ) : (
                <>
                  <span className="text-2xl font-bold text-red-600">
                    {formatMinutes(forecastTime)}
                  </span>
                  <span className="text-xs text-gray-400">projected</span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">PSRC model · same corridor</p>
          </div>

          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <p className="bg-white border border-red-200 text-red-600 text-sm px-4 py-2 rounded-lg shadow">
                {error}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

// ── Legend subcomponent ───────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="absolute bottom-8 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow border border-gray-100 px-3 py-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Traffic</p>
      <div className="flex flex-col gap-1">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <div className="w-6 h-2 rounded-full" style={{ background: l.color }} />
            <span className="text-xs text-gray-600">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ElenaForecastMap;
