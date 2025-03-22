"use client";

import React, { useEffect, useState, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Papa from "papaparse";

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

// Updated overall condition colors (more legible)
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
  marginBottom: "15px",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  marginTop: "5px",
  marginBottom: "10px",
  borderRadius: "4px",
  border: "1px solid #ccc",
};

// Updated culvert condition short descriptions (keys as numbers in string)
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

  // Filter states (county filter remains)
  const [selectedCounty, setSelectedCounty] = useState("All");
  const [selectedOverallCondition, setSelectedOverallCondition] = useState("All");
  const [selectedCulvertCondition, setSelectedCulvertCondition] = useState("All");
  const [selectedScourCondition, setSelectedScourCondition] = useState("All");

  // New viewMode state: "condition" or "detour"
  const [viewMode, setViewMode] = useState<"condition" | "detour">("condition");

  // Load CSV data.
  useEffect(() => {
    fetch("/Bridge Needs GIS data.csv")
      .then((response) => response.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          complete: (result) => {
            if (result.data.length > 0) {
              const normalizedData = result.data.map((d: any) => ({
                ...d,
                CountyName: String(d.CountyName || "").trim(),
                BridgeOverallConditionState: String(d.BridgeOverallConditionState || "").trim(),
                CulvertCondition: String(d.CulvertCondition || "").trim(),
                ScourCondition: String(d.ScourCondition || "").trim(),
                Detour: Number(d.Detour) // Ensure detour is numeric
              }));
              console.log("Parsed Data:", normalizedData);
              setBridges(normalizedData);
            } else {
              console.error("No data found in CSV.");
            }
          },
        });
      })
      .catch((error) => console.error("Error loading CSV:", error));
  }, []);

  // Initialize the Mapbox map.
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!mapInstance.current) {
      mapInstance.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-120.7401, 47.4511],
        zoom: 6.1,
        accessToken: mapboxToken,
      });
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
                "line-color": "#000000",
                "line-width": 1,
                "line-opacity": 0.3
              },
            });
          }
        })
        .catch((err) => console.error("Error loading counties GeoJSON:", err));
    });
  }, []);

  // Update markers whenever bridges, filters, or viewMode change.
  useEffect(() => {
    if (!mapInstance.current || bridges.length === 0) return;
    const map = mapInstance.current;

    const clearMarkers = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };

    const filtered = bridges.filter((bridge) => {
      const passesCounty =
        selectedCounty === "All" || bridge.CountyName === selectedCounty;
      const passesOverall =
        selectedOverallCondition === "All" ||
        bridge.BridgeOverallConditionState === selectedOverallCondition;
      const passesCulvert =
        selectedCulvertCondition === "All" ||
        (bridge.CulvertCondition && bridge.CulvertCondition === selectedCulvertCondition);
      const passesScour =
        selectedScourCondition === "All" ||
        (bridge.ScourCondition && bridge.ScourCondition === selectedScourCondition);
      return passesCounty && passesOverall && passesCulvert && passesScour;
    });

    const addMarkers = () => {
      clearMarkers();

      filtered.forEach((bridge) => {
        const {
          Longitude,
          Latitude,
          BridgeNumber,
          BridgeName,
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
        if (viewMode === "detour") {
          markerColor = isNaN(Detour) ? markerColor : getDetourColor(Detour);
        } else {
          markerColor = conditionColors[BridgeOverallConditionState] || "#999999";
        }

        const markerDot = document.createElement("div");
        markerDot.style.width = "7px";
        markerDot.style.height = "7px";
        markerDot.style.backgroundColor = markerColor;
        markerDot.style.borderRadius = "50%";
        markerDot.style.opacity = "80%";

        // Build popup content based on view mode.
        let popupContent = "";
        if (viewMode === "detour") {
          popupContent = `
            <strong>${BridgeName || "Unknown Bridge"}</strong><br>
            <b>Bridge Number:</b> ${BridgeNumber || "N/A"}<br>
            <b>Detour:</b> ${Detour != null ? Detour + " miles" : "N/A"}<br>
          `;
        } else {
          popupContent = `
            <strong>${BridgeName || "Unknown Bridge"}</strong><br>
            <b>Bridge Number:</b> ${BridgeNumber || "N/A"}<br>
            <b>Overall Condition:</b> ${BridgeOverallConditionState || "N/A"}<br>
            <b>Scour Condition:</b> ${ScourCondition || "N/A"}<br>
            <b>Culvert Condition:</b> ${CulvertCondition || "N/A"}<br>
            <b>Type of Work:</b> ${PrpsedImprvTypeOfWork || "N/A"}<br>
            <b>Work Method:</b> ${PrpsedImprvWorkMethod || "N/A"}<br>
            <b>Structure Length (ft):</b> ${PrpsedImprvStructureLgthByFT || "N/A"}<br>
            <b>Roadway Width (ft):</b> ${PrpsedImprvRoadwayWdthByFT || "N/A"}<br>
            <b>Cost per SF Deck:</b> ${PrpsedImprvCostPerSFDeck || "N/A"}<br>
            <b>Structure Cost:</b> ${PrpsedImprvStructureCost || "N/A"}<br>
            <b>Roadway Cost:</b> ${PrpsedImprvRoadwayCost || "N/A"}<br>
            <b>Eng/Misc Cost:</b> ${PrpsedImprvEngMiscCost || "N/A"}<br>
            <b>Total Cost:</b> ${PrpsedImprvTotalCost || "N/A"}<br>
            <b>Estimate Year:</b> ${PrpsedImprvEstimateYear || "N/A"}
          `;
        }

        const marker = new mapboxgl.Marker({ element: markerDot })
          .setLngLat([Longitude, Latitude])
          .setPopup(new mapboxgl.Popup().setHTML(popupContent))
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
    selectedCounty,
    selectedOverallCondition,
    selectedCulvertCondition,
    selectedScourCondition,
    viewMode,
  ]);

  // Compute unique filter options.
  const countyList = Array.from(
    new Set(bridges.map((bridge) => String(bridge.CountyName || "").trim()).filter(Boolean))
  );
  const overallConditionList = Array.from(
    new Set(
      bridges
        .map((bridge) => String(bridge.BridgeOverallConditionState || "").trim())
        .filter(Boolean)
    )
  );
  const culvertConditionList = Array.from(
    new Set(
      bridges
        .map((bridge) => String(bridge.CulvertCondition || "").trim())
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
  const filteredBridges = bridges.filter((bridge) => {
    const passesCounty =
      selectedCounty === "All" || bridge.CountyName === selectedCounty;
    const passesOverall =
      selectedOverallCondition === "All" ||
      bridge.BridgeOverallConditionState === selectedOverallCondition;
    const passesCulvert =
      selectedCulvertCondition === "All" ||
      (bridge.CulvertCondition && bridge.CulvertCondition === selectedCulvertCondition);
    const passesScour =
      selectedScourCondition === "All" ||
      (bridge.ScourCondition && bridge.ScourCondition === selectedScourCondition);
    return passesCounty && passesOverall && passesCulvert && passesScour;
  });

  const totalBridges = filteredBridges.length;
  const totalImprovementCost = filteredBridges.reduce((sum, bridge) => {
    const cost = bridge.PrpsedImprvTotalCost;
    return sum + (typeof cost === "number" ? cost : 0);
  }, 0);

  // Compute breakdown data.
  let breakdown: { label: string; count: number; percentage: number }[] = [];
  if (viewMode === "detour") {
    // Breakdown based on detour ranges.
    const detourCounts = filteredBridges.reduce((acc, bridge) => {
      const detour = Number(bridge.Detour);
      let range: string;
      if (isNaN(detour)) {
        range = "Unknown";
      } else {
        range = getDetourRange(detour);
      }
      acc[range] = (acc[range] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    breakdown = (Object.entries(detourCounts) as [string, number][]).map(
      ([range, count]) => ({
        label: range,
        count,
        percentage: totalBridges ? Math.round((count / totalBridges) * 100) : 0,
      })
    );
    // Order detour breakdown as Good, Fair, Poor, Unknown.
    const order: { [key: string]: number } = { Good: 0, Fair: 1, Poor: 2, Unknown: 3 };
    breakdown.sort((a, b) => {
      const aOrder = order[a.label] !== undefined ? order[a.label] : 4;
      const bOrder = order[b.label] !== undefined ? order[b.label] : 4;
      return aOrder - bOrder;
    });
  } else {
    // Breakdown based on overall condition.
    const conditionCounts = filteredBridges.reduce((acc, bridge) => {
      const cond = bridge.BridgeOverallConditionState || "Unknown";
      acc[cond] = (acc[cond] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    breakdown = (Object.entries(conditionCounts) as [string, number][]).map(
      ([cond, count]) => ({
        label: cond,
        count,
        percentage: totalBridges ? Math.round((count / totalBridges) * 100) : 0,
      })
    );
    // Order overall condition breakdown as Good, Fair, Poor, Unknown.
    const order: { [key: string]: number } = { Good: 0, Fair: 1, Poor: 2, Unknown: 3 };
    breakdown.sort((a, b) => {
      const aOrder = order[a.label] !== undefined ? order[a.label] : 4;
      const bOrder = order[b.label] !== undefined ? order[b.label] : 4;
      return aOrder - bOrder;
    });
  }

  // Define legend content based on viewMode.
  const legendItems =
    viewMode === "detour"
      ? [
          { label: "Good (0-5 mi)", color: "#1a9850" },
          { label: "Fair (5-10 mi)", color: "#fee08b" },
          { label: "Poor (>10 mi)", color: "#d73027" },
        ]
      : Object.entries(conditionColors).map(([cond, color]) => ({ label: cond, color }));

  return (
    <div style={{ height: "95vh", display: "flex", background: "#f4f4f4", borderRadius: 8 }}>
      {/* Left Sidebar */}
      <div style={{ width: "25%", padding: "20px", overflowY: "auto" }}>
        <div style={cardStyle}>
          <div>
            <label style={{fontSize:"11pt" }}>County:</label>
            <select
              style={selectStyle}
              value={selectedCounty}
              onChange={(e) => setSelectedCounty(e.target.value)}
            >
              <option value="All">All</option>
              {countyList.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{fontSize:"11pt" }}>Overall Condition:</label>
            <select
              style={selectStyle}
              value={selectedOverallCondition}
              onChange={(e) => setSelectedOverallCondition(e.target.value)}
            >
              <option value="All">All</option>
              {overallConditionList.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{fontSize:"11pt" }}>Culvert Condition:</label>
            <select
              style={selectStyle}
              value={selectedCulvertCondition}
              onChange={(e) => setSelectedCulvertCondition(e.target.value)}
            >
              <option value="All">All</option>
              {culvertConditionList.map((cond) => (
                <option key={cond} value={cond}>
                  {culvertShortDescriptions[cond] || cond}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{fontSize:"11pt" }}>Scour Condition:</label>
            <select
              style={selectStyle}
              value={selectedScourCondition}
              onChange={(e) => setSelectedScourCondition(e.target.value)}
            >
              <option value="All">All</option>
              {scourConditionList.map((cond) => (
                <option key={cond} value={cond}>
                  {scourShortDescriptions[cond] || cond}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Totals & Improvement Cost */}
        <div style={cardStyle}>
          <p style={{ margin: "8px 0" }}>
            <strong>Total Bridges:</strong> {totalBridges}
          </p>
          <p style={{ margin: "8px 0", paddingBottom: "10px" }}>
            <strong>Total Proposed Improvement Cost:</strong> ${totalImprovementCost.toLocaleString()}
          </p>
        </div>

        {/* Radio buttons for view mode & Breakdown */}
        <div style={cardStyle}>
          <div style={{ marginBottom: "10px", fontWeight: "bold", fontSize: "15px" }}>Display Mode:</div>
          <label style={{ marginRight: "10px", fontSize:"11pt" }}>
            <input
              type="radio"
              value="condition"
              checked={viewMode === "condition"}
              onChange={() => setViewMode("condition")}
            />{" "}
            Overall Condition
          </label>
          <label style={{ marginRight: "10px", fontSize:"11pt" }}>
            <input
              type="radio"
              value="detour"
              checked={viewMode === "detour"}
              onChange={() => setViewMode("detour")}
            />{" "}
            Detour
          </label>
          <h4 style={{ marginTop: "15px", paddingBottom: "10px", fontSize: "15px" }}>
            <strong>{viewMode === "detour" ? "Detour Breakdown" : "Condition Breakdown"}</strong>
          </h4>
          {breakdown.map(({ label, count, percentage }) => (
            <div key={label} style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "0.9em", marginBottom: "4px" }}>
                {label}: {count} ({percentage}%)
                <div
                  style={{
                    background:
                      viewMode === "detour"
                        ? label === "Good"
                          ? "#1a9850"
                          : label === "Fair"
                          ? "#fee08b"
                          : label === "Poor"
                          ? "#d73027"
                          : "#ccc"
                        : conditionColors[label] || "#ccc",
                    width: `${percentage}%`,
                    height: "10px",
                    borderRadius: "4px",
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map Container with Legend Overlay */}
      <div style={{ width: "75%", position: "relative" }}>
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
          <h4 style={{ marginBottom: "10px" }}>Legend</h4>
          {legendItems.map((item) => (
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default BridgeNeedsMap;
