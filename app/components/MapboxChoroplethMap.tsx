// @ts-nocheck
// components/MapboxChoroplethMap.tsx
"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { scaleSequential } from "d3-scale";
import { scaleThreshold } from "d3-scale";
import { interpolateRgb } from "d3-interpolate";
import { scaleQuantize } from "d3-scale";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string;

// === COLOR CONFIGURATION ===
const COLOR_NEG = "#d73027";     // stronger red
const COLOR_NEUTRAL = "#ffffbf"; // keep as is
const COLOR_POS = "#1c9099";     // stronger blue/teal


// === OTHER CONFIG ===
const COLOR_NULL = "#ccc";
const NUM_QUANTILES = 21;

const generateColorRange = (): string[] => {
  const left = interpolateRgb(COLOR_NEG, COLOR_NEUTRAL);
  const right = interpolateRgb(COLOR_NEUTRAL, COLOR_POS);
  const colors: string[] = [];

  for (let i = 0; i < NUM_QUANTILES; i++) {
    const t = i / (NUM_QUANTILES - 1);
    colors.push(t < 0.5
      ? left(t * 2)  // scale 0–0.5 → left
      : right((t - 0.5) * 2)); // scale 0.5–1 → right
  }

  return colors;
};

const map_layer = "land-structure-polygon";

interface CountyData {
  growthRates: { [year: number]: number };
  populations: { [year: number]: number };
}

interface Props {
  geojsonData: GeoJSON.FeatureCollection;
  countyData: Record<string, CountyData>;
  year: number;
  selectedCounties: Set<string>;
  onCountyClick: (county: string) => void;
}

