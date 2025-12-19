// @ts-nocheck
"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Papa from "papaparse";
import * as d3 from "d3"; 
import Select, { components } from "react-select";
import ClientOnly from "./ClientOnly"; 
import { debounce } from "lodash";
import { useCallback } from "react";

import { Info, RotateCcw } from "lucide-react";
import styles from "./Tooltip.module.css";


const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;
const colorScale = d3.interpolateViridis

export function formatNumberAbbreviation(value: number): string {
  let result: string;

  if (value >= 1_000_000_000) {
    result = (value / 1_000_000_000).toFixed(1) + "B";
  } else if (value >= 1_000_000) {
    result = (value / 1_000_000).toFixed(1) + "M";
  } else if (value >= 1_000) {
    result = (value / 1_000).toFixed(1) + "K";
  } else {
    return value.toString();
  }

  // Remove trailing
  return result.replace(/\.0(?=[KMB])/, "");
}

// Updated overall condition colors 
const conditionColors: { [key: string]: string } = {
  Good: "#2ca25f",  // saturated green
  Fair: "#fc8d59",  // vibrant orange
  Poor: "#e34a33",  // strong red
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "8px",
  padding: "15px",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  marginTop: "5px",
  marginBottom: "10px",
  borderRadius: "4px",
  border: "1px solid #ccc",
};

// Updated culvert condition short descriptions
const culvertShortDescriptions: { [key: string]: string } = {
  "9": "Not applicable",
  "8": "No deficiencies",
  "7": "Minor damage",
  "6": "Slight deterioration",
  "5": "Moderate deterioration",
  "4": "Major deterioration",
  "3": "Excessive deterioration",
  "2": "Structural failure",
  "1": "Closed, light service",
  "0": "Closed, replacement needed"
};

// New mapping for scour condition short descriptions
const scourShortDescriptions: { [key: string]: string } = {
  "N": "Bridge not over waterway",
  "T": "Tidal, low risk",
  "U": "Tidal, unknown",
  "9": "Dry land, above flood",
  "8": "Stable; scour above footing",
  "7": "Countermeasures installed",
  "6": "No scour evaluation",
  "5": "Stable; within footing limits",
  "4": "Action needed",
  "3": "Scour critical; unstable",
  "2": "Extensive scour",
  "1": "Imminent failure; closed",
  "0": "Failed; closed"
};

const workTypeDescriptions: { [key: string]: string } = {
  "38": "Other structural work, including hydraulic replacements.",
  "37": "Bridge deck replacement with only incidental widening.",
  "36": "Bridge deck rehabilitation with only incidental widening.",
  "35": "Bridge rehabilitation because of general structure deterioration or inadequate strength.",
  "34": "Widening of existing bridge with deck rehabilitation or replacement.",
  "33": "Widening of existing bridge or other major – structure without deck rehabilitation orreplacement; includes culvert lengthening.",
  "32": "Replacement of bridge or other structure because of relocation of road.",
  "31": "Replacement of bridge or other structure because of substandard load carrying capacity orsubstandard bridge roadway geometry.",
};

const workMethodDescriptions: { [key: string]: string } = {
  "2": "Work to be done by owner’s forces",
  "1": "Work to be done by contract"
};

function getDetourBucket(detour: number): string {
  if (detour === 0) return "No Detour";
  if (detour <= 5) return "0–5 mi";
  if (detour <= 20) return "6–20 mi";
  if (detour <= 50) return "21–50 mi";
  return "Over 50 mi";
}


const detourBucketColors: Record<string, string> = {
  "Over 50 mi": "#08306b",
  "21–50 mi": "#2171b5",
  "6–20 mi": "#6baed6",
  "0–5 mi": "#c6dbef",
  "No Detour": "#7a7a7a"
};

const buildPopupHTML = (bridge: any) => `
  <div style="font-family: sans-serif; font-size: 12px; width: 100%; box-sizing: border-box;">
          
    <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">
      ${bridge.BridgeName || "Unknown Bridge"}
    </div>

    <div style="max-height: 210px; overflow-y: auto; padding-right: 8px;">
      <div style="margin-bottom: 8px;">
        <div><b>Bridge Number:</b> ${bridge.BridgeNumber || "N/A"}</div>
        <div><b>County:</b> ${bridge.CountyName || "N/A"}</div>
        <div><b>Length (ft):</b> ${bridge.PrpsedImprvStructureLgthByFT || "N/A"}</div>
        <div><b>Width (ft):</b> ${bridge.PrpsedImprvRoadwayWdthByFT || "N/A"}</div>
        <div><b>Year Built:</b> ${bridge.YearBuilt || "N/A"}</div>
        ${
          bridge.YearRebuilt
            ? `<div><b>Year Rebuilt:</b> ${bridge.YearRebuilt}</div>`
            : ""
        }
      </div>

      <hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;" />

      <div style="margin-bottom: 8px;">
        <div style="font-weight: bold; margin-bottom: 4px;">Condition</div>
        <div><b>Overall:</b> ${bridge.BridgeOverallConditionState || "N/A"}</div>
        <div><b>Scour:</b> ${scourShortDescriptions[bridge.ScourCondition] || "N/A"}</div>
        <div><b>Culvert:</b> ${culvertShortDescriptions[bridge.CulvertCondition] || "N/A"}</div>
      </div>

      <hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;" />

      <div style="margin-bottom: 8px;">
        <div style="font-weight: bold; margin-bottom: 4px;">Work & Cost</div>
        <div><b>Type:</b> ${workTypeDescriptions[bridge.PrpsedImprvTypeOfWork] || "N/A"}</div>
        <div><b>Method:</b> ${workMethodDescriptions[bridge.PrpsedImprvWorkMethod] || "N/A"}</div>
        <div><b>Cost/Deck SF:</b> ${formatNumberAbbreviation(bridge.PrpsedImprvCostPerSFDeck * 1000) || "N/A"}</div>
        <div><b>Structure Cost:</b> ${formatNumberAbbreviation(bridge.PrpsedImprvStructureCost * 1000) || "N/A"}</div>
        <div><b>Roadway Cost:</b> ${formatNumberAbbreviation(bridge.PrpsedImprvRoadwayCost * 1000) || "N/A"}</div>
        <div><b>Total:</b> ${formatNumberAbbreviation(bridge.PrpsedImprvTotalCost * 1000) || "N/A"}</div>
      </div>

      <hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;" />

      <div>
        <div style="font-weight: bold; margin-bottom: 4px;">Detour</div>
        <div><b>Distance:</b> ${bridge.Detour != null ? bridge.Detour + " miles" : "N/A"}</div>
      </div>
    </div>
  </div>
`;


// Helper functions for detour thresholds and colors (0–5: Good, 5–10: Fair, >10: Poor)
const getDetourColor = (detour: number): string => {
  if (detour <= 5) return "#1a9850"; // dark green
  if (detour <= 10) return "#fee08b"; // light yellow/orange
  return "#d73027"; // strong red
};

