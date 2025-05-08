// @ts-nocheck
'use client';

import Papa from "papaparse";
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { regressionLinear } from 'd3-regression';

export interface CountyCsvRow {
  County: string;
  Year: number;
  Population: number;
  Source: string;
  rate: number;
}

interface StateDataPoint {
  year: number;
  population: number;
  growthRate?: number;
  source: string;
}

interface BridgeRow {
  CountyName: string;
  BridgeOverallConditionState: string;
  PrpsedImprvTotalCost: number;
}

interface FreightRow {
  Year: number;
  Tons: number;
  Value: number;
  ["Origin County"]?: string;
}

const Dashboard: React.FC = () => {
  const [countyData, setCountyData] = useState<Record<string, CountyCsvRow[]>>({});
  const [stateData, setStateData] = useState<StateDataPoint[]>([]);
  const [selectedCounties, setSelectedCounties] = useState<Set<string>>(new Set());
  const [bridgeData, setBridgeData] = useState<BridgeRow[]>([]);
  const [freightData, setFreightData] = useState<FreightRow[]>([]);
  const [waCountyMapping, setWaCountyMapping] = useState<Record<string, string>>({});
  const growthChartContainerRef = useRef<HTMLDivElement>(null);
  const popChartContainerRef = useRef<HTMLDivElement>(null);
  const tonsChartRef = useRef<SVGSVGElement>(null);
  const valueChartRef = useRef<SVGSVGElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const mapRef = useRef<SVGSVGElement>(null);
  const geoDataRef = useRef<any>(null);
  const bridgeChartRef = useRef<SVGSVGElement>(null);

  // Load county CSV
  useEffect(() => {
    d3.csv<CountyCsvRow>('/county_data.csv', row => ({
      County: row.County,
      Year: +row.Year,
      Population: +row.Population,
      Source: row.Source,
      rate: +row.rate,
    }))
      .then(rows => {
        const grouped: Record<string, CountyCsvRow[]> = {};
        rows.forEach(r => {
          if (!grouped[r.County]) grouped[r.County] = [];
          grouped[r.County].push(r);
        });
        Object.values(grouped).forEach(arr => arr.sort((a, b) => a.Year - b.Year));
        setCountyData(grouped);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    d3.json('/data/freight/counties.geojson').then((geo: any) => {
      const mapping: Record<string, string> = {};
      geo.features
        .filter((f: any) => f.properties.STATEFP === '53')
        .forEach((f: any) => {
          const name = f.properties.NAME.trim();
          const id = f.properties.GEOID ?? (f.properties.STATEFP + f.properties.COUNTYFP);
          mapping[name] = id;
        });
      setWaCountyMapping(mapping);
    });
  }, []);

  useEffect(() => {
    fetch('/Bridge Needs GIS data.csv')
      .then(res => res.text())
      .then(text => {
        Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          complete: (result) => {
            const rows = result.data as any[];
            const cleaned = rows.map(row => ({
              CountyName: String(row.CountyName).trim(),
              BridgeOverallConditionState: String(row.BridgeOverallConditionState).trim(),
              PrpsedImprvTotalCost: +row.PrpsedImprvTotalCost || 0,
            }));
            setBridgeData(cleaned);
          },
        });
      });
  }, []);

  useEffect(() => {
      fetch('/data/freight/sample.csv')
        .then(res => res.text())
        .then(text => {
          Papa.parse<FreightRow>(text, {
            header: true,
            dynamicTyping: true,
            complete: result => {
              const cleaned = result.data.map(row => ({
                Year: +row.Year,
                Tons: +row.Tons,
                Value: +row.Value,
                "Origin County": String(row["Origin County"] || '').trim()
              }));

              console.log("Sample origin counties:", cleaned.slice(0, 10).map(d => d["Origin County"]));

              setFreightData(cleaned);
            }
          });
        });
    }, []);



  // Render map once
  useEffect(() => {
    let tooltip = d3.select("body").select("#tooltip");
    if (tooltip.empty()) {
      // @ts-ignore
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

    d3.json('/data/freight/counties.geojson').then((geo: any) => {
      const svg = d3.select(mapRef.current);
      svg.selectAll("*").remove();

      const width = mapRef.current?.clientWidth || 300;
      const height = mapRef.current?.clientHeight || 250;

      const projection = d3.geoAlbers()
        .center([-0.6, 47.5])
        .rotate([120, 0])
        .parallels([48, 49])
        .scale(12 * Math.min(width, height))
        .translate([width / 2, height / 2]);

      const path = d3.geoPath().projection(projection);
      const counties = geo.features.filter((f: any) => f.properties.STATEFP === '53');

      svg
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('width', '100%')
        .attr('height', '100%');

      const selectedRef = { current: selectedCounties };

      svg.selectAll("path")
        .data(counties)
        .join("path")
        .attr("class", "county")
        .attr("d", path as any)
        .attr("stroke", "#333")
        .attr("fill", (d: any) =>
          selectedRef.current.has(d.properties.NAME) ? "#007bff" : "#ccc"
        )
        .on("mouseover", (event, d: any) => {
          d3.select(event.currentTarget).attr("fill", "orange");
          tooltip
            .style("display", "block")
            .html(`<strong>${d.properties.NAME}</strong>`)
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 20}px`);
        })
        .on("mousemove", (event) => {
          tooltip
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 20}px`);
        })
        .on("mouseout", (event, d: any) => {
          d3.select(event.currentTarget)
            .attr("fill", selectedRef.current.has(d.properties.NAME) ? "#007bff" : "#ccc");
          tooltip.style("display", "none");
        })
        .on("click", (event, d: any) => {
          const name = d.properties.NAME;
          setSelectedCounties((prev) => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            selectedRef.current = next;
            svg.selectAll("path")
              .attr("fill", (d: any) =>
                next.has(d.properties.NAME) ? "#007bff" : "#ccc"
              );
            return new Set(next);
          });
        });
    });
  }, []);

  // Update fill on selection change
  useEffect(() => {
    if (!geoDataRef.current) return;
    d3.select(mapRef.current)
      .selectAll('path')
      .attr('fill', (d: any) => selectedCounties.has(d.properties.NAME) ? '#007bff' : '#ccc');
  }, [selectedCounties]);

  // Aggregate population
  useEffect(() => {
    const counties = selectedCounties.size ? Array.from(selectedCounties) : Object.keys(countyData);
    const aggMap = new Map<number, number>();
    counties.forEach(c => {
      (countyData[c] || []).forEach(({ Year, Population }) => {
        aggMap.set(Year, (aggMap.get(Year) || 0) + Population);
      });
    });

    const years = Array.from(aggMap.keys()).sort((a, b) => a - b);
    const stateArr = years.map((year, i) => {
      const pop = aggMap.get(year)!;
      const prev = aggMap.get(years[i - 1]);
      return {
        year,
        population: pop,
        growthRate: prev ? (pop - prev) / prev : undefined,
      };
    });
    // @ts-ignore
    setStateData(stateArr);
  }, [countyData, selectedCounties]);

  // Population chart
  useEffect(() => {
    if (!stateData.length) return;

    const data = stateData.map(d => ({
      x: d.year,
      y: d.population,
    }));

    const svg = d3.select(svgRef.current)
      .attr("width", "100%")
      .attr("height", 350)
      .style("overflow", "visible");

    const margin = { top: 40, right: 20, bottom: 50, left: 60 };
    const container = popChartContainerRef.current;
    const w = container?.clientWidth || 600;

    const h = 350;
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;
    const t = d3.transition().duration(800);

    const g = svg.select("g.chart").empty()
      ? svg.append("g")
          .attr("class", "chart")
          .attr("transform", `translate(${margin.left},${margin.top})`)
      : svg.select("g.chart");

    // @ts-ignore
    g.selectAll("*").interrupt();

    const xScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.x) as [number, number])
      .range([0, innerW]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.y)!])
      .nice()
      .range([innerH, 0]);

    // @ts-ignore
    g.selectAll(".x-axis").data([0]).join("g")
      // @ts-ignore
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerH})`)
      .transition(t)
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

    // @ts-ignore
    g.selectAll(".y-axis").data([0]).join("g")
      // @ts-ignore
      .attr("class", "y-axis")
      .transition(t)
      .call(d3.axisLeft(yScale).tickFormat(d3.format("~s")));

    const line = d3.line<{ x: number; y: number }>()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(d3.curveMonotoneX);

    // @ts-ignore
    g.selectAll("path.line").data([data])
      .join(
        enter => enter.append("path")
          .attr("class", "line")
          .attr("fill", "none")
          .attr("stroke", "#3b82f6")
          .attr("stroke-width", 2)
          .attr("d", line),
        // @ts-ignore
        update => update.transition(t).attr("d", line),
        exit => exit.remove()
      );

    // @ts-ignore
    const circles = g.selectAll("circle").data(data, (d: any) => d.x).join(
      enter => enter.append("circle")
        .attr("r", 3)
        .attr("fill", "#3b82f6")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y)),
      // @ts-ignore
      update => update.transition(t)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y)),
      exit => exit.remove()
    );

    // @ts-ignore
    g.selectAll("line.forecast").data([2020]).join(
      enter => enter.append("line")
        .attr("class", "forecast")
        .attr("x1", xScale(2020))
        .attr("x2", xScale(2020))
        .attr("y1", 0)
        .attr("y2", innerH)
        .attr("stroke", "gray")
        .attr("stroke-dasharray", "4 4"),
      // @ts-ignore
      update => update.transition(t)
        .attr("x1", xScale(2020))
        .attr("x2", xScale(2020))
        .attr("y2", innerH),
      exit => exit.remove()
    );

    let tooltip = d3.select("body").select("#tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select("body").append("div")
        .attr("id", "tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("padding", "5px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "5px")
        .style("pointer-events", "none")
        .style("display", "none");
    }

    circles
      .on("mouseover", (event, d: any) => {
        tooltip
          .style("display", "block")
          .html(`Year: ${d.x}<br/>Population: ${d3.format("~s")(d.y)}`);
      })
      .on("mousemove", event => {
        tooltip
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 20}px`);
      })
      .on("mouseout", () => {
        tooltip.style("display", "none");
      });

    svg.selectAll("text.y-label").remove();
    svg.append("text")
      .attr("class", "y-label")
      .attr("text-anchor", "middle")
      .attr("transform", `rotate(-90)`)
      .attr("x", -h / 2)
      .attr("y", 15)
      .text("Population");
  }, [stateData]);

  // Growth rate viz

  useEffect(() => {
    if (!stateData.length) return;

    const data = stateData
      .filter(d => isFinite(d.growthRate ?? NaN))
      .map(d => ({
        x: d.year,
        y: d.growthRate ?? 0
      }));

    const container = growthChartContainerRef.current;
    const w = container?.clientWidth || 300;
    const h = 350;
    const margin = { top: 40, right: 20, bottom: 50, left: 60 };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;
    const t = d3.transition().duration(800);

    const svg = d3.select("#growthChart")
      .attr("width", w)
      .attr("height", h)
      .style("overflow", "visible");

    const g = svg.select("g.chart").empty()
      ? svg.append("g")
          .attr("class", "chart")
          .attr("transform", `translate(${margin.left},${margin.top})`)
      : svg.select("g.chart");

    g.selectAll("*").interrupt();

    const xScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.x) as [number, number])
      .range([0, innerW]);

    const yScale = d3.scaleLinear()
      .domain([-0.15, 0.15]) // -15% to +15%
      .range([innerH, 0]);

    g.selectAll(".x-axis").data([0]).join("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerH})`)
      .transition(t)
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

    g.selectAll(".y-axis").data([0]).join("g")
      .attr("class", "y-axis")
      .transition(t)
      .call(d3.axisLeft(yScale).tickFormat(d => `${(d as number * 100).toFixed(1)}%`));

    const line = d3.line<{ x: number; y: number }>()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(d3.curveMonotoneX);

    g.selectAll("path.line").data([data])
      .join(
        enter => enter.append("path")
          .attr("class", "line")
          .attr("fill", "none")
          .attr("stroke", "orange")
          .attr("stroke-width", 2)
          .attr("d", line),
        update => update.transition(t).attr("d", line),
        exit => exit.remove()
      );

    // Trend line using d3-regression
    const regression = regressionLinear()
      .x(d => d.x)
      .y(d => d.y)(data as any);

    g.selectAll("path.trend").data([regression])
      .join(
        enter => enter.append("path")
          .attr("class", "trend")
          .attr("stroke", "grey")
          .attr("stroke-width", 1)
          .attr("fill", "none")
          .attr("d", d3.line()
            .x(d => xScale(d[0]))
            .y(d => yScale(d[1]))
          ),
        update => update.transition(t)
          .attr("d", d3.line()
            .x(d => xScale(d[0]))
            .y(d => yScale(d[1]))
          ),
        exit => exit.remove()
      );

    // Dashed forecast line at 2020
    g.selectAll("line.forecast").data([2020]).join(
      enter => enter.append("line")
        .attr("class", "forecast")
        .attr("x1", xScale(2020))
        .attr("x2", xScale(2020))
        .attr("y1", 0)
        .attr("y2", innerH)
        .attr("stroke", "gray")
        .attr("stroke-dasharray", "4 4"),
      update => update.transition(t)
        .attr("x1", xScale(2020))
        .attr("x2", xScale(2020))
        .attr("y2", innerH),
      exit => exit.remove()
    );

    const circles = g.selectAll("circle").data(data, (d: any) => d.x).join(
      enter => enter.append("circle")
        .attr("r", 3)
        .attr("fill", "orange")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y)),
      update => update.transition(t)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y)),
      exit => exit.remove()
    );

    let tooltip = d3.select("body").select("#tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select("body").append("div")
        .attr("id", "tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("padding", "5px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "5px")
        .style("pointer-events", "none")
        .style("display", "none");
    }

    circles
      .on("mouseover", (event, d: any) => {
        tooltip
          .style("display", "block")
          .html(`Year: ${d.x}<br/>Growth Rate: ${(d.y * 100).toFixed(2)}%`);
      })
      .on("mousemove", event => {
        tooltip
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 20}px`);
      })
      .on("mouseout", () => {
        tooltip.style("display", "none");
      });

    svg.selectAll("text.y-label").remove();
    svg.append("text")
      .attr("class", "y-label")
      .attr("text-anchor", "middle")
      .attr("transform", `rotate(-90)`)
      .attr("x", -h / 2)
      .attr("y", 15)
      .text("Growth Rate");
  }, [stateData]);

  // Freight tons over year
  useEffect(() => {
    if (!freightData.length || !Object.keys(waCountyMapping).length) return;

    const countyIds = new Set(
      Array.from(selectedCounties)
        .map(name => waCountyMapping[name])
        .filter(Boolean)
    );

    const selected = freightData
      .filter(d => countyIds.size === 0 || countyIds.has(d["Origin County"]))
      .filter(d => isFinite(d.Tons));

    const data = Array.from(
      d3.rollups(selected, v => d3.sum(v, d => d.Tons * 1000), d => d.Year),
      ([year, value]) => ({ x: +year, y: value })
    ).sort((a, b) => a.x - b.x);

    const svg = d3.select(tonsChartRef.current)
      .attr("width", 300)
      .attr("height", 200)
      .style("overflow", "visible");

    const margin = { top: 40, right: 20, bottom: 50, left: 60 };
    const w = 300, h = 200;
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;
    const t = d3.transition().duration(800);

    const g = svg.select("g.chart").empty()
      ? svg.append("g")
          .attr("class", "chart")
          .attr("transform", `translate(${margin.left},${margin.top})`)
      : svg.select("g.chart");

    g.selectAll("*").interrupt(); // avoid race conditions

    const xScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.x) as [number, number])
      .range([0, innerW]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.y)!])
      .nice()
      .range([innerH, 0]);

    g.selectAll(".x-axis").data([0]).join("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerH})`)
      .transition(t)
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

    g.selectAll(".y-axis").data([0]).join("g")
      .attr("class", "y-axis")
      .transition(t)
      .call(d3.axisLeft(yScale).tickFormat(d3.format("~s")));

    const line = d3.line<{ x: number; y: number }>()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(d3.curveMonotoneX);

    g.selectAll("path.line").data([data])
      .join(
        enter => enter.append("path")
          .attr("class", "line")
          .attr("fill", "none")
          .attr("stroke", "steelblue")
          .attr("stroke-width", 2)
          .attr("d", line),
        update => update.transition(t).attr("d", line),
        exit => exit.remove()
      );

    const circles = g.selectAll("circle").data(data, (d: any) => d.x).join(
      enter => enter.append("circle")
        .attr("r", 4)
        .attr("fill", "steelblue")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y)),
      update => update.transition(t)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y)),
      exit => exit.remove()
    );

    g.selectAll("line.forecast").data([2020]).join(
      enter => enter.append("line")
        .attr("class", "forecast")
        .attr("x1", xScale(2020))
        .attr("x2", xScale(2020))
        .attr("y1", 0)
        .attr("y2", innerH)
        .attr("stroke", "gray")
        .attr("stroke-dasharray", "4 4"),
      update => update.transition(t)
        .attr("x1", xScale(2020))
        .attr("x2", xScale(2020))
        .attr("y2", innerH),
      exit => exit.remove()
    );

    let tooltip = d3.select("body").select("#tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select("body").append("div")
        .attr("id", "tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("padding", "5px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "5px")
        .style("pointer-events", "none")
        .style("display", "none");
    }

    circles
      .on("mouseover", (event, d: any) => {
        tooltip
          .style("display", "block")
          .html(`Year: ${d.x}<br/>Tons: ${d3.format("~s")(d.y)}`);
      })
      .on("mousemove", event => {
        tooltip
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 20}px`);
      })
      .on("mouseout", () => {
        tooltip.style("display", "none");
      });

    // Optional: add Y-axis label like original
    svg.selectAll("text.y-label").remove();
    svg.append("text")
      .attr("class", "y-label")
      .attr("text-anchor", "middle")
      .attr("transform", `rotate(-90)`)
      .attr("x", -h / 2)
      .attr("y", 15)
      .text("Tons");
  }, [freightData, selectedCounties, waCountyMapping]);


  // Freight value over years
  useEffect(() => {
    if (!freightData.length || !Object.keys(waCountyMapping).length) return;

    const countyIds = new Set(
      Array.from(selectedCounties)
        .map(name => waCountyMapping[name])
        .filter(Boolean)
    );

    const selected = freightData
      .filter(d => countyIds.size === 0 || countyIds.has(d["Origin County"]))
      .filter(d => isFinite(d.Value));

    const data = Array.from(
      d3.rollups(selected, v => d3.sum(v, d => d.Value * 1e6), d => d.Year),
      ([year, value]) => ({ x: +year, y: value })
    ).sort((a, b) => a.x - b.x);

    const svg = d3.select(valueChartRef.current)
      .attr("width", 300)
      .attr("height", 200)
      .style("overflow", "visible");

    const margin = { top: 40, right: 20, bottom: 50, left: 60 };
    const w = 300, h = 200;
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;
    const t = d3.transition().duration(800);

    const g = svg.select("g.chart").empty()
      ? svg.append("g")
          .attr("class", "chart")
          .attr("transform", `translate(${margin.left},${margin.top})`)
      : svg.select("g.chart");

    g.selectAll("*").interrupt();

    const xScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.x) as [number, number])
      .range([0, innerW]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.y)!])
      .nice()
      .range([innerH, 0]);

    g.selectAll(".x-axis").data([0]).join("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerH})`)
      .transition(t)
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

    g.selectAll(".y-axis").data([0]).join("g")
      .attr("class", "y-axis")
      .transition(t)
      .call(d3.axisLeft(yScale).tickFormat(d => `$${d3.format("~s")(d).replace("G", "B")}`));

    const line = d3.line<{ x: number; y: number }>()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(d3.curveMonotoneX);

    g.selectAll("path.line").data([data])
      .join(
        enter => enter.append("path")
          .attr("class", "line")
          .attr("fill", "none")
          .attr("stroke", "darkorange")
          .attr("stroke-width", 2)
          .attr("d", line),
        update => update.transition(t).attr("d", line),
        exit => exit.remove()
      );

    const circles = g.selectAll("circle").data(data, (d: any) => d.x).join(
      enter => enter.append("circle")
        .attr("r", 4)
        .attr("fill", "darkorange")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y)),
      update => update.transition(t)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y)),
      exit => exit.remove()
    );

    g.selectAll("line.forecast").data([2020]).join(
      enter => enter.append("line")
        .attr("class", "forecast")
        .attr("x1", xScale(2020))
        .attr("x2", xScale(2020))
        .attr("y1", 0)
        .attr("y2", innerH)
        .attr("stroke", "gray")
        .attr("stroke-dasharray", "4 4"),
      update => update.transition(t)
        .attr("x1", xScale(2020))
        .attr("x2", xScale(2020))
        .attr("y2", innerH),
      exit => exit.remove()
    );

    let tooltip = d3.select("body").select("#tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select("body").append("div")
        .attr("id", "tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("padding", "5px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "5px")
        .style("pointer-events", "none")
        .style("display", "none");
    }

    circles
      .on("mouseover", (event, d: any) => {
        tooltip
          .style("display", "block")
          .html(`Year: ${d.x}<br/>Value: $${d3.format("~s")(d.y).replace("G", "B")}`);
      })
      .on("mousemove", event => {
        tooltip
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 20}px`);
      })
      .on("mouseout", () => {
        tooltip.style("display", "none");
      });

    svg.selectAll("text.y-label").remove();
    svg.append("text")
      .attr("class", "y-label")
      .attr("text-anchor", "middle")
      .attr("transform", `rotate(-90)`)
      .attr("x", -h / 2)
      .attr("y", 15)
      .text("Value");
  }, [freightData, selectedCounties, waCountyMapping]);


  // Bridge Conditions Chart
  useEffect(() => {
    const normalizedSelected = Array.from(selectedCounties).map(c => c.trim().toLowerCase());

    const filtered = selectedCounties.size
      ? bridgeData.filter(b => {
          const county = (b.CountyName || "")
            .replace(/ county$/i, "")
            .trim()
            .toLowerCase();
          return normalizedSelected.includes(county);
        })
      : bridgeData;

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
        .style("pointer-events", "none")
        .style("display", "none");
    }

    const conditionCounts = d3.rollups(
      filtered,
      v => v.length,
      d => d.BridgeOverallConditionState || 'Unknown'
    );

    const conditionsOrder = ["Good", "Fair", "Poor"];

    const chartData = conditionsOrder.map(condition => {
      const match = conditionCounts.find(([c]) => c === condition);
      return {
        condition,
        count: match ? match[1] : 0
      };
    });


    const totalImprovementCost = d3.sum(filtered, d => d.PrpsedImprvTotalCost);
    const totalBridges = filtered.length;

    const svg = d3.select(bridgeChartRef.current);
    const width = 300;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const t = d3.transition().duration(800);

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // Create chart group if missing
    let g = svg.select("g.chart");
    if (g.empty()) {
      g = svg.append("g")
        .attr("class", "chart")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    }

    // Scales

    

    const x = d3.scaleBand()
      .domain(conditionsOrder)
      .range([0, innerW])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.count)!])
      .nice()
      .range([innerH, 0]);

    // Update X axis
    g.selectAll(".x-axis").data([0]).join("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerH})`)
      .transition(t)
      .call(d3.axisBottom(x));

    // Update Y axis
    g.selectAll(".y-axis").data([0]).join("g")
      .attr("class", "y-axis")
      .transition(t)
      .call(d3.axisLeft(y));

    // Bars
    const bars = g.selectAll("rect.bar")
      .data(chartData, (d: any) => d.condition);

    bars.join(
      enter => enter.append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.condition)!)
        .attr("width", x.bandwidth())
        .attr("y", innerH)
        .attr("height", 0)
        .attr("fill", d => {
          if (d.condition === "Good") return "#4caf50";
          if (d.condition === "Fair") return "#ff9800";
          return "#f44336";
        })
        .on("mouseover", (event, d) => {
          tooltip
            .style("display", "block")
            .html(`<strong>${d.condition}:</strong> ${d.count} bridges`)
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 20}px`);
        })
        .on("mousemove", event => {
          tooltip
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 20}px`);
        })
        .on("mouseout", () => {
          tooltip.style("display", "none");
        })
        .transition(t)
        .attr("y", d => y(d.count))
        .attr("height", d => innerH - y(d.count)),

      update => update.transition(t)
        .attr("x", d => x(d.condition)!)
        .attr("width", x.bandwidth())
        .attr("y", d => y(d.count))
        .attr("height", d => innerH - y(d.count)),

      exit => exit
        .transition(t)
        .attr("y", innerH)
        .attr("height", 0)
        .remove()
    );

    // Update summary box
    const summary = document.getElementById("bridge-summary");
    if (summary) {
      summary.innerHTML = `
        <div><strong>Total Bridges</strong><br/><span class="text-2xl">${totalBridges.toLocaleString()}</span></div>
        <div><strong>Proposed Cost</strong><br/><span class="text-2xl">$${(totalImprovementCost / 1e6).toFixed(1)}M</span></div>
      `;
    }
  }, [bridgeData, selectedCounties]);



  return (
    <div className="p-6 space-y-6">
  <h1 className="text-3xl font-bold mb-4">Washington State County Dashboard</h1>

  <div className="grid grid-cols-3 gap-6">
    <div className="bg-white border p-4 rounded shadow h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-2">Select Counties</h2>
      <div className="flex-grow relative">
        <svg ref={mapRef} className="w-full h-full" />
      </div>
    </div>

    <div className="col-span-2 grid grid-cols-2 gap-6">
      <div className="bg-white border p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Population Over Time</h2>
        <div ref={popChartContainerRef} className="w-full h-[350px]">
          <svg ref={svgRef} className="w-full h-full" />
        </div>
      </div>

      <div className="bg-white border p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Population Growth Rate</h2>
        <div ref={growthChartContainerRef} className="w-full h-[350px]">
          <svg id="growthChart" className="w-full h-full" />
        </div>
      </div>

    </div>
  </div>

  <div className="grid grid-cols-2 gap-6">
    <div className="bg-white border p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-4">Bridge Conditions</h2>
      <div className="flex gap-6">
        <svg ref={bridgeChartRef} className="w-1/2 h-[200px]" />
        <div id="bridge-summary" className="w-1/2 flex flex-col justify-center items-start space-y-2 text-lg"></div>
      </div>
    </div>

    <div className="bg-white border p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-2">Freight Over Time</h2>
      <div className="grid grid-cols-2 gap-6">
        <div className="p-2">
          <h3 className="text-md font-medium mb-1">Tons Over Years</h3>
          <svg ref={tonsChartRef} className="w-full h-[200px]" />
        </div>
        <div className="p-2">
          <h3 className="text-md font-medium mb-1">Value Over Years</h3>
          <svg ref={valueChartRef} className="w-full h-[200px]" />
        </div>
      </div>
    </div>
  </div>
</div>

  );
};

export default Dashboard;
