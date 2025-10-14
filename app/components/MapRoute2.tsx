// @ts-nocheck
"use client";

import React, { useRef, useState, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import dynamic from "next/dynamic";
import "../globals2.css";
import { worsenRoute } from "./worsenRoute"; // adjust path

import * as turf from "@turf/turf";

import { point, booleanPointInPolygon } from '@turf/turf'
//import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
//import { point, FeatureCollection, Polygon } from "@turf/helpers";

const SearchBox = dynamic(
  () => import("@mapbox/search-js-react").then((mod) => mod.SearchBox as any),
  { ssr: false }
);

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

const MapRoute: React.FC = () => {
  // Map container references and instances
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const mapForecastContainerRef = useRef<HTMLDivElement | null>(null);
  const mapForecastInstanceRef = useRef<mapboxgl.Map | null>(null);

  // Map load states
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapForecastLoaded, setMapForecastLoaded] = useState(false);

  // Origin & destination states
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
  const [departAtTime, setDepartAtTime] = useState<string | null>(null);

  // Travel time estimates
  const [travelTime, setTravelTime] = useState<number | null>(null);
  const [forecastTravelTime, setForecastTravelTime] = useState<number | null>(null);
  const [peakTime, setPeakTime] = useState<string | null>(null);

  // Year
  const [forecastYear, setForecastYear] = useState<2030 | 2040 | 2050>(2050);
  const [multiplier2050, setMultiplier2050] = useState<number | null>(null);

  const [baseTrafficTime, setBaseTrafficTime] = useState<number | null>(null);

  const yearSensitivity: Record<2030 | 2040 | 2050, number> = {
    2030: 1.8,  // a little more sensitive
    2040: 2.8,  // stronger effect
    2050: 4,  // strongest effect
  };

  // view toggle for the left map
  const [currentTrafficView, setCurrentTrafficView] =  useState<"current" | "none">("current");

  // store no-traffic routes returned by the 'driving' profile
  const [routesNoTraffic, setRoutesNoTraffic] = useState<any[]>([]);

  // Marker refs
  const originMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const originForecastMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destinationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destinationForecastMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // County selection state – if empty, no county outlines are shown.
  const [selectedCountyOption, setSelectedCountyOption] = useState<string>("psrc"); // or "trpc"

  // which routes were returned & which one we’re showing
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [forecastMultiplier, setForecastMultiplier] = useState<number | null>(null);

  // Ref to hold the selected region GeoJSON
  const [regionGeoJSON, setRegionGeoJSON] = useState<any>(null);

  const [suppressAutoZoom, setSuppressAutoZoom] = useState(false);

  //const originInputRef = useRef<HTMLInputElement | null>(null);
  const destinationInputRef = useRef<HTMLInputElement | null>(null);

  // --- Lazy baseline (no-traffic) cache & inflight tracking ---
  const baselineCacheRef = useRef<Map<number, { duration: number }>>(new Map());
  const baselineInflightRef = useRef<Map<number, AbortController>>(new Map());
  const [baselineLoadingIdx, setBaselineLoadingIdx] = useState<number | null>(null);

  // --- Current-traffic loading state ---
  const [trafficLoading, setTrafficLoading] = useState(false);


  const isBaselineLoading =
    currentTrafficView === "none" &&
    baselineLoadingIdx != null &&
    baselineLoadingIdx === selectedRouteIdx;


  const map_layer = "road-label";

  const time_slots = {
    "5to6.h5" : "Peak time: 5 AM to 6 AM",
    "6to7.h5" : "Peak time: 6 AM to 7 AM",
    "7to8.h5" : "Peak time: 7 AM to 8 AM",
    "8to9.h5" : "Peak time: 8 AM to 9 AM",
    "9to10.h5" : "Peak time: 9 AM to 10 AM",
    "10to14.h5" : "Peak time: 10 AM to 2 PM",
    "14to15.h5" : "Peak time: 2 PM to 3 PM",
    "15to16.h5" : "Peak time: 3 PM to 4 PM",
    "16to17.h5" : "Peak time: 4 PM to 5 PM",
    "17to18.h5" : "Peak time: 5 PM to 6 PM",
    "18to20.h5" : "Peak time: 6 PM to 8 PM",
    "20to5.h5" : "Peak time: 8 PM to 5 AM"
  }

  const depart_at = {
    "5to6.h5" : "05:30",
    "6to7.h5" : "06:30",
    "7to8.h5" : "07:30",
    "8to9.h5" : "08:30",
    "9to10.h5" : "09:30",
    "10to14.h5" : "12:00",
    "14to15.h5" : "14:30",
    "15to16.h5" : "15:30",
    "16to17.h5" : "16:30",
    "17to18.h5" : "17:30",
    "18to20.h5" : "19:00",
    "20to5.h5" : "00:30"
  }

  const time_slots_trpc = {
    "AM" : "Peak time: 6 AM to 9 AM",
    "MD" : "Peak time: 11 AM to 2 PM",
    "PM" : "Peak time: 4 PM to 7 PM",
  }

  const depart_at_trpc = {
    "AM" : "07:00",
    "MD" : "12:00",
    "PM" : "18:00",
  }

  const projectTime = (
    baseMinutes: number,
    multiplier: number,
    year: 2030 | 2040 | 2050,
    baseYear = 2025 // treat “today” as the baseline
  ) => {
    if (year === 2050) return baseMinutes * multiplier;
    const t = Math.max(0, Math.min(1, (year - baseYear) / (2050 - baseYear)));
    const factor = 1 + (multiplier - 1) * t;
    return baseMinutes * factor;
  };

  const formatMinutes = (mins?: number | null) => {
    if (mins == null) return "";
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hr${h > 1 ? "s" : ""}`;
    return `${h} hr${h > 1 ? "s" : ""} ${m} min`;
  };

  const getNextWeeksThursday = (): string => {
    const d = new Date();
    const day = d.getDay();
    const THU = 4;
    // Days until THIS week’s Thursday:
    const daysUntilThisThursday = (THU - day + 7) % 7;
    // Force "next week" by adding an extra 7 days:
    const daysToNextWeeksThursday = daysUntilThisThursday + 7;
    d.setDate(d.getDate() + daysToNextWeeksThursday);

    // Return YYYY-MM-DD in local time
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  useEffect(() => {
    const mapF = mapForecastInstanceRef.current;
    if (!mapF || !routes.length || forecastTravelTime == null) return;

    routes.forEach((route, i) => {
      const annotation = route.legs?.[0]?.annotation || {};
      const trafficMin = Math.round((route.duration ?? 0) / 60);  // traffic base
      const deltaMin = Math.max(0, Math.round(forecastTravelTime - trafficMin));

      const gradient =
        deltaMin > 0
          ? (() => {
              const wr = worsenRoute(route, { targetDeltaMinutes: deltaMin, seed: 42, preferHighways: true });
              return gradientFromAdjusted(wr.adjustedLevels);
            })()
          : gradientFromAnnotation(annotation); // multiplier < 1 → show original traffic

      if (mapF.getLayer(`route-forecast-line-${i}`)) {
        mapF.setPaintProperty(`route-forecast-line-${i}`, "line-gradient", gradient);
      }
    });
  }, [routes, forecastTravelTime]);


  // Subsample a polyline so we stay well under Map Matching's 100-pt limit
  function subsample(coords: [number, number][], maxPts = 90) {
    if (!coords?.length) return [];
    if (coords.length <= maxPts) return coords;
    const step = Math.ceil(coords.length / maxPts);
    const out: [number, number][] = [];
    for (let i = 0; i < coords.length; i += step) out.push(coords[i]);
    // ensure last coordinate is included
    const last = coords[coords.length - 1];
    const outLast = out[out.length - 1];
    if (!outLast || outLast[0] !== last[0] || outLast[1] !== last[1]) out.push(last);
    return out;
  }

  // Map-match the traffic route's geometry using the *driving* profile (no traffic).
  // Returns an object with { duration } (seconds) computed on the SAME path.
  async function matchBaselineForSamePath(
    route: any,
    accessToken: string,
    signal?: AbortSignal
  ) {
    const coords: [number, number][] = route?.geometry?.coordinates || [];
    if (!coords.length) return null;

    const samp = subsample(coords, 90);
    const path = samp.map(([lng, lat]) => `${lng},${lat}`).join(";");

    const url =
      `https://api.mapbox.com/matching/v5/mapbox/driving/${path}` +
      `?geometries=geojson&overview=false&annotations=duration&tidy=true` +
      `&access_token=${accessToken}`;

    let res: Response | null = null;
    try {
      res = await fetch(url, { signal });
    } catch (e: any) {
      // swallow aborts; rethrow real errors
      if (e?.name === "AbortError" || /aborted/i.test(String(e?.message))) {
        return null;
      }
      throw e;
    }
    if (!res || !res.ok) return null;
    const json = await res.json();

    const m = json?.matchings?.[0];
    if (!m) return null;

    // Keep geometry unchanged for drawing; we only need baseline time.
    return { duration: m.duration ?? null };
  }

  function abortBaseline(index: number) {
    const ac = baselineInflightRef.current.get(index);
    if (!ac) return;
    if (!ac.signal.aborted) {
      try {
        ac.abort(new Error("baseline-canceled")); 
      } catch {
        // some environments can still complain; ignore
      }
    }
    baselineInflightRef.current.delete(index);
  }



  async function ensureBaselineForIndex(idx: number, routeOverride?: any) {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;
    const route = routeOverride ? routeOverride : routes[idx];
    if (!route || !token) return;

    if (baselineInflightRef.current.has(idx)) {
      return; // <-- prevents "self-cancel"
    }

    // cached?
    const cached = baselineCacheRef.current.get(idx);
    if (cached?.duration != null) {
      // make sure routesNoTraffic[idx] reflects cached duration
      setRoutesNoTraffic((prev) => {
        const next = [...prev];
        next[idx] = { duration: cached.duration };
        return next;
      });
      return;
    }

    // cancel any inflight for this idx
    //abortBaseline(idx);

    const ac = new AbortController();
    baselineInflightRef.current.set(idx, ac);
    setBaselineLoadingIdx(idx);

    try {
      const res = await matchBaselineForSamePath(route, token, ac.signal);
      baselineInflightRef.current.delete(idx);
      setBaselineLoadingIdx((cur) => (cur === idx ? null : cur));

      if (res?.duration != null) {
        // cache + state (sparse array, aligned by index)
        baselineCacheRef.current.set(idx, { duration: res.duration });
        setRoutesNoTraffic((prev) => {
          const next = [...prev];
          next[idx] = { duration: res.duration };
          return next;
        });

        // If we're currently showing "No Traffic" *for this same route*, update the ETA
        if (currentTrafficView === "none" && selectedRouteIdx === idx) {
          setTravelTime(Math.round(res.duration / 60));
          setBaseTrafficTime(Math.round(res.duration / 60));
        }
      }
    } catch (e: any) {

      if (e?.name !== "AbortError" && !/aborted/i.test(String(e?.message))) {
        console.error("MapMatch baseline failed:", e);
      }
      // aborted or failed — clear loading state for this idx
      //baselineInflightRef.current.delete(idx);
      //setBaselineLoadingIdx((cur) => (cur === idx ? null : cur));
      //console.error("MapMatch baseline failed:", e);
    }finally {
      baselineInflightRef.current.delete(idx);
      setBaselineLoadingIdx((cur) => (cur === idx ? null : cur));
    }
  }

  const CONGESTION_COLORS = {
    unknown: "#B2B2B2",
    low: "#78B24A",
    moderate: "#FF9619",
    heavy: "#EB7360",
    severe: "#A82D19",
  };

  useEffect(() => {
    if (currentTrafficView !== "none" && baselineLoadingIdx != null) {
      //abortBaseline(baselineLoadingIdx);
      setBaselineLoadingIdx(null);
    }
  }, [currentTrafficView]);


  // build gradient for "current" (original palette)
  function gradientFromAnnotation(annotation: any) {
    const levels: string[] = annotation?.congestion || [];
    if (!levels.length) return ["literal", CONGESTION_COLORS.unknown];

    let stops: [string, ...any[]] = ["interpolate", ["linear"], ["line-progress"]];
    const n = levels.length;
    for (let i = 0; i < n; i++) {
      let p = n === 1 ? 1 : i / (n - 1);
      if (stops.length >= 4 && p <= stops[stops.length - 2]) p += 0.0001;
      stops.push(p, CONGESTION_COLORS[levels[i] as keyof typeof CONGESTION_COLORS] ?? CONGESTION_COLORS.unknown);
    }
    return stops;
  }

  function gradientFromAdjusted(adjusted: string[]) {
    if (!adjusted.length) return ["literal", CONGESTION_COLORS.unknown];
    let stops: [string, ...any[]] = ["interpolate", ["linear"], ["line-progress"]];
    const n = adjusted.length;
    for (let i = 0; i < n; i++) {
      let p = n === 1 ? 1 : i / (n - 1);
      if (stops.length >= 4 && p <= stops[stops.length - 2]) p += 0.0001;
      stops.push(p, CONGESTION_COLORS[adjusted[i] as keyof typeof CONGESTION_COLORS] ?? CONGESTION_COLORS.unknown);
    }
    return stops;
  }

  function gradientNoTraffic(annotation: any) {
    const n = (annotation?.congestion || []).length;
    const lows = Array(n).fill("low");
    return gradientFromAdjusted(lows);
  }

  function layerExists(map: mapboxgl.Map, id: string) {
    try { return !!map.getLayer(id); } catch { return false; }
  }
  function setVisibilitySafe(map: mapboxgl.Map, id: string, visible: boolean) {
    if (!layerExists(map, id)) return;
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
  function setPaintSafe(map: mapboxgl.Map, id: string, prop: string, value: any) {
    if (!layerExists(map, id)) return;
    map.setPaintProperty(id, prop, value);
  }

  useEffect(() => {
    // If user is in "No Traffic", make sure we fetch the baseline for the selected route
    if (currentTrafficView !== "none") return;
    if (!routes.length) return;

    const idx = selectedRouteIdx;

    if (baselineInflightRef.current.has(idx)) return;

    const hasBaseline =
      !!baselineCacheRef.current.get(idx) ||
      !!(routesNoTraffic[idx]?.duration);

    if (!hasBaseline) {
      // optional: show "…" immediately for ETA while we compute
      setTravelTime(null);
      ensureBaselineForIndex(idx);
    }
  }, [currentTrafficView, routes, selectedRouteIdx]);




  function selectRoute(idx: number) {
    const map = mapInstanceRef.current;
    const mapF = mapForecastInstanceRef.current;
    if (!map || !mapF) return;



    routes.forEach((_, i) => {
      // forecast
      setVisibilitySafe(mapF, `route-forecast-line-${i}`, i === idx);
      // current (traffic + no-traffic)
      setVisibilitySafe(map, `route-current-line-${i}`, i === idx && currentTrafficView === "current");
      setVisibilitySafe(map, `route-current-none-line-${i}`, i === idx && currentTrafficView === "none");
    });


    setSelectedRouteIdx(idx);



    // Always (re)set the true baseline for the selected route
    const baselineRoute = routesNoTraffic[idx] || null;
    setBaseTrafficTime(baselineRoute ? Math.round(baselineRoute.duration / 60) : null);

    // Set the currently displayed ETA based on the left-view toggle
    if (currentTrafficView === "current" && routes[idx]) {
      setTravelTime(Math.round(routes[idx].duration / 60));
    } else if (currentTrafficView === "none" && baselineRoute) {
      setTravelTime(Math.round(baselineRoute.duration / 60));
    }

    // If user is in "No Traffic" mode and we don't have this route's baseline yet, fetch it
    if (currentTrafficView === "none") {
      const cached = baselineCacheRef.current.get(idx);
      if (!cached?.duration) {
        // fire-and-forget; the loading indicator will show
        ensureBaselineForIndex(idx);
      }
    }


  }


  useEffect(() => {
    const map = mapInstanceRef.current;
    const mapF = mapForecastInstanceRef.current;
    if (!map || !mapF || !routes.length) return;

    routes.forEach((_, i) => {
      setVisibilitySafe(map, `route-current-line-${i}`,     i === selectedRouteIdx && currentTrafficView === "current");
      setVisibilitySafe(map, `route-current-none-line-${i}`,i === selectedRouteIdx && currentTrafficView === "none");
      setVisibilitySafe(mapF, `route-forecast-line-${i}`,   i === selectedRouteIdx);
    });

    // update ETA when switching view
    if (currentTrafficView === "current" && routes[selectedRouteIdx]) {
      setTravelTime(Math.round(routes[selectedRouteIdx].duration / 60));
    } else if (currentTrafficView === "none" && routesNoTraffic[selectedRouteIdx]) {
      setTravelTime(Math.round(routesNoTraffic[selectedRouteIdx].duration / 60));
    }
  }, [currentTrafficView, selectedRouteIdx, routes, routesNoTraffic]);




  function cleanupAllRoutes(mp: mapboxgl.Map | null) {
    if (!mp) return;
    if (!mp.isStyleLoaded()) {
      mp.once("styledata", () => cleanupAllRoutes(mp));
      return;
    }

    const layers = mp.getStyle().layers || [];
    for (const layer of layers) {
      if (
        layer.id.startsWith("route-current-line-") ||
        layer.id.startsWith("route-current-none-line-") || 
        layer.id.startsWith("route-forecast-line-")
      ) {
        if (mp.getLayer(layer.id)) mp.removeLayer(layer.id);
      }
    }

    const sources = mp.getStyle().sources || {};
    for (const id in sources) {
      if (
        id.startsWith("route-current-src-") ||
        id.startsWith("route-current-none-src-") || 
        id.startsWith("route-forecast-src-")
      ) {
        if (mp.getSource(id)) mp.removeSource(id);
      }
    }
  }

  // Clear all route layers/sources + route-related state on BOTH maps
  // Remove all route layers/sources and route-related state — DO NOT touch pins/addresses
  function clearRoutesOnly() {
    // cancel any baseline in-flight
    if (baselineInflightRef?.current?.size) {
      baselineInflightRef.current.forEach((ac) => ac.abort());
      baselineInflightRef.current.clear();
    }
    baselineCacheRef?.current?.clear?.();

    // remove polylines from both maps
    cleanupAllRoutes?.(mapInstanceRef?.current || null);
    cleanupAllRoutes?.(mapForecastInstanceRef?.current || null);

    // reset route state/UI only
    setRoutes([]);
    setRoutesNoTraffic([]);
    setSelectedRouteIdx(0);
    setTravelTime(null);
    setForecastTravelTime(null);
    setBaseTrafficTime(null);
    setPeakTime(null);
  }


  // Clear origin marker + state
  function clearOriginSide() {
    originMarkerRef.current?.remove();
    originMarkerRef.current = null;
    originForecastMarkerRef.current?.remove();
    originForecastMarkerRef.current = null;

    setOrigin("");
    setOriginCoords(null);

    clearRoutesOnly();
  }

  // Clear destination marker + state
  function clearDestinationSide() {
    destinationMarkerRef.current?.remove();
    destinationMarkerRef.current = null;
    destinationForecastMarkerRef.current?.remove();
    destinationForecastMarkerRef.current = null;

    setDestination("");
    setDestinationCoords(null);
    clearRoutesOnly();
  }




  // State for holding the county GeoJSON data from /public/wa_counties.geojson
  //const [countyData, setCountyData] = useState<any>(null);

  const isPointInRegion = (coords: [number, number], region: any): boolean => {
    if (!region || !region.features) return false;

    const pt = point(coords);

    // If region is a FeatureCollection, check against all features
    return region.features.some((feature: any) => {
      try {
        return booleanPointInPolygon(pt, feature);
      } catch (err) {
        console.warn("Invalid geometry in region feature:", err);
        return false;
      }
    });
  };



  // Initialize maps when container refs are available.
  useEffect(() => {
    if (mapContainerRef.current) {
      mapInstanceRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-122.3505, 47.6206],
        zoom: 12,
      });
      mapInstanceRef.current.on("load", () => {
        setMapLoaded(true);
      });
    }
    if (mapForecastContainerRef.current) {
      mapForecastInstanceRef.current = new mapboxgl.Map({
        container: mapForecastContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-122.3505, 47.6206],
        zoom: 12,
      });
      mapForecastInstanceRef.current.on("load", () => {
        setMapForecastLoaded(true);
      });
    }
    return () => {
      if (mapInstanceRef.current) mapInstanceRef.current.remove();
      if (mapForecastInstanceRef.current) mapForecastInstanceRef.current.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapForecastLoaded || !selectedCountyOption) return;

    const geojsonPath =
      selectedCountyOption === "psrc"
        ? "/data/psrc/psrc_outline.geojson"
        : "/data/trpc/trpc_outline.geojson";

    fetch(geojsonPath)
      .then((response) => response.json())
      .then((geojsonData) => {

        setRegionGeoJSON(geojsonData);

        const updateLayer = (map: mapboxgl.Map, layerId: string) => {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(layerId)) map.removeSource(layerId);

          map.addSource(layerId, {
            type: "geojson",
            data: geojsonData,
          });

          map.addLayer({
            id: layerId,
            type: "line",
            source: layerId,
            layout: {},
            paint: {
              "line-color": "#FF0000",
              "line-width": 2,
              "line-opacity": 0.5,
            },
          }, map_layer);

          // Fit map to outline bounds
          const bounds = new mapboxgl.LngLatBounds();
          geojsonData.features.forEach((feature: any) => {
            const coords = feature.geometry.coordinates.flat(Infinity);
            for (let i = 0; i < coords.length; i += 2) {
              bounds.extend([coords[i], coords[i + 1]]);
            }
          });
          map.fitBounds(bounds, { padding: 50 });
        };

        if (mapInstanceRef.current) updateLayer(mapInstanceRef.current, "county-outline");
        if (mapForecastInstanceRef.current) updateLayer(mapForecastInstanceRef.current, "county-outline");
      })
      .catch((err) => console.error("Error loading selected county outline:", err));
  }, [selectedCountyOption, mapLoaded, mapForecastLoaded]);



  useEffect(() => {
    if (!mapInstanceRef.current || !mapForecastInstanceRef.current) return;

    baselineInflightRef.current.forEach((ac) => ac.abort());
    baselineInflightRef.current.clear();
    baselineCacheRef.current.clear();
    setRoutesNoTraffic([]);        // <<< important
    setBaselineLoadingIdx(null);

    // Reset inputs
    setOrigin("");
    setDestination("");
    setOriginCoords(null);
    setDestinationCoords(null);
    setForecastTravelTime(null);

    // Remove markers
    originMarkerRef.current?.remove();
    originForecastMarkerRef.current?.remove();
    destinationMarkerRef.current?.remove();
    destinationForecastMarkerRef.current?.remove();

    cleanupAllRoutes(mapInstanceRef.current);
    cleanupAllRoutes(mapForecastInstanceRef.current);

    setRoutes([]);
    setSelectedRouteIdx(0);
    setForecastMultiplier(null);
    setTravelTime(null);
    setForecastTravelTime(null);
    setPeakTime(null);
    setBaseTrafficTime(null);
    setMultiplier2050(null);


  }, [selectedCountyOption]);

  const fetchMultiplier = async (
    originCoords: [number, number],
    destinationCoords: [number, number],
    region: string
  ): Promise<number | null> => {
    try {
      const endpoint =
        region === "psrc" ? "/api/psrc-multiplier" : "/api/trpc-multiplier";
      const url = `${endpoint}?originLat=${originCoords[1]}&originLng=${originCoords[0]}&destinationLat=${destinationCoords[1]}&destinationLng=${destinationCoords[0]}`;
      const res = await fetch(url)
      const data = await res.json()
      //console.log('TAZs:', data.originTaz, data.destinationTaz)
      //console.log('Multiplier:', data.multiplier)
      //console.log('Source Multiplier:', data.sourceMultiplier)
      if (region === "psrc" && data.sourceMultiplier) {
        setPeakTime(time_slots[data.sourceMultiplier]);
        setDepartAtTime(depart_at[data.sourceMultiplier]);
      } else if (region === "trpc" && data.sourceMultiplier) {
          setPeakTime(time_slots_trpc[data.sourceMultiplier]);
          setDepartAtTime(depart_at_trpc[data.sourceMultiplier]);
      }  else {
        // fallback: default to 5 PM
          setPeakTime("Peak time: 5 PM to 6 PM");
          setDepartAtTime("17:00");
      } 
      const m = data.multiplier ?? null;
      setMultiplier2050(m);
      return m;
    } catch (err) {
      //console.error("Error fetching multiplier:", err)
      return null
    }
  }

  const getRoutesCurrentOnly = async (
    originCoords: [number, number],
    destinationCoords: [number, number]
  ) => {
    const map = mapInstanceRef.current;
    const mapF = mapForecastInstanceRef.current;
    if (!map || !mapF) return;

    setBaseTrafficTime(null);
    setMultiplier2050(null);
    setTravelTime(null);
    setForecastTravelTime(null);
    setPeakTime(null);
    setBaseTrafficTime(null);
    setRoutesNoTraffic([]);        // <<< important
    setBaselineLoadingIdx(null);


    const timePart = departAtTime || "17:00";
    const datePart = getNextWeeksThursday();
    const departAtParam = `&depart_at=${encodeURIComponent(`${datePart}T${timePart}`)}`;

    const baseQS = `?geometries=geojson&overview=full&steps=false&alternatives=true&access_token=${mapboxgl.accessToken}`;

    const urlTraffic =
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
      `${originCoords[0]},${originCoords[1]};${destinationCoords[0]},${destinationCoords[1]}` +
      `${baseQS}&annotations=congestion,duration,distance${departAtParam}`;


    let dataTraffic: any;

    setTrafficLoading(true)
    setTravelTime(null);
    try {
      const resT = await fetch(urlTraffic);
      dataTraffic = await resT.json();          
    } catch (e) {
      console.error("Directions fetch failed", e);
      return;
    } finally {
      setTrafficLoading(false)
    }

    if (!dataTraffic?.routes?.length) {
      setRoutes([]);
      setRoutesNoTraffic([]);
      return;
    }

    const trafficRoutes = dataTraffic.routes;

    setRoutesNoTraffic(Array(trafficRoutes.length).fill(null));

    setRoutes(trafficRoutes);

    if (currentTrafficView === "none") {
      setTravelTime(null); // show "…" while computing
      const idx = selectedRouteIdx; // usually 0 here
      const fresh = trafficRoutes[idx];
      if (fresh) ensureBaselineForIndex(idx, fresh);
    }

    mapInstanceRef.current?.fitBounds(
      turf.bbox(turf.lineString(trafficRoutes[0].geometry.coordinates)),
      { padding: 80, maxZoom: 14, duration: 600 }
    );

    mapForecastInstanceRef.current?.fitBounds(
      turf.bbox(turf.lineString(trafficRoutes[0].geometry.coordinates)),
      { padding: 80, maxZoom: 14, duration: 600 }
    );


    // build aligned "no-traffic" baselines via Map Matching (same order, same path)
    // const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;
    // const abort = new AbortController(); 
    // const signal = abort.signal;

    // const matchedBaselines = await Promise.all(
    //   trafficRoutes.map((r: any) => matchBaselineForSamePath(r, token, signal))
    // );

    // // Keep 1:1 alignment with traffic routes (index i ↔ i)
    // const alignedNoTraffic = matchedBaselines.map((b) => b ?? null);
    // setRoutesNoTraffic(alignedNoTraffic);

    // const i = 0; 
    // if (alignedNoTraffic[i]) {
    //   const baseMin = Math.round(alignedNoTraffic[i]!.duration / 60);
    //   setBaseTrafficTime(baseMin); 
    // } else {
    //   setBaseTrafficTime(null);
    // }

    // initialize a sparse array matching the number of traffic routes (all null)
    //setRoutesNoTraffic(Array(trafficRoutes.length).fill(null));
    // We will lazily fill each index on demand when user toggles "No Traffic"
    setBaseTrafficTime(null);



    // fetch multiplier once
    const mult = await fetchMultiplier(originCoords, destinationCoords, selectedCountyOption);
    setForecastMultiplier(mult ?? null);

    // cleanup previous route layers/sources on both maps
    const cleanup = (mp: mapboxgl.Map) => {
      mp.getStyle().layers?.forEach((l) => {
        if (
          l.id.startsWith("route-current-line-") ||
          l.id.startsWith("route-current-none-line-") || 
          l.id.startsWith("route-forecast-line-")
        ) {
          mp.removeLayer(l.id);
        }
      });
      Object.keys((mp.getStyle() as any).sources || {}).forEach((sid) => {
        if (
          sid.startsWith("route-current-src-") ||
          sid.startsWith("route-current-none-src-") ||
          sid.startsWith("route-forecast-src-")
        ) {
          mp.removeSource(sid);
        }
      });
    };

    cleanup(map);
    cleanup(mapF);

    // draw all routes once
    dataTraffic.routes.forEach((route: any, i: number) => {
      const geometry = route.geometry;
      const annotation = route.legs?.[0]?.annotation || {};
      const dists = annotation.distance || [];


      // CURRENT map
      map.addSource(`route-current-src-${i}`, {
        type: "geojson",
        lineMetrics: true,
        data: { type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: {} }] },
      });
      map.addLayer({
        id: `route-current-line-${i}`,
        type: "line",
        source: `route-current-src-${i}`,
        layout: { "line-join": "round", "line-cap": "round", visibility: i === 0 ? "visible" : "none" },
        paint: {
          "line-gradient": gradientFromAnnotation(annotation),
          "line-width": 5,
          "line-opacity": 0.8,
        },
      }, map_layer);

      // CURRENT (no-traffic) source + layer using the **no-traffic** geometry
      // const ntRoute = dataNoTraffic.routes?.[i] ?? dataNoTraffic.routes?.[0];
      // const ntGeom = ntRoute?.geometry ?? geometry; // fallback if not enough alts

      map.addSource(`route-current-none-src-${i}`, {
        type: "geojson",
        lineMetrics: true,
        data: { type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: {} }] },
      });

      // map.addSource(`route-current-none-src-${i}`, {
      //   type: "geojson",
      //   lineMetrics: true,
      //   data: { type: "FeatureCollection", features: [{ type: "Feature", geometry: ntGeom, properties: {} }] },
      // });
      map.addLayer({
        id: `route-current-none-line-${i}`,
        type: "line",
        source: `route-current-none-src-${i}`,
        layout: { "line-join": "round", "line-cap": "round", visibility: (i === 0 && currentTrafficView === "none") ? "visible" : "none" },
        paint: { "line-gradient": gradientNoTraffic(annotation), "line-width": 5, "line-opacity": 0.8 },
      }, map_layer);

    
      mapF.addSource(`route-forecast-src-${i}`, {
        type: "geojson",
        lineMetrics: true,
        data: { type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: {} }] },
      });

      const trafficMin = Math.round((route.duration ?? 0) / 60);  // <- always traffic
      let forecastGradient = gradientFromAnnotation(annotation);
      if (forecastTravelTime != null) {
        const deltaMin = Math.max(0, Math.round(forecastTravelTime - trafficMin));
        if (deltaMin > 0) {
          const wr = worsenRoute(route, { targetDeltaMinutes: deltaMin, seed: 42, preferHighways: true });
          forecastGradient = gradientFromAdjusted(wr.adjustedLevels);
        }
      }

      
      mapF.addLayer(
        {
          id: `route-forecast-line-${i}`,
          type: "line",
          source: `route-forecast-src-${i}`,
          layout: {
            "line-join": "round",
            "line-cap": "round",
            visibility: i === 0 ? "visible" : "none",
          },
          paint: {
            "line-gradient": forecastGradient,
            "line-width": 5,
            "line-opacity": 0.8,
          },
        },
        map_layer
      );

    });

    // store routes + set ETAs for route 0
    //setRoutes(dataTraffic.routes);
    //setRoutesNoTraffic(dataNoTraffic.routes ?? []);
    setSelectedRouteIdx(0);

    const etaTraffic0 = Math.round(dataTraffic.routes[0].duration / 60);
    //const etaNoTraffic0 = dataNoTraffic.routes?.[0] ? Math.round(dataNoTraffic.routes[0].duration / 60) : null;
    //const etaNoTraffic0 = alignedNoTraffic[0] ? Math.round(alignedNoTraffic[0]!.duration / 60) : null;

    //setBaseTrafficTime(etaTraffic0);

    if (currentTrafficView === "current") setTravelTime(etaTraffic0);
    //else if (etaNoTraffic0 != null) setTravelTime(etaNoTraffic0);

    //if (mult != null) setForecastTravelTime(Math.round(etaTraffic0 *  mult));

    // fit both maps to O/D
    //const bounds = new mapboxgl.LngLatBounds();
    //bounds.extend(originCoords).extend(destinationCoords);
    //map.fitBounds(bounds, { padding: { top: 120, bottom: 50, left: 50, right: 50 } });
    //mapF.fitBounds(bounds, { padding: { top: 120, bottom: 50, left: 50, right: 50 } });
  };

  useEffect(() => {
    if (!routes.length || selectedRouteIdx == null || multiplier2050 == null) {
      setForecastTravelTime(null);
      return;
    }
    // always use CURRENT-TRAFFIC minutes for the projection baseline
    const trafficMin = Math.round((routes[selectedRouteIdx]?.duration ?? 0) / 60);
    // projectTime should handle intermediate years + multipliers < 1
    setForecastTravelTime(projectTime(trafficMin, multiplier2050, forecastYear));
  }, [routes, selectedRouteIdx, multiplier2050, forecastYear]);


  // forecastTravelTime = CURRENT TRAFFIC minutes × multiplier_from_DB (can be < 1)
  useEffect(() => {
    if (!routes.length || selectedRouteIdx == null || forecastMultiplier == null) {
      setForecastTravelTime(null);
      return;
    }
    const trafficRoute = routes[selectedRouteIdx];     // driving-traffic route
    if (!trafficRoute) { setForecastTravelTime(null); return; }

    const trafficMin = Math.round(trafficRoute.duration / 60);
    setForecastTravelTime(Math.round(trafficMin * forecastMultiplier)); // <-- no clamp
  }, [routes, selectedRouteIdx, forecastMultiplier]);


  function TinySpinner() {
    return (
      <svg
        className="ml-2 inline-block animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        aria-label="Loading"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"></circle>
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3"></path>
      </svg>
    );
  }

  const isTrafficLoadingDisplay =
    currentTrafficView === "current" && trafficLoading;


  return (
    <div className="flex gap-4 w-full h-[500px] p-0 m-0">
      {/* Top Controls Row: Search Inputs + Filters */}
      <div className="flex flex-col gap-4 w-3/12 h-full">

        {/* Filters on the Right */}
        <div className="p-3 bg-white border rounded-lg shadow-md w-full ">
          <label htmlFor="county-select" className="block text-lg font-semibold mb-2">
            Select Model
          </label>
          <div className="flex items-center gap-2">
            <select
              id="county-select"
              className="w-full rounded-sm p-2"
              value={selectedCountyOption}
              //defaultValue="psrc"
              onChange={(e) => setSelectedCountyOption(e.target.value)}
            >              
              <option value="psrc">Puget Sound Regional Council</option>
              <option value="trpc">Thurston Regional Planning Council</option>
            </select>
          </div>
        </div>
      {/* Search Box Container */}
      <div className="p-3 bg-white border rounded-lg shadow-md w-full min-h-[150px]">
        {mapLoaded ? (
          <>
            <div className="mb-2">
              <label htmlFor="vehicle-mode-select" className="block text-lg font-semibold mb-2">
                Origin & Destination
              </label>
              <form autoComplete="off">
                <SearchBox
                  // @ts-ignore
                  accessToken={mapboxgl.accessToken}
                  //map={!suppressAutoZoom ? mapInstanceRef.current : null}
                  mapboxgl={mapboxgl}
                  placeholder="Enter origin address"
                  options={{ language: "en", country: "US", proximity: [-122.3505, 47.6206] }}
                  //onChange={(d) => setOrigin(d)}
                  onChange={(d) => {
                    setOrigin(d);
                    if (!d) {
                      // user cleared the box — remove pin and all routes
                      clearOriginSide();  
                    }
                  }}
                  onClear={() => {            
                    clearOriginSide();
                  }}

                  autoComplete="off"
                  onRetrieve={(res) => {
                    if (res.features?.[0]) {
                      const coords = res.features[0].geometry.coordinates as [number, number];
                      const isValid = isPointInRegion(coords, regionGeoJSON);
                      setSuppressAutoZoom(!isValid);

                      if (!isValid) {
                        alert("Selected location is outside the selected region.");
                        setOrigin("");
                        return;
                      }
                      setOriginCoords(coords);
                      setOrigin(res.features[0].properties.name);
                      if (destinationCoords) getRoutesCurrentOnly(coords, destinationCoords);
                      if (mapInstanceRef.current) {
                        originMarkerRef.current?.remove();
                        originMarkerRef.current = new mapboxgl.Marker({ color: "blue" })
                          .setLngLat(coords)
                          .addTo(mapInstanceRef.current);
                      }
                      if (mapForecastInstanceRef.current) {
                        originForecastMarkerRef.current?.remove();
                        originForecastMarkerRef.current = new mapboxgl.Marker({ color: "blue" })
                          .setLngLat(coords)
                          .addTo(mapForecastInstanceRef.current);
                        const currentZoom = mapInstanceRef.current?.getZoom() ?? 12;
                        mapInstanceRef.current?.easeTo({ center: coords, zoom: currentZoom });
                        mapForecastInstanceRef.current?.easeTo({ center: coords, zoom: currentZoom });

                      }
                    }
                  }}
                  value={origin}
                />
              </form>
            </div>

            <div>
              <SearchBox
                // @ts-ignore
                accessToken={mapboxgl.accessToken}
                //map={!suppressAutoZoom ? mapInstanceRef.current : null}
                mapboxgl={mapboxgl}
                placeholder="Enter destination address"
                options={{ language: "en", country: "US", proximity: [-122.3505, 47.6206] }}
                //onChange={(d) => setDestination(d)}
                onChange={(d) => {
                  setDestination(d);
                  if (!d) {
                    // user cleared the box — remove pin and all routes
                    clearDestinationSide();
                  }
                }}
                onClear={() => {            
                  clearDestinationSide();
                }}
                onRetrieve={(res) => {
                  if (res.features?.[0]) {
                    const coords = res.features[0].geometry.coordinates as [number, number];

                    const isValid = isPointInRegion(coords, regionGeoJSON);
                    setSuppressAutoZoom(!isValid);

                    if (!isValid) {
                      alert("Selected location is outside the selected region.");
                      setDestination("");
                      return;
                    }

                    setDestinationCoords(coords);
                    setDestination(res.features[0].properties.name);
                    if (originCoords) getRoutesCurrentOnly(originCoords, coords);
                    if (mapInstanceRef.current) {
                      destinationMarkerRef.current?.remove();
                      destinationMarkerRef.current = new mapboxgl.Marker({ color: "#EA4335" })
                        .setLngLat(coords)
                        .addTo(mapInstanceRef.current);
                      mapInstanceRef.current.setCenter(coords);
                    }
                    if (mapForecastInstanceRef.current) {
                      destinationForecastMarkerRef.current?.remove();
                      destinationForecastMarkerRef.current = new mapboxgl.Marker({ color: "#EA4335" })
                        .setLngLat(coords)
                        .addTo(mapForecastInstanceRef.current);
                      const currentZoom = mapInstanceRef.current?.getZoom() ?? 12;
                      mapInstanceRef.current?.easeTo({ center: coords, zoom: currentZoom });
                      mapForecastInstanceRef.current?.easeTo({ center: coords, zoom: currentZoom, duration: 300 });

                    }
                  }
                }}
                value={destination}
              />
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500">Loading map and inputs…</div>
        )}
      </div>

      
    </div>

    {/* Map Containers */}
    <div className="flex-1 flex gap-4 w-9/12 h-full">

      <div className="flex-1 relative rounded-lg shadow-md border h-full" >
        <div className="absolute top-2 left-2 bg-white bg-opacity-90 p-2 rounded text-sm font-medium shadow z-10">

          <div className={`flex items-center gap-3 ${routes.length > 1 ? "justify-between" : ""}`}>
            <h4 className="text-lg font-semibold mb-0">
              <select
                className="mr-1 rounded-lg"
                value={currentTrafficView}
                // onChange={(e) => {
                //   const v = e.target.value as "current" | "none";
                //   setCurrentTrafficView(v);
                //   // update ETA shown on the left when switching
                //   const rIdx = selectedRouteIdx;
                //   if (v === "current" && routes[rIdx]) {
                //     setTravelTime(Math.round(routes[rIdx].duration / 60));
                //   } else if (v === "none" && routesNoTraffic[rIdx]) {
                //     setTravelTime(Math.round(routesNoTraffic[rIdx].duration / 60));
                //   }
                // }}
                onChange={async (e) => {
                  const v = e.target.value as "current" | "none";
                  setCurrentTrafficView(v);
                  const rIdx = selectedRouteIdx;

                  if (v === "current") {
                    if (routes[rIdx]) setTravelTime(Math.round(routes[rIdx].duration / 60));
                    return;
                  }

                  // v === "none": if we already have the baseline, use it; else fetch lazily
                  const cached = baselineCacheRef.current.get(rIdx);
                  if (cached?.duration != null) {
                    setTravelTime(Math.round(cached.duration / 60));
                    setBaseTrafficTime(Math.round(cached.duration / 60));
                  } else {
                    // show loading state immediately
                    setTravelTime(null);
                    setBaseTrafficTime(null);
                    await ensureBaselineForIndex(rIdx);
                  }
                }}

              >
                <option value="current">Current Traffic</option>
                <option value="none">No Traffic</option>
              </select>
              {(isBaselineLoading || isTrafficLoadingDisplay) && <TinySpinner />}
            </h4>



            {/* Route toggle */}
            {/*{routes.length > 1 && (
              <div className="ml-auto flex items-center rounded-full border border-gray-300 overflow-hidden">
                {[...Array(routes.length)].map((_, i) => {
                  const active = i === selectedRouteIdx;
                  return (
                    <button
                      key={i}
                      onClick={() => selectRoute(i)}
                      disabled={active}
                      className={[
                        "px-2 h-6 text-[11px] font-semibold",
                        "focus:outline-none transition",
                        active
                          ? "bg-white text-black"
                          : "bg-gray-200/80 text-gray-700 hover:bg-gray-200",
                      ].join(" ")}
                      style={{ lineHeight: 1 }}
                      aria-pressed={active}
                      aria-label={`Show route ${i + 1} of ${routes.length}`}
                      title={`Show route ${i + 1}`}
                    >
                      {`Route ${i + 1}`}
                    </button>
                  );
                })}
              </div>
            )}*/}
          </div>

          <div className="mt-1 text-sm font-normal text-gray-700">
            {/*{peakTime && <span className="mr-2">{peakTime}</span>}*/}
            {/*{routes.length > 0 && travelTime != null && <span><br/>Estimated time: {formatMinutes(travelTime)}</span>}*/}
            {routes.length > 0 && (
              <div className="mt-1 ml-1 text-sm text-neutral-700">
                <div>
                  Estimated time:{" "}
                  {(currentTrafficView === "none" && isBaselineLoading) ||
                  (currentTrafficView === "current" && isTrafficLoadingDisplay)
                    ? "…"
                    : (travelTime != null ? formatMinutes(travelTime) : "—")}
                </div>
                {peakTime != null && (
                  <div>
                    {peakTime}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
        <div
          id="map-container"
          ref={mapContainerRef}
          style={{ height: "100%", borderRadius: 8 }}
          className="absolute inset-0 h-full rounded-lg border"
        />

        {/*top-right Route pill (LEFT map only) */}
        {routes.length > 1 && (
          <div className="absolute top-2 right-2 z-10">
            <div className="flex items-center bg-white/90 backdrop-blur rounded-full border border-gray-300 shadow overflow-hidden">

              {/* buttons */}
              {[0, 1].map((i) =>
                routes[i] ? (
                  <button
                    key={`route-chip-${i}`}
                    onClick={() => selectRoute(i)}
                    disabled={i === selectedRouteIdx}
                    aria-label={`Route ${i + 1}`}
                    title={`Route ${i + 1}`}
                    className={[
                      "h-7 px-2 text-xs tabular-nums font-semibold border-l border-gray-300 transition",
                      i === selectedRouteIdx
                        ? "bg-black text-white"
                        : "bg-white text-gray-800 hover:bg-gray-50",
                    ].join(" ")}
                    style={{ lineHeight: 1 }}
                  >
                    Route {i + 1}
                  </button>
                ) : null
              )}
            </div>
          </div>
        )}


      </div>

      <div className="flex-1 relative rounded-lg shadow-md h-full" >
        <div className="absolute top-2 left-2 bg-white bg-opacity-90 p-2 rounded text-sm font-medium shadow z-10">
          <h4 className="text-lg font-semibold mb-0">
            
            <select 
              className="mr-1 rounded-lg" 
              value={forecastYear} 
              onChange={(e) => setForecastYear(Number(e.target.value) as 2030 | 2040 | 2050)}
            >
              <option value="2030">2030</option>
              <option value="2040">2040</option>
              <option value="2050">2050</option>
            </select>
            Forecast
          </h4>
          {routes.length > 0 && forecastTravelTime && travelTime && (
            <span className="text-sm font-normal">
              {`Estimated time: ${formatMinutes(forecastTravelTime)} `} 
              {forecastTravelTime > travelTime && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    color: "#ff0000",
                    fontSize: "1em",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    width="1em"
                    height="0.8em"
                    fill="currentColor"
                    style={{ marginBottom: "0.1em" }}
                  >
                    <path d="M8 15V3M8 3l-4 4m4-4l4 4" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>

              )}            
            </span>
          )}
        </div>
        <div
          id="map-forecast-container"
          ref={mapForecastContainerRef}
          style={{ height: "100%", borderRadius: 8 }}
          className="absolute inset-0 h-full rounded-lg border"
        />
      </div>
    </div>
  </div>
);


};

export default MapRoute;
