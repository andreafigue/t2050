// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

// ---------------------------
// Data & constants
// ---------------------------
const passengerData = [
  { year: 2017, forecast: 22.45, capacity: 23.05 },
  // { year: 2022, forecast: 25.4, capacity: 25.655 },
  { year: 2019, forecast: 25.4, capacity: 25.655 },
  { year: 2020, forecast: 9.6, capacity: 25.655 },
  { year: 2021, forecast: 17.5, capacity: 25.655 },
  { year: 2022, forecast: 22.4, capacity: 25.655 },
  { year: 2023, forecast: 24.9, capacity: 25.655 },
  { year: 2024, forecast: 25.7, capacity: 25.655 },
  { year: 2027, forecast: 31.1, capacity: 28.6 },
  { year: 2037, forecast: 38.0, capacity: 28.6 },
  { year: 2050, forecast: 55.6, capacity: 33.6 },
];

const iconsPerUnit = 1; // 1 icon = 1M passengers

export default function Airport() {
  // ---------------------------
  // State & refs
  // ---------------------------
  const [index, setIndex] = useState(0);
  const svgRef = useRef<SVGSVGElement | null>(null);   // left graph
  const chartRef = useRef<SVGSVGElement | null>(null); // right buckets

  // Counts to control animated icon adds/removals
  const capacityCountRef = useRef(0);
  const unmetCountRef = useRef(0);

  // ---------------------------
  // Draw effect (runs on index change)
  // ---------------------------
  useEffect(() => {
    // ---- selections
    const svg = d3.select(svgRef.current);
    const chart = d3.select(chartRef.current);

    // ---- left chart (fixed coordinate system)
    const LEFT_W = 400;
    const LEFT_H = 350;
    svg.attr("viewBox", `0 0 ${LEFT_W} ${LEFT_H}`);

    // ---- right chart: derive width from parent on each redraw (no resize listener)
    const parent = chartRef.current?.parentElement;
    const chartW = parent?.clientWidth || 440; // fallback to previous width
    const chartH = parent?.clientHeight || 350;
    chart.attr("viewBox", `0 0 ${chartW} ${chartH}`);

    // ===========================
    // LEFT: Line chart
    // ===========================
    const margin = { top: 50, right: 20, bottom: 30, left: 40 };
    const innerWidth = LEFT_W - margin.left - margin.right;
    const innerHeight = LEFT_H - margin.top - margin.bottom;

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(passengerData, (d) => d.year) as [number, number])
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([
        0,
        d3.max(passengerData, (d) => Math.max(d.forecast, d.capacity))!,
      ])
      .nice()
      .range([innerHeight, 0]);

    // Clear previous line-chart elements
    svg.selectAll(".axis, .line, .highlight, .y-label, .title").remove();

    // Title
    svg
      .append("text")
      .attr("class", "title")
      .attr("x", margin.left + innerWidth / 2)
      .attr("y", margin.top / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", "18px")
      .attr("fill", "#334155")
      .text("Passenger Enplanements vs. Capacity");

    // Y-axis label
    svg
      .append("text")
      .attr("class", "y-label")
      .attr(
        "transform",
        `translate(${margin.left - 40}, ${margin.top + innerHeight / 2}) rotate(-90)`
      )
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("fill", "#334155")
      .text("Millions of Passengers");

    // Axes
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left}, ${LEFT_H - margin.bottom})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .call(d3.axisLeft(yScale));

    // Lines
    const lineForecast = d3
      .line()
      .x((d: any) => xScale(d.year))
      .y((d: any) => yScale(d.forecast));

    const lineCapacity = d3
      .line()
      .x((d: any) => xScale(d.year))
      .y((d: any) => yScale(d.capacity));

    svg
      .append("path")
      .datum(passengerData)
      .attr("class", "line forecast")
      .attr("fill", "none")
      .attr("stroke", "#1e40af")
      .attr("stroke-width", 2.5)
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .attr("d", lineForecast);

    svg
      .append("path")
      .datum(passengerData)
      .attr("class", "line capacity")
      .attr("fill", "none")
      .attr("stroke", "#94a3b8")
      .attr("stroke-dasharray", "4 2")
      .attr("stroke-width", 2)
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .attr("d", lineCapacity);

    // Highlights for selected year
    const highlight = passengerData[index];
    svg
      .append("circle")
      .attr("class", "highlight")
      .attr("cx", margin.left + xScale(highlight.year))
      .attr("cy", margin.top + yScale(highlight.forecast))
      .attr("r", 6)
      .attr("fill", "#ef4444")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    svg
      .append("circle")
      .attr("class", "highlight")
      .attr("cx", margin.left + xScale(highlight.year))
      .attr("cy", margin.top + yScale(highlight.capacity))
      .attr("r", 6)
      .attr("fill", "#94a3b8")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // ===========================
    // RIGHT: Buckets + icons
    // ===========================
    const { forecast, capacity } = passengerData[index];
    const met = Math.floor(Math.min(forecast, capacity) / iconsPerUnit);
    const unmet = Math.max(0, Math.floor((forecast - capacity) / iconsPerUnit));

    // Container for icons
    const iconGroup = chart.select(".icon-group").empty()
      ? chart.append("g").attr("class", "icon-group")
      : chart.select(".icon-group");

    // --- layout constants for buckets
    const iconPerRow = 5;
    const cell = chartW * 0.07;     // grid step
    const icon = cell *0.8 ;     // icon visual size
    const bucketPad = cell * 0.3; // inner padding
    //const bucketY = 60;  // top of bucket content area

    // Width of one bucket frame
    const bucketW = (iconPerRow - 1) * cell + icon + bucketPad * 2;

    // Gap + centering (computed per redraw from chartW)
    const gap = chartW * 0.12;
    const contentW = bucketW * 2 + gap;
    const startX = Math.max(0, (chartW - contentW) / 2);

    // Final offsets (centered)
    const offsetCapacity = startX;                  // left bucket
    const offsetUnmet = startX + bucketW + gap + bucketPad;     // right bucket

    // Bottom baseline stays fixed so growth is "up"
    const bucketTopY = chartH * 0.13;    // space for labels
    const bucketBottomY = chartH * 0.82; // space above legend
    const bucketHMax = bucketBottomY - bucketTopY;

    const maxCapacityIcons = iconPerRow * Math.floor(bucketHMax / cell);
    const bottomY = bucketBottomY;

    // Current year capacity -> rows -> current frame height
    const currentCapacityIcons = Math.floor(
      passengerData[index].capacity / iconsPerUnit
    );

    const currentRows = Math.ceil(currentCapacityIcons / iconPerRow);
    const bucketHCurrent = Math.max(icon + bucketPad * 2, (currentRows - 1) * cell + icon + bucketPad * 2);

  
    // One path generator for both cases (full rounded rect + stepped top-right).
    // Keeping the same command sequence eliminates weird morphing during transitions.
    function roundedRectWithOptionalTopRightStep(
      x: number, y: number, w: number, h: number, rOuter: number,
      stepStartX: number, stepDepth: number, rStep: number
    ) {
      const xR = x + w, yB = y + h;

      // Clamp step start so inner arcs stay inside the outer radius
      const minStepX = x + rOuter + 2 + rStep;
      const maxStepX = xR - rOuter - 2 - rStep;
      const L = Math.max(minStepX, Math.min(stepStartX, maxStepX));

      const yTop = y;                                 // original top
      const yStep = y + Math.max(0, stepDepth);       // lowered top after step

      return [
        // left edge -> TL corner
        `M ${x} ${yTop + rOuter}`,
        `A ${rOuter} ${rOuter} 0 0 1 ${x + rOuter} ${yTop}`,  // TL outer

        // straight to just before the step
        `H ${L - rStep}`,

        // inner rounded step: down
        `A ${rStep} ${rStep} 0 0 1 ${L} ${yTop + rStep}`,

        // vertical drop (degenerates to 0 if stepDepth=0)
        `V ${Math.max(yTop + rStep, yStep - rStep)}`,

        // inner rounded step: right
        `A ${rStep} ${rStep} 0 0 0 ${L + rStep} ${yStep}`,

        // continue along "top" (possibly lowered)
        `H ${xR - rOuter}`,

        // TR corner at the lowered y
        `A ${rOuter} ${rOuter} 0 0 1 ${xR} ${yStep + rOuter}`,

        // right, BR, bottom, BL
        `V ${yB - rOuter}`,
        `A ${rOuter} ${rOuter} 0 0 1 ${xR - rOuter} ${yB}`,
        `H ${x + rOuter}`,
        `A ${rOuter} ${rOuter} 0 0 1 ${x} ${yB - rOuter}`,
        `Z`
      ].join(" ");
    }

    // Create/update the capacity frame path.
    // Call this every time you redraw/update the chart.
    function drawCapacityFrame({
      chart,
      passengerData, index,
      offsetCapacity, bottomY, bucketW, bucketHCurrent,
      iconsPerUnit, iconPerRow,
      bucketPad, cell, icon,
      radius = 12, strokeWidth = 2, duration = 500
    }: {
      chart: any;
      passengerData: Array<{ capacity: number; forecast: number }>;
      index: number;
      offsetCapacity: number;
      bottomY: number;
      bucketW: number;
      bucketHCurrent: number;
      iconsPerUnit: number;
      iconPerRow: number;
      bucketPad: number;
      cell: number;
      icon: number;
      radius?: number;
      strokeWidth?: number;
      duration?: number;
    }) {
      // Frame bounds
      const xL = offsetCapacity;
      const yT = bottomY - bucketHCurrent;

      // Stroke color (alert if forecast exceeds capacity)
      const capacityUnits = passengerData[index].capacity;
      const stroke =
        passengerData[index].forecast > capacityUnits ? "#ef4444" : "#94a3b8";

      // Determine whether top row is partial
      const capacityIcons = Math.floor(capacityUnits / iconsPerUnit);
      const rem = capacityIcons % iconPerRow; // 0 = full top row

      // Persistent <path>
      const frame = chart.select("path.capacity-frame").empty()
        ? chart.append("path")
            .attr("class", "capacity-frame")
            .attr("fill", "none")
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
        : chart.select("path.capacity-frame");

      // Where does the last icon in the top row end? (grid is centered inside bucket)
      const innerW = bucketW - bucketPad * 2;
      const gridFullRowW = (iconPerRow - 1) * cell + icon; // width of a full icons row
      const xInset = Math.max(0, (innerW - gridFullRowW) / 2);
      const gridLeft = xL + bucketPad + xInset;

      // If the top row is full, "filledW" is the full-row width; otherwise width of the used portion
      const filledW = (rem === 0 ? gridFullRowW : (rem - 1) * cell + icon);
      //const stepStart = gridLeft + filledW;
      const stepStart = gridLeft + filledW + 5+ (cell - icon) / 2;

      // Step depth: drop one full row when partial, else 0 (keeps path commands constant)
      const stepDepth =
        rem === 0 || bucketHCurrent <= 0
          ? 0
          : Math.min(cell, Math.max(0, bucketHCurrent - radius * 2));

      // Inner radius for the rounded step (kept <= half of the drop)
      const rStep = Math.min(radius * 0.9, Math.max(0, stepDepth / 2));

      // Build path (same generator for both cases)
      const d = roundedRectWithOptionalTopRightStep(
        xL, yT, bucketW, bucketHCurrent, radius,
        stepStart, stepDepth, rStep
      );

      // Smooth morphing: interrupt queued tweens and tween with constant command list
      frame.interrupt()
        .transition()
        .duration(duration)
        .attr("d", d)
        .attr("stroke", stroke)
        .attr("stroke-width", strokeWidth)
        .attr("fill", "none");
    }

    // ---------- USAGE (exactly like this where you update/redraw) ----------
    drawCapacityFrame({
      chart,
      passengerData, index,
      offsetCapacity, bottomY, bucketW, bucketHCurrent,
      iconsPerUnit, iconPerRow,
      bucketPad, cell, icon
    });

    // --- labels: re-draw each time so they move with centering
    chart.selectAll(".bucket-label").remove();

    chart
      .append("text")
      .attr("class", "bucket-label")
      .attr("x", offsetCapacity + bucketW / 2)
      .attr("y", chartH * 0.08)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .attr("font-size", "18px")
      .text("Capacity");

    chart
      .append("text")
      .attr("class", "bucket-label")
      .attr("x", offsetCapacity + bucketW / 2)
      .attr("y", chartH * 0.87)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .attr("font-size", "15px")
      .text("SeaTac + Paine Field");

    chart
      .append("text")
      .attr("class", "bucket-label")
      .attr("x", offsetUnmet + (bucketW / 2 )- 15)
      .attr("y", chartH * 0.08)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .attr("font-size", "18px")
      .text("Unmet Demand");

    // --- legend (centered under the two buckets)
    const legendGroup = chart.select(".legend-group").empty()
      ? chart.append("g").attr("class", "legend-group")
      : chart.select(".legend-group");
    legendGroup.selectAll("*").remove();

    const legendX = offsetCapacity - 30;
    const legendY = chartH - 34;

    legendGroup
      .append("foreignObject")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", icon)
      .attr("height", icon)
      .append("xhtml:div")
      .html(`
        <svg width="100%" height="100%" fill="none" stroke="#334155" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      `);

    legendGroup
      .append("text")
      .attr("x", legendX + cell - 10)
      .attr("y", legendY + 18)
      .attr("fill", "#334155")
      .attr("font-size", "14px")
      .text(" = 1M passengers");

    // --- icon updater (uses centered offsets)
    const updateIcons = (
      count: number,
      color: string,
      offsetX: number,
      bucketY: number,
      currentCount: number,
      updateCurrentCount: (val: number) => void,
      label: string
    ) => {
      const iconGroup = chart.select(".icon-group");
      const delta = count - currentCount;

      // Add icons if increasing
      if (delta > 0) {
        for (let i = 0; i < delta; i++) {
          const iconIndex = currentCount + i;
          const row = Math.floor(iconIndex / iconPerRow);
          const col = iconIndex % iconPerRow;
          const finalX = offsetX + col * cell;
          const finalY = bottomY - bucketPad - icon - row * cell;

          const group = iconGroup
            .append("g")
            .attr("transform", `translate(${finalX}, -40)`)
            .style("opacity", 0)
            .attr("data-type", label.toLowerCase());

          group
            .transition()
            .delay(i * 100)
            .duration(600)
            .attr("transform", `translate(${finalX}, ${finalY})`)
            .style("opacity", 1);

          group
            .append("foreignObject")
            .attr("width", icon)
            .attr("height", icon)
            .append("xhtml:div")
            .html(`
              <svg width="100%" height="100%" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            `);
        }
      }

      // Remove icons if decreasing (trim excess)
      if (delta < 0) {
        const toRemove = chart
          .selectAll(`.icon-group > g[data-type='${label.toLowerCase()}']`)
          .nodes()
          .slice(count);
        d3.selectAll(toRemove).transition().duration(500).style("opacity", 0).remove();
      }

      updateCurrentCount(count);
    };

    // Reset icons if jumping back to first year
    if (index === 0) {
      capacityCountRef.current = 0;
      unmetCountRef.current = 0;
      chart.selectAll(".icon-group > *").remove();
    }

    // Draw icons with centered offsets
    updateIcons(
      Math.floor(Math.min(forecast, capacity) / iconsPerUnit),
      "#0072ce",
      offsetCapacity + icon/2,
      bucketTopY,
      capacityCountRef.current,
      (v) => (capacityCountRef.current = v),
      "Capacity"
    );

    updateIcons(
      Math.max(0, Math.floor((forecast - capacity) / iconsPerUnit)),
      "#f97316",
      offsetUnmet ,
      bucketTopY,
      unmetCountRef.current,
      (v) => (unmetCountRef.current = v),
      "Unmet"
    );
  }, [index]);

  // ---------------------------
  // UI
  // ---------------------------
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 20 }}>
      {/* Top Box: Title & Slider */}
      <div
        className="border shadow-md rounded-lg"
        style={{ background: "#f4f4f4", padding: 20, borderRadius: 8 }}
      >
        <h2
          className="text-xl font-semibold"
          style={{ marginBottom: 10, textAlign: "center", color: "#1e293b" }}
        >
          Airport Passenger Forecast vs Capacity
        </h2>

        {/* Stats */}
        <div
          className="items-center"
          style={{
            display: "flex",
            justifyContent: "center",
            flexDirection: "row",
            gap: 80,
            width: "100%",
            textAlign: "center",
          }}
        >
          <div style={{ background: "#f4f4f4", padding: 12 }}>
            <strong>Forecast</strong>: {passengerData[index].forecast}M
          </div>
          <div style={{ background: "#f4f4f4", padding: 12 }}>
            <strong>Capacity</strong>: {passengerData[index].capacity}M
          </div>
          <div style={{ background: "#f4f4f4", padding: 12 }}>
            <strong>Unmet</strong>:{" "}
            {(passengerData[index].forecast - passengerData[index].capacity).toFixed(2)}M
          </div>
        </div>

        {/* Slider */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            marginTop: 10,
          }}
        >
          <strong>Year: {passengerData[index].year}</strong>
          <input
            type="range"
            min="0"
            max={passengerData.length - 1}
            value={index}
            onChange={(e) => setIndex(+e.target.value)}
            style={{ width: "60%" }}
          />
        </div>
      </div>

      {/* Bottom Grid */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-center", height: "400px" }}>
        {/* Column 1: Graph */}
        <div
          className="border shadow-md rounded-lg w-50"
          style={{ flex: 1, padding: 12, background: "#f4f4f4" }}
        >
          <svg ref={svgRef} width="100%" height="100%"></svg>
        </div>

        {/* Column 2: Animated Icons (Buckets) */}
        <div
          className="border shadow-md rounded-lg"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "50%",
            background: "#f4f4f4",
            padding: 12,
          }}
        >
          <svg ref={chartRef} width="100%" height="100%" preserveAspectRatio="xMidYMid meet"></svg>
        </div>
      </div>
    </div>
  );
}
