// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import mapboxgl from "mapbox-gl";

type Direction = "EB" | "WB" | "Both";

type RidershipRow = {
  route: string;
  vehicles: number;
  riders: number;
  "walk-on Pass": number;
  "walk-on Share": number; // normalized 0..1
  direction: "EB" | "WB";
  year: number;

  o_id?: number;
  d_id?: number;

  [key: string]: any;
};

const formatSI = d3.format(".2s");
const formatNumber = (n: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
const formatPct = (p: number) =>
  new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(p);

function ensureTooltip() {
  let tooltip = d3.select("body").select("#tooltip");
  if (tooltip.empty()) {
    tooltip = d3
      .select("body")
      .append("div")
      .attr("id", "tooltip")
      .style("position", "fixed")
      .style("background", "white")
      .style("padding", "8px 10px")
      .style("border", "1px solid #ccc")
      .style("border-radius", "8px")
      .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
      .style("display", "none")
      .style("pointer-events", "none")
      .style("font-size", "12px")
      .style("z-index", "9999");
  }
}

const ROUTE_PROP = "Display"; 

function normRouteName(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")         // en/em dash -> hyphen
    .replace(/\s*-\s*/g, " - ")    // normalize spaces around hyphen
    .replace(/\s+/g, " ");         // collapse whitespace
}


function positionTooltip(event: any) {
  const tooltip = d3.select("#tooltip");
  const node = tooltip.node() as HTMLDivElement | null;
  if (!node) return;

  const x = event.clientX ?? event.touches?.[0]?.clientX;
  const y = event.clientY ?? event.touches?.[0]?.clientY;
  if (x == null || y == null) return;

  tooltip.style("display", "block");

  const pad = 8;
  const offset = 12;
  const rect = node.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = x + offset;
  let top = y - rect.height - offset;

  if (top < pad) top = y + offset;

  left = Math.max(pad, Math.min(left, vw - rect.width - pad));
  top = Math.max(pad, Math.min(top, vh - rect.height - pad));

  tooltip.style("left", `${left}px`).style("top", `${top}px`);
}

function updateStackedBarChart(
  svgRef: React.RefObject<SVGSVGElement>,
  data: Array<{
    year: number;
    vehicles: number;
    passengers: number;
    riders: number;
  }>
) {
  const container = svgRef.current?.parentElement;
  if (!container) return;

  const w = container.clientWidth;
  const h = container.clientHeight;

  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;

  const svg = d3
    .select(svgRef.current!)
    .attr("width", w)
    .attr("height", h)
    .style("overflow", "visible");

  svg.selectAll("*").remove();

  const margin = { top: 20, right: 14, bottom: 40, left: 62 };
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;

  if (!data.length) return;

  const years = data.map((d) => d.year);

  const x = d3
    .scaleBand<number>()
    .domain(years)
    .range([0, innerW])
    .padding(0.35);

  const yMax = d3.max(data, (d) => d.riders) ?? 1;
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

  const g = svg
    .append("g")
    .attr("class", "chart")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // grid
  g.append("g")
    .attr("opacity", 0.18)
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(() => ""))
    .selectAll(".tick line")
    .attr("stroke", "currentColor");

  // axes
  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickSizeOuter(0));

  g.append("g").call(
    (d3.axisLeft(y).tickFormat((n: any) => formatSI(n)) as any).ticks(5)
  );

  // y label
  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("transform", `rotate(-90)`)
    .attr("x", -h / 2)
    .attr("y", 14)
    .style("font-size", "12px")
    .text("Riders (stacked)");

  // stack vehicles + passengers
  const keys = ["vehicles", "passengers"] as const;
  const stack = d3.stack<any>().keys(keys as any);
  const stacked = stack(data as any);

  const color = d3
    .scaleOrdinal<string>()
    .domain(keys as any)
    .range(["steelblue", "darkorange"]);

  // bars (stacked)
  g.selectAll("g.layer")
    .data(stacked)
    .join("g")
    .attr("class", "layer")
    .attr("fill", (d: any) => color(d.key) as string)
    .attr("opacity", 0.75)
    .selectAll("rect")
    .data((d: any) => d.map((seg: any) => ({ key: d.key, seg })))
    .join("rect")
    .attr("x", (d: any) => (x(d.seg.data.year) ?? 0))
    .attr("y", (d: any) => y(d.seg[1]))
    .attr("height", (d: any) => y(d.seg[0]) - y(d.seg[1]))
    .attr("width", x.bandwidth())
    .attr("rx", 10)
    .on("mouseover", (event, d: any) => {
      const year = d.seg.data.year;
      const vehicles = d.seg.data.vehicles;
      const passengers = d.seg.data.passengers;
      const riders = d.seg.data.riders;

      const label = d.key;
      const value = label === "vehicles" ? vehicles : passengers;

      d3.select("#tooltip")
        .style("display", "block")
        .html(
          `Year: <b>${year}</b><br/>
           riders: <b>${formatNumber(riders)}</b><br/>
           vehicles: <b>${formatNumber(vehicles)}</b><br/>
           passengers: <b>${formatNumber(passengers)}</b><br/>`
        );
    })
    .on("mousemove", (event) => positionTooltip(event))
    .on("mouseout", () => d3.select("#tooltip").style("display", "none"));

  // total label (tiny) above bars
  g.selectAll("text.total")
    .data(data)
    .join("text")
    .attr("class", "total")
    .attr("x", (d) => (x(d.year) ?? 0) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.riders) - 6)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("opacity", 0.75)
    .text((d) => formatSI(d.riders));

  // legend
  const legend = svg.append("g").attr("transform", `translate(${margin.left},${h - 6})`);
  const items = [
    { label: "vehicles", c: "steelblue" },
    { label: "passengers", c: "darkorange" },
  ];
  let xOff = 0;
  for (const it of items) {
    legend.append("circle").attr("cx", xOff + 6).attr("cy", 0).attr("r", 4).attr("fill", it.c);
    legend.append("text").attr("x", xOff + 16).attr("y", 4).style("font-size", "12px").text(it.label);
    xOff += 210;
  }
}


