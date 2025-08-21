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

  // Travel time estimates
  const [travelTime, setTravelTime] = useState<number | null>(null);
  const [forecastTravelTime, setForecastTravelTime] = useState<number | null>(null);
  const [peakTime, setPeakTime] = useState<number | null>(null);

  // Marker refs
  const originMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const originForecastMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destinationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destinationForecastMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // County selection state – if empty, no county outlines are shown.
  const [selectedCountyOption, setSelectedCountyOption] = useState<string>("psrc"); // or "trpc"

  // Ref to hold the selected region GeoJSON
  const [regionGeoJSON, setRegionGeoJSON] = useState<any>(null);

  const [suppressAutoZoom, setSuppressAutoZoom] = useState(false);

  const originInputRef = useRef<HTMLInputElement | null>(null);
  const destinationInputRef = useRef<HTMLInputElement | null>(null);

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

  // Vehicle mode state for the new select box.
  //const [vehicleMode, setVehicleMode] = useState<string>("");

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
          });

          

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

    // Remove route layers/sources
    ["route", "route-forecast"].forEach((id) => {
      if (mapInstanceRef.current?.getLayer(id)) {
        mapInstanceRef.current.removeLayer(id);
      }
      if (mapInstanceRef.current?.getSource(id)) {
        mapInstanceRef.current.removeSource(id);
      }
      if (mapForecastInstanceRef.current?.getLayer(id)) {
        mapForecastInstanceRef.current.removeLayer(id);
      }
      if (mapForecastInstanceRef.current?.getSource(id)) {
        mapForecastInstanceRef.current.removeSource(id);
      }
    });

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
      console.log('TAZs:', data.originTaz, data.destinationTaz)
      console.log('Multiplier:', data.multiplier)
      console.log('Source Multiplier:', data.sourceMultiplier)
      data.sourceMultiplier ? setPeakTime(time_slots[data.sourceMultiplier]) : setPeakTime(null);
      return data.multiplier ?? null
    } catch (err) {
      console.error("Error fetching multiplier:", err)
      return null
    }
  }


  // Your getRoute function remains unchanged.
  const getRoute = async (
    originCoords: [number, number],
    destinationCoords: [number, number]
  ) => {
    if (!mapInstanceRef.current || !mapForecastInstanceRef.current) return;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${originCoords[0]},${originCoords[1]};${destinationCoords[0]},${destinationCoords[1]}?geometries=geojson&overview=full&steps=true&annotations=congestion,distance&access_token=${mapboxgl.accessToken}`;
    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        console.error("No route found");
        return;
      }

      const route = data.routes[0];
      const geometry = route.geometry;
      const annotation = route.legs[0].annotation;
      const estimatedTimeMinutes = Math.round(route.duration / 60);
      setTravelTime(estimatedTimeMinutes);

      // Remove existing route layers/sources on both maps.
      ["route", "route-forecast"].forEach((id) => {
        if (mapInstanceRef.current?.getLayer(id)) {
          mapInstanceRef.current.removeLayer(id);
        }
        if (mapInstanceRef.current?.getSource(id)) {
          mapInstanceRef.current.removeSource(id);
        }
        if (mapForecastInstanceRef.current?.getLayer(id)) {
          mapForecastInstanceRef.current.removeLayer(id);
        }
        if (mapForecastInstanceRef.current?.getSource(id)) {
          mapForecastInstanceRef.current.removeSource(id);
        }
      });

      const congestionLevels: Record<string, string> = {
        unknown: "#B2B2B2",
        low: "#78B24A",
        moderate: "#FF9619",
        heavy: "#EB7360",
        severe: "#A82D19",
      };

      if (!annotation.congestion || annotation.congestion.length === 0) {
        console.error("No congestion data available.");
        return;
      }

      let stops: [string, ...any[]] = ["interpolate", ["linear"], ["line-progress"]];
      for (let i = 0; i < annotation.congestion.length; i++) {
        const progress = i / (annotation.congestion.length - 1);
        const congestionType = annotation.congestion[i];
        const color = congestionLevels[congestionType] || congestionLevels.unknown;
        stops.push(progress, color);
      }

      //const congestionFactor = 1.4; //default value

      const multiplier = await fetchMultiplier(originCoords, destinationCoords, selectedCountyOption);
      if (multiplier === null) {
        console.error("Could not fetch multiplier; aborting route rendering.")
        return
      }
      const congestionFactor = multiplier


      const forecastedTimeMinutes = estimatedTimeMinutes * congestionFactor;
      setForecastTravelTime(Number(forecastedTimeMinutes.toFixed(1)));
      const adjustedCongestion: string[] = [];
      for (let i = 0; i < annotation.congestion.length; i++) {
        const currentType = annotation.congestion[i];
        const isHighway = annotation.distance[i] > 800;
        const forecastType = worsenCongestion(
          currentType,
          annotation.congestion[i - 1],
          isHighway,
          annotation.distance[i],
          congestionFactor
        );
        adjustedCongestion.push(forecastType);
      }
      let forecastStops: [string, ...any[]] = ["interpolate", ["linear"], ["line-progress"]];
      for (let i = 0; i < adjustedCongestion.length; i++) {
        let progress = i / (adjustedCongestion.length - 1);
        if (i > 0 && progress <= forecastStops[forecastStops.length - 2]) {
          progress += 0.0001;
        }
        const color = congestionLevels[adjustedCongestion[i]] || congestionLevels.unknown;
        forecastStops.push(progress, color);
      }

      mapInstanceRef.current.addSource("route", {
        type: "geojson",
        lineMetrics: true,
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: geometry,
              properties: {},
            },
          ],
        },
      });
      mapInstanceRef.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-gradient": stops,
          "line-width": 5,
          "line-opacity": 0.8,
        },
      });

      mapForecastInstanceRef.current.addSource("route-forecast", {
        type: "geojson",
        lineMetrics: true,
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: geometry,
              properties: {},
            },
          ],
        },
      });
      mapForecastInstanceRef.current.addLayer({
        id: "route-forecast",
        type: "line",
        source: "route-forecast",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-gradient": forecastStops,
          "line-width": 5,
          "line-opacity": 0.8,
        },
      });

      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(originCoords);
      bounds.extend(destinationCoords);
      mapInstanceRef.current.fitBounds(bounds, { 
        padding: {
          top: 120,     // increase this based on height of your box
          bottom: 50,
          left: 50,
          right: 50
        } 
      });
      mapForecastInstanceRef.current.fitBounds(bounds, { 
        padding: {
          top: 120,     // increase this based on height of your box
          bottom: 50,
          left: 50,
          right: 50
        } 
      });
    } catch (error) {
      console.error("Error fetching route:", error);
    }
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
              <SearchBox
                // @ts-ignore
                accessToken={mapboxgl.accessToken}
                //map={!suppressAutoZoom ? mapInstanceRef.current : null}
                mapboxgl={mapboxgl}
                placeholder="Enter origin address"
                options={{ language: "en", country: "US", proximity: [-122.3505, 47.6206] }}
                onChange={(d) => setOrigin(d)}
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
                    if (destinationCoords) getRoute(coords, destinationCoords);
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
                    if (originCoords) getRoute(originCoords, coords);
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
          <h4 className="text-lg font-semibold mb-0">
            Current Traffic
          </h4>
          {peakTime && (
            <div className="text-sm font-normal">
              {`${peakTime}`}
            </div>
          )}
          {travelTime && (
            <span className="text-sm font-normal">
              {`Estimated time: ${travelTime} min`}
            </span>
          )}
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
              {`Estimated time: ${forecastTravelTime} min `} 
              {forecastTravelTime > travelTime && (
                <span style={{ color: "#ff0000" }}>🠉</span>
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