const getDetourRange = (detour: number): "Good" | "Fair" | "Poor" => {
  if (detour <= 5) return "Good";
  if (detour <= 10) return "Fair";
  return "Poor";
};

const bridgesToGeoJSON = (bridges: any[]) => ({
  type: "FeatureCollection",
  features: bridges
    .filter(b => b.Longitude && b.Latitude)
    .map((b,i) => ({
      type: "Feature",
      id: b.BridgeNumber ?? i,
      geometry: {
        type: "Point",
        coordinates: [b.Longitude, b.Latitude],
      },
      properties: {
        ...b,
        condition: b.BridgeOverallConditionState,
        detourBucket: getDetourBucket(b.Detour),
      },
    })),
});



const BridgeNeedsMap = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  //const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [bridges, setBridges] = useState<any[]>([]);
  const [selectedLayer, setSelectedLayer] = useState("placeholder");
  const [selectedDetourRange, setSelectedDetourRange] = useState<[number, number] | null>(null);

  // Filter states (county filter remains)
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [selectedOverallCondition, setSelectedOverallCondition] = useState("All");
  const [selectedScourCondition, setSelectedScourCondition] = useState("All");

  // County filter menu
  const [isCountyMenuOpen, setIsCountyMenuOpen] = useState(false);
  const countySelectRef = useRef<any>(null);

  const [mobilePopupData, setMobilePopupData] = useState<any | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const tooltipRef = useRef<d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | null>(null);

  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const activeBridgeIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!tooltipRef.current) {
      tooltipRef.current = d3.select("body")
        .append("div")
        .attr("class", "d3-tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("padding", "5px 10px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("opacity", 0);
    }

    return () => {
      tooltipRef.current?.remove();
      tooltipRef.current = null;
    };
  }, []);

  const activePopupRef = useRef<mapboxgl.Popup | null>(null);

  const lightenColor = (hex: string, amount = 0.4) => {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;

    const lighten = (c: number) =>
      Math.round(c + (255 - c) * amount);

    return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
  };

    // Compute unique filter options.
  const countyList = Array.from(
    new Set(bridges.map((bridge) => String(bridge.CountyName || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const countyOptions = countyList.map((county) => ({
    value: county,
    label: county,
  }));

  const overallConditionList = Array.from(
    new Set(
      bridges
        .map((bridge) => String(bridge.BridgeOverallConditionState || "").trim())
        .filter(Boolean)
    )
  );

  const scourConditionList = Array.from(
    new Set(
      bridges
        .map((bridge) => String(bridge.ScourCondition || "").trim())
        .filter(Boolean)
    )
  );

  // Compute filtered bridges for totals and breakdown visualization.
  const filteredBridges = useMemo(() => {
    return bridges.filter((bridge) => {
      const passesCounty =
        selectedCounties.length === 0 || selectedCounties.includes(bridge.CountyName);
      const passesOverall =
        selectedOverallCondition === "All" ||
        bridge.BridgeOverallConditionState === selectedOverallCondition;
      const passesScour =
        selectedScourCondition === "All" ||
        bridge.ScourCondition === selectedScourCondition;
      const passesDetour =
        !selectedDetourRange ||
        (selectedDetourRange[0] === 0 && selectedDetourRange[1] === 0
          ? bridge.Detour === 0
          : bridge.Detour > selectedDetourRange[0] && bridge.Detour <= selectedDetourRange[1]);

      return passesCounty && passesOverall && passesScour && passesDetour;
    });
  }, [bridges, selectedCounties, selectedOverallCondition, selectedScourCondition, selectedDetourRange]);

  //const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  //const [isCountyMenuOpen, setIsCountyMenuOpen] = useState(false);
  //const countySelectRef = useRef<any>(null);
  const [countySheetOpen, setCountySheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");

    const update = () => setIsMobile(mq.matches);
    update(); // run once on mount

    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const applyCountyFilters = (map: mapboxgl.Map, selectedCounties: string[]) => {
    const normalized = selectedCounties.map(name =>
      name.replace(/\s+County$/, "").trim()
    );

    const hasSelection = normalized.length > 0;

    if (map.getLayer("wa-county-selection-outline")) {
      map.setFilter(
        "wa-county-selection-outline",
        hasSelection ? ["in", "NAME", ...normalized] : null
      );
      map.setLayoutProperty(
        "wa-county-selection-outline",
        "visibility",
        hasSelection ? "visible" : "none"
      );
    }

    if (map.getLayer("wa-county-gray-fill")) {
      map.setFilter(
        "wa-county-gray-fill",
        hasSelection ? ["!in", "NAME", ...normalized] : null
      );
      map.setLayoutProperty(
        "wa-county-gray-fill",
        "visibility",
        hasSelection ? "visible" : "none"
      );
    }



  };



  // New viewMode state: "condition" or "detour"
  const [viewMode, setViewMode] = useState<"condition" | "detour">("condition");

  const debouncedSetSelectedDetourRange = useCallback(
    debounce((range: [number, number] | null) => {
        setSelectedDetourRange(range);
      }, 300),
      []
    );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      debouncedSetSelectedDetourRange.cancel();
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/bridges');
        if (!res.ok) throw new Error('DB fetch failed');
        const raw: any[] = await res.json();

        const rows: BridgeRow[] = raw.map(row => ({
          ...row,
          CountyName: (row.CountyName ?? '').trim(),
          BridgeOverallConditionState: (row.BridgeOverallConditionState ?? '').trim(),
          CulvertCondition: (row.CulvertCondition ?? '').trim(),
          ScourCondition: (row.ScourCondition ?? '').trim(),
          Detour: row.Detour != null ? +row.Detour : NaN,
        }));

        process(rows);
      } catch (error) {
        console.warn('Falling back to local CSV', error);
        d3.csv<BridgeRow>('/Bridge Needs GIS data.csv', row => ({
          ...row,
          CountyName: (row.CountyName ?? '').trim(),
          BridgeOverallConditionState: (row.BridgeOverallConditionState ?? '').trim(),
          CulvertCondition: (row.CulvertCondition ?? '').trim(),
          ScourCondition: (row.ScourCondition ?? '').trim(),
          Detour: row.Detour != null ? +row.Detour : NaN,
        }))
        .then(process)
        .catch(err => console.error('Failed to load fallback CSV', err));
      }
    };

    const process = (rows: BridgeRow[]) => {
      setBridges(rows);
    };

    fetchData();
  }, []);



  // Initialize the Mapbox map.
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!mapInstance.current) {
      mapInstance.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-120.7401, 47.4511],
        accessToken: mapboxToken,
        interactiveLayerIds: ["bridges-circle"],
      });

      mapInstance.current.on("load", () => {
        setIsMapReady(true);
        // Washington State bounding box
        mapInstance.current!.fitBounds(
          [
            [-124.848974, 45.543541], // southwest corner (long, lat)
            [-116.915989, 49.002494], // northeast corner (long, lat)
          ],
          { padding: 70}
        );
      });

      mapInstance.current.addControl(new mapboxgl.NavigationControl(), "right");
    }
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !isMapReady) return;

    if (!map.getSource("bridges")) {
      map.addSource("bridges", {
        type: "geojson",
        data: bridgesToGeoJSON(filteredBridges),
        promoteId: "BridgeNumber",
      });
    }
  }, [isMapReady]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const source = map.getSource("bridges") as mapboxgl.GeoJSONSource;
    if (!source) return;

    source.setData(bridgesToGeoJSON(filteredBridges));
  }, [filteredBridges]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !map.getSource("bridges")) return;

    if (map.getLayer("bridges-circle")) return;

    map.addLayer({
      id: "bridges-circle",
      type: "circle",
      source: "bridges",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],

          5,
          [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            7,  // hovered at zoom 5
            3,  // normal at zoom 5
          ],

          8,
          [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            10, // hovered at zoom 8
            5,  // normal at zoom 8
          ],

          12,
          [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            14, // hovered at zoom 12
            8,  // normal at zoom 12
          ],

          16,
          [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            18, // hovered at zoom 16
            12, // normal at zoom 16
          ],
        ],

        "circle-color": [
          "match",
          ["get", "condition"],
          "Good", conditionColors.Good,
          "Fair", conditionColors.Fair,
          conditionColors.Poor,
        ],
        "circle-opacity": 0.95,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 0.8,
      },
    });

  }, [isMapReady]);

  useEffect(() => {
    const map = mapInstance.current;
    if (isMobile || !map || !map.getLayer("bridges-circle")) return;

    map.setPaintProperty("bridges-circle", "circle-radius", [
      "interpolate",
      ["linear"],
      ["zoom"],

      5,
      [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        7,
        3,
      ],

      8,
      [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        10,
        5,
      ],

      12,
      [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        14,
        8,
      ],

      16,
      [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        18,
        12,
      ],
    ]);
  }, []);

  useEffect(() => {
  const map = mapInstance.current;
  if (!map || !map.getLayer("bridges-circle")) return;

  if (isMobile) {
    map.setPaintProperty("bridges-circle", "circle-radius", [
      "interpolate",
      ["linear"],
      ["zoom"],
      5, 3,
      8, 5,
      12, 8,
      16, 12,
    ]);
  }
}, [isMobile]);

