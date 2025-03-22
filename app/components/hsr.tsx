"use client";

import React, { useRef, useState, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

// Cities with coordinates
const cities = {
  Vancouver: [-123.1216, 49.2827],
  Seattle: [-122.3321, 47.6062],
  Portland: [-122.6765, 45.5231],
};

const listboxContainerStyle: React.CSSProperties = {
  border: "1px solid #b0b0b0",
  borderRadius: "8px",
  overflow: "hidden",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
};

const listboxHeaderStyle: React.CSSProperties = {
  backgroundColor: "#d6d6d6", // Muted header color
  color: "#444",
  padding: "8px",
  textAlign: "center",
  fontWeight: "bold",
};

const listboxStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  maxHeight: "140px",
  overflowY: "auto",
  cursor: "pointer",
};

const itemStyle: React.CSSProperties = {
  padding: "10px",
  backgroundColor: "#f9f9f0",
  borderBottom: "1px solid #ddd",
  textAlign: "center",
};

const selectedStyle: React.CSSProperties = {
  ...itemStyle,
  backgroundColor: "#7491cf", // Softer blue-gray for selected item
  color: "white",
  fontWeight: "bold",
};



// Predefined travel times (in minutes)
const travelTimes = {
  Car: {
    "Seattle-Vancouver": 210,
    "Seattle-Portland": 180,
    "Portland-Vancouver": 330,
    "Vancouver-Seattle": 210,
    "Portland-Seattle": 180,
    "Vancouver-Portland": 330,
  },
  Train: {
    "Seattle-Vancouver": 255,
    "Seattle-Portland": 225,
    "Portland-Vancouver": 495,
    "Vancouver-Seattle": 255,
    "Portland-Seattle": 225,
    "Vancouver-Portland": 495 
  },
  HSR: {
    "Seattle-Vancouver": 47,
    "Seattle-Portland": 58,
    "Portland-Vancouver": 110,
    "Vancouver-Seattle": 47,
    "Portland-Seattle": 58,
    "Vancouver-Portland": 110 
  },
};

const TravelComparison: React.FC = () => {
  const [origin, setOrigin] = useState("Vancouver");
  const [destination, setDestination] = useState("Seattle");
  const [carTime, setCarTime] = useState<number | null>(null);
  const carMapRef = useRef<HTMLDivElement | null>(null);
  const trainMapRef = useRef<HTMLDivElement | null>(null);
  const hsrMapRef = useRef<HTMLDivElement | null>(null);
  const carMapInstance = useRef<mapboxgl.Map | null>(null);
  const trainMapInstance = useRef<mapboxgl.Map | null>(null);
  const hsrMapInstance = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (carMapRef.current) {
      carMapInstance.current = new mapboxgl.Map({
        container: carMapRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: cities[origin],
        zoom: 6,
        accessToken: mapboxToken,
      });
    }
    if (trainMapRef.current) {
      trainMapInstance.current = new mapboxgl.Map({
        container: trainMapRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: cities[origin],
        zoom: 6,
        accessToken: mapboxToken,
      });
    }
    if (hsrMapRef.current) {
      hsrMapInstance.current = new mapboxgl.Map({
        container: hsrMapRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: cities[origin],
        zoom: 6,
        accessToken: mapboxToken,
      });
    }

    return () => {
      carMapInstance.current?.remove();
      trainMapInstance.current?.remove();
      hsrMapInstance.current?.remove();
    };
  }, []);

  useEffect(() => {
    updateMaps();
  }, [origin, destination]);


  // Store references to markers
let markers = [];


  const addMarker = (map, id, coords, color) => {
    if (!map) return;

    // Remove previous marker
    if (map.getLayer(id)) {
      map.removeLayer(id);
      map.removeSource(id);
    }

    const marker = new mapboxgl.Marker({ color })
      .setLngLat(coords)
      .addTo(map);
    // @ts-ignore
    markers.push(marker);
  };


// Remove all previous markers before adding new ones
const removeMarkers = () => {
  // @ts-ignore
  markers.forEach(marker => marker.remove());
  markers = []; // Reset marker array
};

