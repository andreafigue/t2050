// @ts-nocheck
"use client";

import React, { useRef, useState, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import dynamic from "next/dynamic";
//import "../globals2.css";
import { worsenRoute } from "./worsenRoute"; // adjust path

import * as turf from "@turf/turf";
import * as d3 from "d3";

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
  const [showCompareMap, setShowCompareMap] = useState(false);
  const [compareYear, setCompareYear] = useState<2030 | 2040 | 2050 | 'current' | 'none'>(2050);
  const [compareTravelTime, setCompareTravelTime] = useState<number | null>(null);

  // Origin & destination states
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
  const [departAtTime, setDepartAtTime] = useState<string | null>(null);

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

  const [userDepartTime, setUserDepartTime] = useState<string>("17:00");


  // Travel time estimates
  const [travelTime, setTravelTime] = useState<number | null>(null);
  const [forecastTravelTime, setForecastTravelTime] = useState<number | null>(null);
  const [peakTime, setPeakTime] = useState<string | null>(null);

  // Year
  const [forecastYear, setForecastYear] = useState<2030 | 2040 | 2050 | 'current' | 'none'>(2050);
  const [multiplier2050, setMultiplier2050] = useState<number | null>(null);

  const forecastYearRef = useRef(forecastYear);
  const compareYearRef = useRef(compareYear);



  const [baseTrafficTime, setBaseTrafficTime] = useState<number | null>(null);

  // Bridge layer
  const [showBridgesLayer, setShowBridgesLayer] = useState(false);
  const [bridgesData, setBridgesData] = useState<any[]>([]);
  const [bridgesLoading, setBridgesLoading] = useState(false);
  const [bridgeConditionFilters, setBridgeConditionFilters] = useState({
    fair: true,
    poor: true,
    good: false,
  });
  const [bridgeColorMode, setBridgeColorMode] = useState<'condition' | 'detour'>('condition');
  const [bridgeDetourFilters, setBridgeDetourFilters] = useState({
    noDetour: true, short: true, medium: true, long: true, veryLong: true,
  });
  const [showBridgeInfoTooltip, setShowBridgeInfoTooltip] = useState(false);

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
    year: 2030 | 2040 | 2050 | 'current' | 'none',
    baseYear = 2025 // treat “today” as the baseline
  ) => {
    if (year === 'current' || year === 'none') return baseMinutes;
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



  useEffect(() => {
    const mapF = mapForecastInstanceRef.current;
    if (!mapF || !routes.length || forecastTravelTime == null) return;
    if (forecastYear === 'none') return;

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
        mapF.setLayoutProperty(                                          
          `route-forecast-line-${i}`,                                   
          "visibility",                                                  
          i === selectedRouteIdx && forecastYear !== 'none' ? "visible" : "none"  
        ); 
      }
    });
  }, [routes, forecastTravelTime, forecastYear, selectedRouteIdx]);

  useEffect(() => {
    forecastYearRef.current = forecastYear;
  }, [forecastYear]);

  useEffect(() => {
    compareYearRef.current = compareYear;
  }, [compareYear]);

  // Update forecast gradient on compare map when compareTravelTime changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !routes.length || compareTravelTime == null) return;
    routes.forEach((route, i) => {
      const annotation = route.legs?.[0]?.annotation || {};
      const trafficMin = Math.round((route.duration ?? 0) / 60);
      const deltaMin = Math.max(0, Math.round(compareTravelTime - trafficMin));
      const gradient = deltaMin > 0
        ? (() => { const wr = worsenRoute(route, { targetDeltaMinutes: deltaMin, seed: 42, preferHighways: true }); return gradientFromAdjusted(wr.adjustedLevels); })()
        : gradientFromAnnotation(annotation);
      if (map.getLayer(`route-forecast-line-${i}`)) {
        map.setPaintProperty(`route-forecast-line-${i}`, "line-gradient", gradient);
      }
    });
  }, [routes, compareTravelTime]);


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

        // Always update baseTrafficTime for the selected route
        if (selectedRouteIdx === idx) {
          setBaseTrafficTime(Math.round(res.duration / 60));
          if (currentTrafficView === "none") {
            setTravelTime(Math.round(res.duration / 60));
          }
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
    if (!levels.length) return ["interpolate", ["linear"], ["line-progress"], 0, CONGESTION_COLORS.unknown, 1, CONGESTION_COLORS.unknown];

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
    if (!adjusted.length) return ["interpolate", ["linear"], ["line-progress"], 0, CONGESTION_COLORS.unknown, 1, CONGESTION_COLORS.unknown];
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
  }, [currentTrafficView, routes, selectedRouteIdx, userDepartTime]);




  function selectRoute(idx: number) {
    const map = mapInstanceRef.current;
    const mapF = mapForecastInstanceRef.current;
    if (!mapF) return;



    routes.forEach((_, i) => {
      // main (forecast) map
      setVisibilitySafe(mapF, `route-forecast-line-${i}`,      i === idx && forecastYear !== 'none');
      setVisibilitySafe(mapF, `route-forecast-none-line-${i}`, i === idx && forecastYear === 'none');
      // compare map
      if (map) {
        setVisibilitySafe(map, `route-forecast-line-${i}`,      i === idx && compareYear !== 'none');
        setVisibilitySafe(map, `route-forecast-none-line-${i}`, i === idx && compareYear === 'none');
      }
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
    if (!mapF || !routes.length) return;

    routes.forEach((_, i) => {
      // main map layers
      setVisibilitySafe(mapF, `route-forecast-line-${i}`,      i === selectedRouteIdx && forecastYear !== 'none');
      setVisibilitySafe(mapF, `route-forecast-none-line-${i}`, i === selectedRouteIdx && forecastYear === 'none');
      // compare map layers
      if (map) {
        setVisibilitySafe(map, `route-forecast-line-${i}`,      i === selectedRouteIdx && compareYear !== 'none');
        setVisibilitySafe(map, `route-forecast-none-line-${i}`, i === selectedRouteIdx && compareYear === 'none');
      }
    });
  }, [forecastYear, compareYear, selectedRouteIdx, routes]);

  // Trigger baseline fetch when main map switches to "No Traffic"
  useEffect(() => {
    if (forecastYear !== 'none' || !routes.length) return;
    const cached = baselineCacheRef.current.get(selectedRouteIdx);
    if (!cached?.duration) ensureBaselineForIndex(selectedRouteIdx);
  }, [forecastYear, selectedRouteIdx, routes]);

  // Trigger baseline fetch when compare map switches to "No Traffic"
  useEffect(() => {
    if (compareYear !== 'none' || !routes.length) return;
    const cached = baselineCacheRef.current.get(selectedRouteIdx);
    if (!cached?.duration) ensureBaselineForIndex(selectedRouteIdx);
  }, [compareYear, selectedRouteIdx, routes]);

  // Resize + re-center main map whenever the compare panel opens or closes
  useEffect(() => {
    if (!routes.length) return;
    const mapF = mapForecastInstanceRef.current;
    if (!mapF || !routes[0]) return;
    // Let the DOM settle after the layout change, then resize + fit
    const timer = setTimeout(() => {
      mapF.resize();
      mapF.fitBounds(
        turf.bbox(turf.lineString(routes[0].geometry.coordinates)) as any,
        { padding: 50, maxZoom: 14, duration: 600 }
      );
    }, 50);
    return () => clearTimeout(timer);
  }, [showCompareMap]);




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
        layer.id.startsWith("route-forecast-line-") ||
        layer.id.startsWith("route-forecast-none-line-")
      ) {
        if (mp.getLayer(layer.id)) mp.removeLayer(layer.id);
      }
    }

    const sources = mp.getStyle().sources || {};
    for (const id in sources) {
      if (
        id.startsWith("route-current-src-") ||
        id.startsWith("route-current-none-src-") ||
        id.startsWith("route-forecast-src-") ||
        id.startsWith("route-forecast-none-src-")
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



  // Initialize forecast map (always-on main map).
  useEffect(() => {
    if (mapForecastContainerRef.current) {
      mapForecastInstanceRef.current = new mapboxgl.Map({
        container: mapForecastContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-122.3505, 47.6206],
        zoom: 12,
        cooperativeGestures: true
      });
      mapForecastInstanceRef.current.on("load", () => {
        setMapForecastLoaded(true);
      });
    }
    return () => {
      if (mapForecastInstanceRef.current) mapForecastInstanceRef.current.remove();
    };
  }, []);

  // Initialize / destroy current-traffic map when compare panel is toggled.
  useEffect(() => {
    if (!showCompareMap) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setMapLoaded(false);
      return;
    }
    if (mapContainerRef.current) {
      mapInstanceRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-122.3505, 47.6206],
        zoom: 12,
        cooperativeGestures: true
      });
      mapInstanceRef.current.on("load", () => {
        setMapLoaded(true);
      });
    }
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setMapLoaded(false);
    };
  }, [showCompareMap]);

  const applyOutlineLayer = (map: mapboxgl.Map, geojsonData: any) => {
    const layerId = "county-outline";
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(layerId)) map.removeSource(layerId);
    map.addSource(layerId, { type: "geojson", data: geojsonData });
    map.addLayer({
      id: layerId,
      type: "line",
      source: layerId,
      layout: {},
      paint: { "line-color": "#FF0000", "line-width": 2, "line-opacity": 0.5 },
    }, map_layer);
    const bounds = new mapboxgl.LngLatBounds();
    geojsonData.features.forEach((feature: any) => {
      const coords = feature.geometry.coordinates.flat(Infinity);
      for (let i = 0; i < coords.length; i += 2) {
        bounds.extend([coords[i], coords[i + 1]]);
      }
    });
    map.fitBounds(bounds, { padding: 30 });
  };

  // ── Bridge layer helpers ──────────────────────────────────────────────────
  const BRIDGE_CONDITION_COLORS: Record<string, string> = {
    Good: "#2ca25f",
    Fair: "#fc8d59",
    Poor: "#e34a33",
  };

  const BRIDGE_DETOUR_COLORS: Record<string, string> = {
    noDetour: "#7a7a7a",
    short: "#c6dbef",
    medium: "#6baed6",
    long: "#2171b5",
    veryLong: "#08306b",
  };

  const getDetourBucket = (detour: any): keyof typeof BRIDGE_DETOUR_COLORS => {
    const d = Number(detour);
    if (!detour || isNaN(d) || d === 0) return 'noDetour';
    if (d <= 5) return 'short';
    if (d <= 20) return 'medium';
    if (d <= 50) return 'long';
    return 'veryLong';
  };

  const CULVERT_DESC: Record<string, string> = {
    "9": "Not applicable", "8": "No deficiencies", "7": "Minor damage",
    "6": "Slight deterioration", "5": "Moderate deterioration", "4": "Major deterioration",
    "3": "Excessive deterioration", "2": "Structural failure", "1": "Closed, light service",
    "0": "Closed, replacement needed",
  };
  const SCOUR_DESC: Record<string, string> = {
    "N": "Not over waterway", "T": "Tidal, low risk", "U": "Tidal, unknown",
    "9": "Dry land", "8": "Stable; above footing", "7": "Countermeasures installed",
    "6": "No evaluation", "5": "Stable; within footing", "4": "Action needed",
    "3": "Scour critical", "2": "Extensive scour", "1": "Imminent failure", "0": "Failed",
  };
  const WORK_TYPE_DESC: Record<string, string> = {
    "31": "Replacement (load/geometry)", "32": "Replacement (relocation)",
    "33": "Widening w/o deck rehab", "34": "Widening w/ deck rehab",
    "35": "Rehabilitation (deterioration)", "36": "Deck rehab w/ incidental widening",
    "37": "Deck replacement w/ incidental widening", "38": "Other structural work",
  };
  const fmtCost = (v: number) => {
    if (!v || isNaN(v)) return "N/A";
    if (v >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B";
    if (v >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
    if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
    return "$" + v;
  };

  const buildBridgePopupHTML = (p: any) => `
    <div style="font-family:sans-serif;font-size:12px;width:260px;box-sizing:border-box">
      <div style="font-weight:bold;font-size:14px;margin-bottom:8px">${p.BridgeName || "Unknown Bridge"}</div>
      <div style="max-height:220px;overflow-y:auto;padding-right:4px">
        <div style="margin-bottom:8px">
          <div><b>Bridge #:</b> ${p.BridgeNumber || "N/A"}</div>
          <div><b>County:</b> ${p.CountyName || "N/A"}</div>
          <div><b>Length (ft):</b> ${p.PrpsedImprvStructureLgthByFT || "N/A"}</div>
          <div><b>Width (ft):</b> ${p.PrpsedImprvRoadwayWdthByFT || "N/A"}</div>
          <div><b>Year Built:</b> ${p.YearBuilt || "N/A"}</div>
          ${p.YearRebuilt ? `<div><b>Year Rebuilt:</b> ${p.YearRebuilt}</div>` : ""}
        </div>
        <hr style="margin:6px 0;border:none;border-top:1px solid #ddd"/>
        <div style="margin-bottom:8px">
          <div style="font-weight:bold;margin-bottom:3px">Condition</div>
          <div><b>Overall:</b> ${p.BridgeOverallConditionState || "N/A"}</div>
          <div><b>Scour:</b> ${SCOUR_DESC[p.ScourCondition] || p.ScourCondition || "N/A"}</div>
          <div><b>Culvert:</b> ${CULVERT_DESC[p.CulvertCondition] || p.CulvertCondition || "N/A"}</div>
        </div>
        <hr style="margin:6px 0;border:none;border-top:1px solid #ddd"/>
        <div>
          <div style="font-weight:bold;margin-bottom:3px">Work & Cost</div>
          <div><b>Type:</b> ${WORK_TYPE_DESC[p.PrpsedImprvTypeOfWork] || "N/A"}</div>
          <div><b>Structure:</b> ${fmtCost((p.PrpsedImprvStructureCost ?? 0) * 1000)}</div>
          <div><b>Total:</b> ${fmtCost((p.PrpsedImprvTotalCost ?? 0) * 1000)}</div>
          <div><b>Detour:</b> ${p.Detour != null ? p.Detour + " mi" : "N/A"}</div>
        </div>
      </div>
    </div>`;

  const addBridgeLayerToMap = (map: mapboxgl.Map, bridges: any[], colorMode: 'condition' | 'detour') => {
    const geojson: any = {
      type: "FeatureCollection",
      features: bridges
        .filter(b => b.Longitude && b.Latitude)
        .map(b => ({
          type: "Feature",
          id: b.BridgeNumber,
          geometry: { type: "Point", coordinates: [+b.Longitude, +b.Latitude] },
          properties: { ...b },
        })),
    };

    const colorExpr = colorMode === 'condition'
      ? [
          "match", ["get", "BridgeOverallConditionState"],
          "Good", BRIDGE_CONDITION_COLORS.Good,
          "Fair", BRIDGE_CONDITION_COLORS.Fair,
          BRIDGE_CONDITION_COLORS.Poor,
        ]
      : [
          "case",
          ["<=", ["coalesce", ["to-number", ["get", "Detour"]], 0], 0], BRIDGE_DETOUR_COLORS.noDetour,
          ["<=", ["to-number", ["get", "Detour"]], 5], BRIDGE_DETOUR_COLORS.short,
          ["<=", ["to-number", ["get", "Detour"]], 20], BRIDGE_DETOUR_COLORS.medium,
          ["<=", ["to-number", ["get", "Detour"]], 50], BRIDGE_DETOUR_COLORS.long,
          BRIDGE_DETOUR_COLORS.veryLong,
        ] as any;

    if (map.getSource("route-bridges")) {
      (map.getSource("route-bridges") as mapboxgl.GeoJSONSource).setData(geojson);
      if (map.getLayer("route-bridges-circle")) {
        map.setLayoutProperty("route-bridges-circle", "visibility", "visible");
        map.setPaintProperty("route-bridges-circle", "circle-color", colorExpr);
      }
      return;
    }

    map.addSource("route-bridges", { type: "geojson", data: geojson, promoteId: "BridgeNumber" });
    map.addLayer({
      id: "route-bridges-circle",
      type: "circle",
      source: "route-bridges",
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          5,  ["case", ["boolean", ["feature-state", "hover"], false], 7,  3],
          8,  ["case", ["boolean", ["feature-state", "hover"], false], 10, 5],
          12, ["case", ["boolean", ["feature-state", "hover"], false], 14, 8],
          16, ["case", ["boolean", ["feature-state", "hover"], false], 18, 12],
        ],
        "circle-color": colorExpr,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 0.8,
        "circle-opacity": 0.95,
      },
    });

    // Hover popup (small, no close button — same as BridgeMap2)
    let hoverPopup: mapboxgl.Popup | null = null;
    let hoveredId: string | number | null = null;

    map.on("mousemove", "route-bridges-circle", (e: any) => {
      const feature = e.features?.[0];
      if (!feature) return;
      if (hoveredId !== null && hoveredId !== feature.id) {
        map.setFeatureState({ source: "route-bridges", id: hoveredId }, { hover: false });
      }
      hoveredId = feature.id;
      map.setFeatureState({ source: "route-bridges", id: hoveredId }, { hover: true });
      map.getCanvas().style.cursor = "pointer";

      if (!hoverPopup) {
        hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10, maxWidth: "200px" });
      }
      const p = feature.properties;
      hoverPopup
        .setLngLat(e.lngLat)
        .setHTML(`<div style="font-family:sans-serif;font-size:12px">
          <div style="font-weight:bold">${p.BridgeNumber ?? "Unknown #"}</div>
          <div>${p.BridgeName ?? "Unnamed bridge"}</div>
          <div style="color:grey;font-size:11px;margin-top:3px">Click for more</div>
        </div>`)
        .addTo(map);
      hoverPopup.getElement().style.pointerEvents = "none";
    });

    map.on("mouseleave", "route-bridges-circle", () => {
      if (hoveredId !== null) {
        map.setFeatureState({ source: "route-bridges", id: hoveredId }, { hover: false });
      }
      hoveredId = null;
      map.getCanvas().style.cursor = "";
      hoverPopup?.remove();
      hoverPopup = null;
    });

    // Click popup (full details — same as BridgeMap2)
    const clickPopup = new mapboxgl.Popup({ closeButton: true, maxWidth: "300px" });
    map.on("click", "route-bridges-circle", (e: any) => {
      const props = e.features[0].properties;
      hoverPopup?.remove();
      hoverPopup = null;
      clickPopup.setLngLat(e.lngLat).setHTML(buildBridgePopupHTML(props)).addTo(map);
    });
  };

  const removeBridgeLayerFromMap = (map: mapboxgl.Map) => {
    if (map.getLayer("route-bridges-circle")) {
      map.setLayoutProperty("route-bridges-circle", "visibility", "none");
    }
  };

  // Lazy-fetch bridge data when the layer is first enabled
  useEffect(() => {
    if (!showBridgesLayer || bridgesData.length > 0) return;
    const processRows = (raw: any[]) => {
      setBridgesData(raw.map((row: any) => ({
        ...row,
        Longitude: row.Longitude != null ? +row.Longitude : null,
        Latitude: row.Latitude != null ? +row.Latitude : null,
        PrpsedImprvTotalCost: row.PrpsedImprvTotalCost != null ? +row.PrpsedImprvTotalCost : 0,
        PrpsedImprvStructureCost: row.PrpsedImprvStructureCost != null ? +row.PrpsedImprvStructureCost : 0,
      })));
      setBridgesLoading(false);
    };
    setBridgesLoading(true);
    fetch("/api/bridges")
      .then(r => { if (!r.ok) throw new Error('API failed'); return r.json(); })
      .then(processRows)
      .catch(() => {
        d3.csv('/Bridge Needs GIS data.csv').then(processRows).catch(err => { console.error("Failed to load bridge data", err); setBridgesLoading(false); });
      });
  }, [showBridgesLayer]);

  // Bridges within 250 m of the selected route line (bbox pre-filter + exact distance)
  const bridgesAlongRoute = React.useMemo(() => {
    if (!bridgesData.length) return [];
    if (!routes.length || !routes[selectedRouteIdx]?.geometry?.coordinates) return [];
    const coords = routes[selectedRouteIdx].geometry.coordinates;
    const line = turf.lineString(coords);
    // Rough bbox pre-filter (±0.01° ≈ 1 km) to avoid running turf on every bridge
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const c of coords) {
      if (c[0] < minLng) minLng = c[0];
      if (c[0] > maxLng) maxLng = c[0];
      if (c[1] < minLat) minLat = c[1];
      if (c[1] > maxLat) maxLat = c[1];
    }
    minLng -= 0.01; maxLng += 0.01; minLat -= 0.01; maxLat += 0.01;
    return bridgesData.filter(b => {
      if (!b.Longitude || !b.Latitude) return false;
      if (b.Longitude < minLng || b.Longitude > maxLng || b.Latitude < minLat || b.Latitude > maxLat) return false;
      return turf.pointToLineDistance(
        turf.point([b.Longitude, b.Latitude]),
        line,
        { units: "kilometers" }
      ) <= 0.25;
    });
  }, [bridgesData, routes, selectedRouteIdx]);

  // Count bridges by condition state
  const bridgeConditionCounts = React.useMemo(() => {
    const counts = { fair: 0, poor: 0, good: 0 };
    for (const bridge of bridgesAlongRoute) {
      const condition = bridge.BridgeOverallConditionState?.toLowerCase();
      if (condition === 'fair') counts.fair++;
      else if (condition === 'poor') counts.poor++;
      else if (condition === 'good') counts.good++;
    }
    return counts;
  }, [bridgesAlongRoute]);

  // Count bridges by detour bucket
  const bridgeDetourCounts = React.useMemo(() => {
    const counts = { noDetour: 0, short: 0, medium: 0, long: 0, veryLong: 0 };
    for (const bridge of bridgesAlongRoute) {
      counts[getDetourBucket(bridge.Detour)]++;
    }
    return counts;
  }, [bridgesAlongRoute]);

  // Count filtered condition bridges (given current detour filters)
  const filteredBridgeConditionCounts = React.useMemo(() => {
    const counts = { fair: 0, poor: 0, good: 0 };
    for (const bridge of bridgesAlongRoute) {
      const detourBucket = getDetourBucket(bridge.Detour);
      if (bridgeDetourFilters[detourBucket]) {
        const condition = bridge.BridgeOverallConditionState?.toLowerCase();
        if (condition === 'fair') counts.fair++;
        else if (condition === 'poor') counts.poor++;
        else if (condition === 'good') counts.good++;
      }
    }
    return counts;
  }, [bridgesAlongRoute, bridgeDetourFilters]);

  // Count filtered detour bridges (given current condition filters)
  const filteredBridgeDetourCounts = React.useMemo(() => {
    const counts = { noDetour: 0, short: 0, medium: 0, long: 0, veryLong: 0 };
    for (const bridge of bridgesAlongRoute) {
      const condition = bridge.BridgeOverallConditionState?.toLowerCase();
      const condPass = condition === 'fair' ? bridgeConditionFilters.fair
                     : condition === 'poor' ? bridgeConditionFilters.poor
                     : condition === 'good' ? bridgeConditionFilters.good
                     : false;
      if (condPass) {
        counts[getDetourBucket(bridge.Detour)]++;
      }
    }
    return counts;
  }, [bridgesAlongRoute, bridgeConditionFilters]);

  // Filter bridges by selected conditions and detours
  const filteredBridgesAlongRoute = React.useMemo(() => {
    return bridgesAlongRoute.filter(b => {
      const condition = b.BridgeOverallConditionState?.toLowerCase();
      const condPass = condition === 'fair' ? bridgeConditionFilters.fair
                     : condition === 'poor' ? bridgeConditionFilters.poor
                     : condition === 'good' ? bridgeConditionFilters.good
                     : false;
      const detourBucket = getDetourBucket(b.Detour);
      const detourPass = bridgeDetourFilters[detourBucket];
      return condPass && detourPass;
    });
  }, [bridgesAlongRoute, bridgeConditionFilters, bridgeDetourFilters]);

  // Add / remove / update bridge layers on both maps
  useEffect(() => {
    const mapF = mapForecastInstanceRef.current;
    const map = mapInstanceRef.current;
    if (!mapF) return;

    if (showBridgesLayer) {
      addBridgeLayerToMap(mapF, filteredBridgesAlongRoute, bridgeColorMode);
      if (map) addBridgeLayerToMap(map, filteredBridgesAlongRoute, bridgeColorMode);
    } else {
      removeBridgeLayerFromMap(mapF);
      if (map) removeBridgeLayerFromMap(map);
    }
  }, [showBridgesLayer, filteredBridgesAlongRoute, bridgeColorMode]);

  // Load region outline whenever the main (forecast) map loads or county changes.
  useEffect(() => {
    if (!mapForecastLoaded || !selectedCountyOption) return;
    const geojsonPath =
      selectedCountyOption === "psrc"
        ? "/data/psrc/psrc_outline.geojson"
        : "/data/trpc/trpc_outline.geojson";
    fetch(geojsonPath)
      .then((r) => r.json())
      .then((geojsonData) => {
        setRegionGeoJSON(geojsonData);
        if (mapForecastInstanceRef.current) applyOutlineLayer(mapForecastInstanceRef.current, geojsonData);
        if (mapInstanceRef.current) applyOutlineLayer(mapInstanceRef.current, geojsonData);
      })
      .catch((err) => console.error("Error loading selected county outline:", err));
  }, [selectedCountyOption, mapForecastLoaded]);

  // When compare map loads: apply outline, add markers, draw forecast layers, fit bounds.
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    if (regionGeoJSON) applyOutlineLayer(map, regionGeoJSON);

    // Add markers if origin/destination already set
    if (originCoords) {
      originMarkerRef.current?.remove();
      originMarkerRef.current = new mapboxgl.Marker({ color: "blue" })
        .setLngLat(originCoords)
        .addTo(map);
    }
    if (destinationCoords) {
      destinationMarkerRef.current?.remove();
      destinationMarkerRef.current = new mapboxgl.Marker({ color: "#EA4335" })
        .setLngLat(destinationCoords)
        .addTo(map);
    }

    if (!routes.length) return;

    // Fit compare map to route bounds
    if (routes[0]) {
      map.fitBounds(
        turf.bbox(turf.lineString(routes[0].geometry.coordinates)) as any,
        { padding: 50, maxZoom: 14, duration: 600 }
      );
    }
    // Also re-fit main map
    if (mapForecastInstanceRef.current && routes[0]) {
      mapForecastInstanceRef.current.fitBounds(
        turf.bbox(turf.lineString(routes[0].geometry.coordinates)) as any,
        { padding: 50, maxZoom: 14, duration: 600 }
      );
    }

    // Add bridge layer to compare map if enabled
    if (showBridgesLayer && filteredBridgesAlongRoute.length > 0) {
      addBridgeLayerToMap(map, filteredBridgesAlongRoute, bridgeColorMode);
    }

    routes.forEach((route: any, i: number) => {
      const geometry = route.geometry;
      const annotation = route.legs?.[0]?.annotation || {};
      const trafficMin = Math.round((route.duration ?? 0) / 60);
      const initCompareTime = compareTravelTime ?? trafficMin;
      const deltaMin = Math.max(0, Math.round(initCompareTime - trafficMin));
      const compareGradient = deltaMin > 0
        ? (() => { const wr = worsenRoute(route, { targetDeltaMinutes: deltaMin, seed: 42, preferHighways: true }); return gradientFromAdjusted(wr.adjustedLevels); })()
        : gradientFromAnnotation(annotation);

      map.addSource(`route-forecast-src-${i}`, {
        type: "geojson", lineMetrics: true,
        data: { type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: {} }] },
      });
      map.addLayer({
        id: `route-forecast-line-${i}`, type: "line", source: `route-forecast-src-${i}`,
        layout: { "line-join": "round", "line-cap": "round", visibility: i === selectedRouteIdx && compareYear !== 'none' ? "visible" : "none" },
        paint: { "line-gradient": compareGradient, "line-width": 5, "line-opacity": 0.8 },
      }, map_layer);

      map.addSource(`route-forecast-none-src-${i}`, {
        type: "geojson", lineMetrics: true,
        data: { type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: {} }] },
      });
      map.addLayer({
        id: `route-forecast-none-line-${i}`, type: "line", source: `route-forecast-none-src-${i}`,
        layout: { "line-join": "round", "line-cap": "round", visibility: i === selectedRouteIdx && compareYear === 'none' ? "visible" : "none" },
        paint: { "line-gradient": gradientNoTraffic(annotation), "line-width": 5, "line-opacity": 0.8 },
      }, map_layer);
    });
  }, [mapLoaded]);



  useEffect(() => {
    if (!mapForecastInstanceRef.current) return;

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
       
      } else if (region === "trpc" && data.sourceMultiplier) {
          setPeakTime(time_slots_trpc[data.sourceMultiplier]);

      }  else {
        // fallback: default to 5 PM
          setPeakTime("Peak time: 5 PM to 6 PM");
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
    if (!mapF) return;

    // IMPORTANT: depart_at change invalidates all no-traffic baselines
    baselineInflightRef.current.forEach((ac) => ac.abort());
    baselineInflightRef.current.clear();
    baselineCacheRef.current.clear();
    setRoutesNoTraffic([]);
    setBaselineLoadingIdx(null);


    setBaseTrafficTime(null);
    setMultiplier2050(null);
    setTravelTime(null);
    setForecastTravelTime(null);
    //setPeakTime(null);
    setBaseTrafficTime(null);


    const datePart = getNextWeeksThursday();
    const departAtDateTime = `${datePart}T${userDepartTime}`;
    const departAtParam = `&depart_at=${encodeURIComponent(departAtDateTime)}`;

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
      { padding: 50, maxZoom: 14, duration: 600 }
    );

    mapForecastInstanceRef.current?.fitBounds(
      turf.bbox(turf.lineString(trafficRoutes[0].geometry.coordinates)),
      { padding: 50, maxZoom: 14, duration: 600 }
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
          l.id.startsWith("route-forecast-line-") ||
          l.id.startsWith("route-forecast-none-line-")
        ) {
          mp.removeLayer(l.id);
        }
      });
      Object.keys((mp.getStyle() as any).sources || {}).forEach((sid) => {
        if (
          sid.startsWith("route-current-src-") ||
          sid.startsWith("route-current-none-src-") ||
          sid.startsWith("route-forecast-src-") ||
          sid.startsWith("route-forecast-none-src-")
        ) {
          mp.removeSource(sid);
        }
      });
    };

    if (map) cleanup(map);
    cleanup(mapF);

    // draw all routes once
    dataTraffic.routes.forEach((route: any, i: number) => {
      const geometry = route.geometry;
      const annotation = route.legs?.[0]?.annotation || {};
      const dists = annotation.distance || [];


      const trafficMin = Math.round((route.duration ?? 0) / 60);  // <- always traffic
      let forecastGradient = gradientFromAnnotation(annotation);

      // COMPARE map (only when compare panel is open) — same layer names, separate instance
      if (map) {
        map.addSource(`route-forecast-src-${i}`, {
          type: "geojson", lineMetrics: true,
          data: { type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: {} }] },
        });
        map.addLayer({
          id: `route-forecast-line-${i}`, type: "line", source: `route-forecast-src-${i}`,
          layout: { "line-join": "round", "line-cap": "round", visibility: i === 0 && compareYearRef.current !== 'none' ? "visible" : "none" },
          paint: { "line-gradient": forecastGradient, "line-width": 5, "line-opacity": 0.8 },
        }, map_layer);

        map.addSource(`route-forecast-none-src-${i}`, {
          type: "geojson", lineMetrics: true,
          data: { type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: {} }] },
        });
        map.addLayer({
          id: `route-forecast-none-line-${i}`, type: "line", source: `route-forecast-none-src-${i}`,
          layout: { "line-join": "round", "line-cap": "round", visibility: i === 0 && compareYearRef.current === 'none' ? "visible" : "none" },
          paint: { "line-gradient": gradientNoTraffic(annotation), "line-width": 5, "line-opacity": 0.8 },
        }, map_layer);
      }


      mapF.addSource(`route-forecast-src-${i}`, {
        type: "geojson",
        lineMetrics: true,
        data: { type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: {} }] },
      });
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
            visibility: i === 0 && forecastYearRef.current !== 'none' ? "visible" : "none",
          },
          paint: {
            "line-gradient": forecastGradient,
            "line-width": 5,
            "line-opacity": 0.8,
          },
        },
        map_layer
      );

      // No-traffic layer on main (forecast) map
      mapF.addSource(`route-forecast-none-src-${i}`, {
        type: "geojson",
        lineMetrics: true,
        data: { type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: {} }] },
      });
      mapF.addLayer({
        id: `route-forecast-none-line-${i}`,
        type: "line",
        source: `route-forecast-none-src-${i}`,
        layout: { "line-join": "round", "line-cap": "round", visibility: i === 0 && forecastYearRef.current === 'none' ? "visible" : "none" },
        paint: { "line-gradient": gradientNoTraffic(annotation), "line-width": 5, "line-opacity": 0.8 },
      }, map_layer);

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
    if (!routes.length || selectedRouteIdx == null) {
      setForecastTravelTime(null);
      return;
    }
    if (forecastYear === 'none') {
      setForecastTravelTime(baseTrafficTime); // shown as no-traffic ETA
      return;
    }
    if (forecastYear !== 'current' && multiplier2050 == null) {
      setForecastTravelTime(null);
      return;
    }
    const trafficMin = Math.round((routes[selectedRouteIdx]?.duration ?? 0) / 60);
    setForecastTravelTime(projectTime(trafficMin, multiplier2050 ?? 1, forecastYear));
  }, [routes, selectedRouteIdx, multiplier2050, forecastYear, userDepartTime, baseTrafficTime]);

  // compareTravelTime: same logic but driven by compareYear
  useEffect(() => {
    if (!showCompareMap || !routes.length || selectedRouteIdx == null) {
      setCompareTravelTime(null);
      return;
    }
    if (compareYear === 'none') {
      setCompareTravelTime(baseTrafficTime);
      return;
    }
    if (compareYear !== 'current' && multiplier2050 == null) {
      setCompareTravelTime(null);
      return;
    }
    const trafficMin = Math.round((routes[selectedRouteIdx]?.duration ?? 0) / 60);
    setCompareTravelTime(projectTime(trafficMin, multiplier2050 ?? 1, compareYear));
  }, [routes, selectedRouteIdx, multiplier2050, compareYear, userDepartTime, baseTrafficTime, showCompareMap]);

  // // forecastTravelTime = CURRENT TRAFFIC minutes × multiplier_from_DB (can be < 1)
  // useEffect(() => {
  //   if (!routes.length || selectedRouteIdx == null || forecastMultiplier == null) {
  //     setForecastTravelTime(null);
  //     return;
  //   }
  //   const trafficRoute = routes[selectedRouteIdx];     // driving-traffic route
  //   if (!trafficRoute) { setForecastTravelTime(null); return; }

  //   const trafficMin = Math.round(trafficRoute.duration / 60);
  //   setForecastTravelTime(Math.round(trafficMin * forecastMultiplier)); // <-- no clamp
  // }, [routes, selectedRouteIdx, forecastMultiplier]);


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

  useEffect(() => {
    if (originCoords && destinationCoords) {
      getRoutesCurrentOnly(originCoords, destinationCoords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDepartTime]);



  return (
    <div className="flex flex-col md:flex-row gap-1 md:gap-2  w-full h-full p-0 m-0">

      {/* Top Controls Row: Search Inputs + Filters */}
      <div className="w-full md:w-3/12 flex flex-col gap-1 md:gap-2 h-auto md:h-full shrink-0">

        {/* Filters on the Right */}
        <div className="p-2 bg-white border rounded-lg shadow-md w-full ">
          <div className="flex items-center gap-1 md:flex-col md:items-start w-full">
            <label htmlFor="county-select" className="mb-0 text-md md:text-lg font-semibold whitespace-nowrap">
              Select Model
            </label>
            <select
              id="county-select"
              className="rounded-lg w-full p-1 md:p-2 shadow-md border text-sm md:text-md flex-1"
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
      <div className="p-2  bg-white border rounded-lg shadow-md w-full min-h-0">
        {mapForecastLoaded ? (
          <>
            <div className="mb-1 md:mb-2">
              <label className="block text-base md:text-lg font-semibold mb-1 md:mb-2 ">
                Origin & Destination
              </label>
              <form autoComplete="off">
                <div className="sb">
                <SearchBox

                  name = "origin"
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
                /></div>
              </form>
            </div>

            <div>
              <SearchBox
                name="destination"
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

      <div className="p-2 bg-white border rounded-lg shadow-md w-full ">
        <div className="flex items-center gap-2 md:flex-col md:items-start">
          <label htmlFor="county-select" className="text-md md:text-lg font-semibold whitespace-nowrap mb-0">
            Depart at
          </label>
          <input
            type="time"
            id="hour"
            name="hour"
            step="600"
            className="text-sm md:text-md rounded-lg border shadow-md p-1 md:p-2 w-full"
            value={userDepartTime}
            onChange={(e) => setUserDepartTime(e.target.value)}
          />
        </div>
      </div>

      <div className="p-2 bg-white border rounded-lg shadow-md w-full">
        <label className="text-md md:text-lg font-semibold">Layers</label>
        <div className="mt-1 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
              <input
                type="checkbox"
                checked={showBridgesLayer}
                onChange={(e) => setShowBridgesLayer(e.target.checked)}
                className="rounded"
              />
              <span>Bridges</span>
              {!bridgesLoading && showBridgesLayer && routes.length > 0 && (
                <span className="text-xs text-gray-500">(Showing {filteredBridgesAlongRoute.length} out of {bridgesAlongRoute.length} bridges)</span>
              )}
              {bridgesLoading && (
                <svg className="animate-spin h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              )}
            </label>
            {showBridgesLayer && routes.length > 0 && (
              <div className="flex items-center gap-2 relative">
                <span className="text-xs font-semibold text-gray-600">Color by:</span>
                <select
                  value={bridgeColorMode}
                  onChange={(e) => setBridgeColorMode(e.target.value as 'condition' | 'detour')}
                  className="text-xs rounded border border-gray-300 px-2 py-1 bg-white"
                >
                  <option value="condition">Condition</option>
                  <option value="detour">Detour</option>
                </select>
                <button
                  onMouseEnter={() => setShowBridgeInfoTooltip(true)}
                  onMouseLeave={() => setShowBridgeInfoTooltip(false)}
                  className="text-gray-500 hover:text-gray-700 text-sm font-semibold w-5 h-5 rounded-full border border-gray-400 flex items-center justify-center hover:bg-gray-100"
                  title="Bridge condition information"
                >
                  ?
                </button>

                {showBridgeInfoTooltip && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-96 z-50 text-xs text-gray-700">
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-semibold text-green-700 mb-1">Good</h3>
                        <p>A range from no problems to some minor deterioration of structural elements.</p>
                      </div>

                      <div>
                        <h3 className="font-semibold text-orange-600 mb-1">Fair</h3>
                        <p>All primary structural elements are sound but may have deficiencies such as minor section loss, deterioration, cracking, spalling or scour.</p>
                      </div>

                      <div>
                        <h3 className="font-semibold text-red-600 mb-1">Poor</h3>
                        <p>Advanced deficiencies such as section loss, deterioration, cracking, spalling, scour, or seriously affected primary structural components. Bridges rated in poor condition may be posted with truck weight restrictions. Poor is the Federal Highway Administration's new rating term for bridges previously described as "structurally deficient."</p>
                      </div>

                      <hr className="my-2" />

                      <div>
                        <h3 className="font-semibold text-gray-700 mb-1">No Detour</h3>
                        <p>Ground level bypass is available at the structure site for the inventory route.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {showBridgesLayer && routes.length > 0 && (
            <div className="ml-6 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <div className="text-xs font-semibold text-gray-500 uppercase">Condition</div>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bridgeConditionFilters.fair}
                    onChange={(e) => setBridgeConditionFilters({ ...bridgeConditionFilters, fair: e.target.checked })}
                    className="rounded"
                  />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#fc8d59" }} />
                  <span>Fair ({bridgeConditionCounts.fair})</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bridgeConditionFilters.poor}
                    onChange={(e) => setBridgeConditionFilters({ ...bridgeConditionFilters, poor: e.target.checked })}
                    className="rounded"
                  />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#e34a33" }} />
                  <span>Poor* ({bridgeConditionCounts.poor})</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bridgeConditionFilters.good}
                    onChange={(e) => setBridgeConditionFilters({ ...bridgeConditionFilters, good: e.target.checked })}
                    className="rounded"
                  />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#2ca25f" }} />
                  <span>Good ({bridgeConditionCounts.good})</span>
                </label>
              </div>

              <div className="flex flex-col gap-1">
                <div className="text-xs font-semibold text-gray-500 uppercase">Detour</div>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bridgeDetourFilters.noDetour}
                    onChange={(e) => setBridgeDetourFilters({ ...bridgeDetourFilters, noDetour: e.target.checked })}
                    className="rounded"
                  />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#7a7a7a" }} />
                  <span>No Detour ({bridgeDetourCounts.noDetour})</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bridgeDetourFilters.short}
                    onChange={(e) => setBridgeDetourFilters({ ...bridgeDetourFilters, short: e.target.checked })}
                    className="rounded"
                  />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#c6dbef" }} />
                  <span>0–5 mi ({bridgeDetourCounts.short})</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bridgeDetourFilters.medium}
                    onChange={(e) => setBridgeDetourFilters({ ...bridgeDetourFilters, medium: e.target.checked })}
                    className="rounded"
                  />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#6baed6" }} />
                  <span>6–20 mi ({bridgeDetourCounts.medium})</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bridgeDetourFilters.long}
                    onChange={(e) => setBridgeDetourFilters({ ...bridgeDetourFilters, long: e.target.checked })}
                    className="rounded"
                  />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#2171b5" }} />
                  <span>21–50 mi ({bridgeDetourCounts.long})</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bridgeDetourFilters.veryLong}
                    onChange={(e) => setBridgeDetourFilters({ ...bridgeDetourFilters, veryLong: e.target.checked })}
                    className="rounded"
                  />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#08306b" }} />
                  <span>Over 50 mi ({bridgeDetourCounts.veryLong})</span>
                </label>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                *A bridge in "Poor" condition does not mean the bridge is unsafe for travelers or in danger of collapse.
              </p>
            </div>
          )}
        </div>
        {showBridgesLayer && routes.length === 0 && (
          <p className="text-xs text-gray-400 mt-1">Enter a route to see bridges along it.</p>
        )}
      </div>

      
    </div>

    {/* Map Containers */}
    <div className="w-full md:w-9/12 flex flex-col md:flex-row  gap-1 md:gap-2 flex-1 min-h-0">

      {/* Main map: forecast (always visible) */}
      <div className="flex-1 relative rounded-lg shadow-md border min-h-0 md:h-full">

        <div className="absolute top-1 md:top-2 left-1 md:left-2 bg-white bg-opacity-90 p-1 md:p-2 rounded-lg text-sm font-medium shadow z-10">
          <div className="text-base md:text-lg font-semibold">
            <select
              className="mr-1 rounded-lg"
              value={forecastYear}
              onChange={(e) => {
                const v = e.target.value;
                setForecastYear(v === 'current' || v === 'none' ? v : Number(v) as 2030 | 2040 | 2050);
              }}
            >
              <option value="none">No Traffic</option>
              <option value="current">Current Traffic</option>
              <option value="2030">2030</option>
              <option value="2040">2040</option>
              <option value="2050">2050</option>
            </select>
            {forecastYear !== 'current' && forecastYear !== 'none' && 'Forecast'}
          </div>
          {routes.length > 0 && (
            <div className="ml-1 md:mt-1 text-sm text-neutral-700">
              <div>
                Estimated time:{" "}
                {forecastYear === 'none'
                  ? (isBaselineLoading ? '…' : (baseTrafficTime != null ? formatMinutes(baseTrafficTime) : '—'))
                  : (forecastTravelTime != null ? formatMinutes(forecastTravelTime) : '—')}
                {forecastYear !== 'current' && forecastYear !== 'none' && travelTime != null && forecastTravelTime != null && forecastTravelTime > travelTime && (
                  <span style={{ display: "inline-flex", alignItems: "center", color: "#ff0000", fontSize: "1em" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="1em" height="0.8em" fill="currentColor">
                      <path d="M8 15V3M8 3l-4 4m4-4l4 4" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div
          id="map-forecast-container"
          ref={mapForecastContainerRef}
          className="absolute inset-0 h-full w-full rounded-lg border"
          style={{ borderRadius: 8 }}
        />

        {/* Compare toggle button */}
        <div className="absolute bottom-6 right-2 z-10">
          <button
            onClick={() => {
              if (!showCompareMap) {
                const smart = (forecastYear === 'current' || forecastYear === 'none') ? 2050 : 'current';
                setCompareYear(smart as any);
              }
              setShowCompareMap(!showCompareMap);
            }}
            className="bg-white/90 backdrop-blur border border-gray-300 rounded-full px-3 py-1 text-xs font-semibold shadow hover:bg-gray-50 transition flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="8" height="18" rx="1"/><rect x="13" y="3" width="8" height="18" rx="1"/>
            </svg>
            {showCompareMap ? "Close comparison" : "Side-by-side comparison"}
          </button>
        </div>

        {/* Route pill selector */}
        {routes.length > 1 && (
          <div className="absolute top-2 right-2 z-10">
            <div className="flex items-center bg-white/90 backdrop-blur rounded-full border border-gray-300 shadow overflow-hidden">
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

      {/* Compare map (shown when compare is toggled) */}
      {showCompareMap && (
        <div className="flex-1 relative rounded-lg shadow-md border min-h-0 md:h-full">
          <div className="absolute top-1 md:top-2 left-1 md:left-2 bg-white bg-opacity-90 p-1 md:p-2 rounded-lg text-sm font-medium shadow z-10">
            <div className="text-base md:text-lg font-semibold">
              <select
                className="mr-1 rounded-lg"
                value={compareYear}
                onChange={(e) => {
                  const v = e.target.value;
                  setCompareYear(v === 'current' || v === 'none' ? v : Number(v) as 2030 | 2040 | 2050);
                }}
              >
                <option value="none">No Traffic</option>
                <option value="current">Current Traffic</option>
                <option value="2030">2030</option>
                <option value="2040">2040</option>
                <option value="2050">2050</option>
              </select>
              {compareYear !== 'current' && compareYear !== 'none' && 'Forecast'}
              {(isBaselineLoading && (compareYear === 'none')) && <TinySpinner />}
            </div>
            {routes.length > 0 && (
              <div className="ml-1 md:mt-1 text-sm text-neutral-700">
                <div>
                  Estimated time:{" "}
                  {compareYear === 'none'
                    ? (isBaselineLoading ? '…' : (baseTrafficTime != null ? formatMinutes(baseTrafficTime) : '—'))
                    : compareYear === 'current'
                    ? (isTrafficLoadingDisplay ? '…' : (travelTime != null ? formatMinutes(travelTime) : '—'))
                    : (compareTravelTime != null ? formatMinutes(compareTravelTime) : '—')}
                  {compareYear !== 'current' && compareYear !== 'none' && travelTime != null && compareTravelTime != null && compareTravelTime > travelTime && (
                    <span style={{ display: "inline-flex", alignItems: "center", color: "#ff0000", fontSize: "1em" }}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="1em" height="0.8em" fill="currentColor">
                        <path d="M8 15V3M8 3l-4 4m4-4l4 4" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div
            id="map-container"
            ref={mapContainerRef}
            className="absolute inset-0 h-full w-full rounded-lg border"
          />
        </div>
      )}
    </div>

  </div>


);


};



export default MapRoute;
