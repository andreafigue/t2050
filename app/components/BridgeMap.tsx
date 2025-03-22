"use client";

import React, { useEffect, useState, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Papa from "papaparse";

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

// Mapping from BridgeOverallConditionState to marker color.
const conditionColors: { [key: string]: string } = {
  Good: "#a0c15a",
  Fair: "#ffd934",
  Poor: "#ff8c5a",
  // Extend as needed.
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

const BridgeNeedsMap = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [bridges, setBridges] = useState<any[]>([]);
  // Existing layer filter (if needed for later customization)
  const [selectedLayer, setSelectedLayer] = useState("placeholder");

  // Filter states with default "All" option.
  const [selectedCounty, setSelectedCounty] = useState("All");
  const [selectedOverallCondition, setSelectedOverallCondition] = useState("All");
  const [selectedCulvertCondition, setSelectedCulvertCondition] = useState("All");
  const [selectedScourCondition, setSelectedScourCondition] = useState("All");

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
              // Normalize fields for consistency (convert to string and trim)
              const normalizedData = result.data.map((d: any) => ({
                ...d,
                CountyName: String(d.CountyName || "").trim(),
                BridgeOverallConditionState: String(d.BridgeOverallConditionState || "").trim(),
                CulvertCondition: String(d.CulvertCondition || "").trim(),
                ScourCondition: String(d.ScourCondition || "").trim(),
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

  // Update markers whenever bridges or filters change.
  useEffect(() => {
    if (!mapInstance.current || bridges.length === 0) return;
    const map = mapInstance.current;

    // Clear existing markers.
    const clearMarkers = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };

    // Filter bridges based on all filters.
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

    // Add markers for each filtered bridge.
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

        if (!Longitude || !Latitude) return; // Skip if coordinates are missing

        // Determine marker color.
        const markerColor =
          conditionColors[BridgeOverallConditionState] || "#ff5733";

        // Create marker element.
        const markerDot = document.createElement("div");
        markerDot.style.width = "7px";
        markerDot.style.height = "7px";
        markerDot.style.backgroundColor = markerColor;
        markerDot.style.borderRadius = "50%";
        markerDot.style.opacity = "80%";

        // Build popup content.
        const popupContent = `
          <strong>${BridgeName || "Unknown Bridge"}</strong><br>
          🔢 <b>Bridge Number:</b> ${BridgeNumber || "N/A"}<br>
          🌊 <b>Scour Condition:</b> ${ScourCondition || "N/A"}<br>
          🌉 <b>Culvert Condition:</b> ${CulvertCondition || "N/A"}<br>
          <b>Overall Condition:</b> ${BridgeOverallConditionState || "N/A"}<br>
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
  ]);

  // Compute unique filter options (using the full dataset).
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

  // Compute filtered bridges for totals and viz.
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

  // Breakdown of overall condition.
  const conditionCounts = filteredBridges.reduce((acc, bridge) => {
    const cond = bridge.BridgeOverallConditionState || "Unknown";
    acc[cond] = (acc[cond] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const conditionBreakdown = (Object.entries(conditionCounts) as [string, number][]).map(
    ([cond, count]) => ({
      condition: cond,
      count,
      percentage: totalBridges ? Math.round((count / totalBridges) * 100) : 0,
    })
  );


  return (
    <div style={{ height: "95vh", display: "flex", background: "#f4f4f4", borderRadius: 8 }}>
      {/* Left Sidebar */}
      <div style={{ width: "25%", padding: "20px", overflowY: "auto" }}>
        <div style={cardStyle}>
          <div>
            <label>County:</label>
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
            <label>Overall Condition:</label>
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
            <label>Culvert Condition:</label>
            <select
              style={selectStyle}
              value={selectedCulvertCondition}
              onChange={(e) => setSelectedCulvertCondition(e.target.value)}
            >
              <option value="All">All</option>
              {culvertConditionList.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Scour Condition:</label>
            <select
              style={selectStyle}
              value={selectedScourCondition}
              onChange={(e) => setSelectedScourCondition(e.target.value)}
            >
              <option value="All">All</option>
              {scourConditionList.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Totals & Breakdown Visualization */}
        <div style={cardStyle}>
          <p style={{ margin: "8px 0" }}>
            <strong>Total Bridges:</strong> {totalBridges}
          </p>
          <p style={{ margin: "8px 0", borderBottom: "1px solid #eee", paddingBottom: "10px"}}>
            <strong>Total Proposed Improvement Cost:</strong> ${totalImprovementCost.toLocaleString()}
          </p>
          <h4 style={{ marginTop: "15px", paddingBottom: "10px" }}>
            <strong>
              Condition Breakdown
            </strong>
          </h4>
          {conditionBreakdown.map(({ condition, count, percentage }) => (
            <div key={condition} style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "0.9em", marginBottom: "4px" }}>
                {condition}: {count} ({percentage}%)
                <div
                style={{
                  background: conditionColors[condition] || "#ccc",
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
        {/* Legend at bottom right */}
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
          {Object.entries(conditionColors).map(([state, color]) => (
            <div key={state} style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
              <div
                style={{
                  width: "15px",
                  height: "15px",
                  backgroundColor: color,
                  marginRight: "8px",
                  borderRadius: "50%",
                }}
              ></div>
              <span style={{ fontSize: "0.9em" }}>{state}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BridgeNeedsMap;