useEffect(() => {
  const map = mapInstance.current;
  if (!map || !isMobile) return;

  const source = map.getSource("bridges") as mapboxgl.GeoJSONSource;
  if (!source) return;

  // Clear ALL feature hover states
  filteredBridges.forEach(b => {
    if (b.BridgeNumber != null) {
      map.setFeatureState(
        { source: "bridges", id: b.BridgeNumber },
        { hover: false }
      );
    }
  });

  hoverPopupRef.current?.remove();
  hoverPopupRef.current = null;
}, [isMobile, filteredBridges]);



  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !map.getLayer("bridges-circle")) return;

    const colorExpression =
      viewMode === "detour"
        ? [
            "match",
            ["get", "detourBucket"],
            "No Detour", detourBucketColors["No Detour"],
            "0–5 mi", detourBucketColors["0–5 mi"],
            "6–20 mi", detourBucketColors["6–20 mi"],
            "21–50 mi", detourBucketColors["21–50 mi"],
            detourBucketColors["Over 50 mi"],
          ]
        : [
            "match",
            ["get", "condition"],
            "Good", conditionColors.Good,
            "Fair", conditionColors.Fair,
            conditionColors.Poor,
          ];

    map.setPaintProperty("bridges-circle", "circle-color", colorExpression);
  }, [viewMode]);


  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const onClick = (e: mapboxgl.MapMouseEvent) => {
      const hitPadding = isMobile ? 10 : 2;

      const features = map.queryRenderedFeatures(
        [
          [e.point.x - hitPadding, e.point.y - hitPadding],
          [e.point.x + hitPadding, e.point.y + hitPadding],
        ],
        { layers: ["bridges-circle"] }
      );


      const feature = features[0];
      if (!feature) return;

      const props = feature.properties as any;
      const id = feature.id;

      if (isMobile) {
        const map = mapInstance.current;
        if (!map || !map.getLayer("bridges-circle")) return;

        const bridgeNumber = feature.properties.BridgeNumber;

        const haloColorExpression =
          viewMode === "condition"
            ? [
                "match",
                ["get", "condition"],
                "Good", "rgba(22, 163, 74, 1)",
                "Fair", "rgba(234, 88, 12, 1)",
                "Poor", "rgba(185, 28, 28, 1)",
                "#ffffff",
              ]
            : [
                "match",
                ["get", "detourBucket"],
                "Over 50 mi", "rgba(8, 48, 107, 1)",
                "21–50 mi",   "rgba(30, 64, 175, 1)",
                "6–20 mi",    "rgba(37, 99, 235, 0.7)",
                "0–5 mi",     "rgba(59, 130, 246, 0.7)",
                "No Detour",  "rgba(55, 55, 55, 1)",
                "#ffffff",
              ];

        map.setPaintProperty("bridges-circle", "circle-stroke-color", [
          "case",
          ["==", ["get", "BridgeNumber"], bridgeNumber],
          haloColorExpression,
          "#ffffff",
        ]);

        map.setPaintProperty("bridges-circle", "circle-stroke-width", [
          "case",
          ["==", ["get", "BridgeNumber"], bridgeNumber],
          3,        
          0.8,
        ]);

        const coords = feature.geometry.coordinates as [number, number];

        map.easeTo({
          center: coords,
          duration: 400
        });

        setMobilePopupData(props);
        return;
      }
       else {
        if (activeBridgeIdRef.current === id) {
          activePopupRef.current?.remove();
          hoverPopupRef.current?.remove();
          hoverPopupRef.current = null;
          activeBridgeIdRef.current = null;
          return;
        }

        activePopupRef.current?.remove();
        hoverPopupRef.current?.remove();
        hoverPopupRef.current = null;

        activePopupRef.current = new mapboxgl.Popup({
          closeButton: true,
          maxWidth: "300px",
        })
          .setLngLat(feature.geometry.coordinates)
          .setHTML(buildPopupHTML(props))
          .addTo(map);
        activeBridgeIdRef.current = id;
      }
    };

    map.on("click", onClick);

    return () => {
      map.off("click", onClick);
    };
  }, [isMobile]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !map.getLayer("bridges-circle")) return;

    if (!mobilePopupData) {
      map.setPaintProperty("bridges-circle", "circle-opacity", 0.95);
      map.setPaintProperty("bridges-circle", "circle-stroke-color", "#fff");
      map.setPaintProperty("bridges-circle", "circle-stroke-width", 0.8);
    }
  }, [mobilePopupData]);


  useEffect(() => {
    const map = mapInstance.current;
    if (!map || isMobile) return;

    let hoveredId: string | number | null = null;

    const attach = () => {
      if (!map.getLayer("bridges-circle")) return;

      const onMove = (e: mapboxgl.MapLayerMouseEvent) => {

        const feature = e.features?.[0];
        if (!feature) return;

        if (hoveredId !== null && hoveredId !== feature.id) {
          map.setFeatureState(
            { source: "bridges", id: hoveredId },
            { hover: false }
          );
        }

        hoveredId = feature.id;

        map.setFeatureState(
          { source: "bridges", id: hoveredId },
          { hover: true }
        );

        map.getCanvas().style.cursor = "pointer";

        if (!isMobile && !hoverPopupRef.current) {
          hoverPopupRef.current = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 10,
            className:"p-1 md:p-2 rounded-lg",
            maxWidth: "200px",
          });      
        }

        if (!isMobile){
          hoverPopupRef.current
            .setLngLat(e.lngLat)
            .setHTML(`
              <div className="mb-0">
                <span className="text-sm md:text-base" style="font-weight:bold;">
                  ${feature.properties.BridgeNumber ?? "Unknown #"}
                </span>
                <span className="text-sm md:text-base mb-1">
                  ${feature.properties.BridgeName ?? "Unnamed bridge"}
                </span>
                <div className="text-xs md:texs-sm text-right" style="color: grey;">
                  Click for more
                </div>
              </div>
            `)
            .addTo(map);
          }

        hoverPopupRef.current.getElement().style.pointerEvents = "none";

      };


      const onLeave = () => {
        if (hoveredId !== null) {
          map.setFeatureState(
            { source: "bridges", id: hoveredId },
            { hover: false }
          );
        }
        hoveredId = null;
        map.getCanvas().style.cursor = "";

        hoverPopupRef.current?.remove();
        hoverPopupRef.current = null;

      };

      map.on("mousemove", "bridges-circle", onMove);
      map.on("mouseleave", "bridges-circle", onLeave);

      map.off("idle", attach); // IMPORTANT: only attach once
    };

    map.on("idle", attach);

    return () => {
      map.off("idle", attach);
    };
  }, [isMobile]);




  // Add WA county divisions layer from local GeoJSON file.
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !isMapReady) return;

    if (map.getSource("wa-county-divisions")) return;

    fetch("/wa_counties.geojson")
      .then(res => res.json())
      .then(data => {
        map.addSource("wa-county-divisions", {
          type: "geojson",
          data,
        });

        map.addLayer({
          id: "wa-county-selection-outline",
          type: "line",
          layout: { visibility: "none" },
          source: "wa-county-divisions",
          paint: {
            "line-color": "#757575",
            "line-width": 2,
          },
        });

        map.addLayer({
          id: "wa-county-boundaries",
          type: "line",
          source: "wa-county-divisions",
          paint: {
            "line-color": "#757575",
            "line-width": 1,
          },
        }, "land-structure-polygon");        

        map.addLayer({
          id: "wa-county-gray-fill",
          type: "fill",
          layout: { visibility: "none" },
          source: "wa-county-divisions",
          paint: {
            "fill-color": "#dddddd",
            "fill-opacity": 0.5,
          },
        }, "land-structure-polygon");

        applyCountyFilters(map, selectedCounties);




      });


  }, [isMapReady]);



  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !isMapReady) return;


    applyCountyFilters(map, selectedCounties);
  }, [selectedCounties]);

  // Menu handling
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Track whether the user is dragging the map
    let isDragging = false;
    const onDragStart = () => { isDragging = true; };
    const onDragEnd = () => { isDragging = false; };

    /**
     * Returns true if the click was inside the react-select menu portal.
     * We’re using classNamePrefix defaults: ".react-select__menu".
     */
    const clickIsInsideSelectMenu = (clientX: number, clientY: number) => {
      const menu = document.querySelector(".react-select__menu") as HTMLElement | null;
      if (!menu) return false;
      const r = menu.getBoundingClientRect();
      return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
    };

    // Close on clicks
    const onMapClick = (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
      if (!isCountyMenuOpen) return; // nothing to do
      if (isDragging) return;        // ignore if the map moved

      const container = map.getContainer();
      const cr = container.getBoundingClientRect();
      const clientX = cr.left + e.point.x;
      const clientY = cr.top + e.point.y;

      if (clickIsInsideSelectMenu(clientX, clientY)) return;

      setIsCountyMenuOpen(false);
      countySelectRef.current?.blur?.();
    };

    const onMapTouchEnd = (e: mapboxgl.MapTouchEvent & mapboxgl.EventData) => {
      if (!isCountyMenuOpen) return;
      if (isDragging) return;

      const touch = e.originalEvent.changedTouches?.[0];
      if (!touch) return;

      const clientX = touch.clientX;
      const clientY = touch.clientY;

      if (clickIsInsideSelectMenu(clientX, clientY)) return;

      setIsCountyMenuOpen(false);
      countySelectRef.current?.blur?.();
    };

    map.on("dragstart", onDragStart);
    map.on("dragend", onDragEnd);
    map.on("click", onMapClick);
    map.on("touchend", onMapTouchEnd);

    return () => {
      map.off("dragstart", onDragStart);
      map.off("dragend", onDragEnd);
      map.off("click", onMapClick);
      map.off("touchend", onMapTouchEnd);
    };
  }, [isCountyMenuOpen]);


  // Overall condition chart
  useEffect(() => {
    // Prepare data
    const counts = d3.rollups(
      filteredBridges,
      v => v.length,
      d => d.BridgeOverallConditionState
    );

    const order = ["Good", "Fair", "Poor"];
    const orderedData = order.map(label => ({
      label,
      count: counts.find(([k]) => k === label)?.[1] || 0
    }));

    const total = d3.sum(orderedData, d => d.count);
    orderedData.forEach(d => {
      d.percentage = total > 0 ? Math.round((d.count / total) * 100) : 0;
    });

    // D3 setup
    const container = d3.select("#condition-bar-chart");
    const { width, height } = container
      .node()
      .getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const margin = { top: 20, right: 0, bottom: 20, left: 30 };

    let svg = container.select("svg");
    if (svg.empty()) {
      svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%")
        .style("display", "block")
        .style("margin", "0 auto");
    }

    const x = d3.scaleBand()
      .domain(order)
      .range([margin.left, width - margin.right])
      .padding(0.3);

    const maxCount = d3.max(orderedData, d => d.count) || 1;

    const y = d3.scaleLinear()
      .domain([0, Math.max(maxCount, 20)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const bars = svg.selectAll("rect")
      .data(orderedData, d => d.label)
      .join(
        enter => enter.append("rect")
          .attr("x", d => x(d.label)!)
          .attr("width", x.bandwidth())
          .attr("y", y(0))              // only new bars start at 0
          .attr("height", 0)
          .attr("fill", d => conditionColors[d.label])
          .style("cursor", "pointer")
          .call(enter =>
            enter.transition().duration(500)
              .attr("y", d => y(d.count))
              .attr("height", d => y(0) - y(d.count))
          ),
        update => update
          .transition().duration(500)
          .attr("y", d => y(d.count))
          .attr("height", d => y(0) - y(d.count)),
        exit => exit
          .transition().duration(300)
          .attr("y", y(0))
          .attr("height", 0)
          .remove()
      );

    const map = mapInstance.current;
    
    bars
      .on("click", (_, d) => {
        setSelectedOverallCondition(prev =>
          prev === d.label ? "All" : d.label
        );
      });

    bars.on("mouseover", null)
      .on("mousemove", null)
      .on("mouseout", null);


    if (!isMobile) {
      bars
        .on("mouseover", function (event, d) {
          tooltip
            .style("opacity", 1)
            .html(
              `<strong>${d.label} (${d.percentage}%)</strong><br/>${d.count} bridges<br/>
              <small style="color: grey;">
                ${selectedOverallCondition === d.label ? "Click to reset" : "Click to filter"}
              </small>`
            );

          svg.selectAll("rect")
            .style("opacity", bar => bar.label === d.label ? 1 : 0.3);

          const map = mapInstance.current;
          if (map && map.getLayer("bridges-circle")) {
            const matchExpr = ["==", ["get", "condition"], d.label];

            const haloColorExpression =
              viewMode === "condition"
                ? [
                    "match",
                    ["get", "condition"],
                    "Good", "rgba(22, 163, 74, 1)",
                    "Fair", "rgba(234, 88, 12, 1)",
                    "Poor", "rgba(185, 28, 28, 1)",
                    "#ffffff",
                  ]
                : [
                    "match",
                    ["get", "detourBucket"],
                    "Over 50 mi", "rgba(8, 48, 107, 1)",
                    "21–50 mi",   "rgba(30, 64, 175, 1)",
                    "6–20 mi",    "rgba(37, 99, 235, 0.7)",
                    "0–5 mi",     "rgba(59, 130, 246, 0.7)",
                    "No Detour",  "rgba(55, 55, 55, 1)",
                    "#ffffff",
                  ];

            map.setPaintProperty("bridges-circle", "circle-stroke-color", [
              "case",
              matchExpr,
              haloColorExpression,
              "#ffffff",
            ]);

            map.setPaintProperty("bridges-circle", "circle-stroke-width", [
              "case",
              matchExpr,
              2.5,
              0.8,
            ]);

            map.setPaintProperty("bridges-circle", "circle-opacity", [
              "case",
              matchExpr,
              1,
              0.2,
            ]);

        
          }

        })

        .on("mousemove", event => {
          tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })

        .on("mouseout", function () {
          svg.selectAll("rect")
            .style("opacity", 1);

          tooltip.style("opacity", 0);
          const map = mapInstance.current;
          if (map && map.getLayer("bridges-circle")) {
            map.setPaintProperty("bridges-circle", "circle-opacity", 0.95);
            map.setPaintProperty("bridges-circle", "circle-stroke-color", "#fff");
            map.setPaintProperty("bridges-circle", "circle-stroke-width", 0.8);
          }

        });
    }

    // Animate bar height and y
    bars.transition().duration(500)
      .attr("y", d => y(d.count))
      .attr("height", d => y(0) - y(d.count));

    // Add text labels
    const labels = svg.selectAll("text.label")
      .data(orderedData, d => d.label);

    labels.join(
      enter => enter.append("text")
        .attr("class", "label")
        .attr("x", d => x(d.label)! + x.bandwidth() / 2)
        .attr("y", y(0) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#333")
        .text(d => `${d.percentage}%`)
        .call(enter =>
          enter.transition().duration(500)
            .attr("y", d => y(d.count) - 5)
        ),
      update => update
        .transition().duration(500)
        .attr("y", d => y(d.count) - 5)
        .text(d => `${d.percentage}%`),
      exit => exit
        .transition().duration(300)
        .attr("y", y(0) - 5)
        .style("opacity", 0)
        .remove()
    );

    svg.selectAll(".x-axis").remove();
    svg.selectAll(".y-axis").remove();

    svg.append("g")  
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x));

    svg.append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    return () => {
      tooltip.style("opacity", 0);
    };

  }, [filteredBridges, selectedOverallCondition, isMobile, viewMode]);


  // Detour distribution chart
  useEffect(() => {
    const container = d3.select("#detour-distribution-chart");

    const bucketCounts: Record<string, number> = {
      "Over 50 mi": 0,
      "21–50 mi": 0,
      "6–20 mi": 0,
      "0–5 mi": 0,
      "No Detour": 0,
    };

    const rangeMap: Record<string, [number, number]> = {
      "No Detour": [0, 0],
      "0–5 mi": [0.00001, 5],
      "6–20 mi": [5.00001, 20],
      "21–50 mi": [20.00001, 50],
      "Over 50 mi": [50.00001, Infinity],
    };

    const detourRangeToExpression = (range: [number, number]) => {
      const [min, max] = range;

      const detourValue = ["to-number", ["get", "Detour"], -1];

      if (min === 0 && max === 0) {
        return ["==", detourValue, 0];
      }

      if (max === Infinity) {
        return [">", detourValue, min];
      }

      return [
        "all",
        [">", detourValue, min],
        ["<=", detourValue, max],
      ];
    };


    filteredBridges.forEach(d => {
      const bucket = getDetourBucket(d.Detour);
      bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;
    });

    const { width, height } = container
      .node()
      .getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const margin = { top: 20, right: 0, bottom: 40, left: 30 };

    const buckets = ["No Detour","0–5 mi","6–20 mi","21–50 mi", "Over 50 mi"];

    const totalCount = d3.sum(Object.values(bucketCounts));
    const bucketData = buckets.map(bucket => ({
      label: bucket,
      count: bucketCounts[bucket],
      percentage: totalCount > 0 ? Math.round((bucketCounts[bucket] / totalCount) * 100) : 0
    }));

    let svg = container.select("svg");
    if (svg.empty()) {
      svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%")
        .style("display", "block")
        .style("margin", "0 auto");
    }

    const x = d3.scaleBand()
      .domain(buckets)
      .range([margin.left, width - margin.right])
      .padding(0.2);

    const maxCount = d3.max(bucketData.map(d => d.count)) || 1;
    const y = d3.scaleLinear()
      .domain([0, Math.max(maxCount, 20)])
      .nice()
      .range([height - margin.bottom, margin.top]);


    const color = d3.scaleOrdinal<string, string>()
    .domain(buckets)
    .range(["#7a7a7a","#c6dbef","#6baed6","#2171b5","#08306b"]);


    const tooltip = tooltipRef.current;
    if (!tooltip) return;


    const bars = svg.selectAll("rect")
      .data(bucketData, d => d.label);

    bars.join(
      enter => enter.append("rect")
        .attr("x", d => x(d.label)!)
        .attr("width", x.bandwidth())
        .attr("y", y(0))
        .attr("height", 0)
        .attr("fill", d => color(d.label))
        .style("cursor", "pointer")
        .call(enter =>
          enter.transition().duration(500)
            .attr("y", d => y(d.count))
            .attr("height", d => y(0) - y(d.count))
        ),
      update => update
        .transition().duration(500)
        .attr("y", d => y(d.count))
        .attr("height", d => y(0) - y(d.count)),
      exit => exit
        .transition().duration(300)
        .attr("y", y(0))
        .attr("height", 0)
        .remove()
    );

    bars
      .on("click", (_, d) => {
        
        const range = rangeMap[d.label];

        const isSame =
          selectedDetourRange &&
          selectedDetourRange[0] === range[0] &&
          selectedDetourRange[1] === range[1];

        setSelectedDetourRange(isSame ? null : range);
        //debouncedSetSelectedDetourRange(isSame ? null : range);
      })

    if (!isMobile) {
      bars
        .on("mouseover", function (event, d) {
          
          const range = rangeMap[d.label];
          const isActive =
            !!selectedDetourRange &&
            selectedDetourRange[0] === range[0] &&
            selectedDetourRange[1] === range[1];

          tooltip
            .style("opacity", 1)
            .html(`<strong>${d.label}</strong><br/>${d.count} bridges<br/>
              <small style="color: grey;">${isActive ? "Click to reset" : "Click to filter"}</small>`);

          // Dim all bars except hovered one
          svg.selectAll("rect").style("opacity", b => b === d ? 1 : 0.3);

          const map = mapInstance.current;
          if (map && map.getLayer("bridges-circle")) {
            const range = rangeMap[d.label];
            const matchExpr = detourRangeToExpression(range);

            // opacity stays the same
            map.setPaintProperty("bridges-circle", "circle-opacity", [
              "case",
              matchExpr,
              1,
              0.2,
            ]);

            const haloColorExpression =
              viewMode === "condition"
                ? [
                    "match",
                    ["get", "condition"],
                    "Good", "rgba(22, 163, 74, 1)",
                    "Fair", "rgba(234, 88, 12, 1)",
                    "Poor", "rgba(185, 28, 28, 1)",
                    "#ffffff",
                  ]
                : [
                    "match",
                    ["get", "detourBucket"],
                    "Over 50 mi", "rgba(8, 48, 107, 1)",
                    "21–50 mi",   "rgba(30, 64, 175, 1)",
                    "6–20 mi",    "rgba(37, 99, 235, 0.7)",
                    "0–5 mi",     "rgba(59, 130, 246, 0.7)",
                    "No Detour",  "rgba(55, 55, 55, 1)",
                    "#ffffff",
                  ];

            map.setPaintProperty("bridges-circle", "circle-stroke-color", [
              "case",
              matchExpr,
              haloColorExpression,
              "#ffffff",
            ]);

            map.setPaintProperty("bridges-circle", "circle-stroke-width", [
              "case",
              matchExpr,
              2.5,
              0.8,
            ]);
          }


        })
        .on("mousemove", event => {
          tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
          // Restore bar opacities
          svg.selectAll("rect")
            //.transition()
            //.duration(150)
            .style("opacity", 1);

          tooltip.style("opacity", 0);

          // Reset all markers
          const map = mapInstance.current;
          if (map && map.getLayer("bridges-circle")) {
            map.setPaintProperty("bridges-circle", "circle-opacity", 0.95);
            map.setPaintProperty("bridges-circle", "circle-stroke-color", "#fff");
            map.setPaintProperty("bridges-circle", "circle-stroke-width", 0.8);
          }


        });
      }

    const labels = svg.selectAll("text.label")
      .data(bucketData, d => d.label);

    labels.join(
      enter => enter.append("text")
        .attr("class", "label")
        .attr("x", d => x(d.label)! + x.bandwidth() / 2)
        .attr("y", y(0) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#333")
        .text(d => `${d.percentage}%`)
        .call(enter =>
          enter.transition().duration(500)
            .attr("y", d => y(d.count) - 5)
        ),
      update => update
        .transition().duration(500)
        .attr("y", d => y(d.count) - 5)
        .text(d => `${d.percentage}%`),
      exit => exit
        .transition().duration(500)
        .attr("y", y(0) - 5)
        .style("opacity", 0)
        .remove()
    );

    svg.selectAll(".x-axis").remove();
    svg.selectAll(".y-axis").remove();

    svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("font-size", "10px")
      .attr("text-anchor", "end")
      .attr("dx", "-0.8em")
      .attr("dy", "0.15em")
      .attr("transform", "rotate(-30)");

    svg.append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4));
  }, [filteredBridges, isMobile, viewMode]);

  const totalBridges = filteredBridges.length;
  const totalImprovementCost = filteredBridges.reduce((sum, bridge) => {
    const cost = Number(bridge.PrpsedImprvTotalCost);
    return sum + (typeof cost === "number" ? cost * 1000 : 0);
  }, 0);

  useEffect(() => {
    const duration = 600;

    // Animate Total Bridges
    const currentBridgeCount = Number(d3.select("#total-bridges").attr("data-count")) || 0;
    const newBridgeCount = filteredBridges.length;

    d3.select("#total-bridges")
      .attr("data-count", newBridgeCount)
      .transition()
      .duration(duration)
      .tween("text", function () {
        const i = d3.interpolateNumber(currentBridgeCount, newBridgeCount);
        return function (t) {
          this.textContent = `${Math.round(i(t))}`;
        };
      });
  }, [filteredBridges]);

  useEffect(() => {
    const el = d3.select("#total-cost");
    if (el.empty()) return;

    const duration = 600;

    let prev = +el.attr("data-cost");
    if (isNaN(prev)) prev = 0;

    el
      .attr("data-cost", totalImprovementCost)
      .transition()
      .duration(duration)
      .tween("text", function () {
        const i = d3.interpolateNumber(prev, totalImprovementCost);
        return function (t) {
          const interpolatedValue = i(t);
          this.textContent = `$${formatNumberAbbreviation(interpolatedValue)}`;
        };
      });
  }, [totalImprovementCost]);

  // Define legend content based on viewMode.
  const maxDetour = d3.max(filteredBridges, d => d.Detour) ?? 20;

  const legendItems =
    viewMode === "detour"
      ? [
          { label: "No Detour", color: detourBucketColors["No Detour"] },
          { label: "0–5 mi", color: detourBucketColors["0–5 mi"] },
          { label: "6–20 mi", color: detourBucketColors["6–20 mi"] },
          { label: "21–50 mi", color: detourBucketColors["21–50 mi"] },
          { label: "Over 50 mi", color: detourBucketColors["Over 50 mi"] },
          
        ]
      : Object.entries(conditionColors).map(([cond, color]) => ({ label: cond, color }));

  const debouncedSetSelectedCounties = useCallback(
    debounce((values: string[]) => {
      setSelectedCounties(values);
    }, 300),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSetSelectedCounties.cancel();
    };
  }, []);

  return (
    <div className="flex flex-col lg:flex-row  md:gap-4 gap-2 w-full h-full m-0">


      {/* Map portion - left column*/}
      <div   className="border shadow-md w-full lg:w-3/5 relative rounded-lg h-[40svh] lg:h-full">
        {/* County filter */}
        {!isMobile && (     
          <div
            className="bg-white/90 backdrop-blur rounded-lg border border-gray-300 shadow top-1 md:top-2 left-1 md:left-2 text-sm md:text-base p-2 md:p-3"
            style={{
              position: "absolute",
              zIndex: 10,
              width: "clamp(140px, 40vw, 220px)"
            }}
          >
            <div
              className="flex text-sm md:text-base font-semibold md:mb-2 items-center"
              style={{
                justifyContent: "space-between"
              }}
            >
              <span>Filter by County</span>
              {selectedCounties.length > 0 && (
                <button
                  onClick={() => setSelectedCounties([])}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#007bff",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "10pt",
                    fontWeight: "normal"
                  }}
                >
                  Clear All
                </button>
              )}
            </div>

            <ClientOnly>

              <Select
                ref={countySelectRef}
                isMulti
                closeMenuOnSelect={false}
                hideSelectedOptions={false}
                options={countyOptions}
                value={countyOptions.filter(opt => selectedCounties.includes(opt.value))}
                onChange={(selected) => {
                    const values = selected.map((opt) => opt.value);
                    debouncedSetSelectedCounties(values);
                }}

                menuIsOpen={isCountyMenuOpen}
                onMenuOpen={() => setIsCountyMenuOpen(true)}
                onMenuClose={() => setIsCountyMenuOpen(false)}

                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                components={{
                  ClearIndicator: null,
                  Control: ({ children, ...props }) => {
                    const selectedLabel =
                      selectedCounties.length > 0 ? `${selectedCounties.length} selected` : "";
                    return (
                      <components.Control {...props}>
                        <div style={{ marginLeft: 8 }}>{selectedLabel}</div>
                        {children}
                      </components.Control>
                    );
                  },
                  Option: (props) => (
                    <components.Option {...props}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",        // space between checkbox & text
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={props.isSelected}
                          readOnly
                        />
                        <span>{props.label}</span>
                      </div>
                    </components.Option>
                  )

                }}
                styles={{
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  control: (base) => ({ ...base, fontSize: "10pt", minHeight: "35px" }),
                  multiValue: () => ({ display: "none" }),
                  menu: (base) => ({ ...base, fontSize: "10pt" }),
                }}
              />
            </ClientOnly>
          </div>
        )}




        {/* Map Container */}

        <div className="relative h-full rounded-lg">
          <div ref={mapContainerRef} className="h-full w-full rounded-lg" />
        </div>


        {isMobile && (
          <button
            onClick={() => setCountySheetOpen(true)}
            className="
              absolute top-1 left-1 z-10
              bg-white/90 backdrop-blur
              rounded-lg border border-gray-300 shadow
              h-7 px-2 text-xs font-semibold
            "
          >
            Filter Counties
            {selectedCounties.length > 0 && ` (${selectedCounties.length})`}
          </button>
        )}

        {isMobile && countySheetOpen && (
          <div className="fixed inset-0 z-[1000]">

            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setCountySheetOpen(false)}
            />

            {/* Sheet */}
            <div
              className="
                absolute top-2 left-2 right-2
                bg-white rounded-lg
                shadow-lg
                max-h-[85svh]
                flex flex-col
              "
            >
              {/* Sticky header */}
              <div
                className="
                  sticky top-0 z-10
                  bg-white rounded-lg
                  border-b border-gray-200
                  px-4 py-3
                "
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base">
                    Filter by County
                  </h3>

                  <div className="justify-right">

                    {selectedCounties.length > 0 && (
                      <button
                        onClick={() => setSelectedCounties([])}
                        className="text-sm text-red-600 font-medium mr-4"
                      >
                        Clear all {` (${selectedCounties.length})`}
                      </button>
                    )}

                    <button
                      onClick={() => setCountySheetOpen(false)}
                      className="text-sm text-blue-600 font-medium"
                    >
                      Done
                    </button>
                  </div>
                </div>

              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto px-4">
                <div className="space-y-2">
                  {countyOptions.map(opt => {
                    const checked = selectedCounties.includes(opt.value);

                    return (
                      <label
                        key={opt.value}
                        className="
                          flex items-center gap-3
                          py-2
                          text-sm
                          border-b border-gray-100
                        "
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedCounties(prev =>
                              checked
                                ? prev.filter(c => c !== opt.value)
                                : [...prev, opt.value]
                            )
                          }
                          className="h-4 w-4"
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="absolute bottom-1 md:bottom-2 right-1 md:right-2 z-10">
          <div className="bg-white/90 backdrop-blur rounded-lg border border-gray-300 shadow p-2 gap-0.5 text-xs md:text-sm">
            {legendItems.map(item => (
              <div
                key={item.label}
                className="flex items-center gap-1.5 leading-tight"
              >
                <div
                  className={[
                    "w-2.5 h-2.5 border border-gray-400",
                    viewMode === "condition" ? "rounded-full" : "rounded-sm",
                  ].join(" ")}
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-800">{item.label}</span>
              </div>
            ))}
          </div>
        </div>


        <div className="absolute top-1 md:top-2 right-1 md:right-2 z-10">
          <div className="flex items-center bg-white/90 backdrop-blur rounded-full border border-gray-300 shadow overflow-hidden">
            {(["condition", "detour"] as const).map((mode, i) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                aria-label={mode}
                title={mode === "condition" ? "Condition" : "Detour"}
                className={[
                  "h-7 px-2 text-xs font-semibold transition border-l border-gray-300",
                  viewMode === mode
                    ? "bg-black text-white"
                    : "bg-white text-gray-800 hover:bg-gray-50",
                ].join(" ")}
                style={{ lineHeight: 1 }}
              >
                {mode === "condition" ? "Condition" : "Detour"}
              </button>
            ))}
          </div>
        </div>
      </div>


      {/* right column */}
      <div className="w-full gap-2 md:gap-4 lg:w-2/5 flex flex-col h-[60svh] lg:h-full lg:mt-0">

        <div className="flex md:gap-4 gap-2">
          <div className="border p-1 md:p-3 rounded-lg shadow-md text-center" style={{ flex: 1, backgroundColor: "#f4f4f4" }}>
            <div className="text-sm md:text-base md:mb-3">
              Total Bridges
            </div>
            <div id="total-bridges" className="text-2xl md:text-3xl font-semibold">
              {totalBridges}
            </div>
          </div>

          <div className="border px-2 py-1 md:p-3 rounded-lg shadow-md text-center" style={{ flex: 1, backgroundColor: "#f4f4f4" }}>
            
            <div className="md:mb-3"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div className="text-sm md:text-base">Total Estimated Cost</div>
            <span
              className={styles.tooltip}
              data-tooltip="This is a unit cost estimate provided by WSDOT and does not reflect a bridge replacement design, construction schedule, or current construction costs that are all market dependent."
              tabIndex={0}
              aria-label="More info"
            >
              <Info size={18} />
            </span>


          </div>
            <div id="total-cost" className="text-2xl md:text-3xl font-semibold" data-cost="0">
              $0
            </div>
          </div>
        </div>

        
        <div className="flex flex-col border w-100 min-h-0 rounded-lg shadow-md px-2 py-1 md:p-3" style={{flex: "1 1 0", backgroundColor: "#f4f4f4"}}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* Insert Condition Chart */}
            <h4 className="text-sm  md:text-base font-semibold">
              Overall Condition Breakdown
            </h4>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {selectedOverallCondition !== "All" && (
                <button
                  onClick={() => setSelectedOverallCondition("All")}
                  aria-label="Reset condition filter"
                  className="mr-1 md:mr-2"
                  style={{ lineHeight: 0 }}
                  aria-label="Reset"
                >
                  <RotateCcw size={18} />
                </button>
              )}
              <span
                className={styles.tooltip}
                data-tooltip={`• Good: Good condition\n• Fair: Some maintenance required\n• Poor: Advanced deficiencies, major maintenance required`}
                tabIndex={0}
                aria-label="More info"
              >
                <Info size={18} />
              </span>

              
            </div>
          </div>
          <div style={{ 
            flex: 1, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            overflow: "hidden"
          }}>
            <div id="condition-bar-chart" className="w-full h-full p-1 md:p-2"/>
          </div>
        </div>


        <div className="flex flex-col border w-100 min-h-0 rounded-lg shadow-md px-2 py-1 md:p-3" style={{flex: "1 1 0", backgroundColor: "#f4f4f4"}}>
          {/* Insert Detour Chart */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 className="text-sm md:text-base font-semibold">
              Detour Distance 
            </h4>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {selectedDetourRange && (
                <button
                  onClick={() => setSelectedDetourRange(null)}
                  aria-label="Reset detour filter"
                  className="mr-1 md:mr-2"
                  style={{ lineHeight: 0 }}
                >
                  <RotateCcw size={18} />
                </button>
              )}
              <span
                className={styles.tooltip}
                data-tooltip="No Detour: Ground level bypass is available at the structure site for the inventory route."
                tabIndex={0}
                aria-label="More info"
              >
                <Info size={18} />
              </span>

              
            </div>
          </div>
          <div style={{ 
            flex: 1, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            overflow: "hidden"
          }}>
            <div id="detour-distribution-chart" className="w-full h-full p-1 md:p-2"/>
            </div>
          </div>
        </div> 

    <style
      dangerouslySetInnerHTML={{
        __html: `
          .mapboxgl-popup-close-button {
            padding: 6px 10px !important;
            margin: 6px 6px 0 0 !important;
            font-size: 16px !important;
            line-height: 1 !important;
            color: #444 !important;
          }

          .mapboxgl-popup-content {
            padding: 6px 6px 5px 6px;
            margin: 0;
            min-height: unset;
            box-sizing: border-box;
          }
        `,
      }}

    />

    {isMapReady && isMobile && mobilePopupData && (
      <div className="fixed inset-0 z-[2000] pointer-events-none">


        {/* Sheet */}
        <div
          className="
            mt-1 absolute top-[38svh] left-2 right-2
            bg-white rounded-lg
            max-h-[56svh]
            flex flex-col
            pointer-events-auto border border-gray-200
          "
        >
          {/* Sticky header */}
          <div
            className="
              sticky top-0 z-10
              bg-white
              border border-gray-200
              px-4 py-3 rounded-lg
              flex justify-between items-center
            "
          >
            <h3 className="font-semibold text-base">
              {mobilePopupData.BridgeName || "Unknown Bridge"}
            </h3>
            <button
              onClick={() => setMobilePopupData(null)}
              className="text-sm text-blue-600"
            >
              Close
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-3 text-sm space-y-4">
            {/* General info */}
            <section>
              <div><b>Bridge Number:</b> {mobilePopupData.BridgeNumber || "N/A"}</div>
              <div><b>County:</b> {mobilePopupData.CountyName || "N/A"}</div>
              <div><b>Length (ft):</b> {mobilePopupData.PrpsedImprvStructureLgthByFT || "N/A"}</div>
              <div><b>Width (ft):</b> {mobilePopupData.PrpsedImprvRoadwayWdthByFT || "N/A"}</div>
              <div><b>Year Built:</b> {mobilePopupData.YearBuilt || "N/A"}</div>     
                            
              {mobilePopupData.YearRebuilt != null && mobilePopupData.YearRebuilt > 0 && (
                <div>
                  <b>Year Rebuilt:</b> {mobilePopupData.YearRebuilt}
                </div>
              )}

            </section>

            <hr />

            {/* Condition */}
            <section>
              <div className="font-semibold mb-1">Condition</div>
              <div><b>Overall:</b> {mobilePopupData.BridgeOverallConditionState || "N/A"}</div>
              <div><b>Scour:</b> {scourShortDescriptions[mobilePopupData.ScourCondition] || "N/A"}</div>
              <div><b>Culvert:</b> {culvertShortDescriptions[mobilePopupData.CulvertCondition] || "N/A"}</div>
            </section>

            <hr />

            {/* Work & cost */}
            <section>
              <div className="font-semibold mb-1">Work & Cost</div>
              <div><b>Type:</b> {workTypeDescriptions[mobilePopupData.PrpsedImprvTypeOfWork] || "N/A"}</div>
              <div><b>Method:</b> {workMethodDescriptions[mobilePopupData.PrpsedImprvWorkMethod] || "N/A"}</div>
              <div><b>Total:</b> ${formatNumberAbbreviation(mobilePopupData.PrpsedImprvTotalCost * 1000)}</div>
            </section>

            <hr />

            {/* Detour */}
            <section>
              <div className="font-semibold mb-1">Detour</div>
              <div>
                <b>Distance:</b>{" "}
                {mobilePopupData.Detour != null
                  ? `${mobilePopupData.Detour} miles`
                  : "N/A"}
              </div>
            </section>
          </div>
        </div>
      </div>
    )}


    </div>
  );
};

export default BridgeNeedsMap;
