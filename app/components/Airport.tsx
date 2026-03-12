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

type DataPoint = { year: number; forecast: number; capacity: number };


const iconsPerUnit = 1; // 1 icon = 1M passengers

// ─────────────────────────────────────────────
// RIGHT PANEL
// ─────────────────────────────────────────────
const BUCKET = {
  // How many icons sit in each row
  iconPerRow: 5,

  // Cell size is computed from available space, then clamped to these px bounds.
  // Raise cellMax to allow bigger icons on large screens.
  // Lower cellMin to keep icons visible on tiny screens.
  cellMin:  14,   // px — smallest a cell (and icon) can ever be
  cellMax:  35,   // px — largest a cell can ever be

  // Icon is this fraction of the cell. 1.0 = fills the cell, 0.8 = more gap.
  iconRatio: 0.88,

  // Padding inside each bucket frame, as a fraction of cell size.
  // Higher = more breathing room around the icon grid.
  padRatio: 0.15,

  // Pixel gap between the top of the SVG and the top of the buckets.
  topY: 10,

  // Pixel gap between the bottom of the buckets and the SVG edge.
  bottomClearance: 4,

  // What fraction of chartW each bucket column can use (both buckets share the width).
  // 0.45 means each bucket can use 45% of the panel width.
  widthRatio: 0.45,

  // Horizontal centre of each bucket, as a fraction of chartW.
  leftCenterX:  0.25,
  rightCenterX: 0.75,

  // Bucket frame corner radius (px). Scales with cell but clamped to these bounds.
  frameRadiusMin: 4,
  frameRadiusMax: 14,

  // Bucket frame stroke width (px).
  frameStroke: 2,

  // Frame transition duration (ms).
  frameDuration: 500,
};

