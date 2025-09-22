// @ts-nocheck
"use client";

import React, { useRef, useState, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import dynamic from "next/dynamic";
import "../globals2.css";

import { point, booleanPointInPolygon } from '@turf/turf'
//import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
//import { point, FeatureCollection, Polygon } from "@turf/helpers";

const SearchBox = dynamic(
  () => import("@mapbox/search-js-react").then((mod) => mod.SearchBox as any),
  { ssr: false }
);

// Set the access token from your environment variables
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

  const originInputRef = useRef<HTMLInputElement | null>(null);
  const destinationInputRef = useRef<HTMLInputElement | null>(null);

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

  // Congestion colors
  const CURRENT_CONGESTION_COLORS: Record<string, string> = {
    unknown: "#B2B2B2",
    low: "#78B24A",
    moderate: "#FF9619",
    heavy: "#EB7360",
    severe: "#A82D19",
  };

  // build gradient for "current" (original palette)
  function gradientFromAnnotation(annotation: any) {
    const COLORS = {
      unknown: "#B2B2B2",
      low: "#78B24A",
      moderate: "#FF9619",
      heavy: "#EB7360",
      severe: "#A82D19",
    } as const;

    const levels: string[] = annotation?.congestion || [];
    if (!levels.length) return ["literal", COLORS.unknown];

    let stops: [string, ...any[]] = ["interpolate", ["linear"], ["line-progress"]];
    const n = levels.length;
    for (let i = 0; i < n; i++) {
      let p = n === 1 ? 1 : i / (n - 1);
      if (stops.length >= 4 && p <= stops[stops.length - 2]) p += 0.0001;
      stops.push(p, COLORS[levels[i] as keyof typeof COLORS] ?? COLORS.unknown);
    }
    return stops;
  }

  function gradientFromAdjusted(adjusted: string[]) {
    const COLORS = {
      unknown: "#B2B2B2",
      low: "#78B24A",
      moderate: "#FF9619",
      heavy: "#EB7360",
      severe: "#A82D19",
    } as const;

    if (!adjusted.length) return ["literal", COLORS.unknown];
    let stops: [string, ...any[]] = ["interpolate", ["linear"], ["line-progress"]];
    const n = adjusted.length;
    for (let i = 0; i < n; i++) {
      let p = n === 1 ? 1 : i / (n - 1);
      if (stops.length >= 4 && p <= stops[stops.length - 2]) p += 0.0001;
      stops.push(p, COLORS[adjusted[i] as keyof typeof COLORS] ?? COLORS.unknown);
    }
    return stops;
  }

  function selectRoute(idx: number) {
    const map = mapInstanceRef.current;
    const mapF = mapForecastInstanceRef.current;
    if (!map || !mapF) return;

    routes.forEach((_, i) => {
      const vis = i === idx ? "visible" : "none";
      if (map.getLayer(`route-current-line-${i}`)) {
        map.setLayoutProperty(`route-current-line-${i}`, "visibility", vis);
      }
      if (mapF.getLayer(`route-forecast-line-${i}`)) {
        mapF.setLayoutProperty(`route-forecast-line-${i}`, "visibility", vis);
      }
    });

    const r = routes[idx];
    setSelectedRouteIdx(idx);
    const eta = Math.round(r.duration / 60);
    setTravelTime(eta);

    if (forecastMultiplier != null) {
      setForecastTravelTime(Math.round(eta * Math.max(1, forecastMultiplier)));
    }
  }

  function cleanupAllRoutes(mp: mapboxgl.Map | null) {
    if (!mp) return;
    if (!mp.isStyleLoaded()) {
      // Delay cleanup until style is ready
      mp.once("styledata", () => cleanupAllRoutes(mp));
      return;
    }

    const layers = mp.getStyle().layers || [];
    for (const layer of layers) {
      if (layer.id.startsWith("route-")) {
        if (mp.getLayer(layer.id)) mp.removeLayer(layer.id);
      }
    }
    const sources = mp.getStyle().sources || {};
    for (const id in sources) {
      if (id.startsWith("route-")) {
        if (mp.getSource(id)) mp.removeSource(id);
      }
    }
  }


  // State for holding the county GeoJSON data from /public/wa_counties.geojson
  const [countyData, setCountyData] = useState<any>(null);

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

  // Fetch county GeoJSON data when the component mounts.
  useEffect(() => {
    fetch("/wa_counties.geojson")
      .then((response) => response.json())
      .then((data) => setCountyData(data))
      .catch((err) => console.error("Error fetching county data:", err));
  }, []);

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

    // Reset inputs
    setOrigin("");
    setDestination("");
    setOriginCoords(null);
    setDestinationCoords(null);
    setTravelTime(null);
    setForecastTravelTime(null);

    // Remove markers
    originMarkerRef.current?.remove();
    originForecastMarkerRef.current?.remove();
    destinationMarkerRef.current?.remove();
    destinationForecastMarkerRef.current?.remove();

    cleanupAllRoutes(mapInstanceRef.current);
    cleanupAllRoutes(mapForecastInstanceRef.current);

    // clear route UI state so the header/toggle don’t show stale values
    setRoutes([]);
    setSelectedRouteIdx(0);
    setForecastMultiplier(null);
    setTravelTime(null);
    setForecastTravelTime(null);
    setPeakTime(null);


    // Optionally reset the maps’ views (or you can let the outline fitBounds do this)
    //mapInstanceRef.current.jumpTo({ center: [-122.3505, 47.6206], zoom: 12 });
    //mapForecastInstanceRef.current.jumpTo({ center: [-122.3505, 47.6206], zoom: 12 });

  }, [selectedCountyOption]);


  // Helper function for congestion adjustments (unchanged).
  const worsenCongestion = (
    currentType: string,
    previousType: string,
    isHighway: boolean,
    distance: number,
    factor: number
  ): string => {
    const congestionLevels = ["low", "moderate", "heavy", "severe"];
    let index = congestionLevels.indexOf(currentType);
    let prevIndex = congestionLevels.indexOf(previousType);
    let increaseChance = isHighway ? 0.5 : 0.3;
    let severityBoost = isHighway ? 1 : 0.5;
    if (distance > 1000) increaseChance += 0.1;
    if (distance > 2000) severityBoost += 0.5;
    if (distance > 5000) severityBoost += 0.8;
    if (prevIndex >= index) {
      increaseChance *= 2;
    } else {
      increaseChance *= 0.5;
    }
    if (Math.random() < increaseChance) {
      index += severityBoost;
    }
    return congestionLevels[Math.min(Math.max(Math.ceil(index), 0), congestionLevels.length - 1)];
  };

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
      } else if (region === "trpc") {
        // fallback: default to 5 PM
        setPeakTime("Peak time: 5 PM to 6 PM");
        setDepartAtTime("17:00");
      }
      return data.multiplier ?? null
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

    // --- depart_at (same as your original) ---
    const timePart = departAtTime || "17:00";
    const datePart = getNextWeeksThursday();
    const departAtParam = `&depart_at=${encodeURIComponent(`${datePart}T${timePart}`)}`;

    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
      `${originCoords[0]},${originCoords[1]};${destinationCoords[0]},${destinationCoords[1]}` +
      `?geometries=geojson&overview=full&steps=true&annotations=congestion,distance` +
      `&alternatives=true` +
      `${departAtParam}` +
      `&access_token=${mapboxgl.accessToken}`;

    // fetch once
    let data: any;
    try {
      const res = await fetch(url);
      data = await res.json();
    } catch (e) {
      console.error("Directions fetch failed", e);
      return;
    }
    if (!data?.routes?.length) { setRoutes([]); return; }

    // fetch multiplier once (also sets peakTime/departAtTime inside your helper)
    const mult = await fetchMultiplier(originCoords, destinationCoords, selectedCountyOption);
    setForecastMultiplier(mult ?? null);

    // cleanup previous route layers/sources on both maps
    const cleanup = (mp: mapboxgl.Map) => {
      mp.getStyle().layers?.forEach(l => {
        if (l.id.startsWith("route-current-line-") || l.id.startsWith("route-forecast-line-")) {
          mp.removeLayer(l.id);
        }
      });
      Object.keys((mp.getStyle() as any).sources || {}).forEach(sid => {
        if (sid.startsWith("route-current-src-") || sid.startsWith("route-forecast-src-")) {
          mp.removeSource(sid);
        }
      });
    };
    cleanup(map);
    cleanup(mapF);

    // draw all routes once
    data.routes.forEach((route: any, i: number) => {
      const geometry = route.geometry;
      const annotation = route.legs?.[0]?.annotation || {};

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

      // FORECAST map (adjusted congestion using your worsenCongestion + multiplier)
      let adjusted: string[] = [];
      if (mult != null) {
        const base = annotation.congestion || [];
        const dists = annotation.distance || [];
        for (let k = 0; k < base.length; k++) {
          const cur = base[k];
          const prev = k > 0 ? base[k - 1] : cur;
          const isHighway = (dists?.[k] ?? 0) > 800;
          adjusted.push(worsenCongestion(cur, prev, isHighway, dists?.[k] ?? 0, mult));
        }
      }

      mapF.addSource(`route-forecast-src-${i}`, {
        type: "geojson",
        lineMetrics: true,
        data: { type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: {} }] },
      });
      mapF.addLayer({
        id: `route-forecast-line-${i}`,
        type: "line",
        source: `route-forecast-src-${i}`,
        layout: { "line-join": "round", "line-cap": "round", visibility: i === 0 ? "visible" : "none" },
        paint: {
          "line-gradient": mult != null ? gradientFromAdjusted(adjusted) : gradientFromAnnotation(annotation),
          "line-width": 5,
          "line-opacity": 0.8,
        },
      }, map_layer);
    });

    // store routes + set ETAs for route 0
    setRoutes(data.routes);
    setSelectedRouteIdx(0);

    const eta0 = Math.round(data.routes[0].duration / 60);
    setTravelTime(eta0);
    if (mult != null) setForecastTravelTime(Math.round(eta0 * Math.max(1, mult)));

    // fit both maps to O/D
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend(originCoords).extend(destinationCoords);
    map.fitBounds(bounds, { padding: { top: 120, bottom: 50, left: 50, right: 50 } });
    mapF.fitBounds(bounds, { padding: { top: 120, bottom: 50, left: 50, right: 50 } });
  };


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
                  onChange={(d) => setOrigin(d)}
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
                onChange={(d) => setDestination(d)}
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
              Current Traffic
            </h4>

            {/* Route toggle */}
            {routes.length > 1 && (
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
                      {`${i + 1}`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-1 text-sm font-normal text-gray-700">
            {peakTime && <span className="mr-2">{peakTime}</span>}
            {travelTime != null && <span><br/>Estimated time: {formatMinutes(travelTime)}</span>}
          </div>
        </div>
        <div
          id="map-container"
          ref={mapContainerRef}
          style={{ height: "100%", borderRadius: 8 }}
          className="absolute inset-0 h-full rounded-lg border"
        />
      </div>

      <div className="flex-1 relative rounded-lg shadow-md h-full" >
        <div className="absolute top-2 left-2 bg-white bg-opacity-90 p-2 rounded text-sm font-medium shadow z-10">
          <h4 className="text-lg font-semibold mb-0">2050 Forecast</h4>
          {forecastTravelTime && travelTime && (
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
