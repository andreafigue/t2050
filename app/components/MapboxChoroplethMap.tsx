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

  const selectedRef = useRef(selectedCounties);

  useEffect(() => {
    selectedRef.current = selectedCounties;
  }, [selectedCounties]);

  const isSelectedNow = (name?: string | null) => {
    const sel = selectedRef.current;
    if (!name || !sel) return false;
    return Array.isArray(sel) ? sel.includes(name) : sel.has(name);
  };

  const getSelectionKey = (featureProps: any) =>
    getCountyKey?.(featureProps) ?? featureProps?.NAME;

  const getDisplayName = (featureProps: any) =>
    featureProps?.NAME ?? getSelectionKey(featureProps);




  useEffect(() => {
    tooltipDataRef.current = { year, countyData, tooltipFields };
  }, [year, countyData, tooltipFields]);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current || !geojsonData) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-120.4472, 47.3826],
    });

    mapRef.current.on("load", () => {
      // Washington State bounding box
      mapRef.current!.fitBounds(
        [
          [-124.848974, 45.543541], // southwest corner (long, lat)
          [-116.915989, 49.002494], // northeast corner (long, lat)
        ],
        { padding: 70}
      );
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), "right");

    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, className: "county-popup" });
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

        const selectedNow = isSelectedNow(key);

        if (!isSmall) {
          lines.push(
            `<div style="color: grey; font-size: 11px; margin-top: 2px">
              ${selectedNow ? "Click to unselect" : "Click to select"}
            </div>`
          );
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
        if (!mapRef.current || !e.features?.[0] || isSmall) return;

        const feature = e.features[0];
        const key = feature.properties?.GEOID ?? feature.properties?.NAME;
        const name = feature.properties?.NAME ?? key;

        if (name) onCountyClick(name);

        const willBeSelected = !isSelectedNow(key);

        
        const lines = [`<strong>${name}</strong>`];
        const { year, countyData, tooltipFields } = tooltipDataRef.current;

        lines.push(`Year: ${year}`);

        if (tooltipFields?.length) {
          for (const { label, field, format } of tooltipFields) {
            const raw = countyData[name]?.[field]?.[year] ?? countyData[key]?.[field]?.[year];
            const formatted = raw != null ? format(raw) : "N/A";
            lines.push(`${label}: ${formatted}`);
          }
        }

        lines.push(
          `<div style="color: grey; font-size: 11px; margin-top: 2px">
            ${willBeSelected ? "Click to unselect" : "Click to select"}
          </div>`
        );

        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(lines.join("<br/>"))
          .addTo(mapRef.current);
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
        bottom: 6,
        right: 6,
        background: "white",
        padding: "10px 14px",
        borderRadius: 10,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        fontFamily: "sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "clamp(2px, 0.6vw, 2px)",
        padding: "clamp(5px, 1vw, 12px)",
        fontSize: "clamp(9px, 1.8vw, 12px)",
        width: "clamp(110px, 35vw, 200px)",
        zIndex: 100
      }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{valueLabel ?? "Legend"}</div>

        <div
          style={{
            width: "100%",
            height: 12,
            borderRadius: 4,
            background: `linear-gradient(to right, ${
              range.map(d => d.color).join(",")
            })`,
            marginBottom: 2
          }}
        />

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
         // fontSize: 11,
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

  useEffect(() => {
    if (!mapRef.current || !mapContainerRef.current) return;

    const map = mapRef.current;
    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(mapContainerRef.current);

    return () => ro.disconnect();
  }, []);

  const [isSmall, setIsSmall] = useState(false);
  
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsSmall(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const [countySheetOpen, setCountySheetOpen] = useState(false);

  const selectedList = useMemo(
    () => (Array.isArray(selectedCounties) ? selectedCounties : Array.from(selectedCounties ?? [])),
    [selectedCounties]
  );

  // For display in the mobile list we use NAME (human readable).
  const countyOptions = useMemo(() => {
    const names = (geojsonData?.features ?? [])
      .filter((f: any) => f.properties?.STATEFP === "53")
      .map((f: any) => String(f.properties?.NAME ?? "").trim())
      .filter(Boolean);

    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [geojsonData]);




  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div className = "rounded-lg" ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
        {isSmall && onCountyClick && (
        <>
          {/* Mobile filter button */}
          <button
            onClick={() => setCountySheetOpen(true)}
            className="
              absolute top-1 right-1 z-10
              bg-white/90 backdrop-blur
              rounded-lg border border-gray-300 shadow
              h-8 px-3 text-xs font-semibold
            "
          >
            Filter Counties{selectedList.length > 0 ? ` (${selectedList.length})` : ""}
          </button>

          {/* Mobile sheet */}
          {countySheetOpen && (
            <div className="fixed inset-0 z-[1000]">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/30"
                onClick={() => setCountySheetOpen(false)}
              />

              {/* Sheet */}
              <div
                className="
                  absolute top-2 left-2 right-2
                  bg-white rounded-lg shadow-lg
                  max-h-[85svh]
                  flex flex-col
                "
              >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white rounded-lg border-b border-gray-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-base">Filter by County</h3>

                    <div className="flex items-center">
                      {selectedList.length > 0 && (
                        <button
                          className="text-sm text-red-600 font-medium mr-4"
                          onClick={() => {
                            // Clear all: toggle off everything currently selected
                            for (const c of selectedList) onCountyClick(c);
                          }}
                        >
                          Clear all ({selectedList.length})
                        </button>
                      )}

                      <button
                        className="text-sm text-blue-600 font-medium"
                        onClick={() => setCountySheetOpen(false)}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto px-4">
                  <div className="space-y-2">
                    {countyOptions.map((name) => {
                      const checked =
                        selectedList.includes(name) ||
                        // fallback: if this map instance stores GEOIDs, the UI can still reflect selection
                        // when selection contains the county's GEOID
                        (() => {
                          const f = (geojsonData?.features ?? []).find(
                            (ff: any) =>
                              ff.properties?.STATEFP === "53" &&
                              String(ff.properties?.NAME ?? "").trim() === name
                          );
                          const geoid = f?.properties?.GEOID ? String(f.properties.GEOID) : null;
                          return geoid ? selectedList.includes(geoid) : false;
                        })();

                      return (
                        <label
                          key={name}
                          className="flex items-center gap-3 py-2 text-sm border-b border-gray-100"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onCountyClick(name)}
                            className="h-4 w-4"
                          />
                          <span>{name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

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
