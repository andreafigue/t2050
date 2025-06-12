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
const COLOR_NEG = "#d73027";    
const COLOR_NEUTRAL = "#ffffbf"; 
const COLOR_POS = "#1c9099";     

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
  [field: string]: {
    [year: number]: number;
  };
}

type Props = {
  geojsonData: any;
  countyData: Record<string, CountyData>;
  year: number;
  selectedCounties: string[] | Set<string>;
  onCountyClick?: (countyKey: string) => void;
  getCountyKey?: (featureProps: any) => string;

  dataField?: keyof CountyData; // used for coloring
  valueLabel?: string;          // label for dataField (optional)
  formatValue?: (val: number) => string; // optional formatter for dataField

  tooltipFields?: {
    label: string;
    field: keyof CountyData;
    format: (val: number) => string;
  }[];

  colorScale?: (val: number) => string;
  transformValue?: (value: number) => number;

};

const MapboxChoroplethMap: React.FC<Props> = ({
  geojsonData,
  countyData,
  year,
  selectedCounties,
  onCountyClick,
  getCountyKey = (props) => props?.NAME,
  dataField = "populations",
  valueLabel = "Population",
  formatValue = (v: number) => v.toLocaleString(),
  tooltipFields,
  colorScale,
  transformValue = (v) => v,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const hoveredCountyId = useRef<number | null>(null);

  const defaultColorScale = useMemo(() => {
    return scaleQuantize<string>()
      .domain([transformValue(-0.15), transformValue(0.15)])
      .range(generateColorRange());
  }, []);

  const getColor = (value: number): string => {
    const scale = colorScale ?? defaultColorScale;
    const domain = scale.domain(); // [transformedMin, transformedMax]
    const clamped = Math.max(domain[0], Math.min(domain[1], value));
    const color = scale(clamped);

    //console.log("map component max: ", domain[1])

    return color ?? COLOR_NULL;
  };

  const isSelected = (id: string | undefined | null): boolean => {
    if (!id || !selectedCounties) return false;
    if (Array.isArray(selectedCounties)) {
      return selectedCounties.includes(id);
    }
    if (selectedCounties instanceof Set) {
      return selectedCounties.has(id);
    }
    return false;
  };

  const [minRate, maxRate] = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const county of Object.values(countyData)) {
      const yearToValue = county?.[dataField];
      if (!yearToValue) continue;

      for (const val of Object.values(yearToValue)) {
        if (val != null && isFinite(val)) {
          min = Math.min(min, val);
          max = Math.max(max, val);
        }
      }
    }
    return [min, max];
  }, [countyData, dataField]);

  const tooltipDataRef = useRef({ year, countyData, tooltipFields });

  useEffect(() => {
    tooltipDataRef.current = { year, countyData, tooltipFields };
  }, [year, countyData, tooltipFields]);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current || !geojsonData) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-120.4472, 47.3826],
      zoom: 5.6,
    });

    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });
    }

    mapRef.current.on("style.load", () => {
      if (!mapRef.current) return;

      const updatedData = enrichedGeoJson;

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
        const key = feature.properties?.GEOID ?? feature.properties?.NAME;
        const name = feature.properties?.NAME ?? key;
        const lines = [`<strong>${name}</strong>`];
        const { year, countyData, tooltipFields } = tooltipDataRef.current;

        lines.push(`Year: ${year}`);

        if (tooltipFields?.length) {
          for (const { label, field, format } of tooltipFields) {
            const raw = countyData[name]?.[field]?.[year] ?? countyData[key]?.[field]?.[year];
            const formatted = raw != null ? format(raw) : "N/A";
            lines.push(`${label}: ${formatted}`);
            //console.log("Name: ", name)
            //console.log("key: ", key)
            //console.log("Label: ", label)
            //console.log("Field: ", field)
            //console.log("year: ", year)
            //console.log("formatted: ", countyData[key]?.[field]?.[year])
          }
        } else {
          // fallback to single field
          const fallback = value != null ? formatValue(value) : "N/A";
          lines.push(`${valueLabel}: ${fallback}`);
        }

        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(lines.join("<br/>"))
          .addTo(mapRef.current);


        mapRef.current.setFilter("counties-highlight", ["==", "NAME", name]);
      });

      mapRef.current.on("mouseleave", "counties-layer", () => {
        if (!mapRef.current) return;
        mapRef.current.getCanvas().style.cursor = "";
        if (popupRef.current) {
          popupRef.current.remove();
          //  popupRef.current = null;
        }
        mapRef.current.setFilter("counties-highlight", ["==", "NAME", ""]);
      });

      mapRef.current.on("click", "counties-layer", (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const name = feature.properties?.NAME;
          const key = feature.properties?.GEOID;
          if (name) onCountyClick(name);
        }
      });

    });

    mapRef.current.on("error", (e) => {
      console.error("Mapbox error event:", e);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [geojsonData]);

  const enrichedGeoJson = useMemo(() => {
    if (!geojsonData?.features || !countyData || !year) {
      return {
        type: "FeatureCollection",
        features: [],
      };
    }

    const features = geojsonData.features
      .filter((f) => f.properties?.STATEFP === "53")
      .map((f) => {
        const key = f.properties?.GEOID
        //const key = f.properties?.NAME ?? key;
        const name =  f.properties?.NAME;
        const entry = countyData[key] ?? countyData[name];
        const rawValue = entry?.[dataField]?.[year];
        //console.log("countyData", countyData[key])
        const color = rawValue != null ? getColor(transformValue(rawValue)) : COLOR_NULL;

        //console.log("Raw value for feature", key, name, rawValue);

        return {
          ...f,
          properties: {
            ...f.properties,
            value: rawValue,
            selected:
              isSelected(f.properties?.NAME) || isSelected(f.properties?.GEOID),
              //selectedCounties.includes(f.properties?.NAME) ||
              //selectedCounties.includes(f.properties?.GEOID),
            fillColor: color,
          },
        };
      });

    // if (!geojsonData?.features?.length) return;
    // const allValues = geojsonData.features.map((feature: any) => {
    //   const countyKey = getCountyKey(feature.properties);
    //   const entry = countyData[name];
    //   return entry?.[dataField]?.[year] ?? null;
    // }).filter((v) => v !== null);  

    return {
      ...geojsonData,
      features,
    };
  }, [geojsonData, countyData, year, dataField, selectedCounties, getCountyKey]);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    const source = map.getSource("counties") as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(enrichedGeoJson);
    }
  }, [enrichedGeoJson]);

  const Legend = ({ colorScale, valueLabel, formatValue }: { colorScale?: (val: number) => string; valueLabel?: string }) => {
    if (!colorScale) return null;
    
    // detect domain
    const domain = (colorScale as any).domain?.() ?? [0, 1];
    const steps = 10;
    const range = Array.from({ length: steps }, (_, i) => {
      const t = i / (steps - 1);
      const val = domain[0] + t * (domain[1] - domain[0]);
      return { val, color: colorScale(val) };
    });

    return (
      <div style={{
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
        width: 200,
        zIndex: 100
      }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{valueLabel ?? "Legend"}</div>

        <div
          style={{
            width: "100%",
            height: 12,
            borderRadius: 4,
            background: `linear-gradient(to right, ${
              range.map(d => d.color).join(",")
            })`,
            marginBottom: 6
          }}
        />

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          fontSize: 11,
          color: "#555"
        }}>
          <span>{formatValue ? formatValue(domain[0]) : domain[0]}</span>

          {dataField === "growthRates" && (
            <span style={{ textAlign: "center", flex: 1 }}>0%</span>
          )}          
          <span>{formatValue ? formatValue(domain[1]) : domain[1]}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%", borderRadius: 8 }} />
      <Legend 
        colorScale={colorScale ?? defaultColorScale} 
        valueLabel={valueLabel} 
        formatValue={(v) => {
          if (dataField === "growthRates") {
            const rawValue = Math.sign(v) * (v * v); // reverse sqrt
            const percent = (rawValue * 100).toFixed(0);
            return percent === "0" ? "0%" : `${percent > 0 ? "+" : ""}${percent}%`;
          }
          return formatValue ? formatValue(v) : v;
        }}
      />
    </div>
  );

};

export default MapboxChoroplethMap;