const MapboxChoroplethMap: React.FC<Props> = ({
  geojsonData,
  countyData,
  year,
  selectedCounties,
  onCountyClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const hoveredCountyId = useRef<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [minRate, maxRate] = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const county of Object.values(countyData)) {
      for (const rate of Object.values(county.growthRates)) {
        if (rate != null) {
          min = Math.min(min, rate);
          max = Math.max(max, rate);
        }
      }
    }
    return [min, max];
  }, [countyData]);

  const allRates = useMemo(() => {
    return Object.values(countyData)
      .map(d => d.growthRates[year])
      .filter((v): v is number => v != null);
  }, [countyData, year]);

  const transformRate = (rate: number) =>
    Math.sign(rate) * Math.sqrt(Math.abs(rate));

  const quantizeScale = useMemo(() => {
    return scaleQuantize<string>()
      .domain([transformRate(-0.15), transformRate(0.15)])
      .range(generateColorRange());
  }, []);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current || !geojsonData) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-120.4472, 47.3826],
      zoom: 5.6,
    });

    mapRef.current.on("style.load", () => {
      if (!mapRef.current) return;

      const updatedData = computeMapData();

      mapRef.current.addSource("counties", {
        type: "geojson",
        data: updatedData,
      });

      mapRef.current.addLayer({
        id: "counties-layer",
        type: "fill",
        source: "counties",
        paint: {
          "fill-color": ["get", "fillColor"],
          "fill-outline-color": "#757575",
        },
      }, map_layer);

      mapRef.current.addLayer({
        id: "counties-highlight",
        type: "line",
        source: "counties",
        paint: {
          "line-color": "red",
          "line-width": 5,
          "line-blur": 5,
          "line-opacity": 1,
        },
        filter: ["==", "NAME", ""]
      }, map_layer);

      const size = 8;
      const pixels = new Uint8Array(size * size * 4);

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const offset = (y * size + x) * 4;
          const isStripe = (x + y) % 8 < 3; // diagonal lines every 8px, 4px wide

          if (isStripe) {
            // Black diagonal line with full alpha
            pixels[offset + 0] = 0;   // R
            pixels[offset + 1] = 0;   // G
            pixels[offset + 2] = 0;   // B
            pixels[offset + 3] = 70; // Semi-transparent (out of 255)
          } else {
            // Transparent background
            pixels[offset + 0] = 0;
            pixels[offset + 1] = 0;
            pixels[offset + 2] = 0;
            pixels[offset + 3] = 0;
          }
        }
      }

      if (!mapRef.current.hasImage("diagonal-hatch")) {
        mapRef.current.addImage("diagonal-hatch", {
          width: size,
          height: size,
          data: pixels,
          pixelRatio: 1
        });
      }


      mapRef.current.addLayer({
        id: "counties-selected",
        type: "fill",
        source: "counties",
        filter: ["==", ["get", "selected"], true],
        paint: {
          "fill-pattern": "diagonal-hatch",
          "fill-color": ["get", "fillColor"],
          "fill-opacity": 1
        }
      }, map_layer);

      mapRef.current.on("mousemove", "counties-layer", (e) => {
        if (!mapRef.current || !e.features || !e.features[0]) return;

        mapRef.current.getCanvas().style.cursor = "pointer";

        const feature = e.features[0];
        const name = feature.properties?.NAME;
        const rate = feature.properties?.growthRate;
        const rawPop = countyData[name]?.population?.[year];
        const pop = rawPop != null ? rawPop.toLocaleString('en-US') : null;

        if (popupRef.current) {
          popupRef.current.remove();
        }

        popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
          .setLngLat(e.lngLat)
          .setHTML(`
            <strong>${name}</strong><br/>
            Population: ${pop}<br/>
            Year: ${year}<br/>
            Growth Rate: ${(rate * 100).toFixed(2)}%
          `)
          .addTo(mapRef.current);

        mapRef.current.setFilter("counties-highlight", ["==", "NAME", name]);
      });

      mapRef.current.on("mouseleave", "counties-layer", () => {
        if (!mapRef.current) return;
        mapRef.current.getCanvas().style.cursor = "";
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        mapRef.current.setFilter("counties-highlight", ["==", "NAME", ""]);
      });

      mapRef.current.on("click", "counties-layer", (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const name = feature.properties?.NAME;
          if (name) onCountyClick(name);
        }
      });

      setMapLoaded(true);
    });

    mapRef.current.on("error", (e) => {
      console.error("Mapbox error event:", e);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [geojsonData, minRate, maxRate]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const source = mapRef.current.getSource("counties") as mapboxgl.GeoJSONSource;
    if (!source) return;
    source.setData(computeMapData());
  }, [year, countyData, selectedCounties, mapLoaded]);

  const computeMapData = (): GeoJSON.FeatureCollection => {
    const features = geojsonData.features
      .filter((f) => f.properties?.STATEFP === "53")
      .map((f) => {
        const name = f.properties?.NAME;
        const rate = countyData[name]?.growthRates[year] ?? null;
        const rawPop = countyData[name]?.population?.[year];
        const pop = rawPop != null ? rawPop.toLocaleString("en-US") : null;
        const color = rate != null ? quantizeScale(transformRate(rate)) : COLOR_NULL;
        return {
          ...f,
          properties: {
            ...f.properties,
            growthRate: rate,
            population: pop,
            selected: selectedCounties.has(name),
            fillColor: color,
          },
        };
      });

    return { ...geojsonData, features };
  };

const Legend = () => {
  const thresholds = quantizeScale.thresholds();
  const colors = quantizeScale.range();

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        background: "white",
        padding: "10px 14px",
        borderRadius: 10,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        fontSize: 12,
        fontFamily: "sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 200
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Growth Rate</div>
      <div
        style={{
          width: "100%",
          height: 10,
          borderRadius: 5,
          background: `linear-gradient(to right, ${generateColorRange().join(', ')})`,
          marginBottom: 4
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          fontSize: 11,
          color: "#555",
        }}
      >
        <span>-15%</span>
        <span>0%</span>
        <span>+15%</span>
      </div>
    </div>
  );
};


  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%", borderRadius: 8 }} />
      <Legend />
    </div>
  );

};

export default MapboxChoroplethMap;
