// @ts-nocheck
'use client';

import Papa from "papaparse";
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { regressionLinear } from 'd3-regression';
import MapboxChoroplethMap from './MapboxChoroplethMap';

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

const Population: React.FC = () => {

  const [countyData, setCountyData] = useState<Record<string, CountyCsvRow[]>>({});
  const [transformedCountyData, setTransformedCountyData] = useState<Record<string, CountyData>>({});

  const [stateData, setStateData] = useState<StateDataPoint[]>([]);
  const [selectedCounties, setSelectedCounties] = useState<Set<string>>(new Set());
  const [waCountyMapping, setWaCountyMapping] = useState<Record<string, string>>({});
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON.FeatureCollection | null>(null);

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const chipWrapperRef = useRef<HTMLDivElement>(null);

  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const chipContainerRef = useRef<HTMLDivElement>(null);

  const chipVisibleRef = useRef<HTMLDivElement>(null);
  const chipMeasureRef = useRef<HTMLDivElement>(null);
  const [showEllipsis, setShowEllipsis] = useState(false);

  const [firstLineCount, setFirstLineCount] = useState(0);

  const growthChartContainerRef = useRef<HTMLDivElement>(null);
  const popChartContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [choroplethYear, setChoroplethYear] = useState<number>(2020); // default year

  const [showScroll, setShowScroll] = useState(false);

  useEffect(() => {
    if (!isSidebarHovered || !chipContainerRef.current) {
      setShowScroll(false);
      return;
    }

    const container = chipContainerRef.current;
    const contentHeight = container.scrollHeight;
    const maxHeight = 160; // ~4 rows

    setShowScroll(contentHeight > maxHeight);
  }, [isSidebarHovered, selectedCounties]);


  useEffect(() => {
    d3.json('/data/freight/counties.geojson')
      .then(data => {
        //console.log("Loaded GeoJSON:", data);
        setGeoJsonData(data as GeoJSON.FeatureCollection);
      })
      .catch(err => {
        //console.error("Failed to load GeoJSON:", err);
      });
  }, []);

 



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

        //Add this transformation
        const transformed: Record<string, CountyData> = {};
        Object.entries(grouped).forEach(([county, records]) => {
          transformed[county] = {
            growthRates: records.reduce((acc, r) => {
              acc[r.Year] = r.rate;
              return acc;
            }, {} as Record<number, number>),
            population: records.reduce((acc, r) => {
              acc[r.Year] = r.Population;
              return acc;
            }, {} as Record<number, number>)
          };
        });
        setTransformedCountyData(transformed); 
      })
      .catch(console.error);
  }, []);

  const countyGrowthMap = new Map<string, number>();

  Object.entries(countyData).forEach(([county, records]) => {
    const thisYear = records.find(r => r.Year === choroplethYear);
    const prevYear = records.find(r => r.Year === choroplethYear - 1);
    if (thisYear && prevYear && prevYear.Population > 0) {
      const rate = (thisYear.Population - prevYear.Population) / prevYear.Population;
      countyGrowthMap.set(county, rate);
    }
  });

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
    if (!stateData.length || !popChartContainerRef.current || !svgRef.current) return;

    const container = popChartContainerRef.current;
    const svg = d3.select(svgRef.current);
    const margin = { top: 6, right: 12, bottom: 18, left: 45 };

    const render = () => {

      const w = container.clientWidth;
      const h = container.clientHeight;
      const innerW = w - margin.left - margin.right;
      const innerH = h - margin.top - margin.bottom;

      const data = stateData.map(d => ({ x: d.year, y: d.population })).slice(1);
      const t = d3.transition().duration(500);


      svg.attr("width", w).attr("height", h).style("overflow", "visible");

      const g = svg.select("g.chart").empty()
        ? svg.append("g")
            .attr("class", "chart")
            .attr("transform", `translate(${margin.left},${margin.top})`)
        : svg.select("g.chart").attr("transform", `translate(${margin.left},${margin.top})`);

      g.selectAll("path.trend").remove();

      const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x) as [number, number])
        .range([0, innerW]);

      const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.y)!])
        .nice()
        .range([innerH, 0]);

      g.selectAll(".x-axis")
        .data([0])
        .join("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${innerH})`)
        .transition(t)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

      g.selectAll(".y-axis")
        .data([0])
        .join("g")
        .attr("class", "y-axis")
        .transition(t)
        .call(d3.axisLeft(yScale).tickFormat(d3.format("~s")));

      const line = d3.line<{ x: number; y: number }>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveMonotoneX);

      g.selectAll("path.line")
        .data([data])
        .join(
          enter => enter.append("path")
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", "#3b82f6")
            .attr("stroke-width", 2)
            .attr("d", line),
          update => update.transition(t).attr("d", line),
          exit => exit.remove()
        );

      g.selectAll("circle")
        .data(data, d => d.x)
        .join(
          enter => enter.append("circle")
            .attr("r", d => d.x === choroplethYear ? 4 : 3)
            .attr("fill", "#3b82f6")
            .attr("stroke", d => d.x === choroplethYear ? "#3068C9" : "none")
            .attr("stroke-width", d => d.x === choroplethYear ? 1.5 : 0)
            .attr("cx", d => xScale(d.x))
            .attr("cy", d => yScale(d.y))
            .style("cursor", "pointer"),
          update => {
            update
            .attr("r", d => d.x === choroplethYear ? 4 : 3) // no transition
            .attr("stroke", d => d.x === choroplethYear ? "#3068C9" : "none")
            .attr("stroke-width", d => d.x === choroplethYear ? 1.5 : 0);

            update.transition(t)
              .attr("cx", d => xScale(d.x))
              .attr("cy", d => yScale(d.y))
          },
          exit => exit.remove()
        );

      g.selectAll("line.forecast")
        .data([2020])
        .join(
          enter => enter.append("line")
            .attr("class", "forecast")
            .attr("stroke", "gray")
            .attr("stroke-dasharray", "4 4")
            .attr("x1", xScale(2020))
            .attr("x2", xScale(2020))
            .attr("y1", 0)
            .attr("y2", innerH),
          update => update.transition(t)
            .attr("x1", xScale(2020))
            .attr("x2", xScale(2020))
            .attr("y2", innerH),
          exit => exit.remove()
        );

      // Label
      svg.selectAll("text.y-label").data([0]).join("text")
        .attr("class", "y-label")
        .attr("text-anchor", "middle")
        .attr("transform", `rotate(-90)`)
        .attr("x", -h / 2)
        .attr("y", 15)
        .text("Population");

      //Tooltip

      svg.selectAll("circle")
        .on("mouseover", (event, d) => {
          const population = d.y.toLocaleString() ?? "Unknown";
          const year = d.x ?? "N/A";

          d3.select("#tooltip")
            .style("display", "block")
            .html(`<strong>${year}</strong>: ${population}`);
        }) 
        .on("mousemove", (event) => {
          d3.select("#tooltip")
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 28}px`);
        })
        .on("mouseout", () => {
          d3.select("#tooltip").style("display", "none");
        })
        .on("click", function(event, d) {
          // Smoothly animate the year update over 200ms
          const start = choroplethYear;
          const end = d.x;
          const duration = 200;
          const step = (timestamp: number, startTime: number) => {
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const interpolated = Math.round(start + (end - start) * progress);
            setChoroplethYear(interpolated);
            if (progress < 1) {
              requestAnimationFrame(ts => step(ts, startTime));
            }
          };
          requestAnimationFrame(ts => step(ts, ts));

          //setChoroplethYear(d.x);
          d3.select(this)
            .transition()
            .duration(150)
            .attr("r", 7) // temporarily enlarge
            .transition()
            .duration(150)
            .attr("r", 4);
        });
    };

    render();

    let resizeTimer: number;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        requestAnimationFrame(render);
      }, 100); 
    });

    observer.observe(container);

    return () => observer.disconnect();


  }, [stateData, choroplethYear]);


  // Growth rate viz
  useEffect(() => {
    if (!stateData.length || !growthChartContainerRef.current) return;

    const container = growthChartContainerRef.current;
    const svg = d3.select("#growthChart");
    const margin = { top: 5, right: 12, bottom: 17, left: 55 };

    const render = () => {
      const data = stateData
        .filter(d => isFinite(d.growthRate ?? NaN))
        .map(d => ({ x: d.year, y: d.growthRate ?? 0 }));

      const maxAbs = d3.max(data, d => Math.abs(d.y)) ?? 1;
      const yDomain = [-maxAbs, maxAbs];

      const w = container.clientWidth;
      const h = container.clientHeight;
      const innerW = w - margin.left - margin.right;
      const innerH = h - margin.top - margin.bottom;

      const t = d3.transition().duration(500);

      svg.attr("width", w).attr("height", h).style("overflow", "visible");

      const g = svg.select("g.chart").empty()
        ? svg.append("g")
            .attr("class", "chart")
            .attr("transform", `translate(${margin.left},${margin.top})`)
        : svg.select("g.chart").attr("transform", `translate(${margin.left},${margin.top})`);

      const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x) as [number, number])
        .range([0, innerW]);

      const yScale = d3.scaleLinear()
        .domain([-maxAbs, maxAbs])
        .range([innerH, 0]);

      // X-axis line at y = 0 (middle), with invisible ticks/labels
      g.selectAll(".x-axis-line")
        .data([0])
        .join("g")
        .attr("class", "x-axis-line")
        .attr("transform", `translate(0,${yScale(0)})`)
        .call(
          d3.axisBottom(xScale)
            .tickSize(0)
            .tickFormat(() => "")
        );

      // Real visible labels/ticks at bottom
      g.selectAll(".x-axis-labels")
        .data([0])
        .join("g")
        .attr("class", "x-axis-labels")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d")))
        .call(g => g.select(".domain").remove()); // <-- remove the axis line

      g.selectAll(".y-axis")
        .data([0])
        .join("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(0,0)`)
        .transition(t)
        .call(d3.axisLeft(yScale)
          .tickValues(d3.ticks(-maxAbs, maxAbs, 5))  // symmetrical ticks
          .tickFormat(d => `${(d * 100).toFixed(1)}%`)
        );
        //.call(d3.axisLeft(yScale).tickFormat(d => `${(d as number * 100).toFixed(1)}%`));

      const line = d3.line<{ x: number; y: number }>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveMonotoneX);

      g.selectAll("path.line")
        .data([data])
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

      g.selectAll("line.forecast")
        .data([2020])
        .join(
          enter => enter.append("line")
            .attr("class", "forecast")
            .attr("stroke", "gray")
            .attr("stroke-dasharray", "4 4")
            .attr("x1", xScale(2020))
            .attr("x2", xScale(2020))
            .attr("y1", 0)
            .attr("y2", innerH),
          update => update.transition(t)
            .attr("x1", xScale(2020))
            .attr("x2", xScale(2020))
            .attr("y2", innerH),
          exit => exit.remove()
        );

      g.selectAll("circle")
      .data(data, d => d.x)
      .join(
        enter => enter.append("circle")
          .attr("r", d => d.x === choroplethYear ? 4 : 3)
          .attr("fill", "orange") 
          .attr("stroke", d => d.x === choroplethYear ? "#d97706" : "none")
          .attr("stroke-width", d => d.x === choroplethYear ? 1.5 : 0)
          .attr("cx", d => xScale(d.x))
          .attr("cy", d => yScale(d.y))
          .style("cursor", "pointer"),
        update => {
          update
            .attr("r", d => d.x === choroplethYear ? 4 : 3) // no transition
            .attr("stroke", d => d.x === choroplethYear ? "#d97706" : "none")
            .attr("stroke-width", d => d.x === choroplethYear ? 1.5 : 0);

          update.transition(t)
            .attr("cx", d => xScale(d.x))
            .attr("cy", d => yScale(d.y));
        },
        exit => exit.remove()
      );

      svg.selectAll("text.y-label").data([0]).join("text")
        .attr("class", "y-label")
        .attr("text-anchor", "middle")
        .attr("transform", `rotate(-90)`)
        .attr("x", -h / 2)
        .attr("y", 15)
        .text("Growth Rate");

      svg.selectAll("circle")
        .on("mouseover", (event, d) => {
          const growthRate = (d.y * 100).toLocaleString() + "%"?? "Unknown";
          const year = d.x ?? "N/A";

          const arrow = d.y > 0
            ? `<span style="color:green;">🠉</span>`
            : d.y < 0
              ? `<span style="color:red;">🠋</span>`
              : "";

          d3.select("#tooltip")
            .style("display", "block")
            .html(`<strong>${year}</strong>: ${growthRate} <strong>${arrow}</strong>`);
        }) 
        .on("mousemove", (event) => {
          d3.select("#tooltip")
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 28}px`);
        })
        .on("mouseout", () => {
          d3.select("#tooltip").style("display", "none");
        })  
        .on("click", function(event, d) {
          // Smoothly animate the year update over 200ms
          const start = choroplethYear;
          const end = d.x;
          const duration = 200;
          const step = (timestamp: number, startTime: number) => {
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const interpolated = Math.round(start + (end - start) * progress);
            setChoroplethYear(interpolated);
            if (progress < 1) {
              requestAnimationFrame(ts => step(ts, startTime));
            }
          };
          requestAnimationFrame(ts => step(ts, ts));

          //setChoroplethYear(d.x);
          d3.select(this)
            .transition()
            .duration(150)
            .attr("r", 7) // temporarily enlarge
            .transition()
            .duration(150)
            .attr("r", 4);
        });

    };

    render();

    const observer = new ResizeObserver(() => {
      render();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [stateData, choroplethYear]);

  const validYears = useMemo(() => {
    return Array.from(
      new Set(
        stateData
          .filter(d => isFinite(d.growthRate ?? NaN))
          .map(d => d.year)
      )
    ).sort((a, b) => a - b);
  }, [stateData]);

  // --- Tooltip setup ---
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
    }
  }, []);

  return (
    <div className = "flex gap-4" style={{ width:"100%", height: "100vh", margin:0}}>
      
      {/* Map Section */}
      <div className = "w-3/5 border rounded-lg shadow-md flex relative m-0" style={{ height: "100%" }}>
        
        {/* Slider */}  
        <div 
        style={{ 
          position: 'absolute', 
          top: "16px",
          left: "16px",
          //display: "flex",
          borderRadius: "8px",
          background: "rgba(255, 255, 255, 0.95)",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)", 
          padding: "10px 15px", 
          alignItems: "center",
          gap: "15px",
          zIndex: 2 }}
        >
          <label htmlFor="yearSlider">Year: {choroplethYear}</label>
          <br />
          <input
            id="yearSlider"
            type="range"
            min="1962"
            max="2050"
            value={choroplethYear}
            onChange={(e) => {
              const raw = Number(e.target.value);
              // Find closest valid year
              const closest = validYears.reduce((a, b) =>
                Math.abs(b - raw) < Math.abs(a - raw) ? b : a
              );
              setChoroplethYear(closest);
            }}

          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>1962</span>
            <span>2050</span>
          </div>
        </div>

        <MapboxChoroplethMap
          geojsonData={geoJsonData}
          countyData={transformedCountyData}
          year={choroplethYear}
          selectedCounties={selectedCounties}
          onCountyClick={(county) => {
            setSelectedCounties(prev => {
              const next = new Set(prev);
              next.has(county) ? next.delete(county) : next.add(county);
              return new Set(next);
            });
          }}
          getCountyKey={(props) => props.GEOID}
          dataField="growthRates" // use growth rate for coloring
          valueLabel="Growth Rate"
          tooltipFields={[
            { label: "Population", field: "population", format: (v) => v.toLocaleString() },
            { label: "Growth Rate", field: "growthRates", format: (v) => `${(v * 100).toFixed(1)}%` },
          ]}
          transformValue={(v) => Math.sign(v) * Math.sqrt(Math.abs(v))}
        />

        {/* Floating Sidebar */}
        <div
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            width: "240px",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderRadius: "8px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            zIndex: 10,
            padding: "10px",
            fontSize: "12px",
            cursor: "pointer",
            maxHeight: isSidebarHovered ? "400px" : "90px",
            overflow: isSidebarHovered ? "auto" : "hidden",
            transition: "all 0.3s ease-in-out",
          }}
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <strong>Selected Counties</strong>
            {selectedCounties.size > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCounties(new Set());
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                Clear All
              </button>
            )}
          </div>

          <div
            ref={chipContainerRef}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              alignContent: "flex-start",
              overflowY: isSidebarHovered && showScroll ? "auto" : "hidden",
              maxHeight: isSidebarHovered ? "160px" : "60px",
              paddingBottom: "2px",
            }}
          >

            {selectedCounties.size === 0 ? (
              <span style={{ color: "#888" }}>None selected</span>
            ) : (
              (() => {
                const counties = [...selectedCounties];
                const isExpanded = isSidebarHovered;

                let visibleCount = counties.length;
                let showEllipsis = false;

                if (!isExpanded) {
                  if (counties.length > 3) {
                    visibleCount = 2;
                    showEllipsis = true;
                  }
                }

                const visibleChips = counties.slice(0, visibleCount).map((county) => (
                  <div
                    key={county}
                    style={{
                      background: "#eff6ff",
                      padding: "4px 8px",
                      borderRadius: "12px",
                      fontSize: "11px",
                      display: "flex",
                      alignItems: "center",
                      maxWidth: "100%",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {county}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCounties((prev) => {
                          const next = new Set(prev);
                          next.delete(county);
                          return new Set(next);
                        });
                      }}
                      style={{
                        marginLeft: "6px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#3b82f6",
                        fontWeight: "bold",
                        fontSize: "14px",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ));

                if (showEllipsis) {
                  visibleChips.push(
                    <div
                      key="ellipsis"
                      style={{
                        background: "#e5e7eb",
                        padding: "4px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                      }}
                    >
                      ...
                    </div>
                  );
                }

                return visibleChips;
              })()
            )}
          </div>
        </div>
      </div>

      {/* Right Column for Charts */}
      <div className = "w-2/5 flex flex-col h-full">

{/*        <div
          id="line-tooltip"
          style={{
            position: "absolute",
            display: "block",
            padding: "6px 10px",
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "4px",
            pointerEvents: "none",
            fontSize: "12px",
            zIndex: 1000
          }}
        />*/}

        
        {/* Population Chart */}
        <div className="border items-center shadow-md rounded-lg flex-1 flex flex-col mb-4 p-4 h-full"
        style={{background: "#f4f4f4"}}>
          <h4 style={{ fontSize: "15pt", fontWeight: "bold" }}>
            Population Over Time {selectedCounties.size > 0 && "(selected counties)"}
          </h4>

          <div ref={popChartContainerRef} className="w-full flex-1 relative">
            <svg ref={svgRef} className = "absolute inset-0 w-full h-full" />
          </div>
        </div>

        {/* Growth Rate Chart */}
        <div className="border items-center shadow-md rounded-lg flex-1 flex flex-col p-4 h-full bg-gray " 
        style={{background: "#f4f4f4"}}>
          <h4 style={{ fontSize: "15pt", fontWeight: "bold" }}>
            Population Growth Rate {selectedCounties.size > 0 && "(selected counties)"}
          </h4>

          <div ref={growthChartContainerRef} className = "w-full flex-1 relative">
            <svg id="growthChart" className = "absolute inset-0 w-full h-full" />
          </div>
        </div>
      </div>

    </div>
  );


};

export default Population;