export default function Airport() {
  // ---------------------------
  // State & refs
  // ---------------------------
  const [index, setIndex] = useState(0);
  const titleRowRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);   // left graph
  const chartRef = useRef<SVGSVGElement | null>(null); // right buckets
  const leftSizeRef = useRef<{ w: number; h: number } | null>(null);

  // Counts to control animated icon adds/removals
  const capacityCountRef = useRef(0);
  const unmetCountRef = useRef(0);

  useEffect(() => {
    let tip = d3.select("body").select<HTMLDivElement>("#tooltip");
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


  // ---------------------------
  // Draw effect (runs on index change)
  // ---------------------------
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const chart = d3.select(chartRef.current);

    const leftParent = svgRef.current?.parentElement;

    if (leftParent) {
      leftSizeRef.current = { w: leftParent.clientWidth, h: leftParent.clientHeight };
    }

    const { w: leftW, h: leftH } = leftSizeRef.current!;
    svg.attr("viewBox", `0 0 ${leftW} ${leftH}`);


    // ---- right chart: derive width from parent on each redraw (no resize listener)
    const parent = chartRef.current?.parentElement;
    const chartW = chartRef.current?.clientWidth  || 300;
    const chartH = chartRef.current?.clientHeight || 300;
    chart.attr("viewBox", `0 0 ${chartW} ${chartH}`);


    // ===========================
    // LEFT: Line chart
    // ===========================
    const margin = { top: 20, right: 30, bottom: 30, left: 55 };
    const innerWidth = leftW - margin.left - margin.right;
    const innerHeight = leftH - margin.top - margin.bottom;

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

    // Y-axis label
    svg
      .append("text")
      .attr("class", "y-label")
      .attr(
        "transform",
        `translate(${margin.left/2}, ${margin.top + innerHeight / 2}) rotate(-90)`
      )
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("fill", "#334155")
      .text("Millions of Passengers");

    // Axes
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left}, ${leftH - margin.bottom})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .call(d3.axisLeft(yScale));


    const lineForecast = d3.line<DataPoint>()
      .x(d => xScale(d.year))
      .y(d => yScale(d.forecast));

    const lineCapacity = d3.line<DataPoint>()
      .x(d => xScale(d.year))
      .y(d => yScale(d.capacity));

    svg
      .append("path")
      .datum(passengerData)
      .attr("class", "line forecast")
      .attr("fill", "none")
      .attr("stroke", "#f97316")
      .attr("stroke-width", 2.5)
      .attr("stroke-dasharray", "4 2")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .attr("d", lineForecast);

    svg
      .append("path")
      .datum(passengerData)
      .attr("class", "line capacity")
      .attr("fill", "none")   
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2)
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .attr("d", lineCapacity);

    if (svg.select(".legend").empty()) {

      const legendItems = [
        { label: "Forecast", color: "#f97316", dash: "4 2" },
        { label: "Capacity", color: "#3b82f6", dash: null },
      ];

      const legendG = svg.append("g").attr("class", "legend")
        .attr("transform", `translate(${margin.left + 10}, ${margin.top + 10})`);

      legendItems.forEach((item, i) => {
        const row = legendG.append("g").attr("transform", `translate(0, ${i * 15})`);
        row.append("line")
          .attr("x1", 0).attr("x2", 24).attr("y1", 6).attr("y2", 6)
          .attr("stroke", item.color)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", item.dash ?? "none");
        row.append("text")
          .attr("x", 30).attr("y", 10)
          .attr("font-size", `clamp(10px, ${leftW * 0.025}px, 13px)`)
          .attr("fill", "#334155")
          .text(item.label);
      });
    }

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
      .attr("r", 5).attr("fill", "#f97316").attr("stroke", "#fff").attr("stroke-width", 1.5)
      .style("opacity", 0);

    const cDot = focusG.append("circle")
      .attr("r", 5).attr("fill", "#3b82f6").attr("stroke", "#fff").attr("stroke-width", 1.5)
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
        const [mx] = d3.pointer(event);
        const year = xScale.invert(mx - margin.left);

        // nearest record by year (same pattern you used)
        const bisect = d3.bisector((d: any) => d.year).left;
        const i = bisect(passengerData, year);
        const d0 = passengerData[Math.max(0, i - 1)];
        const d1 = passengerData[Math.min(passengerData.length - 1, i)];
        const d = (year - d0.year > (d1?.year ?? d0.year) - year && i < passengerData.length) ? d1 : d0;

        const x = margin.left + xScale(d.year);
        const yF = margin.top + yScale(d.forecast);
        const yC = margin.top + yScale(d.capacity);

        // position focus elements
        guide
          .attr("x1", x).attr("x2", x)
          .attr("y1", margin.top).attr("y2", margin.top + innerHeight)
          .style("opacity", 1);

        fDot.attr("cx", x).attr("cy", yF).style("opacity", 1);
        cDot.attr("cx", x).attr("cy", yC).style("opacity", 1);

        const tip = d3.select<HTMLDivElement, unknown>("#tooltip")
          .style("display", "block")
          .html(`<strong>${d.year}</strong><br/>
                 Forecast: ${d.forecast.toFixed(1)}M<br/>
                 Capacity: ${d.capacity.toFixed(3)}M`);

        const tipNode = tip.node() as HTMLElement;
        const tipW = tipNode.offsetWidth;
        const tipH = tipNode.offsetHeight;

        const left = (event.pageX + tipW > window.innerWidth)
          ? event.pageX - tipW
          : event.pageX;
        const top = (event.pageY - tipH < 0)
          ? event.pageY
          : event.pageY - tipH;

        tip.style("left", `${left}px`).style("top", `${top}px`);
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
      .attr("fill", "#f97316")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    svg
      .append("circle")
      .attr("class", "highlight")
      .attr("cx", margin.left + xScale(highlight.year))
      .attr("cy", margin.top + yScale(highlight.capacity))
      .attr("r", 6)
      .attr("fill", "#3b82f6")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // ===========================
    // RIGHT: Buckets + icons
    // ===========================
    const { forecast, capacity } = passengerData[index];

    // Container for icons
    const iconGroup = chart.select(".icon-group").empty()
      ? chart.append("g").attr("class", "icon-group")
      : chart.select(".icon-group");

    // --- layout constants for buckets
    const iconPerRow = BUCKET.iconPerRow;

    // Find the tallest bucket across ALL years (capacity or forecast-capacity)
    const maxCapacityRows = Math.ceil(d3.max(passengerData, d => Math.floor(d.capacity / iconsPerUnit))! / iconPerRow);
    const maxUnmetRows    = Math.ceil(d3.max(passengerData, d => Math.max(0, Math.floor((d.forecast - d.capacity) / iconsPerUnit)))! / iconPerRow);
    const maxRows = Math.max(maxCapacityRows, maxUnmetRows);

    // Available vertical space for icons
    const bucketTopY    = BUCKET.topY;
    const bucketBottomY = chartH - BUCKET.bottomClearance;
    const bucketHMax    = bucketBottomY - bucketTopY;

    // Cell size: fit maxRows vertically AND fit iconPerRow horizontally,
    // then clamp between cellMin and cellMax so icons never get absurdly big or tiny.
    const cellByHeight = bucketHMax / maxRows;
    const cellByWidth  = (chartW * BUCKET.widthRatio) / iconPerRow;
    const cell = Math.min(
      BUCKET.cellMax,
      Math.max(BUCKET.cellMin, Math.min(cellByWidth, cellByHeight))
    );

    const icon      = cell * BUCKET.iconRatio;
    const bucketPad = cell * BUCKET.padRatio;

    // Frame corner radius scales with cell, clamped to its own bounds
    const frameRadius = Math.min(
      BUCKET.frameRadiusMax,
      Math.max(BUCKET.frameRadiusMin, cell * 0.25)
    );

    // Width of one bucket frame
    const bucketW = (iconPerRow - 1) * cell + icon + bucketPad * 2;

    const capacityCenterX = chartW * BUCKET.leftCenterX;
    const unmetCenterX    = chartW * BUCKET.rightCenterX;

    const offsetCapacity = capacityCenterX - bucketW / 2;
    const offsetUnmet    = unmetCenterX    - bucketW / 2;

    const bottomY = bucketBottomY;

    // Current year capacity -> rows -> current frame height
    const currentCapacityIcons = Math.floor(
      passengerData[index].capacity / iconsPerUnit
    );

    const currentRows = Math.ceil(currentCapacityIcons / iconPerRow);
    const bucketHCurrent = Math.max(icon + bucketPad * 2, (currentRows - 1) * cell + icon + bucketPad * 2);

  
    function roundedRectWithOptionalTopRightStep(
      x: number, y: number, w: number, h: number, rOuter: number,
      stepStartX: number, stepDepth: number, rStep: number
    ) {
      const xR = x + w, yB = y + h;

      // Clamp step start so inner arcs stay inside the outer radius
      const minStepX = x + rOuter + 2 + rStep;
      const maxStepX = xR - rOuter - 2 - rStep;
      const L = Math.max(minStepX, Math.min(stepStartX, maxStepX));

      const yTop = y;                               
      const yStep = y + Math.max(0, stepDepth);   
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

      frame.interrupt()
        .transition()
        .duration(duration)
        .attr("d", d)
        .attr("stroke", stroke)
        .attr("stroke-width", strokeWidth)
        .attr("fill", "none");
    }

    drawCapacityFrame({
      chart,
      passengerData, index,
      offsetCapacity, bottomY, bucketW, bucketHCurrent,
      iconsPerUnit, iconPerRow,
      bucketPad, cell, icon,
      radius: frameRadius,
      strokeWidth: BUCKET.frameStroke,
      duration: BUCKET.frameDuration,
    });

    // --- labels: re-draw each time so they move with centering
    chart.selectAll(".bucket-label").remove();


    // --- legend (centered under the two buckets)
    const legendGroup = chart.select(".legend-group").empty()
      ? chart.append("g").attr("class", "legend-group")
      : chart.select(".legend-group");
    (legendGroup as unknown as d3.Selection<SVGGElement, unknown, HTMLElement, unknown>).selectAll("*").remove();



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
          const finalY = bottomY  - icon - row * cell ;

          const group = iconGroup
            .append("g")
            .attr("transform", `translate(${finalX}, ${bucketTopY - icon})`)
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
              <svg  viewBox="0 0 24 24" style="padding: 1px; box-sizing: border-box;" width="100%" height="100%" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user">
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
      offsetCapacity + bucketPad,
      bucketTopY,
      capacityCountRef.current,
      (v) => (capacityCountRef.current = v),
      "Capacity"
    );

    updateIcons(
      Math.max(0, Math.floor((forecast - capacity) / iconsPerUnit)),
      "#f97316",
      offsetUnmet + bucketPad,
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
    <div className="h-full  flex flex-col gap-2 md:gap-4" >
      {/* Top Container */}
      <div className="border shadow-md rounded-lg p-2 md:p-5" style={{ background: "#f4f4f4" }}>
        {/* Title */}
        <h2 className="text-lg md:text-xl font-semibold text-center mb-2">
          Airport Passenger Forecast vs Capacity
        </h2>

        {/* Stats Row — ALWAYS SIDE BY SIDE */}
        <div className="flex items-center justify-between gap-2 md:gap-6 text-center mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-xs md:text-sm font-semibold">Forecast</div>
            <div className="text-sm md:text-base truncate">
              {passengerData[index].forecast}M
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs md:text-sm font-semibold">Capacity</div>
            <div className="text-sm md:text-base truncate">
              {passengerData[index].capacity}M
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs md:text-sm font-semibold">Unmet</div>
            <div className="text-sm md:text-base truncate">
              {(passengerData[index].forecast - passengerData[index].capacity).toFixed(2)}M
            </div>
          </div>
        </div>

        {/* Year + Slider */}
        <div className="flex items-center justify-center gap-3">
          <div className="text-xs md:text-sm font-semibold whitespace-nowrap">
            Year: {passengerData[index].year}
          </div>

          <input
            type="range"
            min={0}
            max={passengerData.length - 1}
            value={index}
            onChange={(e) => setIndex(+e.target.value)}
            className="flex-1 max-w-[520px]"
          />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="flex flex-col md:flex-row gap-2 md:gap-5 h-full">

          {/* Column 1 */}
          <div className="border shadow-md rounded-lg flex flex-col p-1 md:p-4 flex-1 min-h-0" style={{ background: "#f4f4f4" }}>
            <div className="text-md text-center md:text-lg font-bold mb-1 md:mb-2">Passenger Enplanements vs Capacity</div>

            {/* This container grows to fill leftover space */}
            <div  className="flex-1 w-full min-h-0">
              <svg ref={svgRef} className="w-full h-full"></svg>
            </div>
          </div>

          {/* Column 2 */}
          <div className="border shadow-md rounded-lg flex flex-col p-2 md:p-4 flex-1 min-h-0" style={{ background: "#f4f4f4" }}>

            <div ref={titleRowRef} className="flex justify-between w-full background-red">
              <div className="text-center text-md md:text-lg flex-1">
                <strong>Capacity</strong>
                {/*<div className="text-xs">SeaTac + Paine Field</div>*/}
              </div>

              <div className="text-center text-md md:text-lg flex-1">
                <strong>Unmet Demand</strong>
              </div>
            </div>

            <div  className="flex-1 w-full overflow-hidden mb-0" >
              <svg
                ref={chartRef}
                className="w-full h-full"
                preserveAspectRatio="xMidYMid meet"
              />
            </div>


            {/* Row 1 — Seatac aligned under Capacity */}
            <div className="flex w-full">
              <div className="flex-1 text-center text-sm md:text-md text-gray-700">
                SeaTac + Paine Field
              </div>
              <div className="flex-1"></div>
            </div>

            {/* Row 2 — Legend aligned under Unmet Demand, bottom-right */}
            <div className="flex w-full">
              <div className="flex-1"></div>
              <div className="flex-1 flex text-sm md:text-md justify-end items-center gap-1 text-gray-700">
                <svg
                  width="22"
                  height="22"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-user"
                  viewBox="0 0 24 24" 
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>= 1M passengers</span>
              </div>
            </div>


          </div>
        </div>



      </div>
    </div>

  );
}
