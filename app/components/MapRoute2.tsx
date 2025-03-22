"use client";

import React, { useRef, useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import dynamic from 'next/dynamic';
import "../globals2.css";

const SearchBox = dynamic(() => import('@mapbox/search-js-react').then((mod) => mod.SearchBox as any), { ssr: false });

// Set the access token from your environment variables
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

const MapRoute: React.FC = () => {
  // Map current traffic
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  // Map Forecast traffic
  const mapForecastContainerRef = useRef<HTMLDivElement | null>(null);
  const mapForecastInstanceRef = useRef<mapboxgl.Map | null>(null);

  // Map
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapForecastLoaded, setMapForecastLoaded] = useState(false);

  // Origin and destination
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  // Coordinates
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);

  // Estimated travel time in minutes
  const [travelTime, setTravelTime] = useState<number | null>(null);
  const [forecastTravelTime, setForecastTravelTime] = useState<number | null>(null);

  // Markers
  const originMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const originForecastMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destinationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destinationForecastMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (mapContainerRef.current) {
      mapInstanceRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v11',
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
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
      if (mapForecastInstanceRef.current) {
        mapForecastInstanceRef.current.remove();
      }
    };
  }, []);

  const worsenCongestion = (currentType, previousType, isHighway, distance, factor): string => {
    const congestionLevels = ["low", "moderate", "heavy", "severe"];
    let index = congestionLevels.indexOf(currentType);
    //console.log("initial: ", currentType)
    let prevIndex = congestionLevels.indexOf(previousType);

    // **Base Increase Chances**
    let increaseChance = isHighway ? 0.5 : 0.3; // Highways worsen more
    let severityBoost = isHighway ? 1 : 0.5; // Highways worsen faster

        // **Longer segments increase probability & congestion severity**
    if (distance > 1000) increaseChance += 0.1;
    if (distance > 2000) severityBoost += 0.5;
    if (distance > 5000) severityBoost += 0.8;

    // **If previous segment had high congestion, increase chance for this one**
    if (prevIndex >= index) {
      increaseChance *= 2; // Adjacent worsening effect
    }else{
      increaseChance *= 0.5;
    }

    // **Apply probability-based congestion worsening**
    if (Math.random() < increaseChance) {
      index += severityBoost;
    }
    // if(!congestionLevels[Math.min(Math.max(index, 0), congestionLevels.length - 1)]){
    //   console.log("UNDEFINED");
    //   console.log("index: ", index)
    //   console.log("max: ", congestionLevels.length-1)
    // }
    return congestionLevels[Math.min(Math.max(Math.ceil(index), 0), congestionLevels.length - 1)];
  };

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
      const annotation = route.legs[0].annotation; // Contains congestion and distance arrays

      // Calculate estimated travel time (in minutes)
      const estimatedTimeMinutes = Math.round(route.duration / 60);
      setTravelTime(estimatedTimeMinutes);

      // Remove existing route layers/sources on both maps
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

      // Google Maps–inspired congestion colors.
      const congestionLevels: Record<string, string> = {
        unknown: "#B2B2B2", // Gray for unknown congestion
        low: "#78B24A",     // Free-flowing (green)
        moderate: "#FF9619",// Moderate (amber)
        heavy: "#EB7360",   // Heavy (red)
        severe: "#A82D19",  // Severe (dark red)
      };

      // Ensure congestion data exists
      if (!annotation.congestion || annotation.congestion.length === 0) {
        console.error("No congestion data available.");
        return;
      }

      // **Build congestion stops for the first map**
      let stops: [string, ...any[]] = ["interpolate", ["linear"], ["line-progress"]];

      for (let i = 0; i < annotation.congestion.length; i++) {
        const progress = i / (annotation.congestion.length - 1); // Normalize progress from 0 to 1
        const congestionType = annotation.congestion[i];
        const color = congestionLevels[congestionType] || congestionLevels.unknown;
        
        stops.push(progress, color);
      }


      // **Forecasted Route Adjustments**
      const congestionFactor = 1.4; // 40% increase in congestion

      const forecastedTimeMinutes = estimatedTimeMinutes * congestionFactor;
      setForecastTravelTime(Number(forecastedTimeMinutes.toFixed(1)));

      const adjustedCongestion: string[] = [];


      for (let i = 0; i < annotation.congestion.length; i++) {
        const currentType = annotation.congestion[i];
        const isHighway = annotation.distance[i] > 800; // Highway if segment > 800m

        // Worsen congestion based on road type
        const forecastType = worsenCongestion(currentType, annotation.congestion[i-1], isHighway, annotation.distance[i], congestionFactor);
        adjustedCongestion.push(forecastType);
      }

      // **Build congestion stops for the forecasted map**
      let forecastStops: [string, ...any[]] = ["interpolate", ["linear"], ["line-progress"]];

      for (let i = 0; i < adjustedCongestion.length; i++) {
        let progress = i / (adjustedCongestion.length - 1);
        
        // Ensure that progress is strictly increasing
        if (i > 0 && progress <= forecastStops[forecastStops.length - 2]) {
          progress += 0.0001; // Slightly increase to prevent duplicates
        }

        const color = congestionLevels[adjustedCongestion[i]] || congestionLevels.unknown;
        
        forecastStops.push(progress, color);
      }

      // **Add the GeoJSON source and route layer to the current map**
      mapInstanceRef.current.addSource("route", {
        type: "geojson",
        lineMetrics: true, // Required for line-gradient
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

      // **Add the GeoJSON source and adjusted route layer to the forecast map**
      mapForecastInstanceRef.current.addSource("route-forecast", {
        type: "geojson",
        lineMetrics: true, // Required for line-gradient
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

      // **Fit both maps to the bounds of the route**
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
      {mapLoaded && (
        <>
          <div style={{border: "1px solid #fff", width: '25%', padding:'5px 5px 5px 6px', margin:"0 auto"}}>
            <SearchBox
              // @ts-ignore
              accessToken={mapboxgl.accessToken}
              map={mapInstanceRef.current}
              mapboxgl={mapboxgl}
              placeholder="Enter origin address"
              options={{ 
                language: "en", 
                country: "US",
                proximity: [-122.3505, 47.6206]
              }}
              onChange={(d) => setOrigin(d)}
              onRetrieve={(res) => {
                if (res.features && res.features.length > 0) {
                  const coords = res.features[0].geometry.coordinates as [number, number];
                  setOriginCoords(coords);
                  setOrigin(res.features[0].properties.name);
                  if (destinationCoords) {
                    getRoute(coords, destinationCoords);
                  }
                  // Add marker to current map without forcing centering
                  if (mapInstanceRef.current) {
                    if (originMarkerRef.current) {
                      originMarkerRef.current.remove();
                    }
                    originMarkerRef.current = new mapboxgl.Marker({ color: "blue" })
                      .setLngLat(coords)
                      .addTo(mapInstanceRef.current);
                  }
                  // Add marker to forecast map without forcing centering
                  if (mapForecastInstanceRef.current) {
                    if (originForecastMarkerRef.current) {
                        originForecastMarkerRef.current.remove();
                      }
                      // Add a new marker and store it in the ref
                      originForecastMarkerRef.current = new mapboxgl.Marker({ color: "blue" })
                      .setLngLat(coords)
                      .addTo(mapForecastInstanceRef.current);
                    // @ts-ignore
                    mapForecastInstanceRef.current.easeTo({center: coords, zoom: mapInstanceRef.current.getZoom()});
                  }
                }
              }}
              value={origin}
            />
          </div>
          <div style={{border: "1px solid #fff", width: '25%', padding:'5px 5px 5px 6px', margin:"0 auto"}}>
            <SearchBox
              // @ts-ignore
              accessToken={mapboxgl.accessToken}
              map={mapInstanceRef.current}
              mapboxgl={mapboxgl}
              placeholder="Enter destination address"
              options={{ 
                language: "en", 
                country: "US",
                proximity: [-122.3505, 47.6206] 
              }}
              onChange={(d) => {
                setDestination(d);
              }}
              onRetrieve={(res) => {
                if (res.features && res.features.length > 0) {
                  const coords = res.features[0].geometry.coordinates as [number, number];
                  setDestinationCoords(coords);
                  setDestination(res.features[0].properties.name);
                  if (originCoords) {
                    getRoute(originCoords, coords);
                  }
                  // Add marker to current map and center it
                  if (mapInstanceRef.current) {
                    if (destinationMarkerRef.current) {
                      destinationMarkerRef.current.remove();
                    }
                    destinationMarkerRef.current = new mapboxgl.Marker({ color: "#EA4335" })
                      .setLngLat(coords)
                      .addTo(mapInstanceRef.current);
                    mapInstanceRef.current.setCenter(coords);
                  }
                  // Add marker to forecast map and center it
                  if (mapForecastInstanceRef.current) {
                    if (destinationForecastMarkerRef.current) {
                        destinationForecastMarkerRef.current.remove();
                      }
                    destinationForecastMarkerRef.current = new mapboxgl.Marker({ color: "#EA4335" })
                      .setLngLat(coords)
                      .addTo(mapForecastInstanceRef.current);
                    //console.log("current zoom: ", mapInstanceRef.current.getZoom())
                    mapForecastInstanceRef.current.easeTo({
                      center: coords, 
                      // @ts-ignore
                      zoom: mapInstanceRef.current.getZoom(),
                      duration: 300
                    });
                    //console.log("new zoom: ", mapForecastInstanceRef.current.getZoom())
                  }
                }
              }}
              value={destination}
            />
          </div>
        </>
      )}
      <div>
        <div className="row" style={{height: 600, border: "1px solid #fff"}}>
          <div className="column" style={{width: "50%", padding: '20px'}}>
            <h3 style={{ textAlign: 'center' }}>Current Traffic levels</h3>
            <p style={{ textAlign: "center", height: '32px' }}>
              {travelTime ? <>Estimated travel time: <strong>{travelTime} min</strong></> : ""}
            </p>
            <div 
              id="map-container" 
              ref={mapContainerRef} 
              style={{ height: "100%", borderRadius: 8}}
              className = "column" 
            />
          </div>
          <div className="column" style={{ width: "50%", padding: '20px'}}>
            <h3 style={{ textAlign: 'center' }}>Projected 2050 Traffic</h3>
            <p style={{ textAlign: "center", height: '32px' }}>
              {forecastTravelTime ? <>Estimated travel time: <strong>{forecastTravelTime} min</strong></> : ""}
            </p>
            <div 
              id="map-forecast-container" 
              ref={mapForecastContainerRef} 
              style={{ height: '100%', borderRadius: 8}}
              className = "column"
            />
          </div>
        </div>  
      </div>
    </>
  );
};

export default MapRoute;