export default function FerryRidershipStackedBarsWithArcMap() {
  const chartRef = useRef<SVGSVGElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [rows, setRows] = useState<RidershipRow[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string>("All");

  const [routeGeoJson, setRouteGeoJson] = useState<any | null>(null);

  const csvRouteSet = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) s.add(normRouteName(r.route));
    return s;
  }, [rows]);

  const [selectedDirection, setSelectedDirection] = useState<Direction>("both");
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const loadGeo = async () => {
      try {
        const res = await fetch("/data/ferry/WSDOT_-_Ferry_Routes.geojson");
        const gj = await res.json();
        setRouteGeoJson(gj);
      } catch (e) {
        console.error("Failed to load route geojson", e);
      }
    };
    loadGeo();
  }, []);






  useEffect(() => ensureTooltip(), []);

  function extendBoundsFromGeometry(bounds: mapboxgl.LngLatBounds, geom: any) {
    if (!geom) return bounds;

    switch (geom.type) {
      case "LineString":
        geom.coordinates?.forEach((c: any) => bounds.extend(c));
        break;
      case "MultiLineString":
        geom.coordinates?.forEach((line: any) => line?.forEach((c: any) => bounds.extend(c)));
        break;
      case "Point":
        bounds.extend(geom.coordinates);
        break;
      case "MultiPoint":
        geom.coordinates?.forEach((c: any) => bounds.extend(c));
        break;
      case "Polygon":
        geom.coordinates?.forEach((ring: any) => ring?.forEach((c: any) => bounds.extend(c)));
        break;
      case "MultiPolygon":
        geom.coordinates?.forEach((poly: any) =>
          poly?.forEach((ring: any) => ring?.forEach((c: any) => bounds.extend(c)))
        );
        break;
      default:
        break;
    }

    return bounds;
  }

