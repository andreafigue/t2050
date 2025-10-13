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

import { Info } from "lucide-react";
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


const BridgeNeedsMap = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

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

  // Load CSV data.
  // useEffect(() => {
  //   fetch("/Bridge Needs GIS data.csv")
  //     .then((response) => response.text())
  //     .then((csvText) => {
  //       Papa.parse(csvText, {
  //         header: true,
  //         dynamicTyping: true,
  //         complete: (result) => {
  //           if (result.data.length > 0) {
  //             const normalizedData = result.data.map((d: any) => ({
  //               ...d,
  //               CountyName: String(d.CountyName || "").trim(),
  //               BridgeOverallConditionState: String(d.BridgeOverallConditionState || "").trim(),
  //               CulvertCondition: String(d.CulvertCondition || "").trim(),
  //               ScourCondition: String(d.ScourCondition || "").trim(),
  //               Detour: Number(d.Detour) // Ensure detour is numeric
  //             }));
  //             //console.log("Parsed Data:", normalizedData);
  //             setBridges(normalizedData);
  //           } else {
  //             console.error("No data found in CSV.");
  //           }
  //         },
  //       });
  //     })
  //     .catch((error) => console.error("Error loading CSV:", error));
  // }, []);

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
        zoom: 5.6,
        accessToken: mapboxToken,
      });

      mapInstance.current.addControl(new mapboxgl.NavigationControl(), "right");
    }
  }, []);

  // Add WA county divisions layer from local GeoJSON file.
  useEffect(() => {
    if (!mapInstance.current) return;
    mapInstance.current.on("load", () => {
      // Fetch the local GeoJSON file.
      fetch("/wa_counties.geojson")
        .then((res) => res.json())
        .then((data) => {
          // Add the source.
          if (!mapInstance.current!.getSource("wa-county-divisions")) {
            mapInstance.current!.addSource("wa-county-divisions", {
              type: "geojson",
              data: data,
            });
            // Add a layer to display county boundaries.
            mapInstance.current!.addLayer({
              id: "wa-county-boundaries",
              type: "line",
              source: "wa-county-divisions",
              layout: {},
              paint: {
                "line-color": "#757575", 
                "line-width": 1
              },
            }, "land-structure-polygon");
            mapInstance.current!.addLayer({
              id: "wa-county-gray-fill",
              type: "fill",
              source: "wa-county-divisions",
              paint: {
                "fill-color": "#dddddd",
                "fill-opacity": 0.5
              },
              filter: ["in", "NAME", ""] // placeholder, will update dynamically
            }, "land-structure-polygon");

            mapInstance.current!.addLayer({
              id: "wa-county-selection-outline",
              type: "line",
              source: "wa-county-divisions",
              paint: {
                "line-color": "#757575", // bright blue
                "line-width": 2
              },
              filter: ["in", "NAME", ""] // start empty
            }, "land-structure-polygon");
          }
        })
        .catch((err) => console.error("Error loading counties GeoJSON:", err));
    });
  }, []);

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

  // Update markers whenever bridges, filters, or viewMode change.
  useEffect(() => {
    if (!mapInstance.current || bridges.length === 0) return;
    const map = mapInstance.current;

    const clearMarkers = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };

    const filtered = filteredBridges;

    const addMarkers = () => {
      clearMarkers();

      let detourColorScale: d3.ScaleSequential<string> | null = null;

      if (viewMode === "detour") {
        const detourValues = filtered
          .map(b => b.Detour)
          .filter(d => typeof d === "number" && !isNaN(d));

        detourColorScale = d3.scaleSequential()
          .domain([0, 99])
          .interpolator(colorScale);
      }


      filtered.forEach((bridge) => {
        const {
          Longitude,
          Latitude,
          BridgeNumber,
          BridgeName,
          YearBuilt,
          YearRebuilt,
          ScourCondition,
          CulvertCondition,
          BridgeOverallConditionState,
          Detour,
          PrpsedImprvTypeOfWork,
          PrpsedImprvWorkMethod,
          PrpsedImprvStructureLgthByFT,
          PrpsedImprvRoadwayWdthByFT,
          PrpsedImprvCostPerSFDeck,
          PrpsedImprvStructureCost,
          PrpsedImprvRoadwayCost,
          PrpsedImprvEngMiscCost,
          PrpsedImprvTotalCost,
          PrpsedImprvEstimateYear,
        } = bridge;

        if (!Longitude || !Latitude) return;

        // Determine marker color based on viewMode.
        let markerColor = "#ff5733";

        if (viewMode === "detour" && typeof Detour === "number") {
          const bucket = getDetourBucket(Detour);
          markerColor = detourBucketColors[bucket] || "#999999";
        } else {
          markerColor = conditionColors[BridgeOverallConditionState] || "#999999";
        }

        const markerDot = document.createElement("div");
        markerDot.dataset.condition = BridgeOverallConditionState;
        markerDot.classList.add("map-dot", "highlighted");

        if (typeof Detour === "number") {
          markerDot.dataset.detourBucket = getDetourBucket(Detour);
        }

        // Wrapper div Mapbox will use
        const wrapper = document.createElement("div");
        wrapper.style.width = "10px";
        wrapper.style.height = "10px";
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.justifyContent = "center";
        wrapper.appendChild(markerDot);

        markerDot.style.width = "7px";
        markerDot.style.height = "7px";
        markerDot.style.borderRadius = "50%";
        markerDot.style.backgroundColor = markerColor;
        //markerDot.style.opacity = "0.8";

        // Build popup content based on view mode.
        const popupContent = `
          <div style="font-family: sans-serif; font-size: 12px; width: 100%; box-sizing: border-box;">
            
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">
              ${BridgeName || "Unknown Bridge"}
            </div>

            <div style="max-height: 210px; overflow-y: auto; padding-right: 8px;">
              <div style="margin-bottom: 8px;">
                <div><b>Bridge Number:</b> ${BridgeNumber || "N/A"}</div>
                <div><b>County:</b> ${bridge.CountyName || "N/A"}</div>
                <div><b>Length (ft):</b> ${PrpsedImprvStructureLgthByFT || "N/A"}</div>
                <div><b>Width (ft):</b> ${PrpsedImprvRoadwayWdthByFT || "N/A"}</div>
                <div><b>Year Built:</b> ${YearBuilt || "N/A"}</div>
                ${
                  YearRebuilt
                    ? `<div><b>Year Rebuilt:</b> ${YearRebuilt}</div>`
                    : ""
                }
              </div>

              <hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;" />

              <div style="margin-bottom: 8px;">
                <div style="font-weight: bold; margin-bottom: 4px;">Condition</div>
                <div><b>Overall:</b> ${BridgeOverallConditionState || "N/A"}</div>
                <div><b>Scour:</b> ${scourShortDescriptions[ScourCondition] || "N/A"}</div>
                <div><b>Culvert:</b> ${culvertShortDescriptions[CulvertCondition] || "N/A"}</div>
              </div>

              <hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;" />

              <div style="margin-bottom: 8px;">
                <div style="font-weight: bold; margin-bottom: 4px;">Work & Cost</div>
                <div><b>Type:</b> ${workTypeDescriptions[PrpsedImprvTypeOfWork] || "N/A"}</div>
                <div><b>Method:</b> ${workMethodDescriptions[PrpsedImprvWorkMethod] || "N/A"}</div>
                <div><b>Cost/Deck SF:</b> ${formatNumberAbbreviation(PrpsedImprvCostPerSFDeck * 1000) || "N/A"}</div>
                <div><b>Structure Cost:</b> ${formatNumberAbbreviation(PrpsedImprvStructureCost * 1000) || "N/A"}</div>
                <div><b>Roadway Cost:</b> ${formatNumberAbbreviation(PrpsedImprvRoadwayCost * 1000) || "N/A"}</div>
                <div><b>Total:</b> ${formatNumberAbbreviation(PrpsedImprvTotalCost * 1000) || "N/A"}</div>
              </div>

              <hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;" />

              <div>
                <div style="font-weight: bold; margin-bottom: 4px;">Detour</div>
                <div><b>Distance:</b> ${Detour != null ? Detour + " miles" : "N/A"}</div>
              </div>
            </div>
          </div>
        `;

        const marker = new mapboxgl.Marker({ element: wrapper })
          .setLngLat([Longitude, Latitude])
          .setPopup(
            new mapboxgl.Popup({ closeButton: true, maxWidth: "300px" })
              .setHTML(popupContent)
          )
          .addTo(map);

        markersRef.current.push(marker);
      });
    };

    if (map.loaded()) {
      addMarkers();
    } else {
      map.once("load", addMarkers);
    }
  }, [
    bridges,
    selectedCounties,
    selectedOverallCondition,
    selectedScourCondition,
    selectedDetourRange,
    viewMode,
  ]);

  // Update for layers of the map when filtering
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !map.isStyleLoaded()) return;

    const normalized = selectedCounties.map(name =>
      name.replace(/ County$/, "").trim()
    );

    const selectedfilter =
      normalized.length > 0
        ? ["in", "NAME", ...normalized]
        : ["in", "NAME", ""];

    const unselectedFilter =
    normalized.length > 0
      ? ["!in", "NAME", ...normalized] // show all NOT selected
      : ["in", "NAME", ""];            // show nothing


    if (map.getLayer("wa-county-selection-outline")) {
      map.setFilter("wa-county-selection-outline", selectedfilter);
    }

    if (map.getLayer("wa-county-gray-fill")) {
      map.setFilter("wa-county-gray-fill", unselectedFilter);
    }
  }, [selectedCounties]);


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
    const width = 400;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };

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

    // AFTER (reuses if exists, otherwise creates once)
    const tooltip = d3.select("body").select(".d3-tooltip").empty()
      ? d3.select("body")
          .append("div")
          .attr("class", "d3-tooltip")
          .style("position", "absolute")
          .style("background", "#fff")
          .style("padding", "5px 10px")
          .style("border", "1px solid #ccc")
          .style("border-radius", "4px")
          .style("pointer-events", "none")
          .style("opacity", 0)
      : d3.select("body").select(".d3-tooltip");


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

    bars
      .on("click", (_, d) => {
        setSelectedOverallCondition(prev =>
          prev === d.label ? "All" : d.label
        );
      })
      .on("mouseover", function (event, d) {

        tooltip
          .style("opacity", 1)
          .html(`<strong>${d.label} (${d.percentage}%)</strong><br/>${d.count} bridges<br/>
            <small style="color: grey;">
              ${selectedOverallCondition === d.label ? "Click to reset" : "Click to filter"}
            </small>`);
        svg.selectAll("rect")
          //.transition().duration(50)
          .style("opacity", bar => bar.label === d.label ? 1 : 0.3);        

        d3.selectAll<HTMLDivElement, unknown>(".map-dot")
          .classed("highlighted", function() {
            return (this as HTMLDivElement).dataset.condition === d.label;
          })
          .classed("dimmed", function() {
            return (this as HTMLDivElement).dataset.condition !== d.label;
          });
        })
        .on("mousemove", event => {
          tooltip.style("left", (event.pageX + 10) + "px")
                 .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
          svg.selectAll("rect")
            //.transition().duration(50)
            .style("opacity", 1);

          tooltip.style("opacity", 0);

          d3.selectAll(".map-dot")
            .classed("highlighted", false)
            .classed("dimmed", false);

      });

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

  }, [filteredBridges, selectedOverallCondition]);


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

    filteredBridges.forEach(d => {
      const bucket = getDetourBucket(d.Detour);
      bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;
    });

    const width = 400;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };

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


    const tooltip = d3.select("body").select(".d3-tooltip").empty()
      ? d3.select("body")
        .append("div")
        .attr("class", "d3-tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("padding", "5px 10px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("opacity", 0)
      : d3.select("body").select(".d3-tooltip");

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

        d3.selectAll<HTMLDivElement, unknown>(".map-dot")
        .classed("highlighted", function () {
          return (this as HTMLDivElement).dataset.detourBucket === d.label;
        })
        .classed("dimmed", function () {
          return (this as HTMLDivElement).dataset.detourBucket !== d.label;
        });

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
        d3.selectAll(".map-dot")
        .classed("highlighted", false)
        .classed("dimmed", false);
      });

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
  }, [filteredBridges]);

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
    <div className="flex gap-4" style={{ width:'100%', height:"75vh", margin:0 }}>
      <div className="border shadow-md" style={{ width: "60%", position: "relative",  borderRadius: "8px"}}>

        {/* County filter */}     
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            zIndex: 10,
            background: "rgba(255, 255, 255, 0.95)",
            borderRadius: "8px",
            padding: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            width: "240px",
            fontSize: "10pt",
            fontFamily: "Encode Sans Compressed, sans-serif"

          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "11pt",
              fontWeight: "bold",
              marginBottom: "8px"
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
                    <input
                      type="checkbox"
                      checked={props.isSelected}
                      onChange={() => {}}
                      style={{ marginRight: 8 }}
                    />
                    {props.label}
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

        {/* Display mode filter */}

        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            zIndex: 10,
            background: "rgba(255, 255, 255, 0.95)",
            borderRadius: "8px",
            padding: "10px 15px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            display: "flex",
            alignItems: "center",
            gap: "15px",
            fontSize: "11pt"
          }}
        >
          <strong 
            style={{
              fontSize: "11pt", 
              fontFamily: "Encode Sans Compressed, sans-serif"
            }}
          >
            Display Mode:
          </strong>
          <label style={{fontSize: "11pt", marginBottom: "0"}}>
            <input
              type="radio"
              value="condition"
              checked={viewMode === "condition"}
              onChange={() => setViewMode("condition")}
            />{" "}
            Condition
          </label>
          <label style={{fontSize: "11pt", marginBottom: "0"}}>
            <input
              type="radio"
              value="detour"
              checked={viewMode === "detour"}
              onChange={() => setViewMode("detour")}
            />{" "}
            Detour
          </label>
        </div>

        {/* Map Container */}

        <div ref={mapContainerRef} style={{ height: "100%", borderRadius: 8 }}></div>
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            background: "rgba(255, 255, 255, 0.9)",
            padding: "15px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
            {viewMode === "detour" ? (
              <div style={{ minWidth: "100px", fontSize: "10pt" }}>
                {[
                  { label: "No Detour", color: "#7a7a7a" },
                  { label: "0–5 mi", color: "#c6dbef" },
                  { label: "6–20 mi", color: "#6baed6" },
                  { label: "21–50 mi", color: "#2171b5" },
                  { label: "Over 50 mi", color: "#08306b" },
                  
                ].map(({ label, color }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        backgroundColor: color,
                        marginRight: "6px",
                        border: "1px solid #888",
                        borderRadius: "2px"
                      }}
                    />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            ) : (

            legendItems.map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
                <div
                  style={{
                    width: "15px",
                    height: "15px",
                    backgroundColor: item.color,
                    marginRight: "8px",
                    borderRadius: "50%",
                  }}
                ></div>
                <span style={{ fontSize: "0.9em" }}>{item.label}</span>
              </div>
            ))
          )}

        </div>
      </div>


      {/* right column */}
      <div style={{ 
        width: "40%", 
        display: "flex", 
        flexDirection: "column", 
        height: "100%",
        minHeight: 0 
      }}>
        <div className="mb-4" style={{ display: "flex", gap: "10px", flex: "0 0 20%" }}>
          <div className="border" style={{ ...cardStyle, flex: 1, textAlign: "center", backgroundColor: "#f4f4f4" }}>
            <div style={{ fontSize: "11pt", marginBottom: "10px", fontFamily: "Encode Sans Compressed, sans-serif" }}>
              Total Bridges
            </div>
            <div id="total-bridges" style={{ fontSize: "24pt", fontWeight: "bold", color: "#333", fontFamily: "Encode Sans Compressed, sans-serif" }}>
              {totalBridges}
            </div>
          </div>

          <div className="border" style={{ ...cardStyle, flex: 1, textAlign: "center", backgroundColor: "#f4f4f4" }}>
            
            <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "11pt",
              marginBottom: "10px",
              fontFamily: "Encode Sans Compressed, sans-serif",
            }}
          >
            <span>Total Improvement Cost</span>
            <span
              className={styles.tooltip}
              data-tooltip="Placeholder text."
              tabIndex={0}
              aria-label="More info"
              style={{ marginLeft: 8, fontSize: 11 }}
            >
              <Info size={18} />
            </span>
          </div>
            <div id="total-cost" data-cost="0" style={{ fontSize: "24pt", fontWeight: "bold", color: "#333", fontFamily: "Encode Sans Compressed, sans-serif" }}>
              $0
            </div>
          </div>
        </div>

        
        <div className="border mb-4" style={{
          ...cardStyle, 
          flex: "1 1 0", 
          width: "100%", 
          display:"flex", 
          flexDirection: "column",
          minHeight: 0, 
          backgroundColor: "#f4f4f4"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* Insert Condition Chart */}
            <h4 style={{ fontSize: "13pt", marginBottom: "8px", fontWeight: "bold", fontFamily: "Encode Sans Compressed, sans-serif"}}>
              Overall Condition Breakdown
            </h4>
            <span
              className={styles.tooltip}
              data-tooltip={`• Good: Good condition\n• Fair: Some maintenance required\n• Poor: Advanced deficiencies, major maintenance required`}
              tabIndex={0}
              aria-label="More info"
              style={{ marginLeft: 8, fontSize: 18 }}
            >
              <Info size={18} />
            </span>
          </div>
          <div style={{ 
            flex: 1, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            overflow: "hidden"
          }}>
            <div id="condition-bar-chart" style={{ width: "100%", height: "100%" }}/>
          </div>
        </div>


        <div className="border mb-0" style={{
          ...cardStyle, 
          flex: "1 1 0", 
          width: "100%", 
          display:"flex", 
          flexDirection: "column",
          minHeight: 0 , 
          backgroundColor: "#f4f4f4"
        }}>
          {/* Insert Detour Chart */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ fontSize: "13pt", fontWeight: "bold", fontFamily: "Encode Sans Compressed, sans-serif"}}>Detour Distance </h4>
            <span
              className={styles.tooltip}
              data-tooltip="No Detour: Ground level bypass is available at the structure site for the inventory route."
              tabIndex={0}
              aria-label="More info"
              style={{ marginLeft: 8, fontSize: 18 }}
            >
              <Info size={18} />
            </span>
          </div>
          <div style={{ 
            flex: 1, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            overflow: "hidden"
          }}>
            <div id="detour-distribution-chart" style={{ width: "100%", height: "100%" }}/>
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

          .map-dot.dimmed {
            opacity: 0.2 !important;
            transform: scale(0.8);
          }

          .mapboxgl-popup {
            z-index: 9999 !important;
          }

          .map-dot.highlighted {
            opacity: 1 !important;
            transform: scale(1.1);
          }
        `,
      }}
    />

    </div>
  );
};

export default BridgeNeedsMap;
