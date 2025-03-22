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
  const selectedCountiesRef = useRef<Set<string>>(new Set());

  const [freightCSVData, setFreightCSVData] = useState<FreightData[]>([]);

  const [waCountyIDs, setWaCountyIDs] = useState<Set<string>>(new Set());
  const [waCountyMapping, setWaCountyMapping] = useState<Record<string, string>>({});

  const [filterOptions] = useState({
    commodityGroup: [
      "All",
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
    commodityGroup: "All",
    tradeType: "all",
    mode: "all",
  });

  const container = mapSvgRef.current?.parentElement;
  const mapWidth = container?.clientWidth || 600;
  const mapHeight = container?.clientHeight || 500;

  const lineGraphWidth = 300, lineGraphHeight = 240;

  // Tooltip: Create once on mount if it doesn't exist.
  useEffect(() => {
    let tooltip = d3.select("body").select("#tooltip");
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
      console.log("Tooltip created:", tooltip.node());
    }
  }, []);

  useEffect(() => {
    selectedCountiesRef.current = selectedCounties;
    const svg = d3.select(mapSvgRef.current);
    svg.selectAll(".county")
      .attr("fill", d =>
        selectedCounties.has((d as any).properties.NAME) ? "#007bff" : "#ccc"
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

    const countyFilterSet: Set<string> = new Set(
      Array.from(selectedCounties)
        .map(name => waCountyMapping[name])
        .filter(id => id !== undefined)
    );

    if (selectedCounties.size > 0 && countyFilterSet.size === 0) return [];

    return freightCSVData.filter(d => {
      let pass = true;
      if (selectedCounties.size > 0) {
        pass = countyFilterSet.has(d["Origin County"]);
      }
      if (selectedFilters.commodityGroup !== "All") {
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
  }, [freightCSVData, selectedFilters, selectedCounties, waCountyMapping]);

  // Draw the Washington map with counties.
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
      .scale(Math.min(mapWidth, mapHeight) * 9)
      .translate([mapWidth / 2, mapHeight / 2]);
    const path = d3.geoPath().projection(projection);
    let tooltip = d3.select("body").select("#tooltip");

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
          .attr("d", (d) => path(d as GeoJSON.Feature<GeoJSON.Geometry, any>) || "")
          .attr("stroke", "#333")
          .attr("stroke-width", 1)
          .attr("fill", d => selectedCountiesRef.current.has((d as any).properties.NAME) ? "#007bff" : "#ccc")
          .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "orange");
            tooltip.style("display", "block")
              .html(`<strong>${(d as any).properties.NAME}</strong>`)
              .style("left", `${event.pageX + 10}px`)
              .style("top", `${event.pageY - 20}px`);
            console.log("Mouseover event:", event.pageX, event.pageY);
            console.log("Tooltip set to:", event.pageX + 10, event.pageY - 20);
          })
          .on("mousemove", function(event, d) {
            tooltip.style("left", `${event.pageX + 10}px`)
              .style("top", `${event.pageY - 20}px`);
            console.log("Mousemove event at:", event.pageX, event.pageY);
          })
          .on("mouseout", function(event, d) {
            const isSelected = selectedCountiesRef.current.has((d as any).properties.NAME);
            d3.select(this)
              .transition()
              .duration(200)
              .attr("fill", isSelected ? "#007bff" : "#ccc");
            tooltip.style("display", "none");
            console.log("Mouseout event: Tooltip hidden");
          })
          .on("click", function(event, d) {
            setSelectedCounties(prev => {
              const newSet = new Set(prev);
              const countyName = (d as any).properties.NAME;
              if (newSet.has(countyName)) {
                newSet.delete(countyName);
                console.log("County deselected:", countyName);
              } else {
                newSet.add(countyName);
                console.log("County selected:", countyName);
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

  // Function to update line graph 
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
    
    const tickFormatter = yLabel === "Value"
      ? (n: d3.NumberValue, i: number) => formatDollar(+n)
      : (n: d3.NumberValue, i: number) => formatSI(+n);
    
    let g = svg.select<SVGGElement>("g.chart");
    if (g.empty()) {
      g = svg.append<SVGGElement>("g")
        .attr("class", "chart")
        .attr("transform", `translate(${margin.left},${margin.top})`);
      g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${innerHeight})`);
      g.append("g").attr("class", "y-axis");
    }
        
    const xScale = d3.scaleLinear()
      .domain(d3.extent(aggregatedData, d => d.x) as [number, number])
      .range([0, innerWidth]);
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(aggregatedData, d => d.y) || 100])
      .nice()
      .range([innerHeight, 0]);
    
    g.select(".x-axis")
      .transition(t)
      .call((d3.axisBottom(xScale).tickFormat(d3.format("d"))) as any);
    g.select(".y-axis")
      .transition(t)
      .call((d3.axisLeft(yScale).tickFormat(tickFormatter)) as any);
    
    const line = d3.line<any>()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(d3.curveMonotoneX);
    
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
    
    g.selectAll("circle")
      .on("mouseover", function(event, d) {
        d3.select("#tooltip")
          .style("display", "block")
          .html(`Year: ${(d as any).x}<br/>${yLabel}: ${tickFormatter((d as any).y, 0)}`);
        console.log("Line graph circle mouseover at:", event.pageX, event.pageY);
      })
      .on("mousemove", function(event) {
        d3.select("#tooltip")
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 20}px`);
      })
      .on("mouseout", function() {
        d3.select("#tooltip").style("display", "none");
      });
    
    svg.selectAll("text.y-label").remove();
    svg.append("text")
      .attr("class", "y-label")
      .attr("text-anchor", "middle")
      .attr("transform", `rotate(-90)`)
      .attr("x", -lineGraphHeight / 2)
      .attr("y", 15)
      .text(yLabel);
  };

  useEffect(() => {
    if (!filteredFreightData || filteredFreightData.length === 0) return;
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

  useEffect(() => {
    if (!filteredFreightData || filteredFreightData.length === 0) return;
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
    <div className="flex gap-4 p-4" style={{ width: "100%", margin: "0 auto" }}>
      <div className="w-1/6 p-4 border"  style={{borderRadius: 8}}>
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
          <h2 className="text-base  font-bold">Selected Counties</h2>
          <p>{selectedCounties.size > 0 ? Array.from(selectedCounties).join(", ") : "All"}</p>
        </div>
      </div>

      <div className="w-3/6 border p-4 " style={{borderRadius: 8}}>
        <svg ref={mapSvgRef} className="w-full h-full" />
      </div>

      <div className="w-2/6 flex flex-col gap-4 border p-4" style={{borderRadius: 8}}>
        <div className="flex flex-col items-center">
          <h2 className="text-lg font-bold">Tons over Years</h2>
          <svg ref={lineGraph1Ref}></svg>
        </div>
        <div className="flex flex-col items-center">
          <h2 className="text-lg font-bold">Value over Years</h2>
          <svg ref={lineGraph2Ref}></svg>
        </div>
      </div>
    </div>
  );
};

export default WashingtonMapWithLineGraphs;