function getLineEndpoints(geom: any): Array<[number, number]> {
  if (!geom) return [];

  // Return [start, end] for LineString/MultiLineString
  if (geom.type === "LineString" && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
    const start = geom.coordinates[0];
    const end = geom.coordinates[geom.coordinates.length - 1];
    return [start, end];
  }

  if (geom.type === "MultiLineString" && Array.isArray(geom.coordinates) && geom.coordinates.length) {
    // Use the longest line (more stable than taking [0])
    let best: any[] | null = null;
    let bestLen = -1;
    for (const line of geom.coordinates) {
      if (!Array.isArray(line) || line.length < 2) continue;
      if (line.length > bestLen) {
        bestLen = line.length;
        best = line;
      }
    }
    if (best) return [best[0], best[best.length - 1]];
  }

  return [];
}



function addEndpointMarkers(map: mapboxgl.Map, features: any[]) {
  clearEndpointMarkers();

  // Avoid duplicates (some datasets have multiple segments per route)
  const seen = new Set<string>();

  for (const f of features) {
    const name = String(f?.properties?.[ROUTE_PROP] ?? "");
    if (!name || seen.has(name)) continue;
    seen.add(name);

    const endpoints = getLineEndpoints(f.geometry);
    if (endpoints.length !== 2) continue;

    const [start, end] = endpoints;

    endpointMarkersRef.current.push(
      new mapboxgl.Marker({ color: "#22c55e", scale: 0.7 }).setLngLat(start).addTo(map),
      new mapboxgl.Marker({ color: "#ef4444", scale: 0.7  }).setLngLat(end).addTo(map)
    );
  }
}




  // load CSV
  useEffect(() => {
    const load = async () => {
      const data = await d3.csv("/data/ferry/WSF_Ridership.csv");

      const parsed: RidershipRow[] = data
        .map((r: any) => {
          const route = String(r["route"] ?? "").trim();

          const direction = String(r[" direction"] ?? r["direction"] ?? "")
            .trim()
            .toUpperCase() as "EB" | "WB";

          const year = Number(String(r[" year"] ?? r["year"] ?? "").trim());

          const vehicles = Number(String(r[" vehicles"] ?? r["vehicles"] ?? "").trim());
          const riders = Number(String(r[" riders"] ?? r["riders"] ?? "").trim());

          const walkOnPass = Number(String(r[" walk-on Pass"] ?? r["walk-on Pass"] ?? "").trim());

          const shareRaw = String(r[" walk-on Share"] ?? r["walk-on Share"] ?? "").trim();
          const shareNum = shareRaw.endsWith("%")
            ? Number(shareRaw.replace("%", "")) / 100
            : Number(shareRaw);

          const o_id = r[" o_id"] ? Number(String(r[" o_id"]).trim()) : undefined;
          const d_id = r[" d_id"] ? Number(String(r[" d_id"]).trim()) : undefined;

          return {
            route,
            direction,
            year,
            vehicles,
            riders,
            "walk-on Pass": walkOnPass,
            "walk-on Share": shareNum,
            o_id,
            d_id,
          };
        })
        .filter(
          (d) =>
            d.route &&
            (d.direction === "EB" || d.direction === "WB") &&
            Number.isFinite(d.year)
        )
        .sort((a, b) => a.year - b.year);

      setRows(parsed);
    };

    load().catch((e) => console.error("Failed to load WSF_Ridership.csv", e));
  }, []);

  const routes = useMemo(() => {
    const set = new Set(rows.map((r) => r.route));
    return ["All", ...Array.from(set)];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (selectedRoute !== "All" && r.route !== selectedRoute) return false;
      if (selectedDirection !== "both" && r.direction !== selectedDirection) return false;
      return true;
    });
  }, [rows, selectedRoute, selectedDirection]);

  // aggregate by year
  const byYear = useMemo(() => {
    const rolled = d3.rollups(
      filtered,
      (v) => {
        const vehicles = d3.sum(v, (d) => d.vehicles);
        const riders = d3.sum(v, (d) => d.riders);
        const walkOnPass = d3.sum(v, (d) => d["walk-on Pass"]);
        const walkOnShare = riders > 0 ? walkOnPass / riders : 0;

        const passengers = Math.max(0, riders - vehicles);
        return {
          vehicles,
          riders,
          passengers,
          "walk-on Pass": walkOnPass,
          "walk-on Share": walkOnShare,
        };
      },
      (d) => d.year
    );

    return rolled
      .map(([year, agg]) => ({ year: +year, ...agg }))
      .sort((a, b) => a.year - b.year);
  }, [filtered]);

  // stats
  const latest = byYear[byYear.length - 1];
  const base2017 = byYear.find((d) => d.year === 2017);
  const end2040 = byYear.find((d) => d.year === 2040);
  const delta = (a?: number, b?: number) => (a && a !== 0 && b != null ? (b - a) / a : 0);

  // draw chart + resize
  useEffect(() => {
    if (!byYear.length) return;

    updateStackedBarChart(chartRef, byYear);

    const container = chartRef.current?.parentElement;
    if (!container) return;

    const observer = new ResizeObserver(() => updateStackedBarChart(chartRef, byYear));
    observer.observe(container);
    return () => observer.disconnect();
  }, [byYear]);


