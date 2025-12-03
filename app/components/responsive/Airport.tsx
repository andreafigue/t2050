// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

// ---------------------------
// Data & constants
// ---------------------------
const passengerData = [
  { year: 2017, forecast: 22.45, capacity: 23.05 },
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

  useEffect(() => {
    let tip = d3.select("body").select("#tooltip");
    if (tip.empty()) {
      tip = d3.select("body")
        .append("div")
        .attr("id", "tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("padding", "5px 8px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "5px")
        .style("display", "none")
        .style("pointer-events", "none")
        .style("box-shadow", "0 2px 6px rgba(0,0,0,0.15)")
        .style("font-size", "12px")
        .style("color", "#1e293b");
    }
  }, []);

  
  const leftWrapRef = useRef<HTMLDivElement | null>(null);
  const rightWrapRef = useRef<HTMLDivElement | null>(null);

  const [dims, setDims] = useState({
    left: { w: 400, h: 350 },
    right: { w: 400, h: 350 },
  });

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const lw = leftWrapRef.current?.clientWidth ?? 400;
      const lh = leftWrapRef.current?.clientHeight ?? 350;
      const rw = rightWrapRef.current?.clientWidth ?? 400;
      const rh = rightWrapRef.current?.clientHeight ?? 350;

      setDims({
        left: { w: lw, h: lh },
        right: { w: rw, h: rh },
      });
    });

    if (leftWrapRef.current) ro.observe(leftWrapRef.current);
    if (rightWrapRef.current) ro.observe(rightWrapRef.current);

    return () => ro.disconnect();
  }, []);


  const prevDimsRef = useRef(dims);



  // ---------------------------
  // Draw effect (runs on index change)
  // ---------------------------
  useEffect(() => {
    // ---- selections
    const svg = d3.select(svgRef.current);
    const chart = d3.select(chartRef.current);

    // ---- left chart (fixed coordinate system)
    const LEFT_W = dims.left.w;
    const LEFT_H = dims.left.h;
    svg.attr("viewBox", `0 0 ${LEFT_W} ${LEFT_H}`);

    // ---- right chart: derive width from parent on each redraw (no resize listener)
    const parent = chartRef.current?.parentElement;
    const chartW = dims.right.w;
    const chartH = dims.right.h;
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
      .attr("font-size", window.innerWidth < 640 ? "18px" : "25px")
      .attr("fill", "#334155")
      .text("Passenger Enplanements vs. Capacity");

    // Y-axis label
    svg
      .append("text")
      .attr("class", "y-label")
      .attr(
        "transform",
        `translate(${margin.left - 30}, ${margin.top + innerHeight / 2}) rotate(-90)`
      )
      .attr("text-anchor", "middle")
      .attr("font-size", window.innerWidth < 640 ? "10px" : "14px")
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

    // ------- Tooltip/hover group (cleans old on redraw)
    svg.selectAll(".hover-layer, .focus-group").remove();

    const hoverG = svg.append("g").attr("class", "hover-layer");
    const focusG = svg.append("g").attr("class", "focus-group");

    // vertical guide
    const guide = focusG.append("line")
      .attr("class", "guide-line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-dasharray", "4 4")
      .attr("stroke-width", 1.25)
      .style("opacity", 0);

    // focus dots (forecast + capacity)
    const fDot = focusG.append("circle")
      .attr("r", 5).attr("fill", "#1e40af").attr("stroke", "#fff").attr("stroke-width", 1.5)
      .style("opacity", 0);

    const cDot = focusG.append("circle")
      .attr("r", 5).attr("fill", "#94a3b8").attr("stroke", "#fff").attr("stroke-width", 1.5)
      .style("opacity", 0);

    // overlay for mouse capture
    hoverG.append("rect")
      .attr("class", "overlay")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .style("fill", "transparent")
      .style("pointer-events", "all")
      .on("mousemove", (event) => {
        // update tooltip (same global #tooltip as Population)
        const tooltip = d3.select("#tooltip");

        const [mx, my] = d3.pointer(event);
        const year = xScale.invert(mx - margin.left);

        const bisect = d3.bisector((d: any) => d.year).left;
        const i = bisect(passengerData, year);
        const d0 = passengerData[Math.max(0, i - 1)];
        const d1 = passengerData[Math.min(passengerData.length - 1, i)];
        const d = (year - d0.year > (d1?.year ?? d0.year) - year && i < passengerData.length) ? d1 : d0;

        // pick a reasonable max width for the tooltip
        const TOOLTIP_MAX_W = 200;
        const marginX = 12;
        const marginY = 8;

        const rawX = event.pageX + 10;
        const rawY = event.pageY - 28;

        // clamp so we don't go off the right or top edge
        const clampedX = Math.min(
          rawX,
          window.innerWidth - TOOLTIP_MAX_W - marginX
        );
        const clampedY = Math.max(rawY, marginY);

        tooltip
          .style("display", "block")
          .style("max-width", `${TOOLTIP_MAX_W}px`)
          .style("font-size", window.innerWidth < 640 ? "10px" : "14px")
          .html(
            `<strong>${d.year}</strong><br/>
             Forecast: ${d.forecast.toFixed(1)}M<br/>
             Capacity: ${d.capacity.toFixed(3)}M`
          )
          .style("left", `${clampedX}px`)
          .style("top", `${clampedY}px`);


        // const [mx, my] = d3.pointer(event);
        // const year = xScale.invert(mx - margin.left);

        // // nearest record by year 
        // const bisect = d3.bisector((d: any) => d.year).left;
        // const i = bisect(passengerData, year);
        // const d0 = passengerData[Math.max(0, i - 1)];
        // const d1 = passengerData[Math.min(passengerData.length - 1, i)];
        // const d = (year - d0.year > (d1?.year ?? d0.year) - year && i < passengerData.length) ? d1 : d0;

        // const x = margin.left + xScale(d.year);
        // const yF = margin.top + yScale(d.forecast);
        // const yC = margin.top + yScale(d.capacity);

        // // position focus elements
        // guide
        //   .attr("x1", x).attr("x2", x)
        //   .attr("y1", margin.top).attr("y2", margin.top + innerHeight)
        //   .style("opacity", 1);

        // fDot.attr("cx", x).attr("cy", yF).style("opacity", 1);
        // cDot.attr("cx", x).attr("cy", yC).style("opacity", 1);

        // // update tooltip (same global #tooltip as Population)
        // d3.select("#tooltip")
        //   .style("display", "block")
        //   .html(
        //     `<strong>${d.year}</strong><br/>
        //      Forecast: ${d.forecast.toFixed(1)}M<br/>
        //      Capacity: ${d.capacity.toFixed(3)}M`
        //   )
        //   .style("left", `${event.pageX + 10}px`)
        //   .style("top", `${event.pageY - 28}px`);
      })
      .on("mouseout", () => {
        d3.select("#tooltip").style("display", "none");
        guide.style("opacity", 0);
        fDot.style("opacity", 0);
        cDot.style("opacity", 0);
      })
      .on("click", (event) => {
        // snap the UI slider to the hovered year
        const [mx] = d3.pointer(event);
        const yVal = xScale.invert(mx - margin.left);
        const bisect = d3.bisector((d: any) => d.year).left;
        const i = bisect(passengerData, yVal);
        const d0 = passengerData[Math.max(0, i - 1)];
        const d1 = passengerData[Math.min(passengerData.length - 1, i)];
        const d = (yVal - d0.year > (d1?.year ?? d0.year) - yVal && i < passengerData.length) ? d1 : d0;
        setIndex(passengerData.findIndex(p => p.year === d.year));
      });


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
    const cell = chartW * 0.06;     // grid step
    const icon = cell *0.85 ;     // icon visual size
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

    const prevDims = prevDimsRef.current;
    const resizedRight =
      prevDims.right.w !== dims.right.w || prevDims.right.h !== dims.right.h;

    if (resizedRight) {
      // reset counts and clear icons so they can be re-laid out
      capacityCountRef.current = 0;
      unmetCountRef.current = 0;
      chart.selectAll(".icon-group > *").remove();
    }

    // --- labels: re-draw each time so they move with centering
    chart.selectAll(".bucket-label").remove();

    chart
      .append("text")
      .attr("class", "bucket-label")
      .attr("x", offsetCapacity + bucketW / 2)
      .attr("y", chartH * 0.08)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .attr("font-size", window.innerWidth < 640 ? "19px" : "25px")
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
      .attr("x", offsetUnmet + (bucketW / 2 ))
      .attr("y", chartH * 0.08)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .attr("font-size", window.innerWidth < 640 ? "18px" : "25px")
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

    prevDimsRef.current = dims;
  }, [index, dims]);

  // ---------------------------
  // UI
  // ---------------------------
  return (
    <div className="flex flex-col gap-3 md:gap-5 h-[100svh] md:min-h-[320px] min-h-0 w-full max-w-full">
    
      {/* Top Box: Title & Slider */}
      <div
        className="bg-gray-100 border shadow-md rounded-lg shrink-0 "
        style={{ padding: 20, borderRadius: 8 }}
      >
        <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-1 sm:mb-2 text-center text-slate-800">
          Airport Passenger Forecast vs Capacity
        </h2>

        {/* Stats */}
        <div
          className="flex justify-center gap-3 sm:gap-8 md:gap-20 text-sm sm:text-base"
        >
          <div style={{ background: "#f4f4f4", padding: 10 }}>
            <strong>Forecast</strong>: {passengerData[index].forecast}M
          </div>
          <div style={{ background: "#f4f4f4", padding: 10 }}>
            <strong>Capacity</strong>: {passengerData[index].capacity}M
          </div>
          <div style={{ background: "#f4f4f4", padding: 10 }}>
            <strong>Unmet</strong>:{" "}
            {(passengerData[index].forecast - passengerData[index].capacity).toFixed(2)}M
          </div>
        </div>

        {/* Slider */}
        <div className="flex justify-center items-center gap-2 sm:gap-3 mt-2">
          <strong className="text-sm sm:text-base">Year: {passengerData[index].year}</strong>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5 flex-1 min-h-0">
        {/* Column 1: Graph */} 
        <div
          ref={leftWrapRef}
          className="border shadow-md rounded-lg p-2 md:p-7 min-h-[260px] h-[38svh] md:h-full bg-gray-100 flex-1"
        >
          <svg ref={svgRef}  className="w-full h-full"></svg>
        </div>

        {/* Column 2: Animated Icons (Buckets) */}
        <div
          ref={rightWrapRef} 
          className="border shadow-md rounded-lg bg-gray-100 p-2
             min-h-[260px]  md:h-full w-full flex-1"
        >
          <svg ref={chartRef}  className="w-full h-full" ></svg>
        </div>
      </div>
    </div>
  );
}
