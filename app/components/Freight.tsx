'use client';

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import type { BaseType } from "d3-selection";

interface FreightData {
  Year: number;
  Tons: number;
  Value: number;
  [key: string]: any;
}

const WashingtonMapWithLineGraphs = () => {
  const mapSvgRef = useRef<SVGSVGElement>(null);
  const lineGraph1Ref = useRef<SVGSVGElement>(null);
  const lineGraph2Ref = useRef<SVGSVGElement>(null);

  const [usStatesData, setUsStatesData] = useState<any>(null);
  const [rtpoData, setRtpoData] = useState<any>(null);
  const [selectedCounties, setSelectedCounties] = useState<Set<string>>(new Set());
  const selectedCountiesRef = useRef<Set<string>>(selectedCounties);

  const [freightCSVData, setFreightCSVData] = useState<FreightData[]>([]);

  const [waCountyIDs, setWaCountyIDs] = useState<Set<string>>(new Set());
  const [waCountyMapping, setWaCountyMapping] = useState<Record<string, string>>({});

  const [filterOptions] = useState({
    inboundOutbound: ["all", "Inbound", "Outbound"],
    commodityGroup: [
      "all",
      "Industrial Manufacturing",
      "Last-Mile Delivery",
      "Transportation Equipment",
      "Agriculture & Seafood",
      "Clothing and Misc. Manufacturing",
      "Energy",
      "Food Manufacturing",
      "Forestry Products",
      "High-Tech Manufacturing",
      "Construction"
    ],
    tradeType: [
      { id: "all", name: "All" },
      { id: "1", name: "Domestic Only" },
      { id: "2", name: "Import" },
      { id: "3", name: "Export" }
    ],
    mode: [
      { id: "all", name: "All" },
      { id: "1", name: "Truck" },
      { id: "2", name: "Rail" },
      { id: "3", name: "Water" },
      { id: "4", name: "Air" },
      { id: "5", name: "Multiple Modes Including Mail" }
    ]
  });
  const [selectedFilters, setSelectedFilters] = useState({
    inboundOutbound: "Outbound",
    commodityGroup: "all",
    tradeType: "all",
    mode: "all",
  });

  const mapWidth = 600, mapHeight = 500;
  const lineGraphWidth = 300, lineGraphHeight = 240;

  useEffect(() => {
    selectedCountiesRef.current = selectedCounties;
    const svg = d3.select(mapSvgRef.current);
    svg.selectAll(".county")
      .attr("fill", d =>
        selectedCountiesRef.current.has((d as any).properties.NAME) ? "#007bff" : "#ccc"
      );
  }, [selectedCounties]);

  useEffect(() => {
    d3.json("https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json")
      .then((data) => {
        setUsStatesData({ type: "FeatureCollection", features: (data as any).features });
      });
    d3.json("/data/freight/RTPO.json")
      .then((data) => {
        const geoJson = {
          type: "FeatureCollection",
          features: (data as any).features.map((d: any) => ({
            type: "Feature",
            geometry: { type: "Polygon", coordinates: d.geometry.rings },
            properties: d.attributes,
          }))
        };
        setRtpoData(geoJson);
      });
  }, []);

  useEffect(() => {
    d3.csv<FreightData>("/data/freight/sample.csv", row => ({
      ...row,
      Year: +row.Year,
      Tons: +row.Tons,
      Value: +row.Value
    })).then(data => setFreightCSVData(data));
  }, []);

  useEffect(() => {
    d3.json("/data/freight/counties.geojson")
      .then((geojson: any) => {
        const wa = geojson.features.filter((f: any) => f.properties.STATEFP === "53");
        const ids = new Set<string>();
        const mapping: Record<string, string> = {};
        wa.forEach((f: any) => {
          const id = f.properties.GEOID ? f.properties.GEOID : (f.properties.STATEFP + f.properties.COUNTYFP);
          ids.add(id);
          mapping[f.properties.NAME] = id;
        });
        setWaCountyIDs(ids);
        setWaCountyMapping(mapping);
      })
      .catch(err => console.error(err));
  }, []);

  const filteredFreightData = useMemo(() => {
    if (!freightCSVData || freightCSVData.length === 0) return [];
    const inboundOutbound = selectedFilters.inboundOutbound;
    let countyFilterSet: Set<string>;
    if (selectedCounties.size > 0) {
      countyFilterSet = new Set(
        Array.from(selectedCounties)
          .map(name => waCountyMapping[name])
          .filter(id => id !== undefined)
      );
    } else {
      countyFilterSet = waCountyIDs;
    }
    return freightCSVData.filter(d => {
      let pass = true;
      if (inboundOutbound === "Outbound") {
        pass = pass && countyFilterSet.has(d["Origin County"]);
      } else if (inboundOutbound === "Inbound") {
        pass = pass && countyFilterSet.has(d["Destination County"]);
      } else if (inboundOutbound === "all") {
        pass = pass && (countyFilterSet.has(d["Origin County"]) || countyFilterSet.has(d["Destination County"]));
      }
      if (selectedFilters.commodityGroup !== "all") {
        pass = pass && (d["Commodity Group"] === selectedFilters.commodityGroup);
      }
      if (selectedFilters.tradeType !== "all") {
        pass = pass && (d["Trade Type"] === selectedFilters.tradeType);
      }
      if (selectedFilters.mode !== "all") {
        pass = pass && (d["Mode"] === selectedFilters.mode);
      }
      return pass;
    });
  }, [freightCSVData, selectedFilters, selectedCounties, waCountyIDs, waCountyMapping]);

  // Draw the Washington map (unchanged)
  useEffect(() => {
    if (!usStatesData) return;
    const svg = d3.select(mapSvgRef.current)
      .attr("width", mapWidth)
      .attr("height", mapHeight);
    svg.selectAll("*").remove();
    const projection = d3.geoAlbers()
      .center([-0.6, 47.5])
      .rotate([120, 0])
      .parallels([48, 49])
      .scale(6000)
      .translate([mapWidth / 2, mapHeight / 2]);
    const path = d3.geoPath().projection(projection);
    //let tooltip = d3.select("body").select("#tooltip");
    //let tooltip: d3.Selection<BaseType, unknown, HTMLElement, any> = d3.select("body").select("#tooltip");
    let tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any> = d3.select("body").select<HTMLDivElement>("#tooltip");


    if (tooltip.empty()) {
      tooltip = d3.select("body")
        .append("div")
        .attr("id", "tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("padding", "5px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "5px")
        .style("display", "none")
        .style("pointer-events", "none");
    }
    d3.json("/data/freight/counties.geojson")
      .then((geojson: any) => {
        const washingtonCounties = geojson.features.filter((f: any) => f.properties.STATEFP === "53");
        if (washingtonCounties.length === 0) {
          console.error("No Washington counties found. Check GeoJSON structure.");
          return;
        }
        svg.selectAll(".county")
          .data(washingtonCounties)
          .enter()
          .append("path")
          .attr("class", "county")
          //.attr("d", (d) => path(d) || "")
          //.attr("d", path)
          //.attr("d", (d: GeoJSON.Feature<GeoJSON.Geometry, any>) => path(d) || "")
          .attr("d", (d) => path(d as GeoJSON.Feature<GeoJSON.Geometry, any>) || "")
          .attr("stroke", "#333")
          .attr("stroke-width", 1)
          .attr("fill", d => selectedCountiesRef.current.has((d as any).properties.NAME) ? "#007bff" : "#ccc")
          .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "orange");
            tooltip.style("display", "block")
              .html(`<strong>${(d as any).properties.NAME}</strong>`)
              .style("left", `${event.clientX + 10}px`)
              .style("top", `${event.clientY - 20}px`);
          })
          .on("mouseout", function(event, d) {
            const isSelected = selectedCountiesRef.current.has((d as any).properties.NAME);
            d3.select(this)
              .transition()
              .duration(200)
              .attr("fill", isSelected ? "#007bff" : "#ccc");
            tooltip.style("display", "none");
          })
          .on("click", function(event, d) {
            setSelectedCounties(prev => {
              const newSet = new Set(prev);
              if (newSet.has((d as any).properties.NAME)) {
                newSet.delete((d as any).properties.NAME);
              } else {
                newSet.add((d as any).properties.NAME);
              }
              return newSet;
            });
          });
      })
      .catch(err => console.error("Error loading counties GeoJSON:", err));
  }, [usStatesData]);

  // A formatter for numbers using SI notation (e.g., 1k, 1M)
  const formatSI = d3.format("~s");
  // Custom formatter for dollars: replace "G" with "B"
  const formatDollar = (n: number) => d3.format("~s")(n).replace("G", "B");

  // Function to update line graph (common logic with animated transitions)
  const updateLineGraph = (
    svgRef: React.RefObject<SVGSVGElement | null>,
    aggregatedData: { x: number, y: number }[],
    lineColor: string,
    yLabel: string
  ) => {
    const svg = d3.select(svgRef.current)
      .attr("width", lineGraphWidth)
      .attr("height", lineGraphHeight);
    const margin = { top: 40, right: 20, bottom: 50, left: 60 };
    const innerWidth = lineGraphWidth - margin.left - margin.right;
    const innerHeight = lineGraphHeight - margin.top - margin.bottom;
    const t = d3.transition().duration(1000);
    
    // Choose tick formatter based on yLabel.
    //const tickFormatter = yLabel === "Value" ? (n: number) => formatDollar(n) : formatSI;
    const tickFormatter = yLabel === "Value"
      ? (n: d3.NumberValue, i: number) => formatDollar(+n)
      : (n: d3.NumberValue, i: number) => formatSI(+n);

    
    // Create or select main group.
    let g = svg.select<SVGGElement>("g.chart");
    if (g.empty()) {
      g = svg.append<SVGGElement>("g")
        .attr("class", "chart")
        .attr("transform", `translate(${margin.left},${margin.top})`);
      g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${innerHeight})`);
      g.append("g").attr("class", "y-axis");
    }
        
    // Scales
    const xScale = d3.scaleLinear()
      .domain(d3.extent(aggregatedData, d => d.x) as [number, number])
      .range([0, innerWidth]);
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(aggregatedData, d => d.y) || 100])
      .nice()
      .range([innerHeight, 0]);
    
    // Update axes with transitions
    g.select(".x-axis")
      .transition(t)
      .call((d3.axisBottom(xScale).tickFormat(d3.format("d"))) as any);
    g.select(".y-axis")
      .transition(t)
      .call((d3.axisLeft(yScale).tickFormat(tickFormatter)) as any);
    
    // Line generator
    const line = d3.line<any>()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(d3.curveMonotoneX);
    
    // Update the line path using data join
    const pathSelection = g.selectAll("path.line").data([aggregatedData]);
    pathSelection.join(
      enter => enter.append("path")
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", lineColor)
        .attr("stroke-width", 2)
        .attr("d", line),
      update => update.transition(t).attr("d", line),
      exit => exit.remove()
    );
    
    // Update circles using keyed join on x value
    const circles = g.selectAll("circle").data(aggregatedData, d => (d as any).x);
    circles.join(
      enter => enter.append("circle")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", 4)
        .attr("fill", lineColor)
        .call(enter => enter.transition(t)
          .attr("cx", d => xScale(d.x))
          .attr("cy", d => yScale(d.y))),
      update => update.transition(t)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y)),
      exit => exit.remove()
    );
    
    // Update forecast vertical line at 2020 (dashed grey)
    const forecastLine = g.selectAll("line.forecast").data([2020]);
    forecastLine.join(
      enter => enter.append("line")
        .attr("class", "forecast")
        .attr("x1", xScale(2020))
        .attr("y1", 0)
        .attr("x2", xScale(2020))
        .attr("y2", innerHeight)
        .attr("stroke", "grey")
        .attr("stroke-dasharray", "4 4"),
      update => update.transition(t)
        .attr("x1", xScale(2020))
        .attr("x2", xScale(2020))
        .attr("y2", innerHeight),
      exit => exit.remove()
    );
    
    // Update tooltip events on circles
    g.selectAll("circle")
      .on("mouseover", function(event, d) {
        d3.select("#tooltip")
          .style("display", "block")
          .html(`Year: ${(d as any).x}<br/>${yLabel}: ${tickFormatter((d as any).y, 0)}`);
      })
      .on("mousemove", function(event) {
        d3.select("#tooltip")
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 20}px`);
      })
      .on("mouseout", function() {
        d3.select("#tooltip").style("display", "none");
      });
    
    // Update y-axis label (remove previous and add new)
    svg.selectAll("text.y-label").remove();
    svg.append("text")
      .attr("class", "y-label")
      .attr("text-anchor", "middle")
      .attr("transform", `rotate(-90)`)
      .attr("x", -lineGraphHeight / 2)
      .attr("y", 15)
      .text(yLabel);
  };

  // Draw line graph 1 (Tons over Years)
  useEffect(() => {
    if (!filteredFreightData || filteredFreightData.length === 0) return;
    // Aggregate data: group by Year summing Tons.
    // Multiply by 1000 to convert kilo-tons to tons.
    const aggregatedTons = Array.from(
      d3.rollups(
        filteredFreightData,
        v => d3.sum(v, d => d.Tons) * 1000,
        d => d.Year
      ),
      ([year, total]) => ({ x: +year, y: total })
    ).sort((a, b) => a.x - b.x);
    updateLineGraph(lineGraph1Ref, aggregatedTons, "steelblue", "Tons");
  }, [filteredFreightData]);

  // Draw line graph 2 (Value over Years)
  useEffect(() => {
    if (!filteredFreightData || filteredFreightData.length === 0) return;
    // Aggregate data: group by Year summing Value.
    // Multiply by 1,000,000 to convert million USD to dollars.
    const aggregatedValue = Array.from(
      d3.rollups(
        filteredFreightData,
        v => d3.sum(v, d => d.Value) * 1000000,
        d => d.Year
      ),
      ([year, total]) => ({ x: +year, y: total })
    ).sort((a, b) => a.x - b.x);
    updateLineGraph(lineGraph2Ref, aggregatedValue, "darkorange", "Value");
  }, [filteredFreightData]);

  return (
    <div className="flex gap-4 p-4" style={{ width: "1300px", margin: "0 auto" }}>
      {/* Left Panel: Filters */}
      <div className="w-1/6 p-4 border">
        <h2 className="text-lg font-bold">Filters</h2>
        {Object.keys(selectedFilters).map((filter) => (
          <div key={filter} className="mb-2">
            <label className="block text-sm font-medium capitalize">{filter}</label>
            <select
              className="w-full p-2 border"
              value={selectedFilters[filter as keyof typeof selectedFilters]}
              onChange={(e) =>
                setSelectedFilters({
                  ...selectedFilters,
                  [filter]: e.target.value
                })
              }
            >
              {filterOptions[filter as keyof typeof filterOptions].map((option, index) => (
                <option key={index} value={typeof option === "object" ? option.id : option}>
                  {typeof option === "object" ? option.name : option}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="mt-4 p-2 border bg-gray-100">
          <h3 className="font-bold">Selected Counties</h3>
          <p>{selectedCounties.size > 0 ? Array.from(selectedCounties).join(", ") : "All"}</p>
        </div>
      </div>

      {/* Center Panel: Map */}
      <div className="w-3/6 border p-4">
        <svg ref={mapSvgRef}></svg>
      </div>

      {/* Right Panel: Two line graphs */}
      <div className="w-2/6 flex flex-col gap-4 border p-4">
        <div className="flex flex-col items-center">
          <h3 className="font-bold mb-2">Tons over Years</h3>
          <svg ref={lineGraph1Ref}></svg>
        </div>
        <div className="flex flex-col items-center">
          <h3 className="font-bold mb-2">Value over Years</h3>
          <svg ref={lineGraph2Ref}></svg>
        </div>
      </div>
    </div>
  );
};

export default WashingtonMapWithLineGraphs;
