// @ts-nocheck
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import type { JourneyBridgeData, JourneyRouteData } from "../../../journeys/types";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

const ORIGIN: [number, number] = [-122.4443, 47.2529];
const DESTINATION: [number, number] = [-122.3321, 47.6062];
const ORIGIN_LABEL = "Tacoma";
const DESTINATION_LABEL = "Downtown Seattle";
const CONDITION_COLORS: Record<string, string> = {
  Good: "#2ca25f",
  Fair: "#fc8d59",
  Poor: "#e34a33",
};

const DETOUR_COLORS: Record<string, string> = {
  noDetour: "#7a7a7a",
  short: "#c6dbef",
  medium: "#6baed6",
  long: "#2171b5",
  veryLong: "#08306b",
};

const CONDITION_HALO_COLORS: Record<string, string> = {
  Good: "rgba(22, 163, 74, 1)",
  Fair: "rgba(234, 88, 12, 1)",
  Poor: "rgba(185, 28, 28, 1)",
};

const DETOUR_HALO_COLORS: Record<string, string> = {
  veryLong: "rgba(8, 48, 107, 1)",
  long: "rgba(30, 64, 175, 1)",
  medium: "rgba(37, 99, 235, 0.7)",
  short: "rgba(59, 130, 246, 0.7)",
  noDetour: "rgba(55, 55, 55, 1)",
};

const DETOUR_BUCKET_LABELS: Record<keyof typeof DETOUR_COLORS, string> = {
  noDetour: "No Detour",
  short: "0–5 mi",
  medium: "6–20 mi",
  long: "21–50 mi",
  veryLong: "Over 50 mi",
};

const CONDITION_ORDER = ["Good", "Fair", "Poor"] as const;
const DETOUR_ORDER = ["noDetour", "short", "medium", "long", "veryLong"] as const;

const scourShortDescriptions: Record<string, string> = {
  "0": "Bridge not over waterway",
  "1": "Bridge foundations determined to be stable for assessed or calculated scour conditions",
  "2": "Bridge foundations determined to be stable and not assessed for scour",
  "3": "Bridge foundations determined to be unstable for assessed or calculated scour conditions",
  "4": "Bridge foundations determined to be stable for assessed or calculated scour conditions; field review indicates action required",
  "5": "Bridge foundations determined to be stable and not assessed; field review indicates action required",
  "8": "Scour is unknown; bridge has not yet been evaluated",
  "N": "Bridge not over waterway",
};

const culvertShortDescriptions: Record<string, string> = {
  N: "Not applicable",
  "0": "Failed condition",
  "1": "Critical condition",
  "2": "Serious condition",
  "3": "Poor condition",
  "4": "Fair condition",
  "5": "Fair condition",
  "6": "Satisfactory condition",
  "7": "Good condition",
  "8": "Very good condition",
  "9": "Excellent condition",
};

const workTypeDescriptions: Record<string, string> = {
  "38": "Other structural work, including hydraulic replacements.",
  "37": "Bridge deck replacement with only incidental widening.",
  "36": "Bridge deck rehabilitation with only incidental widening.",
  "35": "Bridge rehabilitation because of general structure deterioration or inadequate strength.",
  "34": "Widening of existing bridge with deck rehabilitation or replacement.",
  "33": "Widening of existing bridge or other major structure without deck rehabilitation or replacement.",
  "32": "Replacement of bridge or other structure because of relocation of road.",
  "31": "Replacement of bridge or other structure because of substandard load carrying capacity or geometry.",
};

const workMethodDescriptions: Record<string, string> = {
  "2": "Work to be done by owner’s forces",
  "1": "Work to be done by contract",
};

function getDetourBucket(detour: any): keyof typeof DETOUR_COLORS {
  const d = Number(detour);
  if (!detour || isNaN(d) || d === 0) return "noDetour";
  if (d <= 5) return "short";
  if (d <= 20) return "medium";
  if (d <= 50) return "long";
  return "veryLong";
}