// Center the map to fit both origin and destination
const fitMapToBounds = (map, start, end) => {
  if (!map) return;
  const bounds = new mapboxgl.LngLatBounds();
  bounds.extend(start);
  bounds.extend(end);
  map.fitBounds(bounds, { padding: 50 });
};



  const updateMaps = async () => {
  if (!carMapInstance.current || !trainMapInstance.current || !hsrMapInstance.current) return;

  const routeKey = `${origin}-${destination}`;
  setCarTime(travelTimes.Car[routeKey]);

  const [originCoords, destinationCoords] = [cities[origin], cities[destination]];

  const clearMapLayers = (map, id) => {
  if (!map) return;

  // Get all layers associated with the source
  const layers = [`${id}-border`, id];

  layers.forEach((layer) => {
    if (map.getLayer(layer)) {
      map.removeLayer(layer);
    }
  });

  // Now it's safe to remove the source
  if (map.getSource(id)) {
    map.removeSource(id);
  }
};

// Clear previous sources & layers properly
["car-route", "train-route", "hsr-route", "origin-marker", "destination-marker"].forEach((id) => {
  [carMapInstance.current, trainMapInstance.current, hsrMapInstance.current].forEach((map) => {
    clearMapLayers(map, id);
  });
});


  // **Fetch driving route from Mapbox**
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originCoords.join(
    ","
  )};${destinationCoords.join(",")}?geometries=geojson&access_token=${mapboxToken}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.routes.length) {
      const routeGeoJSON = {
        type: "Feature",
        geometry: data.routes[0].geometry,
        properties: {},
      };

      carMapInstance.current.addSource("car-route", {
        type: "geojson",
        // @ts-ignore
        data: routeGeoJSON,
      });

      carMapInstance.current.addLayer({
        id: "car-route",
        type: "line",
        source: "car-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ff0000", "line-width": 5, "line-opacity": 0.8 },
      });

      fitMapToBounds(carMapInstance.current, originCoords, destinationCoords);
    }
  } catch (error) {
    console.error("Error fetching car route:", error);
  }

  // **Draw Train & HSR Arcs**
  drawArc(trainMapInstance.current, "train-route", originCoords, destinationCoords, "#0F53FF");
  drawArc(hsrMapInstance.current, "hsr-route", originCoords, destinationCoords, "#0F53FF");

  removeMarkers();
  // **Add markers for origin & destination**
  addMarker(carMapInstance.current, "origin-marker", originCoords, "blue");
  addMarker(carMapInstance.current, "destination-marker", destinationCoords, "red");

  addMarker(trainMapInstance.current, "origin-marker", originCoords, "blue");
  addMarker(trainMapInstance.current, "destination-marker", destinationCoords, "red");

  addMarker(hsrMapInstance.current, "origin-marker", originCoords, "blue");
  addMarker(hsrMapInstance.current, "destination-marker", destinationCoords, "red");
};

  const drawArc = (map, id, start, end, color) => {
  if (!map) return;

  const numPoints = 100; // More points for a smoother arc
  const arcCoords = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints; // Normalize between 0 and 1

    // Quadratic Bézier Curve for smooth arc
    const midLat = (start[1] + end[1]) / 2 + Math.abs(start[1] - end[1]) * 0.3; // Higher arc
    const midLng = (start[0] + end[0]) / 2;

    const lat = (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * midLat + t * t * end[1];
    const lng = (1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * midLng + t * t * end[0];
    // @ts-ignore
    arcCoords.push([lng, lat]);
  }

  const arcGeoJSON = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: arcCoords,
    },
    properties: {},
  };

  if (!map.getSource(id)) {
    map.addSource(id, { type: "geojson", data: arcGeoJSON });
  } else {
    map.getSource(id).setData(arcGeoJSON);
  }

  // **Add the arc layers**
  if (!map.getLayer(`${id}-border`)) {
    map.addLayer({
      id: `${id}-border`,
      type: "line",
      source: id,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#004080", "line-width": 6, "line-opacity": 0.6 },
    });
  }

  if (!map.getLayer(id)) {
    map.addLayer({
      id: id,
      type: "line",
      source: id,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": color, "line-width": 4, "line-opacity": 0.8 },
    });
  }

  fitMapToBounds(map, start, end);
};



  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ width: "20%", padding: "70px 20px 20px 20px" }}>
        <div style={listboxContainerStyle}>
          <div style={listboxHeaderStyle}>From</div>
          <ul style={listboxStyle}>
            {Object.keys(cities).map((city) => (
              <li
                key={city}
                style={origin === city ? selectedStyle : itemStyle}
                onClick={() => setOrigin(city)}
              >
                {city}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ height: "10px" }} /> {/* Spacer */}

        <div style={listboxContainerStyle}>
          <div style={listboxHeaderStyle}>To</div>
          <ul style={listboxStyle}>
            {Object.keys(cities).map((city) => (
              <li
                key={city}
                style={destination === city ? selectedStyle : itemStyle}
                onClick={() => setDestination(city)}
              >
                {city}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ display: "flex", width: "80%" }}>
        {["Car", "Train", "HSR"].map((mode, index) => (
          <div key={mode} style={{ flex: 1, padding: "10px 10px 0px 10px", position: "relative" }}>
            <h2 style={{ textAlign: "center", fontSize: "25px", fontWeight: "bold" }}>{mode}</h2>
            <h2 style={{ textAlign: "center", top: "10px",  fontSize: "16px", fontWeight: "bold" }}>
              {travelTimes[mode][`${origin}-${destination}`]} min
            </h2>
            <div ref={mode === "Car" ? carMapRef : mode === "Train" ? trainMapRef : hsrMapRef} style={{ width: "100%", height: "100%", borderRadius: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TravelComparison;
