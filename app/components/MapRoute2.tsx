"use client";

import React, { useRef, useState, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import dynamic from "next/dynamic";
import "../globals2.css";

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

  // Marker refs
  const originMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const originForecastMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destinationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destinationForecastMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // County selection state – if empty, no county outlines are shown.
  const [selectedCountyOption, setSelectedCountyOption] = useState<string>("");

  // Vehicle mode state for the new select box.
  const [vehicleMode, setVehicleMode] = useState<string>("");

  // County options by key. Adjust county names if needed.
  const countyOptions: { [key: string]: string[] } = {
    option1: ["Thurston", "Pierce", "Lewis", "Mason", "Grays Harbor"],
    option2: ["King", "Kitsap", "Pierce", "Snohomish"],
  };

  // State for holding the county GeoJSON data from /public/wa_counties.geojson
  const [countyData, setCountyData] = useState<any>(null);

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

  // Update county outlines on maps when a county option is selected.
  useEffect(() => {
    if (!mapLoaded || !mapForecastLoaded || !countyData) return;

    const updateCountyLayerOnMap = (map: mapboxgl.Map) => {
      // Remove existing county outline layer and source, if any.
      if (map.getLayer("county-outline")) map.removeLayer("county-outline");
      if (map.getSource("county-outline")) map.removeSource("county-outline");

      // If no county option is selected, exit.
      if (!selectedCountyOption) return;

      // Filter county features based on the selected option.
      const selectedCountyNames = countyOptions[selectedCountyOption];
      const filteredCounties = {
        type: "FeatureCollection",
        features: countyData.features.filter(
          (feature: any) =>
            selectedCountyNames.includes(feature.properties.NAME)
        ),
      };

      // Add the filtered counties as a source.
      map.addSource("county-outline", {
        type: "geojson",
        // @ts-ignore
        data: filteredCounties,
      });

      // Add a layer to show the county outlines.
      map.addLayer({
        id: "county-outline",
        type: "line",
        source: "county-outline",
        layout: {},
        paint: {
          "line-color": "#FF0000",
          "line-width": 2,
          "line-opacity": 0.5
        },
      });
    };

    if (mapInstanceRef.current) updateCountyLayerOnMap(mapInstanceRef.current);
    if (mapForecastInstanceRef.current) updateCountyLayerOnMap(mapForecastInstanceRef.current);
  }, [selectedCountyOption, mapLoaded, mapForecastLoaded, countyData]);

  // Example helper function for congestion adjustments (unchanged).
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

      const congestionFactor = 1.4;
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
      mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
      mapForecastInstanceRef.current.fitBounds(bounds, { padding: 50 });
    } catch (error) {
      console.error("Error fetching route:", error);
    }
  };

  return (
  <>
    {/* Top Controls Row: Search Inputs + Filters */}
    <div className="flex flex-wrap gap-4 items-start justify-center mb-4">
      {/* Search Box Container */}

      <div className="p-4 bg-white border rounded-md max-w-md w-full sm:w-[360px] min-h-[210px]">
        {mapLoaded ? (
          <>
            <div className="mb-4">
              <label htmlFor="vehicle-mode-select" className="block font-medium mb-2 p-1">
                Origin & Destination
              </label>
              <SearchBox
                // @ts-ignore
                accessToken={mapboxgl.accessToken}
                map={mapInstanceRef.current}
                mapboxgl={mapboxgl}
                placeholder="Enter origin address"
                options={{ language: "en", country: "US", proximity: [-122.3505, 47.6206] }}
                onChange={(d) => setOrigin(d)}
                onRetrieve={(res) => {
                  if (res.features?.[0]) {
                    const coords = res.features[0].geometry.coordinates as [number, number];
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
                      mapForecastInstanceRef.current.easeTo({
                        center: coords,
                        // @ts-ignore
                        zoom: mapInstanceRef.current.getZoom(),
                      });
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
                map={mapInstanceRef.current}
                mapboxgl={mapboxgl}
                placeholder="Enter destination address"
                options={{ language: "en", country: "US", proximity: [-122.3505, 47.6206] }}
                onChange={(d) => setDestination(d)}
                onRetrieve={(res) => {
                  if (res.features?.[0]) {
                    const coords = res.features[0].geometry.coordinates as [number, number];
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
                      mapForecastInstanceRef.current.easeTo({
                        center: coords,
                        // @ts-ignore
                        zoom: mapInstanceRef.current.getZoom(),
                        duration: 300,
                      });
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

      {/* Filters on the Right */}
      <div className="p-4 bg-white border rounded-md w-full sm:w-[480px]">
        <div className="mb-4">
          <label htmlFor="county-select" className="block font-medium mb-2">
            Select Counties:
          </label>
          <div className="flex items-center gap-2">
            <select
              id="county-select"
              className="flex-1 border rounded px-2 py-1"
              value={selectedCountyOption}
              onChange={(e) => setSelectedCountyOption(e.target.value)}
            >
              <option value="">-- None --</option>
              <option value="option1">Thurston, Pierce, Lewis, Mason, Grays Harbor</option>
              <option value="option2">King, Kitsap, Pierce, Snohomish</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="vehicle-mode-select" className="block font-medium mb-2">
            Select Vehicle Mode:
          </label>
          <div className="flex items-center gap-2">
            <select
              id="vehicle-mode-select"
              className="w-full border rounded px-2 py-1"
              value={vehicleMode}
              onChange={(e) => setVehicleMode(e.target.value)}
            >
              <option value="">-- Select Mode --</option>
              <option value="SOV">SOV</option>
              <option value="LOV">LOV</option>
              <option value="HOV">HOV</option>
              <option value="light truck">Light Truck</option>
              <option value="medium truck">Medium Truck</option>
              <option value="heavy truck">Heavy Truck</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    {/* Map Containers */}
    <div className="row" style={{ height: 600, border: "1px solid #fff" }}>
      <div className="column" style={{ width: "50%", padding: "20px" }}>
        <h3 style={{ textAlign: "center" }}>Current Traffic levels</h3>
        <p style={{ textAlign: "center", height: "32px" }}>
          {travelTime ? <>Estimated travel time: <strong>{travelTime} min</strong></> : ""}
        </p>
        <div
          id="map-container"
          ref={mapContainerRef}
          style={{ height: "100%", borderRadius: 8 }}
          className="column"
        />
      </div>
      <div className="column" style={{ width: "50%", padding: "20px" }}>
        <h3 style={{ textAlign: "center" }}>Projected 2050 Traffic</h3>
        <p style={{ textAlign: "center", height: "32px" }}>
          {forecastTravelTime ? <>Estimated travel time: <strong>{forecastTravelTime} min</strong></> : ""}
        </p>
        <div
          id="map-forecast-container"
          ref={mapForecastContainerRef}
          style={{ height: "100%", borderRadius: 8 }}
          className="column"
        />
      </div>
    </div>
  </>
);


};

export default MapRoute;
