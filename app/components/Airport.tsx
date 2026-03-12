"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// Each entry is one snapshot year with a forecast passenger count and the
// airport's physical capacity at that time, both in millions of passengers.
// ─────────────────────────────────────────────────────────────────────────────
const passengerData = [
  { year: 2017, forecast: 22.45, capacity: 23.05 },
  { year: 2019, forecast: 25.4,  capacity: 25.655 },
  { year: 2020, forecast: 9.6,   capacity: 25.655 },
  { year: 2021, forecast: 17.5,  capacity: 25.655 },
  { year: 2022, forecast: 22.4,  capacity: 25.655 },
  { year: 2023, forecast: 24.9,  capacity: 25.655 },
  { year: 2024, forecast: 25.7,  capacity: 25.655 },
  { year: 2027, forecast: 31.1,  capacity: 28.6 },
  { year: 2037, forecast: 38.0,  capacity: 28.6 },
  { year: 2050, forecast: 55.6,  capacity: 33.6 },
];

// Shape of a single row in passengerData — used to type D3 line generators.
type DataPoint = { year: number; forecast: number; capacity: number };

// How many millions of passengers one person icon represents.
const iconsPerUnit = 1;

// ─────────────────────────────────────────────────────────────────────────────
// BUCKET CONFIG
// All layout knobs for the right-panel icon buckets live here so they are easy
// to find and adjust without touching the drawing logic.
// ─────────────────────────────────────────────────────────────────────────────
const BUCKET = {
  // Number of icon columns in each bucket grid.
  iconPerRow: 5,

  // Cell size (the slot each icon occupies) is derived from the available SVG
  // space, then clamped between these two pixel values so icons never become
  // unreadably small or absurdly large.
  cellMin: 14,
  cellMax: 35,

  // The icon SVG is drawn at this fraction of the cell size, leaving a small
  // gap between neighbouring icons.
  iconRatio: 0.88,

  // Inner padding around the icon grid inside each bucket frame, expressed as
  // a fraction of the cell size.
  padRatio: 0.15,

  // Pixel gap between the top edge of the SVG and the top of the buckets.
  topY: 10,

  // Pixel gap between the bottom of the buckets and the bottom SVG edge.
  bottomClearance: 4,

  // Each bucket may occupy this fraction of the total SVG width.
  widthRatio: 0.45,

  // Horizontal centre of the left (capacity) and right (unmet) bucket columns,
  // expressed as fractions of the total SVG width.
  leftCenterX:  0.25,
  rightCenterX: 0.75,

  // The bucket frame's corner radius scales with cell size but is clamped
  // between these two pixel values.
  frameRadiusMin: 4,
  frameRadiusMax: 14,

  // Stroke width of the bucket frame outline in pixels.
  frameStroke: 2,

  // Duration of the bucket frame resize/recolour transition in milliseconds.
  frameDuration: 500,
};