function updateMapDataAndFit(map: mapboxgl.Map) {
  if (!routeGeoJson?.features?.length) return;

  // Only keep routes that appear in the CSV
  const allowed = routeGeoJson.features.filter((f: any) => {
    const name = normRouteName(f?.properties?.[ROUTE_PROP]);
    return csvRouteSet.has(name);
  });

  // If a specific route is selected, filter down to it
  const filtered =
    selectedRoute === "All"
      ? allowed
      : allowed.filter(
          (f: any) => normRouteName(f?.properties?.[ROUTE_PROP]) === normRouteName(selectedRoute)
        );

  addEndpointMarkers(map, filtered);

  // Update the map source data (no Mapbox filter needed)
  const src = map.getSource("routes") as mapboxgl.GeoJSONSource | undefined;
  if (!src) return;

  src.setData({
    type: "FeatureCollection",
    features: filtered,
  } as any);


  // Fit bounds from the same data we just set
  let bounds = new mapboxgl.LngLatBounds();
  let any = false;

  for (const f of filtered) {
    bounds = extendBoundsFromGeometry(bounds, f.geometry);
    any = true;
  }

  if (any && !bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 60, duration: 600, essential: true });
  }
}



const endpointMarkersRef = useRef<mapboxgl.Marker[]>([]);

function clearEndpointMarkers() {
  endpointMarkersRef.current.forEach((m) => m.remove());
  endpointMarkersRef.current = [];
}

function getLineEndpoints(geom: any): Array<[number, number]> {
  if (!geom) return [];

  if (geom.type === "LineString" && geom.coordinates?.length >= 2) {
    return [
      geom.coordinates[0],
      geom.coordinates[geom.coordinates.length - 1],
    ];
  }

  if (geom.type === "MultiLineString" && geom.coordinates?.length) {
    // pick the longest line for stability
    let best = geom.coordinates[0];
    for (const l of geom.coordinates) {
      if (l.length > best.length) best = l;
    }
    return [best[0], best[best.length - 1]];
  }

  return [];
}




// --- init mapbox (runs once) ---
useEffect(() => {
  if (!mapContainerRef.current) return;
  if (mapRef.current) return;

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    console.warn("Missing NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN");
    return;
  }
  mapboxgl.accessToken = token;

  const map = new mapboxgl.Map({
    container: mapContainerRef.current,
    style: "mapbox://styles/mapbox/streets-v11",
    center: [-122.45, 47.55],
    zoom: 8,
  });

  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

  const onLoad = () => {
    if (!map.getSource("routes")) {
      map.addSource("routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

    }

    if (!map.getLayer("route-arc-outline")) {
      map.addLayer({
        id: "route-arc-outline",
        type: "line",
        source: "routes",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.65 },
      });
    }

    if (!map.getLayer("route-arc")) {
      map.addLayer({
        id: "route-arc",
        type: "line",
        source: "routes",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#1A73E8", "line-width": 4, "line-opacity": 0.85 },
      });
    }

    setMapReady(true);
    updateMapDataAndFit(map);

  };

  map.on("load", onLoad);
  mapRef.current = map;

  setTimeout(() => map.resize(), 0);


  return () => {
    map.off("load", onLoad);
    clearEndpointMarkers();
    map.remove();
    mapRef.current = null;
  };
}, []);

