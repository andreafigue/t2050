// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const passengerData = [
  { year: 2017, forecast: 22.45, capacity: 23.05 },
  { year: 2022, forecast: 25.4, capacity: 25.655 },
  { year: 2027, forecast: 31.1, capacity: 28.6 },
  { year: 2037, forecast: 38.0, capacity: 28.6 },
  { year: 2050, forecast: 55.6, capacity: 33.6 },
];

const iconsPerUnit = 1; // 1 icon = 1M passengers

export default function Airport() {
  const [index, setIndex] = useState(0);
  const svgRef = useRef(null);
  const chartRef = useRef(null);

  const capacityCountRef = useRef(0);
  const unmetCountRef = useRef(0);

  const prevIndexRef = useRef(0);


  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const chart = d3.select(chartRef.current);
    const width = 400;
    const height = 350;

    svg.attr("viewBox", `0 0 ${width} ${height}`);
    chart.attr("viewBox", `0 0 440 350`);

    const margin = { top: 40, right: 20, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(passengerData, d => d.year) as [number, number])
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(passengerData, d => Math.max(d.forecast, d.capacity))!])
      .nice()
      .range([innerHeight, 0]);

    // Clear graph content only (not icon buckets)
    svg.selectAll(".axis, .line, .highlight, .y-label, .title").remove();

    // Title
    svg.append("text")
      .attr("class", "title")
      .attr("x", margin.left + innerWidth / 2)
      .attr("y", margin.top / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", "20px")
      .attr("fill", "#334155")
      .text("Passenger Enplanements vs. Capacity");

    // Y-axis label
    svg.append("text")
      .attr("class", "y-label")
      .attr("transform", `translate(${margin.left - 40}, ${margin.top + innerHeight / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("fill", "#334155")
      .text("Millions of Passengers");

    // Axes
    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left}, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .call(d3.axisLeft(yScale));

    // Line generators
    const lineForecast = d3
      .line()
      .x(d => xScale((d as any).year))
      .y(d => yScale((d as any).forecast));

    const lineCapacity = d3
      .line()
      .x(d => xScale((d as any).year))
      .y(d => yScale((d as any).capacity));

    svg.append("path")
      .datum(passengerData)
      .attr("class", "line forecast")
      .attr("fill", "none")
      .attr("stroke", "#1e40af")
      .attr("stroke-width", 2.5)
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .attr("d", lineForecast);

    svg.append("path")
      .datum(passengerData)
      .attr("class", "line capacity")
      .attr("fill", "none")
      .attr("stroke", "#94a3b8")
      .attr("stroke-dasharray", "4 2")
      .attr("stroke-width", 2)
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .attr("d", lineCapacity);

    // Highlight selected year
    const highlight = passengerData[index];
    svg.append("circle")
      .attr("class", "highlight")
      .attr("cx", margin.left + xScale(highlight.year))
      .attr("cy", margin.top + yScale(highlight.forecast))
      .attr("r", 6)
      .attr("fill", "#ef4444")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    svg.append("circle")
      .attr("class", "highlight")
      .attr("cx", margin.left + xScale(highlight.year))
      .attr("cy", margin.top + yScale(highlight.capacity))
      .attr("r", 6)
      .attr("fill", "#94a3b8")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Icons
    const { forecast, capacity } = passengerData[index];
    const met = Math.floor(capacity / iconsPerUnit);
    const unmet = Math.max(0, Math.floor((forecast - capacity) / iconsPerUnit));

    const iconGroup = chart.select(".icon-group").empty()
      ? chart.append("g").attr("class", "icon-group")
      : chart.select(".icon-group");

    // Add labels only once
    if (chart.selectAll(".bucket-label").empty()) {
      chart.append("text")
        .attr("class", "bucket-label")
        .attr("x", 40)
        .attr("y", 30)
        .attr("fill", "#334155")
        .attr("font-size", "20px")
        .text("Capacity");

      chart.append("text")
        .attr("class", "bucket-label")
        .attr("x", 200)
        .attr("y", 30)
        .attr("fill", "#334155")
        .attr("font-size", "20px")
        .text("Unmet Demand");
    }

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

  // Add label if not exists
  //const labelClass = `bucket-label-${label.toLowerCase().replace(/\s+/g, "-")}`;

// if (chart.selectAll(`.${labelClass}`).empty()) {
//   chart.append("text")
//     .attr("class", labelClass)
//     .attr("x", offsetX)
//     .attr("y", 30)
//     .attr("fill", "#334155")
//     .attr("font-size", "14px")
//     .text(label);
// }


  const iconPerRow = 5;
  const delta = count - currentCount;

  // Add icons if increasing
  if (delta > 0) {
    for (let i = 0; i < delta; i++) {
      const iconIndex = currentCount + i;
      const row = Math.floor(iconIndex / iconPerRow);
      const col = iconIndex % iconPerRow;
      const finalX = offsetX + col * 30;
      const finalY = bucketY + row * 30;

      const group = iconGroup.append("g")
        .attr("transform", `translate(${finalX}, -40)`)
        .style("opacity", 0)
        .attr("data-type", label.toLowerCase());

      group.transition()
        .delay(i * 100)
        .duration(600)
        .attr("transform", `translate(${finalX}, ${finalY})`)
        .style("opacity", 1);

      group.append("foreignObject")
        .attr("width", 24)
        .attr("height", 24)
        .append("xhtml:div")
        .html(`
          <svg width="24" height="24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        `);
      }
    }

    // Remove icons if decreasing
    if (delta < 0) {
      const toRemove = chart
        .selectAll(`.icon-group > g[data-type='${label.toLowerCase()}']`)
        .nodes()
        .slice(delta); // delta is negative

      d3.selectAll(toRemove)
        .transition()
        .duration(500)
        .style("opacity", 0)
        .remove();
    }

    updateCurrentCount(count);

    // Legend: 1 icon = 1M passengers
    const legendGroup = chart.select(".legend-group").empty()
      ? chart.append("g").attr("class", "legend-group")
      : chart.select(".legend-group");

    // Clear existing legend (if redrawing)
    legendGroup.selectAll("*").remove();

    // Positioning
    const legendX = 10;
    const legendY = 300;

    legendGroup.append("foreignObject")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", 24)
      .attr("height", 24)
      .append("xhtml:div")
      .html(`
        <svg width="24" height="24" fill="none" stroke="#334155" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      `);

    legendGroup.append("text")
      .attr("x", legendX + 32)
      .attr("y", legendY + 18)
      .attr("fill", "#334155")
      .attr("font-size", "14px")
      .text(" = 1M passengers");

    };


    const offsetCapacity = 10;
    const offsetUnmet = 200;
    const bucketY = 50;

    // Reset if going back to first year
    if (index === 0) {
      capacityCountRef.current = 0;
      unmetCountRef.current = 0;
      chart.selectAll(".icon-group > *").remove();
    }

    updateIcons(
      met,
      "#0072ce",
      offsetCapacity,
      bucketY,
      capacityCountRef.current,
      val => capacityCountRef.current = val,
      "Capacity"
    );

    updateIcons(
      unmet,
      "#f97316",
      offsetUnmet,
      bucketY,
      unmetCountRef.current,
      val => unmetCountRef.current = val,
      "Unmet"
    );

    prevIndexRef.current = index;



  }, [index]);

 return (
  <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 20 }}>
    
    {/* Top Box: Title & Slider */}
    <div style={{ background: "#e2e8f0", padding: 20, borderRadius: 8 }}>
      <h2 className="text-lg font-semibold" style={{ marginBottom: 10, textAlign: "center", color: "#1e293b" }}>
        Airport Passenger Forecast vs Capacity
      </h2>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
        <strong>{passengerData[index].year}</strong>
        <input
          type="range"
          min="0"
          max={passengerData.length - 1}
          value={index}
          onChange={(e) => setIndex(+e.target.value)}
          style={{ flex: 1 }}
        />
      </div>
    </div>

    {/* Bottom Grid */}
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

      {/* Column 1: Graph */}
      <div style={{ flex: 1,padding: 12, background: "#e2e8f0" , borderRadius: 8, width: 500}}>
        <svg ref={svgRef} width="100%" height="350"></svg>
      </div>

      {/* Column 2: Animated Icons (Buckets) */}
      <div style={{ width: 400, background: "#e2e8f0", borderRadius: 8, padding: 12 }}>
        <svg ref={chartRef} width="450" height="350"></svg>
      </div>

      {/* Column 3: Stats Boxes */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 200 }}>
        <div style={{ background: "#e2e8f0", padding: 12, borderRadius: 8 }}>
          <strong>Forecast</strong>: {passengerData[index].forecast}M
        </div>
        <div style={{ background: "#e2e8f0", padding: 12, borderRadius: 8 }}>
          <strong>Capacity</strong>: {passengerData[index].capacity}M
        </div>
        <div style={{ background: "#e2e8f0", padding: 12, borderRadius: 8 }}>
          <strong>Unmet</strong>: {(passengerData[index].forecast - passengerData[index].capacity).toFixed(2)}M
        </div>
      </div>

    </div>
  </div>
);

}