// ─────────────────────────────────────────────────────────────────────────────
// buildBucketPath
// Returns an SVG path string that draws a rounded rectangle.  If stepDepth > 0
// the top-right corner is replaced with a step (notch) that drops down by
// stepDepth pixels starting at stepStartX.  This is used to show a partially
// filled top row in the capacity bucket frame.
//
//  x, y        — top-left corner of the rectangle
//  w, h        — total width and height
//  rOuter      — corner radius on the four main corners
//  stepStartX  — x coordinate where the notch begins
//  stepDepth   — how far down the notch drops (0 = flat top, no notch)
//  rStep       — inner radius on the two corners of the notch
// ─────────────────────────────────────────────────────────────────────────────
function buildBucketPath(
  x: number, y: number, w: number, h: number, rOuter: number,
  stepStartX: number, stepDepth: number, rStep: number
): string {
  const xR = x + w;
  const yB = y + h;

  // Keep the notch start inside the frame so the inner arcs never protrude
  // beyond the outer rounded corners.
  const minStepX = x  + rOuter + 2 + rStep;
  const maxStepX = xR - rOuter - 2 - rStep;
  const L = Math.max(minStepX, Math.min(stepStartX, maxStepX));

  const yTop  = y;
  const yStep = y + Math.max(0, stepDepth); // y of the lowered section of the top edge

  return [
    // Start on the left edge, just below the top-left corner.
    `M ${x} ${yTop + rOuter}`,
    // Top-left outer corner arc.
    `A ${rOuter} ${rOuter} 0 0 1 ${x + rOuter} ${yTop}`,
    // Straight along the top to just before the notch.
    `H ${L - rStep}`,
    // Notch: concave arc curving downward (into the rectangle).
    `A ${rStep} ${rStep} 0 0 1 ${L} ${yTop + rStep}`,
    // Vertical drop of the notch (zero length when stepDepth is 0).
    `V ${Math.max(yTop + rStep, yStep - rStep)}`,
    // Notch: convex arc curving rightward (out of the notch).
    `A ${rStep} ${rStep} 0 0 0 ${L + rStep} ${yStep}`,
    // Continue along the lowered top edge to the top-right corner.
    `H ${xR - rOuter}`,
    // Top-right outer corner arc, starting from the (possibly lowered) yStep.
    `A ${rOuter} ${rOuter} 0 0 1 ${xR} ${yStep + rOuter}`,
    // Right edge, bottom-right corner, bottom edge, bottom-left corner — all standard.
    `V ${yB - rOuter}`,
    `A ${rOuter} ${rOuter} 0 0 1 ${xR - rOuter} ${yB}`,
    `H ${x + rOuter}`,
    `A ${rOuter} ${rOuter} 0 0 1 ${x} ${yB - rOuter}`,
    `Z`,
  ].join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// BucketLayout
// All pixel values needed to position and size icons and frames in the right
// panel SVG.  Returned by computeBucketLayout and passed around so every
// drawing step uses a consistent snapshot of the same geometry.
// ─────────────────────────────────────────────────────────────────────────────
type BucketLayout = {
  cell:           number; // side length of one icon slot (px)
  icon:           number; // rendered size of the icon SVG inside the slot (px)
  bucketPad:      number; // padding inside the frame around the icon grid (px)
  bucketW:        number; // total width of one bucket frame (px)
  frameRadius:    number; // corner radius of the bucket frame (px)
  offsetCapacity: number; // x position of the left edge of the capacity bucket
  offsetUnmet:    number; // x position of the left edge of the unmet bucket
  bucketTopY:     number; // y of the top of the bucket area
  bottomY:        number; // y of the bottom of the bucket area (icons stack upward from here)
};

// ─────────────────────────────────────────────────────────────────────────────
// computeBucketLayout
// Derives all bucket geometry from the current SVG pixel dimensions.
// The goal is to fill the available space while keeping icons within the
// cellMin / cellMax bounds defined in BUCKET.
// ─────────────────────────────────────────────────────────────────────────────
function computeBucketLayout(chartW: number, chartH: number): BucketLayout {
  const {
    iconPerRow, cellMin, cellMax, iconRatio, padRatio,
    topY, bottomClearance, widthRatio,
    leftCenterX, rightCenterX, frameRadiusMin, frameRadiusMax,
  } = BUCKET;

  const bucketTopY    = topY;
  const bucketBottomY = chartH - bottomClearance;
  const bucketHMax    = bucketBottomY - bucketTopY; // total vertical space for icons

  // Find the tallest each bucket will ever need to be across all data years
  // so the cell size is stable as the slider moves.
  const maxCapacityRows = Math.ceil(
    d3.max(passengerData, d => Math.floor(d.capacity / iconsPerUnit))! / iconPerRow
  );
  const maxUnmetRows = Math.ceil(
    d3.max(passengerData, d => Math.max(0, Math.floor((d.forecast - d.capacity) / iconsPerUnit)))! / iconPerRow
  );
  const maxRows = Math.max(maxCapacityRows, maxUnmetRows);

  // Size the cell to use available height, then check it also fits horizontally,
  // then clamp the result so icons stay within the configured bounds.
  const cellByHeight = bucketHMax / maxRows;
  const cellByWidth  = (chartW * widthRatio) / iconPerRow;
  const cell = Math.min(cellMax, Math.max(cellMin, Math.min(cellByWidth, cellByHeight)));

  const icon      = cell * iconRatio;   // icon is slightly smaller than the slot
  const bucketPad = cell * padRatio;    // padding scales with icon size

  // Corner radius scales with the cell but stays within its own bounds.
  const frameRadius = Math.min(frameRadiusMax, Math.max(frameRadiusMin, cell * 0.25));

  // Total frame width = space for (iconPerRow - 1) gaps + one icon + two padding sides.
  const bucketW = (iconPerRow - 1) * cell + icon + bucketPad * 2;

  // Left edge of each bucket, derived from its centre position.
  const offsetCapacity = chartW * leftCenterX  - bucketW / 2;
  const offsetUnmet    = chartW * rightCenterX - bucketW / 2;

  return {
    cell, icon, bucketPad, bucketW, frameRadius,
    offsetCapacity, offsetUnmet,
    bucketTopY, bottomY: bucketBottomY,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// drawCapacityFrame
// Creates or updates the <path> element that draws the outline around the
// capacity icon bucket.  The frame height reflects the number of icons in the
// current year, and the top-right notch shows where the partially filled top
// row ends.  The stroke turns red when forecast exceeds capacity.
// ─────────────────────────────────────────────────────────────────────────────
function drawCapacityFrame(
  chart: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  layout: BucketLayout,
  dataIndex: number
) {
  const { cell, icon, bucketPad, bucketW, frameRadius, offsetCapacity, bottomY } = layout;
  const { iconPerRow } = BUCKET;

  const capacityUnits = passengerData[dataIndex].capacity;

  // Red frame = forecast exceeds capacity (over capacity); grey = within capacity.
  const stroke = passengerData[dataIndex].forecast > capacityUnits ? "#ef4444" : "#94a3b8";

  // Convert the capacity value to a whole icon count and derive how many rows
  // that fills, then calculate the pixel height of the frame.
  const capacityIcons  = Math.floor(capacityUnits / iconsPerUnit);
  const currentRows    = Math.ceil(capacityIcons / iconPerRow);
  const bucketHCurrent = Math.max(
    icon + bucketPad * 2,                              // minimum: one icon row + padding
    (currentRows - 1) * cell + icon + bucketPad * 2   // normal: full rows
  );

  // rem is how many icons sit in the top (partial) row.
  // rem === 0 means the top row is completely full, so no notch is needed.
  const rem = capacityIcons % iconPerRow;

  // Compute the x position where the notch should start, aligned with the
  // right edge of the last icon in the top row.
  const innerW       = bucketW - bucketPad * 2;
  const gridFullRowW = (iconPerRow - 1) * cell + icon; // pixel width of a full row of icons
  const xInset       = Math.max(0, (innerW - gridFullRowW) / 2); // centering offset
  const gridLeft     = offsetCapacity + bucketPad + xInset;
  const filledW      = rem === 0 ? gridFullRowW : (rem - 1) * cell + icon;
  // Add half a cell gap so the notch clears the last icon cleanly.
  const stepStart    = gridLeft + filledW + 5 + (cell - icon) / 2;

  // Notch depth equals one cell height, but shrinks if the frame is too short
  // to fit both the notch and the minimum corner radii.
  const stepDepth = rem === 0 || bucketHCurrent <= 0
    ? 0
    : Math.min(cell, Math.max(0, bucketHCurrent - frameRadius * 2));

  // Inner notch arc radius: at most 90% of the outer radius, at most half the drop.
  const rStep = Math.min(frameRadius * 0.9, Math.max(0, stepDepth / 2));

  // The frame sits above bottomY by exactly its current height.
  const xL   = offsetCapacity;
  const yT   = bottomY - bucketHCurrent;
  const pathD = buildBucketPath(xL, yT, bucketW, bucketHCurrent, frameRadius, stepStart, stepDepth, rStep);

  // Create the <path> on first call; reuse it on subsequent calls so the
  // transition animates from the previous shape rather than snapping.
  const frame = chart.select<SVGPathElement>("path.capacity-frame").empty()
    ? chart.append("path")
        .attr("class", "capacity-frame")
        .attr("fill", "none")
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
    : chart.select<SVGPathElement>("path.capacity-frame");

  // interrupt() cancels any in-flight transition before starting a new one.
  frame.interrupt()
    .transition()
    .duration(BUCKET.frameDuration)
    .attr("d", pathD)
    .attr("stroke", stroke)
    .attr("stroke-width", BUCKET.frameStroke)
    .attr("fill", "none");
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Airport() {
  // index is the currently selected row in passengerData, driven by the slider.
  const [index, setIndex] = useState(0);

  // DOM refs — the SVG elements and their immediate container divs.
  // Containers are observed for resize; SVGs receive the viewBox updates.
  const titleRowRef       = useRef<HTMLDivElement   | null>(null);
  const svgRef            = useRef<SVGSVGElement    | null>(null);   // left line chart
  const chartRef          = useRef<SVGSVGElement    | null>(null);   // right bucket chart
  const svgContainerRef   = useRef<HTMLDivElement   | null>(null);   // wrapper for left SVG
  const chartContainerRef = useRef<HTMLDivElement   | null>(null);   // wrapper for right SVG

  // Running icon totals for the two buckets.  Stored in refs (not state) so
  // the delta logic in updateIcons can read them without triggering re-renders.
  const capacityCountRef = useRef(0);
  const unmetCountRef    = useRef(0);

  // Snapshot of the BucketLayout that was used when icons were last positioned.
  // Compared on each draw to detect resizes that require repositioning icons.
  const lastLayoutRef = useRef<BucketLayout | null>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // TOOLTIP — appended to <body> once so it can overflow any container.
  // The cleanup function removes it when the component unmounts.
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tip = d3.select("body")
      .append("div")
      .attr("id", "tooltip")
      .style("position",   "absolute")
      .style("background", "white")
      .style("padding",    "5px 8px")
      .style("border",     "1px solid #ccc")
      .style("border-radius", "5px")
      .style("display",       "none")
      .style("pointer-events","none")
      .style("box-shadow", "0 2px 6px rgba(0,0,0,0.15)")
      .style("font-size",  "12px")
      .style("color",      "#1e293b");

    return () => { tip.remove(); };
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // drawLeft — renders the line chart in the left panel.
  // Clears and redraws every element on each call so the chart is always
  // consistent with the current SVG dimensions and selected index.
  //
  // Wrapped in useCallback so the ResizeObserver effect can list it as a
  // stable dependency without re-subscribing on every render.
  // ───────────────────────────────────────────────────────────────────────────
  const drawLeft = useCallback(() => {
    const el        = svgRef.current;
    const container = svgContainerRef.current;
    if (!el || !container) return;

    // Read the container's rendered pixel size and update the SVG viewBox to
    // match so all coordinates are in real pixels.
    const leftW = container.clientWidth;
    const leftH = container.clientHeight;
    const svg   = d3.select(el);
    svg.attr("viewBox", `0 0 ${leftW} ${leftH}`);

    // margin reserves space for the axes and the y-axis label.
    const margin      = { top: 20, right: 30, bottom: 30, left: 55 };
    const innerWidth  = leftW - margin.left - margin.right;
    const innerHeight = leftH - margin.top  - margin.bottom;

    // xScale maps a year value to a horizontal pixel position inside the plot area.
    const xScale = d3.scaleLinear()
      .domain(d3.extent(passengerData, d => d.year) as [number, number])
      .range([0, innerWidth]);

    // yScale maps millions of passengers to a vertical pixel position.
    // range is [innerHeight, 0] because SVG y increases downward.
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(passengerData, d => Math.max(d.forecast, d.capacity))!])
      .nice()
      .range([innerHeight, 0]);

    // Remove all previously drawn elements before redrawing so nothing
    // accumulates across calls.
    svg.selectAll(".axis, .line, .highlight, .y-label, .legend, .hover-layer, .focus-group").remove();

    // ── Y-axis label ──────────────────────────────────────────────────────────
    svg.append("text")
      .attr("class", "y-label")
      // Rotated 90° and centred along the left margin.
      .attr("transform", `translate(${margin.left / 2}, ${margin.top + innerHeight / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("fill", "#334155")
      .text("Millions of Passengers");

    // ── Axes ─────────────────────────────────────────────────────────────────
    // tickFormat("d") removes the decimal point from year numbers.
    svg.append("g").attr("class", "axis")
      .attr("transform", `translate(${margin.left}, ${leftH - margin.bottom})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

    svg.append("g").attr("class", "axis")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .call(d3.axisLeft(yScale));

    // ── Lines ─────────────────────────────────────────────────────────────────
    // Two line generators — one for forecast (dashed orange) and one for
    // capacity (solid blue).  Both are offset by the margin translate.
    const lineForecast = d3.line<DataPoint>().x(d => xScale(d.year)).y(d => yScale(d.forecast));
    const lineCapacity  = d3.line<DataPoint>().x(d => xScale(d.year)).y(d => yScale(d.capacity));

    svg.append("path").datum(passengerData)
      .attr("class", "line forecast")
      .attr("fill", "none")
      .attr("stroke", "#f97316")
      .attr("stroke-width", 2.5)
      .attr("stroke-dasharray", "4 2") // dashed to distinguish from capacity
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .attr("d", lineForecast);

    svg.append("path").datum(passengerData)
      .attr("class", "line capacity")
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2)
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .attr("d", lineCapacity);

    // ── Legend ───────────────────────────────────────────────────────────────
    // Two rows: a coloured line swatch on the left, a text label on the right.
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

      // Font size scales with SVG width so the legend stays proportional.
      row.append("text")
        .attr("x", 30).attr("y", 10)
        .attr("font-size", `clamp(10px, ${leftW * 0.025}px, 13px)`)
        .attr("fill", "#334155")
        .text(item.label);
    });

    // ── Hover / tooltip layer ─────────────────────────────────────────────────
    // hoverG holds the invisible overlay rect that captures mouse events.
    // focusG holds the visible indicator elements (guide line and dots).
    // Keeping them in separate groups makes it easy to clear the focus
    // elements without disturbing the overlay.
    const hoverG = svg.append("g").attr("class", "hover-layer");
    const focusG = svg.append("g").attr("class", "focus-group");

    // Vertical guide line that snaps to the nearest data point.
    const guide = focusG.append("line")
      .attr("class", "guide-line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-dasharray", "4 4")
      .attr("stroke-width", 1.25)
      .style("opacity", 0); // hidden until hover

    // Orange dot that tracks the forecast value at the hovered year.
    const fDot = focusG.append("circle")
      .attr("r", 5).attr("fill", "#f97316").attr("stroke", "#fff").attr("stroke-width", 1.5)
      .style("opacity", 0);

    // Blue dot that tracks the capacity value at the hovered year.
    const cDot = focusG.append("circle")
      .attr("r", 5).attr("fill", "#3b82f6").attr("stroke", "#fff").attr("stroke-width", 1.5)
      .style("opacity", 0);

    // The overlay rect sits over the entire plot area and intercepts all mouse
    // events.  fill:transparent keeps it invisible while still receiving events.
    hoverG.append("rect")
      .attr("class", "overlay")
      .attr("x", margin.left).attr("y", margin.top)
      .attr("width", innerWidth).attr("height", innerHeight)
      .style("fill", "transparent")
      .style("pointer-events", "all")
      .on("mousemove", (event) => {
        // Convert the mouse x position to a year value, then bisect to find
        // the nearest data point.
        const [mx] = d3.pointer(event);
        const year   = xScale.invert(mx - margin.left);
        const bisect = d3.bisector((d: DataPoint) => d.year).left;
        const i  = bisect(passengerData, year);
        const d0 = passengerData[Math.max(0, i - 1)];
        const d1 = passengerData[Math.min(passengerData.length - 1, i)];
        // Pick whichever of the two neighbouring points is closer by year.
        const d  = (year - d0.year > (d1?.year ?? d0.year) - year && i < passengerData.length) ? d1 : d0;

        // Convert data values back to pixel coordinates (including the margin offset).
        const x  = margin.left + xScale(d.year);
        const yF = margin.top  + yScale(d.forecast);
        const yC = margin.top  + yScale(d.capacity);

        // Move and show the guide line and dots.
        guide.attr("x1", x).attr("x2", x)
          .attr("y1", margin.top).attr("y2", margin.top + innerHeight)
          .style("opacity", 1);
        fDot.attr("cx", x).attr("cy", yF).style("opacity", 1);
        cDot.attr("cx", x).attr("cy", yC).style("opacity", 1);

        // Position the tooltip, flipping it to stay within the viewport when
        // it would otherwise overflow the right or top edge.
        const tip = d3.select<HTMLDivElement, unknown>("#tooltip")
          .style("display", "block")
          .html(`<strong>${d.year}</strong><br/>
                 Forecast: ${d.forecast.toFixed(1)}M<br/>
                 Capacity: ${d.capacity.toFixed(3)}M`);

        const tipNode = tip.node()!;
        const tipW = tipNode.offsetWidth;
        const tipH = tipNode.offsetHeight;
        const pad  = 10;

        const left = (event.pageX + pad + tipW > window.innerWidth)
          ? event.pageX - tipW - pad  // flip left when near right edge
          : event.pageX + pad;
        const top  = (event.pageY - tipH - pad < 0)
          ? event.pageY + pad          // flip down when near top edge
          : event.pageY - tipH - pad;

        tip.style("left", `${left}px`).style("top", `${top}px`);
      })
      .on("mouseout", () => {
        // Hide all focus indicators and the tooltip when the cursor leaves.
        d3.select("#tooltip").style("display", "none");
        guide.style("opacity", 0);
        fDot.style("opacity", 0);
        cDot.style("opacity", 0);
      })
      .on("click", (event) => {
        // Clicking the chart snaps the slider to the nearest data year.
        const [mx]   = d3.pointer(event);
        const yVal   = xScale.invert(mx - margin.left);
        const bisect = d3.bisector((d: DataPoint) => d.year).left;
        const i  = bisect(passengerData, yVal);
        const d0 = passengerData[Math.max(0, i - 1)];
        const d1 = passengerData[Math.min(passengerData.length - 1, i)];
        const d  = (yVal - d0.year > (d1?.year ?? d0.year) - yVal && i < passengerData.length) ? d1 : d0;
        setIndex(passengerData.findIndex(p => p.year === d.year));
      });

    // ── Selected year highlight dots ──────────────────────────────────────────
    // Two larger dots (orange = forecast, blue = capacity) permanently mark the
    // year currently selected by the slider.  They are cleared and redrawn on
    // every call so they move with the slider.
    const highlight = passengerData[index];

    svg.append("circle").attr("class", "highlight")
      .attr("cx", margin.left + xScale(highlight.year))
      .attr("cy", margin.top  + yScale(highlight.forecast))
      .attr("r", 6).attr("fill", "#f97316")
      .attr("stroke", "#fff").attr("stroke-width", 2);

    svg.append("circle").attr("class", "highlight")
      .attr("cx", margin.left + xScale(highlight.year))
      .attr("cy", margin.top  + yScale(highlight.capacity))
      .attr("r", 6).attr("fill", "#3b82f6")
      .attr("stroke", "#fff").attr("stroke-width", 2);

  }, [index]);

  // ───────────────────────────────────────────────────────────────────────────
  // drawRight — renders the icon bucket chart in the right panel.
  // The left bucket shows how many capacity units are filled; the right bucket
  // shows unmet demand (forecast minus capacity, when positive).
  //
  // Icons are NOT cleared and redrawn on every call.  Instead a delta is
  // computed and only the difference is added or removed with animation.
  // The frame path is always redrawn (it transitions smoothly).
  // ───────────────────────────────────────────────────────────────────────────
  const drawRight = useCallback(() => {
    const el        = chartRef.current;
    const container = chartContainerRef.current;
    if (!el || !container) return;

    // Sync the viewBox to the container's current rendered size.
    const chartW = container.clientWidth  || 300;
    const chartH = container.clientHeight || 300;
    const chart  = d3.select<SVGSVGElement, unknown>(el);
    chart.attr("viewBox", `0 0 ${chartW} ${chartH}`);

    // Derive all pixel geometry for the current SVG size.
    const layout = computeBucketLayout(chartW, chartH);
    const { cell, icon, bucketPad, offsetCapacity, offsetUnmet, bucketTopY, bottomY } = layout;
    const { iconPerRow } = BUCKET;
    const { forecast, capacity } = passengerData[index];

    // Animate the capacity frame to reflect the current year's icon count.
    drawCapacityFrame(
      chart as unknown as d3.Selection<SVGSVGElement, unknown, null, undefined>,
      layout,
      index
    );

    // Remove any leftover text labels from previous draws.
    chart.selectAll(".bucket-label").remove();

    // Create the icon container group on first draw; reuse it afterwards so
    // previously placed icons persist.
    if (chart.select(".icon-group").empty()) {
      chart.append("g").attr("class", "icon-group");
    }

    // ── Resize: reposition and resize existing icons if layout changed ────────
    // Because icon positions are baked into their transform attributes at
    // creation time, a resize (change in cell, offsetCapacity, or offsetUnmet)
    // requires updating every existing icon's position and foreignObject size.
    const prevLayout    = lastLayoutRef.current;
    const layoutChanged = !prevLayout
      || prevLayout.cell           !== layout.cell
      || prevLayout.offsetCapacity !== layout.offsetCapacity
      || prevLayout.offsetUnmet    !== layout.offsetUnmet;

    if (layoutChanged) {
      // Reposition and resize capacity icons.
      chart.selectAll<SVGGElement, unknown>(".icon-group > g[data-type='capacity']")
        .each(function(_, iconIndex) {
          const row = Math.floor(iconIndex / iconPerRow);
          const col = iconIndex % iconPerRow;
          const g   = d3.select(this);
          // Update the group's position in the grid.
          g.attr("transform", `translate(${offsetCapacity + bucketPad + col * cell}, ${bottomY - icon - row * cell})`);
          // Update the foreignObject so the icon SVG fills the new cell size.
          g.select("foreignObject").attr("width", icon).attr("height", icon);
        });

      // Reposition and resize unmet icons.
      chart.selectAll<SVGGElement, unknown>(".icon-group > g[data-type='unmet']")
        .each(function(_, iconIndex) {
          const row = Math.floor(iconIndex / iconPerRow);
          const col = iconIndex % iconPerRow;
          const g   = d3.select(this);
          g.attr("transform", `translate(${offsetUnmet + bucketPad + col * cell}, ${bottomY - icon - row * cell})`);
          g.select("foreignObject").attr("width", icon).attr("height", icon);
        });

      // Record the layout we just applied so we can detect the next change.
      lastLayoutRef.current = layout;
    }

    // ── updateIcons ───────────────────────────────────────────────────────────
    // Adds or removes icons to reach the target count for one bucket.
    //   count              — how many icons should exist after this call
    //   color              — stroke colour of the icon SVG
    //   offsetX            — left edge of the icon grid (bucket left + padding)
    //   currentCount       — how many icons currently exist (from a ref)
    //   updateCurrentCount — updates that ref after adding/removing
    //   label              — "Capacity" or "Unmet"; stored as data-type on each <g>
    const updateIcons = (
      count: number,
      color: string,
      offsetX: number,
      currentCount: number,
      updateCurrentCount: (val: number) => void,
      label: string
    ) => {
      const iconGroup = chart.select(".icon-group");
      const delta = count - currentCount; // positive = add, negative = remove

      if (delta > 0) {
        // Add exactly delta new icons, each animating in from the top of the
        // bucket and falling to their final grid position.
        for (let i = 0; i < delta; i++) {
          const iconIndex = currentCount + i;
          const row    = Math.floor(iconIndex / iconPerRow);
          const col    = iconIndex % iconPerRow;
          const finalX = offsetX + col * cell;
          const finalY = bottomY - icon - row * cell; // icons stack upward from bottomY

          // Start the icon above the bucket (at bucketTopY) so it falls in.
          const group = iconGroup.append("g")
            .attr("transform", `translate(${finalX}, ${bucketTopY - icon})`)
            .style("opacity", 0)
            .attr("data-type", label.toLowerCase()); // used for scoped selections

          // Animate the icon downward to its final grid slot.
          group.transition()
            .delay(i * 100)   // stagger so icons don't all arrive at once
            .duration(600)
            .attr("transform", `translate(${finalX}, ${finalY})`)
            .style("opacity", 1);

          // Render the icon as an inline SVG inside a foreignObject so we can
          // use the standard user SVG path without converting it to native SVG.
          group.append("foreignObject")
            .attr("width", icon).attr("height", icon)
            .append("xhtml:div")
            .html(`<svg viewBox="0 0 24 24" style="padding:1px;box-sizing:border-box;" width="100%" height="100%" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>`);
        }
      }

      if (delta < 0) {
        // Remove the excess icons from the end of the list with a fade-out.
        const toRemove = chart
          .selectAll(`.icon-group > g[data-type='${label.toLowerCase()}']`)
          .nodes()
          .slice(count); // everything from index `count` onward
        d3.selectAll(toRemove)
          .transition().duration(500)
          .style("opacity", 0)
          .remove();
      }

      updateCurrentCount(count);
    };

    // Jumping back to index 0 (the earliest year) resets both buckets entirely
    // so the animation plays from scratch on the next forward pass.
    if (index === 0) {
      capacityCountRef.current = 0;
      unmetCountRef.current    = 0;
      chart.selectAll(".icon-group > *").remove();
    }

    // Capacity bucket: filled icons = min(forecast, capacity) so the bucket
    // never shows more icons than its frame can hold.
    updateIcons(
      Math.floor(Math.min(forecast, capacity) / iconsPerUnit),
      "#0072ce",
      offsetCapacity + bucketPad,
      capacityCountRef.current,
      v => (capacityCountRef.current = v),
      "Capacity"
    );

    // Unmet bucket: only populated when forecast exceeds capacity.
    updateIcons(
      Math.max(0, Math.floor((forecast - capacity) / iconsPerUnit)),
      "#f97316",
      offsetUnmet + bucketPad,
      unmetCountRef.current,
      v => (unmetCountRef.current = v),
      "Unmet"
    );
  }, [index]);

  // ───────────────────────────────────────────────────────────────────────────
  // DRAW EFFECT — runs whenever index changes (slider moved or line clicked).
  // drawLeft and drawRight are stable useCallback references, so this effect
  // only re-subscribes when one of them is recreated (i.e. when index changes).
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    drawLeft();
    drawRight();
  }, [drawLeft, drawRight]);

  // ───────────────────────────────────────────────────────────────────────────
  // RESIZE EFFECT — redraws both charts whenever either container changes size.
  // Uses a ResizeObserver so the charts respond to layout changes (e.g. the
  // panel flexing on window resize or orientation change) not just index changes.
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const els = [svgContainerRef.current, chartContainerRef.current].filter(Boolean);
    if (!els.length) return;

    const ro = new ResizeObserver(() => {
      drawLeft();
      drawRight();
    });

    els.forEach(el => ro.observe(el!));
    return () => ro.disconnect(); // stop observing when the component unmounts
  }, [drawLeft, drawRight]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // Layout: a top stats/slider strip, then two side-by-side panels below.
  // The panels are stacked on mobile (flex-col) and side by side on md+ (flex-row).
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col gap-2 md:gap-4">

      {/* ── Top strip: title, stat pills, year slider ── */}
      <div className="border shadow-md rounded-lg p-2 md:p-5" style={{ background: "#f4f4f4" }}>
        <h2 className="text-lg md:text-xl font-semibold text-center mb-2">
          Airport Passenger Forecast vs Capacity
        </h2>

        {/* Three stat pills always sit side by side regardless of screen width. */}
        <div className="flex items-center justify-between gap-2 md:gap-6 text-center mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-xs md:text-sm font-semibold">Forecast</div>
            <div className="text-sm md:text-base truncate">{passengerData[index].forecast}M</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs md:text-sm font-semibold">Capacity</div>
            <div className="text-sm md:text-base truncate">{passengerData[index].capacity}M</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs md:text-sm font-semibold">Unmet</div>
            <div className="text-sm md:text-base truncate">
              {(passengerData[index].forecast - passengerData[index].capacity).toFixed(2)}M
            </div>
          </div>
        </div>

        {/* Slider advances through the passengerData array by integer index. */}
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

      {/* ── Bottom section: left line chart + right bucket chart ── */}
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="flex flex-col md:flex-row gap-2 md:gap-5 h-full">

          {/* Left panel — D3 line chart */}
          <div className="border shadow-md rounded-lg flex flex-col p-1 md:p-4 flex-1 min-h-0" style={{ background: "#f4f4f4" }}>
            <div className="text-md text-center md:text-lg font-bold mb-1 md:mb-2">
              Passenger Enplanements vs Capacity
            </div>
            {/* svgContainerRef is observed for resize; the SVG fills it 100%. */}
            <div ref={svgContainerRef} className="flex-1 w-full min-h-0">
              <svg ref={svgRef} className="w-full h-full" />
            </div>
          </div>

          {/* Right panel — bucket icon chart */}
          <div className="border shadow-md rounded-lg flex flex-col p-2 md:p-4 flex-1 min-h-0" style={{ background: "#f4f4f4" }}>

            {/* Column headers sit above the SVG, aligned with each bucket. */}
            <div ref={titleRowRef} className="flex justify-between w-full">
              <div className="text-center text-md md:text-lg flex-1"><strong>Capacity</strong></div>
              <div className="text-center text-md md:text-lg flex-1"><strong>Unmet Demand</strong></div>
            </div>

            {/* chartContainerRef is observed for resize; the SVG fills it 100%. */}
            <div ref={chartContainerRef} className="flex-1 w-full overflow-hidden mb-0">
              <svg ref={chartRef} className="w-full h-full" preserveAspectRatio="xMidYMid meet" />
            </div>

            {/* Sub-label under the capacity bucket column. */}
            <div className="flex w-full">
              <div className="flex-1 text-center text-sm md:text-md text-gray-700">SeaTac + Paine Field</div>
              <div className="flex-1" />
            </div>

            {/* Icon legend under the unmet demand bucket column. */}
            <div className="flex w-full">
              <div className="flex-1" />
              <div className="flex-1 flex text-sm md:text-md justify-end items-center gap-1 text-gray-700">
                {/* A static sample icon matching the ones drawn in the SVG. */}
                <svg width="22" height="22" fill="none" stroke="#334155" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
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