useEffect(() => {
  const map = mapRef.current;
  if (!map) return;
  if (!mapReady) return;
  if (!routeGeoJson) return;
  if (!rows.length) return;
  if (!map.getSource("routes")) return;

  updateMapDataAndFit(map);
}, [selectedRoute, mapReady, routeGeoJson, rows]);




  return (
    <div className="w-full flex flex-col gap-2 md:gap-4" style={{ margin: 0 }}>
      {/* TOP: Filters + Stats */}
      <div className="grid grid-cols-1 gap-2 md:gap-4 w-full">
        {/* Filters */}
        <div className="p-2 md:p-3 border rounded-lg shadow-md bg-white flex flex-col">
          <div className="text-sm md:text-lg font-semibold">Filters</div>

          <div className="flex flex-wrap gap-2 md:gap-4 w-full mt-2">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs md:text-sm md:mb-1">Route</label>
              <select
                className="w-full text-xs md:text-sm p-1 md:p-2 border rounded"
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
              >
                {routes.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-40">
              <label className="block text-xs md:text-sm md:mb-1">Direction</label>
              <select
                className="w-full text-xs md:text-sm p-1 md:p-2 border rounded"
                value={selectedDirection}
                onChange={(e) => setSelectedDirection(e.target.value as Direction)}
              >
                <option value="both">Both</option>
                <option value="EB">EB</option>
                <option value="WB">WB</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="p-2 md:p-3 border rounded-lg shadow-md bg-white flex flex-col">
          <div className="text-sm md:text-lg font-semibold">Stats  <span className="text-sm text-gray-500">(2017 → 2040) </span></div>

          {!latest ? (
            <div className="text-xs md:text-sm text-gray-500 mt-2">Loading…</div>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2">

              <div className="border rounded-lg p-2">
                <div className="text-sm text-gray-500">Vehicles</div>
                <div className="text-base font-semibold">
                  {formatPct(delta(base2017?.vehicles, end2040?.vehicles))}
                  {delta(base2017?.vehicles, end2040?.vehicles) > 0 ? (
                    <span style={{"display":"inline-flex","alignItems":"center",color:"green","fontSize":"1em" }}>
                      <svg xmlns="http://www.w3.org/2000/svg"
                           viewBox="0 0 16 16"
                           width="1em"
                           height="0.8em"
                           fill="none"
                           stroke="currentColor"
                           strokeWidth="3"
                           strokeLinecap="round"
                           strokeLinejoin="round">
                        <path d="M8 15V3 M8 3l-4 4 M8 3l4 4"/>
                      </svg>
                    </span>
                  ) : delta(base2017?.vehicles, end2040?.vehicles) < 0 ? (
                    <span style={{"display":"inline-flex","alignItems":"center",color:"red","fontSize":"1em" }}>
                      <svg xmlns="http://www.w3.org/2000/svg"
                           viewBox="0 0 16 16"
                           width="1em"
                           height="0.8em"
                           fill="none"
                           stroke="currentColor"
                           strokeWidth="3"
                           strokeLinecap="round"
                           strokeLinejoin="round">
                        <path d="M8 1v12 M8 13l-4-4 M8 13l4-4"/>
                      </svg>
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="border rounded-lg p-2">
                <div className="text-sm text-gray-500">Passengers</div>
                <div className="text-base font-semibold">
                  {formatPct(delta(base2017?.riders, end2040?.riders) - delta(base2017?.vehicles, end2040?.vehicles))}
                  {delta(base2017?.riders, end2040?.riders) - delta(base2017?.vehicles, end2040?.vehicles) > 0 ? (
                    <span style={{"display":"inline-flex","alignItems":"center",color:"green","fontSize":"1em" }}>
                      <svg xmlns="http://www.w3.org/2000/svg"
                           viewBox="0 0 16 16"
                           width="1em"
                           height="0.8em"
                           fill="none"
                           stroke="currentColor"
                           strokeWidth="3"
                           strokeLinecap="round"
                           strokeLinejoin="round">
                        <path d="M8 15V3 M8 3l-4 4 M8 3l4 4"/>
                      </svg>
                    </span>
                  ) : delta(base2017?.riders, end2040?.riders) - delta(base2017?.vehicles, end2040?.vehicles) < 0 ? (
                    <span style={{"display":"inline-flex","alignItems":"center",color:"red","fontSize":"1em" }}>
                      <svg xmlns="http://www.w3.org/2000/svg"
                           viewBox="0 0 16 16"
                           width="1em"
                           height="0.8em"
                           fill="none"
                           stroke="currentColor"
                           strokeWidth="3"
                           strokeLinecap="round"
                           strokeLinejoin="round">
                        <path d="M8 1v12 M8 13l-4-4 M8 13l4-4"/>
                      </svg>
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="border rounded-lg p-2">
                <div className="text-sm text-gray-500">Total riders</div>
                <div className="text-base font-semibold">
                  {formatPct(delta(base2017?.riders, end2040?.riders))}
                  {delta(base2017?.riders, end2040?.riders) > 0 ? (
                    <span style={{"display":"inline-flex","alignItems":"center",color:"green","fontSize":"1em" }}>
                      <svg xmlns="http://www.w3.org/2000/svg"
                           viewBox="0 0 16 16"
                           width="1em"
                           height="0.8em"
                           fill="none"
                           stroke="currentColor"
                           strokeWidth="3"
                           strokeLinecap="round"
                           strokeLinejoin="round">
                        <path d="M8 15V3 M8 3l-4 4 M8 3l4 4"/>
                      </svg>
                    </span>
                  ) : delta(base2017?.riders, end2040?.riders) < 0 ? (
                    <span style={{"display":"inline-flex","alignItems":"center",color:"red","fontSize":"1em" }}>
                      <svg xmlns="http://www.w3.org/2000/svg"
                           viewBox="0 0 16 16"
                           width="1em"
                           height="0.8em"
                           fill="none"
                           stroke="currentColor"
                           strokeWidth="3"
                           strokeLinecap="round"
                           strokeLinejoin="round">
                        <path d="M8 1v12 M8 13l-4-4 M8 13l4-4"/>
                      </svg>
                    </span>
                  ) : null}
                </div>
              </div>

              

            </div>
          )}
        </div>
      </div>

      {/* BOTTOM: 2 columns (Map left, Viz right) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 md:gap-4 w-full h-full">
        {/* MAP (col 1/left) */}
        <div
          className="
            lg:col-span-2
            border rounded-lg shadow-md relative bg-white
            p-2 md:p-3
            h-[38vh] md:h-[44vh] lg:h-[56vh]
            flex flex-col
          "
        >

          <div className="text-sm md:text-lg font-semibold">
            Route map{" "}
            <span className="text-xs md:text-sm font-normal text-gray-500">
              {selectedRoute === "All" ? "(All routes)" : `(${selectedRoute})`}
            </span>
          </div>
          <div
            ref={mapContainerRef}
            className="w-full h-full mt-2 rounded-lg "
          />
          <div className="text-[11px] text-gray-500 mt-1">
            {/*Arcs are drawn as curved polylines between endpoints (swap ROUTE_ENDPOINTS with real terminal coords later).*/}
          </div>
        </div>

        {/* VIZ (col 2/right) */}
        <div
          className="
            lg:col-span-3
            border rounded-lg shadow-md relative bg-white
            p-2 md:p-3
            h-[38vh] md:h-[44vh] lg:h-[56vh]
            min-h-[260px]
            flex flex-col
          "
        >
          <div className="text-sm md:text-lg font-semibold">
            Daily Ridership Forecast - Peak time
            <span className="text-xs md:text-sm font-normal text-gray-500">
              {" "}
              {selectedRoute === "All" ? "(All routes)" : `(${selectedRoute})`}
              {selectedDirection !== "all" ? ` • ${selectedDirection}` : ""}
            </span>
          </div>

          <div className="w-full h-full flex-1 relative min-h-0" style={{ overflow: "visible" }}>
            <svg ref={chartRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