function formatNumberAbbreviation(value: number | string | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "N/A";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function formatMinutes(mins: number | null): string {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr${h > 1 ? "s" : ""}`;
  return `${h} hr${h > 1 ? "s" : ""} ${m} min`;
}

function buildBridgePopupHTML(p: any) {
  return `
    <div style="font-family:sans-serif;font-size:12px;width:100%;box-sizing:border-box">
      <div style="font-weight:bold;font-size:14px;margin-bottom:8px">${p.BridgeName || "Unknown Bridge"}</div>
      <div style="max-height:210px;overflow-y:auto;padding-right:8px">
        <div style="margin-bottom:8px;">
          <div><b>Bridge Number:</b> ${p.BridgeNumber || "N/A"}</div>
          <div><b>County:</b> ${p.CountyName || "N/A"}</div>
          <div><b>Length (ft):</b> ${p.PrpsedImprvStructureLgthByFT || "N/A"}</div>
          <div><b>Width (ft):</b> ${p.PrpsedImprvRoadwayWdthByFT || "N/A"}</div>
          <div><b>Year Built:</b> ${p.YearBuilt || "N/A"}</div>
          ${p.YearRebuilt ? `<div><b>Year Rebuilt:</b> ${p.YearRebuilt}</div>` : ""}
        </div>
        <hr style="margin:8px 0;border:none;border-top:1px solid #ddd;" />
        <div style="margin-bottom:8px;">
          <div style="font-weight:bold;margin-bottom:4px;">Condition</div>
          <div><b>Overall:</b> ${p.BridgeOverallConditionState || "N/A"}</div>
          <div><b>Scour:</b> ${scourShortDescriptions[p.ScourCondition] || "N/A"}</div>
          <div><b>Culvert:</b> ${culvertShortDescriptions[p.CulvertCondition] || "N/A"}</div>
        </div>
        <hr style="margin:8px 0;border:none;border-top:1px solid #ddd;" />
        <div style="margin-bottom:8px;">
          <div style="font-weight:bold;margin-bottom:4px;">Work & Cost</div>
          <div><b>Type:</b> ${workTypeDescriptions[p.PrpsedImprvTypeOfWork] || "N/A"}</div>
          <div><b>Method:</b> ${workMethodDescriptions[p.PrpsedImprvWorkMethod] || "N/A"}</div>
          <div><b>Cost/Deck SF:</b> ${formatNumberAbbreviation(Number(p.PrpsedImprvCostPerSFDeck) * 1000)}</div>
          <div><b>Structure Cost:</b> ${formatNumberAbbreviation(Number(p.PrpsedImprvStructureCost) * 1000)}</div>
          <div><b>Roadway Cost:</b> ${formatNumberAbbreviation(Number(p.PrpsedImprvRoadwayCost) * 1000)}</div>
          <div><b>Total:</b> ${formatNumberAbbreviation(Number(p.PrpsedImprvTotalCost) * 1000)}</div>
        </div>
        <hr style="margin:8px 0;border:none;border-top:1px solid #ddd;" />
        <div>
          <div style="font-weight:bold;margin-bottom:4px;">Detour</div>
          <div><b>Distance:</b> ${p.Detour != null ? `${p.Detour} miles` : "N/A"}</div>
        </div>
      </div>
    </div>
  `;
}

const ElenaBridges: React.FC<{
  route: JourneyRouteData;
  bridges: JourneyBridgeData[];
}> = ({
  route,
  bridges,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const activePopupRef = useRef<mapboxgl.Popup | null>(null);
  const activeBridgeIdRef = useRef<string | number | null>(null);
  const chartHighlightedIdsRef = useRef<string[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [colorMode, setColorMode] = useState<"condition" | "detour">("condition");
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  const [selectedDetourBucket, setSelectedDetourBucket] = useState<keyof typeof DETOUR_COLORS | null>(null);
  const [hoveredCondition, setHoveredCondition] = useState<string | null>(null);
  const [hoveredDetourBucket, setHoveredDetourBucket] = useState<keyof typeof DETOUR_COLORS | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-122.15, 47.43],
      zoom: 9.5,
      cooperativeGestures: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("load", () => {
      new mapboxgl.Marker({ color: "#1d4ed8" })
        .setLngLat(ORIGIN)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(ORIGIN_LABEL))
        .addTo(map);
      new mapboxgl.Marker({ color: "#dc2626" })
        .setLngLat(DESTINATION)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(DESTINATION_LABEL))
        .addTo(map);
      setMapLoaded(true);
    });

    mapRef.current = map;
    return () => map.remove();
  }, []);

  const travelTime = useMemo(() => Math.round(route.duration / 60), [route.duration]);
  const bridgesAlongRoute = useMemo(() => bridges, [bridges]);

  const filteredBridges = useMemo(() => {
    return bridgesAlongRoute.filter((bridge) => {
      const passesCondition =
        !selectedCondition || bridge.BridgeOverallConditionState === selectedCondition;
      const detourBucket = getDetourBucket(bridge.Detour);
      const passesDetour = !selectedDetourBucket || detourBucket === selectedDetourBucket;
      return passesCondition && passesDetour;
    });
  }, [bridgesAlongRoute, selectedCondition, selectedDetourBucket]);

  const conditionSummary = useMemo(
    () =>
      CONDITION_ORDER.map((label) => ({
        label,
        count: bridgesAlongRoute.filter((bridge) => bridge.BridgeOverallConditionState === label).length,
        filteredCount: filteredBridges.filter((bridge) => bridge.BridgeOverallConditionState === label).length,
        color: CONDITION_COLORS[label],
      })),
    [bridgesAlongRoute, filteredBridges]
  );

  const detourSummary = useMemo(
    () =>
      DETOUR_ORDER.map((bucket) => ({
        bucket,
        label: DETOUR_BUCKET_LABELS[bucket],
        count: bridgesAlongRoute.filter((bridge) => getDetourBucket(bridge.Detour) === bucket).length,
        filteredCount: filteredBridges.filter((bridge) => getDetourBucket(bridge.Detour) === bucket).length,
        color: DETOUR_COLORS[bucket],
      })),
    [bridgesAlongRoute, filteredBridges]
  );

  const hoveredBridgeIds = useMemo(() => {
    if (hoveredCondition) {
      return new Set(
        bridgesAlongRoute
          .filter((bridge) => bridge.BridgeOverallConditionState === hoveredCondition)
          .map((bridge) => String(bridge.BridgeNumber))
      );
    }

    if (hoveredDetourBucket) {
      return new Set(
        bridgesAlongRoute
          .filter((bridge) => getDetourBucket(bridge.Detour) === hoveredDetourBucket)
          .map((bridge) => String(bridge.BridgeNumber))
      );
    }

    return null;
  }, [bridgesAlongRoute, hoveredCondition, hoveredDetourBucket]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !route) return;

    const routeGeoJSON: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: route.geometry, properties: {} }],
    };

    if (map.getLayer("elena-bridge-route")) {
      (map.getSource("elena-bridge-route") as mapboxgl.GeoJSONSource).setData(routeGeoJSON);
    } else {
      map.addSource("elena-bridge-route", {
        type: "geojson",
        lineMetrics: true,
        data: routeGeoJSON,
      });
      map.addLayer(
        {
          id: "elena-bridge-route",
          type: "line",
          source: "elena-bridge-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#2563eb", "line-width": 5, "line-opacity": 0.8 },
        },
        "road-label"
      );
    }

    const bridgeGeoJSON: any = {
      type: "FeatureCollection",
      features: filteredBridges
        .filter((b) => b.Longitude && b.Latitude)
        .map((b) => ({
          type: "Feature",
          id: b.BridgeNumber,
          geometry: { type: "Point", coordinates: [b.Longitude, b.Latitude] },
          properties: { ...b, detourBucket: getDetourBucket(b.Detour) },
        })),
    };

    const colorExpr =
      colorMode === "condition"
        ? [
            "match",
            ["get", "BridgeOverallConditionState"],
            "Good",
            CONDITION_COLORS.Good,
            "Fair",
            CONDITION_COLORS.Fair,
            CONDITION_COLORS.Poor,
          ]
        : [
            "match",
            ["get", "detourBucket"],
            "noDetour",
            DETOUR_COLORS.noDetour,
            "short",
            DETOUR_COLORS.short,
            "medium",
            DETOUR_COLORS.medium,
            "long",
            DETOUR_COLORS.long,
            DETOUR_COLORS.veryLong,
          ];

    if (map.getSource("elena-route-bridges")) {
      (map.getSource("elena-route-bridges") as mapboxgl.GeoJSONSource).setData(bridgeGeoJSON);
      map.setPaintProperty("elena-route-bridges-circle", "circle-color", colorExpr as any);
    } else {
      map.addSource("elena-route-bridges", {
        type: "geojson",
        data: bridgeGeoJSON,
        promoteId: "BridgeNumber",
      });
      map.addLayer({
        id: "elena-route-bridges-circle",
        type: "circle",
        source: "elena-route-bridges",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            ["case", ["boolean", ["feature-state", "hover"], false], 7, 3],
            8,
            ["case", ["boolean", ["feature-state", "hover"], false], 10, 5],
            12,
            ["case", ["boolean", ["feature-state", "hover"], false], 14, 8],
            16,
            ["case", ["boolean", ["feature-state", "hover"], false], 18, 12],
          ],
          "circle-color": colorExpr as any,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 0.8,
          "circle-opacity": 0.95,
        },
      });
    }

    const bbox = turf.bbox(turf.lineString(route.geometry.coordinates)) as [
      number,
      number,
      number,
      number
    ];
    map.fitBounds(bbox, {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      maxZoom: 13,
      duration: 800,
    });
  }, [mapLoaded, route, filteredBridges, colorMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getLayer("elena-route-bridges-circle")) return;

    let hoveredId: string | number | null = null;

    const onMove = (e: mapboxgl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;

      if (hoveredId !== null && hoveredId !== feature.id) {
        map.setFeatureState({ source: "elena-route-bridges", id: hoveredId }, { hover: false });
      }

      hoveredId = feature.id ?? null;
      if (hoveredId !== null) {
        map.setFeatureState({ source: "elena-route-bridges", id: hoveredId }, { hover: true });
      }

      map.getCanvas().style.cursor = "pointer";

      if (!hoverPopupRef.current) {
        hoverPopupRef.current = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 10,
          maxWidth: "200px",
        });
      }

      hoverPopupRef.current
        .setLngLat(e.lngLat)
        .setHTML(`
          <div>
            <div style="font-weight:bold;">${feature.properties?.BridgeNumber ?? "Unknown #"}</div>
            <div>${feature.properties?.BridgeName ?? "Unnamed bridge"}</div>
            <div style="color:grey;font-size:12px;text-align:right;">Click for more</div>
          </div>
        `)
        .addTo(map);

      hoverPopupRef.current.getElement().style.pointerEvents = "none";
    };

    const onLeave = () => {
      if (hoveredId !== null) {
        map.setFeatureState({ source: "elena-route-bridges", id: hoveredId }, { hover: false });
      }
      hoveredId = null;
      map.getCanvas().style.cursor = "";
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;
    };

    const onClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;

      if (activeBridgeIdRef.current === feature.id) {
        activePopupRef.current?.remove();
        activePopupRef.current = null;
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
        .setLngLat(feature.geometry.coordinates as [number, number])
        .setHTML(buildBridgePopupHTML(feature.properties))
        .addTo(map);

      activeBridgeIdRef.current = feature.id ?? null;
    };

    map.on("mousemove", "elena-route-bridges-circle", onMove);
    map.on("mouseleave", "elena-route-bridges-circle", onLeave);
    map.on("click", "elena-route-bridges-circle", onClick);

    return () => {
      map.off("mousemove", "elena-route-bridges-circle", onMove);
      map.off("mouseleave", "elena-route-bridges-circle", onLeave);
      map.off("click", "elena-route-bridges-circle", onClick);
    };
  }, [mapLoaded, filteredBridges]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getLayer("elena-route-bridges-circle")) return;

    for (const id of chartHighlightedIdsRef.current) {
      map.setFeatureState({ source: "elena-route-bridges", id }, { chartHover: false });
    }

    if (!hoveredBridgeIds) {
      chartHighlightedIdsRef.current = [];
      map.setPaintProperty("elena-route-bridges-circle", "circle-opacity", 0.95);
      map.setPaintProperty("elena-route-bridges-circle", "circle-stroke-color", "#fff");
      map.setPaintProperty("elena-route-bridges-circle", "circle-stroke-width", 0.8);
      return;
    }

    const ids = Array.from(hoveredBridgeIds);
    for (const id of ids) {
      map.setFeatureState({ source: "elena-route-bridges", id }, { chartHover: true });
    }
    chartHighlightedIdsRef.current = ids;

    map.setPaintProperty("elena-route-bridges-circle", "circle-opacity", [
      "case",
      ["in", ["to-string", ["get", "BridgeNumber"]], ["literal", ids]],
      1,
      0.2,
    ] as any);

    const haloColorExpression =
      colorMode === "condition"
        ? [
            "match",
            ["get", "BridgeOverallConditionState"],
            "Good",
            CONDITION_HALO_COLORS.Good,
            "Fair",
            CONDITION_HALO_COLORS.Fair,
            "Poor",
            CONDITION_HALO_COLORS.Poor,
            "#ffffff",
          ]
        : [
            "match",
            ["get", "detourBucket"],
            "veryLong",
            DETOUR_HALO_COLORS.veryLong,
            "long",
            DETOUR_HALO_COLORS.long,
            "medium",
            DETOUR_HALO_COLORS.medium,
            "short",
            DETOUR_HALO_COLORS.short,
            "noDetour",
            DETOUR_HALO_COLORS.noDetour,
            "#ffffff",
          ];

    map.setPaintProperty("elena-route-bridges-circle", "circle-stroke-color", [
      "case",
      ["in", ["to-string", ["get", "BridgeNumber"]], ["literal", ids]],
      haloColorExpression,
      "#fff",
    ] as any);
    map.setPaintProperty("elena-route-bridges-circle", "circle-stroke-width", [
      "case",
      ["in", ["to-string", ["get", "BridgeNumber"]], ["literal", ids]],
      2.5,
      0.8,
    ] as any);
  }, [mapLoaded, hoveredBridgeIds, colorMode]);

  const legend =
    colorMode === "condition"
      ? [
          { label: "Good", color: CONDITION_COLORS.Good },
          { label: "Fair", color: CONDITION_COLORS.Fair },
          { label: "Poor", color: CONDITION_COLORS.Poor },
        ]
      : [
          { label: "No Detour", color: DETOUR_COLORS.noDetour },
          { label: "0–5 mi", color: DETOUR_COLORS.short },
          { label: "6–20 mi", color: DETOUR_COLORS.medium },
          { label: "21–50 mi", color: DETOUR_COLORS.long },
          { label: "Over 50 mi", color: DETOUR_COLORS.veryLong },
        ];

  return (
    <div className="flex flex-col gap-3 w-full" style={{ fontFamily: "Encode Sans Compressed, sans-serif" }}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 flex-wrap">
          {(["condition", "detour"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setColorMode(mode)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                colorMode === mode
                  ? "bg-black text-white border-black shadow"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
              }`}
            >
              Color by {mode === "condition" ? "condition" : "detour"}
            </button>
          ))}
          <div className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">
            Bridges on route: <span className="ml-2 font-semibold text-gray-900">{filteredBridges.length}</span>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {selectedCondition || selectedDetourBucket ? (
            <button
              onClick={() => {
                setSelectedCondition(null);
                setSelectedDetourBucket(null);
              }}
              className="rounded-full border border-gray-300 px-3 py-1 hover:border-gray-500"
            >
              Clear bridge filters
            </button>
          ) : (
            <span>Hover a summary chart to highlight bridges, click to filter.</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        <div className="relative h-[520px] rounded-lg overflow-hidden border border-gray-200 shadow-sm md:w-3/5">
          <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

          <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-100 px-4 py-3 min-w-[170px]">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-0.5">
              Elena's corridor
            </p>
            <div className="text-2xl font-bold text-gray-900">
              {formatMinutes(travelTime)}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Tacoma → Seattle · 7:30 AM
            </p>
          </div>

          <div className="absolute bottom-8 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow border border-gray-100 px-3 py-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
              {colorMode === "condition" ? "Bridge condition" : "Closure detour"}
            </p>
            <div className="flex flex-col gap-1">
              {legend.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-6 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-xs text-gray-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-2 md:h-[520px] md:w-2/5">
          <SummaryChart
            title="Overall Condition Breakdown"
            cardClassName="border-green-200 bg-green-50"
            titleClassName="text-green-900"
            className="flex-none"
            items={conditionSummary.map((item) => ({
              key: item.label,
              label: item.label,
              color: item.color,
              count: item.count,
              filteredCount: item.filteredCount,
              active: selectedCondition === item.label,
              activeBorderColor: item.color,
            }))}
            onHover={(key) => setHoveredCondition(key)}
            onLeave={() => setHoveredCondition(null)}
            onSelect={(key) => setSelectedCondition((prev) => (prev === key ? null : key))}
          />
          <SummaryChart
            title="Detour Distance"
            cardClassName="border-blue-200 bg-blue-50"
            titleClassName="text-blue-900"
            className="flex-1"
            items={detourSummary.map((item) => ({
              key: item.bucket,
              label: item.label,
              color: item.color,
              count: item.count,
              filteredCount: item.filteredCount,
              active: selectedDetourBucket === item.bucket,
              activeBorderColor: item.color,
            }))}
            onHover={(key) => setHoveredDetourBucket(key as keyof typeof DETOUR_COLORS)}
            onLeave={() => setHoveredDetourBucket(null)}
            onSelect={(key) =>
              setSelectedDetourBucket((prev) =>
                prev === (key as keyof typeof DETOUR_COLORS) ? null : (key as keyof typeof DETOUR_COLORS)
              )
            }
          />
        </div>
      </div>
    </div>
  );
};

function SummaryChart({
  title,
  cardClassName,
  className,
  titleClassName,
  items,
  onHover,
  onLeave,
  onSelect,
}: {
  title: string;
  cardClassName?: string;
  className?: string;
  titleClassName?: string;
  items: Array<{
    key: string;
    label: string;
    color: string;
    count: number;
    filteredCount: number;
    active: boolean;
    activeBorderColor: string;
  }>;
  onHover: (key: string | null) => void;
  onLeave: () => void;
  onSelect: (key: string) => void;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  const hasActive = items.some((item) => item.active);

  return (
    <div className={`flex min-h-0 flex-col rounded-lg border p-2.5 shadow-md ${cardClassName ?? "border-gray-200 bg-[#f4f4f4]"} ${className ?? ""}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className={`text-sm md:text-base font-semibold leading-tight ${titleClassName ?? "text-gray-900"}`}>{title}</p>
      </div>
      <div className="flex-1 space-y-1">
        {items.map((item) => {
          const pct = Math.max((item.count / max) * 100, item.count > 0 ? 10 : 0);
          return (
            <button
              key={item.key}
              onMouseEnter={() => onHover(item.key)}
              onMouseLeave={onLeave}
              onClick={() => onSelect(item.key)}
              className={`w-full rounded-md px-2.5 py-1.5 text-left transition-all ${
                item.active
                  ? "border bg-white"
                  : "border border-gray-200 bg-white hover:border-gray-400"
              }`}
              style={
                item.active
                  ? {
                      borderStyle: "solid",
                      borderWidth: "1px",
                      borderColor: item.activeBorderColor,
                      boxShadow: [
                        `0 0 0 1px ${item.activeBorderColor}`,
                        `0 0 0 4px ${item.activeBorderColor}26`,
                        `0 8px 18px -10px ${item.activeBorderColor}99`,
                      ].join(", "),
                    }
                  : undefined
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">{item.label}</div>
                <span className="text-sm font-bold leading-none text-gray-700">
                  {item.filteredCount}
                  {item.filteredCount !== item.count ? ` / ${item.count}` : ""}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: item.color }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ElenaBridges;
