// @ts-nocheck
'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import MapboxChoroplethMap from "./MapboxChoroplethMap";
import startCase from 'lodash/startCase';

interface FreightProps {
  externalSelectedCounties?: Set<string>;
  onCountySelectionChange?: (selected: Set<string>) => void;
}

interface FreightData {
  Year: number;
  Tons: number;
  Value: number;
  [key: string]: any;
}

interface CountyData {
  tons: { [year: number]: number };
  values: { [year: number]: number };
}

const WashingtonMapWithLineGraphs: React.FC<FreightProps> = ({
  externalSelectedCounties,
  onCountySelectionChange = () => {},
}) => {
  // --- County selection state and sync ---
  const [selectedCounties, setSelectedCounties] = useState<Set<string>>(externalSelectedCounties ?? new Set());
  const selectedCountiesRef = useRef(selectedCounties);
  const [choroplethYear, setChoroplethYear] = useState<number>(2020); // default year


  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const chipWrapperRef = useRef<HTMLDivElement>(null);

  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const chipContainerRef = useRef<HTMLDivElement>(null);

  const chipVisibleRef = useRef<HTMLDivElement>(null);
  const chipMeasureRef = useRef<HTMLDivElement>(null);
  const [showEllipsis, setShowEllipsis] = useState(false);
  const [showScroll, setShowScroll] = useState(false);

  // const modeBarChartRef = useRef<SVGSVGElement>(null);


  useEffect(() => {
    if (externalSelectedCounties) {
      setSelectedCounties(new Set(externalSelectedCounties));
      selectedCountiesRef.current = new Set(externalSelectedCounties);
    }
  }, [externalSelectedCounties]);

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

  // --- Data loading & map init (run once) ---
  const [freightCSVData, setFreightCSVData] = useState<FreightData[]>([]);
  //const [waCountyMapping, setWaCountyMapping] = useState<Record<string,string>>({});
  //const geojsonRef = useRef<any[]>([]);
  //const mapSvgRef = useRef<SVGSVGElement>(null);

  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  //const countyDataRef = useRef<Record<string, CountyData>>({});

  // useEffect(() => {
  //   d3.json('/data/freight/counties.geojson').then(setGeoJsonData);
  // }, []);

  useEffect(() => {

    d3.json<FreightData[]>('/data/freight/aggregated.json').then(data => {
      const processed = data.map(d => ({
        ...d,
        "Trade Type": String(d["Trade Type"]),
        "Mode": String(d["Mode"]),
        "Origin County": String(d["Origin County"])
      }));
      setFreightCSVData(processed);
    });

    // Load & draw counties once
    d3.json('/data/freight/counties.geojson').then((geojson: any) => {
      setGeoJsonData(geojson);

      const features = geojson.features.filter((f:any) => f.properties.STATEFP === '53');
      //geojsonRef.current = features;

      // Build mapping for filtering
      // const mapping: Record<string,string> = {};
      // features.forEach((f:any) => {
      //   mapping[f.properties.NAME] =
      //     f.properties.GEOID ?? (f.properties.STATEFP + f.properties.COUNTYFP);
      // });
      // setWaCountyMapping(mapping);
     
    });
  }, []);

  // state to hold the ONE static copy of countyData for the map
  const [mapCountyData, setMapCountyData] = useState<Record<string, CountyData>>({});

  useEffect(() => {
    if (!freightCSVData.length) return;
    // build one data object from the *entire* CSV
    const full: Record<string, CountyData> = {};

    freightCSVData.forEach(d => {
      const county = d["Origin County"];
      const year   = +d.Year;

      if (!full[county]) {
        full[county] = { tons: {}, values: {} };
      }
      full[county].tons[year] = (full[county].tons[year] || 0) + d.Tons * 1000;
      full[county].values[year] = (full[county].values[year] || 0) +d.Value * 1_000_000;

      //console.log("County: ", county)
      //console.log("Year: ", year)
      //console.log("tons: ", tons)
      //console.log("value: ", value)
    });

    setMapCountyData(full);
  }, [freightCSVData]);

  const enrichedGeoJsonData = useMemo(() => {
    if (!geoJsonData) return null;
    const features = geoJsonData.features
      .filter(f => f.properties?.STATEFP === "53");
    return { ...geoJsonData, features };
  }, [geoJsonData]);

  const nameToGeoid = useMemo(() => {
    if (!enrichedGeoJsonData) return {};
    return enrichedGeoJsonData.features.reduce<Record<string, string>>((acc, f) => {
      const geoid = f.properties?.GEOID;
      const name = f.properties?.NAME;
      if (name && geoid) acc[name] = geoid;
      return acc;
    }, {});
  }, [enrichedGeoJsonData]);


  // --- Filters & data pipeline ---
  const [filterOptions] = useState({
    commodityGroup: ["All","Industrial Manufacturing","Last-Mile Delivery","Transportation Equipment","Agriculture & Seafood","Clothing and Misc. Manufacturing","Energy","Food Manufacturing","Forestry Products","High-Tech Manufacturing","Construction"],
    tradeType: [{id:"all",name:"All"},{id:"1",name:"Domestic Only"},{id:"2",name:"Import"},{id:"3",name:"Export"}],
    mode: [{id:"all",name:"All"},{id:"1",name:"Truck"},{id:"2",name:"Rail"},{id:"3",name:"Water"},{id:"4",name:"Air"},{id:"5",name:"Multiple Modes"}]
  });
  const [selectedFilters, setSelectedFilters] = useState({ commodityGroup:"All", tradeType:"all", mode:"all" });

  const countyArray = useMemo(() => [...selectedCounties], [selectedCounties]);
  
  const filteredFreightData = useMemo(() => {
    // if (!freightCSVData.length) return [];
    // const countyIds = new Set(
    //   Array.from(selectedCounties)
    //     .map(n => waCountyMapping[n])
    //     .filter(Boolean)
    // );
    const selectedGeoids = countyArray
      .map(name => nameToGeoid[name])
      .filter(Boolean); // drop nulls
    const countySet = new Set(selectedGeoids);
    return freightCSVData.filter(d => {
      if (countySet.size && !countySet.has(d["Origin County"])) {
        return false;
      }
      //if (countyIds.size && !countyIds.has(waCountyMapping[d["Origin County"]])) return false;
      if (selectedFilters.commodityGroup !== "All" && d["Commodity Group"] !== selectedFilters.commodityGroup) return false;
      if (selectedFilters.tradeType    !== "all" && d["Trade Type"]      !== selectedFilters.tradeType)      return false;
      if (selectedFilters.mode         !== "all" && d["Mode"]            !== selectedFilters.mode)           return false;
      return true;
    });
  }, [freightCSVData, selectedFilters, selectedCounties]);

  const mapFreightCountyData = useMemo(() => {
    const data: Record<string, CountyData> = {};
    freightCSVData
      .filter(d =>
        selectedFilters.commodityGroup === "All" || d["Commodity Group"] === selectedFilters.commodityGroup
      )
      .filter(d =>
        selectedFilters.tradeType === "all" || d["Trade Type"] === selectedFilters.tradeType
      )
      .filter(d =>
        selectedFilters.mode === "all" || d["Mode"] === selectedFilters.mode
      )
      .forEach(d => {
        const county = d["Origin County"];
        const year = +d["Year"];
        data[county] = data[county] || { tons: {}, values: {} };
        data[county].tons[year] = (data[county].tons[year] || 0) + d.Tons * 1000;
        data[county].values[year] = (data[county].values[year] || 0) + d.Value * 1_000_000;
      });

    return data;
  }, [freightCSVData, selectedFilters]);

  // useEffect(() => {
  //   countyDataRef.current = mapFreightCountyData;
  // }, [mapFreightCountyData]);




  // --- Line chart logic ---
  const lineGraph1Ref = useRef<SVGSVGElement>(null);
  const lineGraph2Ref = useRef<SVGSVGElement>(null);
  //const w = 300, h = 240;
  const formatSI = d3.format(".2s");
  const formatDollar = (n:number) => d3.format(".2s")(n).replace("G","B");

  const updateLineGraph = (
    svgRef: React.RefObject<SVGSVGElement>,
    data: {x:number,y:number}[],
    color: string,
    yLabel: string,
    highlightYear: number
  ) => {

    const container = svgRef.current?.parentElement;
    if (!container) return;

    //if (!data.length) return;

    const resizeChart = () => {

      const w = container.clientWidth;
      const h = container.clientHeight;

      const svg = d3.select(svgRef.current!)
        .attr("width",  w)
        .attr("height", h)
        .style("overflow","visible");    // allow labels to show

      const margin = { top: 6, right: 12, bottom: 17, left: 58 };
      const innerW = w - margin.right - margin.left;
      const innerH = h - margin.bottom - margin.top;
      const t = d3.transition().duration(800);

      const tickFmt = yLabel.includes("Value")
        ? (n:any) => "$" + formatDollar(n)
        : (n:any) => formatSI(n);

      let g = svg.select<SVGGElement>("g.chart");
      if (g.empty()) {
        g = svg.append<SVGGElement>("g")
          .attr("class","chart")
          .attr("transform",`translate(${margin.left},${margin.top})`);
        g.append("g").attr("class","x-axis").attr("transform",`translate(0,${innerH})`);
        g.append("g").attr("class","y-axis");
      }

      const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x) as [number,number])
        .range([0, innerW]);
      const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.y)!])
        .nice()
        .range([innerH, 0]);

      g.select(".x-axis")
        .attr("transform", `translate(0, ${innerH})`)
        .transition(t)
        .call((d3.axisBottom(xScale).tickFormat(d3.format("d"))) as any);
      g.select(".y-axis")
        .transition(t)
        .call((d3.axisLeft(yScale).tickFormat(tickFmt)) as any);

      const line = d3.line<any>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveMonotoneX);

      g.selectAll("path.line").data([data]).join(
        enter => enter.append("path")
          .attr("class","line")
          .attr("fill","none")
          .attr("stroke", color)
          .attr("stroke-width", 2)
          .attr("d", line),
        update => update.transition(t).attr("d", line),
        exit   => exit.remove()
      );

      const circles = g.selectAll("circle").data(data, (d: any) => d.x).join(
        enter => enter.append("circle")
          .attr("fill", color)
          .attr("cx", d => xScale(d.x))
          .attr("cy", d => yScale(d.y))
          .attr("r", d => d.x === highlightYear ? 7 : 4),

        update => {
          update.each(function (d) {
            d3.select(this)
              .transition("position")
              .duration(800)
              .attr("cx", xScale(d.x))
              .attr("cy", yScale(d.y));

            d3.select(this)
              .transition("radius")
              .duration(200)
              .attr("r", d.x === highlightYear ? 7 : 4);
          });
          return update;
        },

        exit => exit.remove()
      );

      circles
        .on("mouseover", (event, d: any) => {
          d3.select("#tooltip")
            .style("display", "block")
            .html(`Year: ${d.x}<br/>${yLabel.includes("Value") ? "Value" : yLabel}: ${tickFmt(d.y)}`);
        })
        .on("mousemove", (event) => {
          d3.select("#tooltip")
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 20}px`);
        })
        .on("mouseout", () => {
          d3.select("#tooltip").style("display", "none");
        });

      // Forecast line
      const forecastLine = g.selectAll("line.forecast").data([2020]);
      forecastLine.join(
        enter => enter.append("line")
          .attr("class","forecast")
          .attr("x1", xScale(2020))
          .attr("y1", 0)
          .attr("x2", xScale(2020))
          .attr("y2", innerH)
          .attr("stroke","grey")
          .attr("stroke-dasharray","4 4"),
        update => update.transition(t)
          .attr("x1", xScale(2020))
          .attr("x2", xScale(2020))
          .attr("y2", innerH),
        exit   => exit.remove()
      );

      // Re-add Y‐axis label 
      svg.selectAll("text.y-label").remove();
      svg.append("text")
        .attr("class","y-label")
        .attr("text-anchor","middle")
        .attr("transform",`rotate(-90)`)
        .attr("x", -h/2)
        .attr("y", 12)
        .text(yLabel);   
    };

    resizeChart(); // initial draw

  };

  // Update each chart when data or filters change
  useEffect(() => {
    //if (!filteredFreightData.length) return;

    const container = lineGraph1Ref.current?.parentElement;
    if (!container) return;

    const aggT = Array.from(
      d3.rollups(filteredFreightData, v => d3.sum(v, d => d.Tons)*1000, d => d.Year),
      ([year, tot]) => ({ x:+year, y: tot })
    ).sort((a,b) => a.x - b.x);

    updateLineGraph(lineGraph1Ref, aggT, "steelblue", "Tons", choroplethYear);

    // Resize observer for dynamic redraw
    const observer = new ResizeObserver(() => {
      updateLineGraph(lineGraph1Ref, aggT, "steelblue", "Tons", choroplethYear);
    });

    observer.observe(container);

    return () => observer.disconnect(); // Cleanup

  }, [filteredFreightData, choroplethYear]);

  useEffect(() => {
    //if (!filteredFreightData.length) return;

    const container = lineGraph2Ref.current?.parentElement;
    if (!container) return;

    const aggV = Array.from(
      d3.rollups(filteredFreightData, v => d3.sum(v, d => d.Value) * 1e6, d => d.Year),
      ([year, tot]) => ({ x: +year, y: tot })
    ).sort((a, b) => a.x - b.x);

    updateLineGraph(lineGraph2Ref, aggV, "darkorange", "Value (dollars)", choroplethYear);

    const observer = new ResizeObserver(() => {
      updateLineGraph(lineGraph2Ref, aggV, "darkorange", "Value (dollars)", choroplethYear);
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, [filteredFreightData, choroplethYear]);


  const handleCountyClick = useCallback((countyName: string) => {
    setSelectedCounties(prev => {
      const next = new Set(prev);
      next.has(countyName) ? next.delete(countyName) : next.add(countyName);
      selectedCountiesRef.current = next;
      onCountySelectionChange(next);
      console.log("Clicked county:", countyName);
      return next;
    });
  }, [onCountySelectionChange]);

  const getCountyKey = useCallback((f: GeoJSON.Feature) => f.properties?.GEOID, []);

  // Build color scale from the FULL county‐data (so map always shows colors)
  const dynamicTonsScale = useMemo(() => {
    const vals = Object.values(mapFreightCountyData)
      .flatMap(cd => Object.values(cd.tons))
      .filter(isFinite);
    const min = 0;
    const max = d3.max(vals) ?? 1;
    return d3.scaleSequential(d3.interpolateYlGnBu)
             .domain([min, max]);
  }, [mapFreightCountyData]);


  const validYears = useMemo(() => {
    return Array.from(
      new Set(
        filteredFreightData
          .filter(d => isFinite(d.Tons))
          .map(d => d.Year)
      )
    ).sort((a, b) => a - b);
  }, [filteredFreightData]);

  const allYears = useMemo(() => {
    const years = Array.from(new Set(freightCSVData.map(d => +d.Year)));
    years.sort((a, b) => a - b);
    return years;
  }, [freightCSVData]);


  return (
    <div className="flex gap-4" style={{ width:'100%', height:"100vh", margin:0 }}>
      
      {/*Mapbox section*/}
      <div className="w-7/12 border rounded-lg shadow-md flex relative" style={{ height: "100%" }}>

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
            min={allYears[0] ?? 0}
            max={allYears[allYears.length-1] ?? 0}
            step={1}
            list="tickmarks"
            value={choroplethYear}
            onChange={(e) => {
              const raw = Number(e.target.value);

              if (!validYears.length) {
                setChoroplethYear(allYears[0] ?? 2020);
              } else {
                const closest = validYears.reduce((a, b) =>
                  Math.abs(b - raw) < Math.abs(a - raw) ? b : a
                );
                setChoroplethYear(closest);
              }

            }}
          />
          <datalist id="tickmarks">
            {allYears.map((year) => (
              <option key={year} value={year} />
            ))}
          </datalist>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{allYears[0] ?? 0}</span>
            <span>{allYears[allYears.length-1] ?? 0}</span>
          </div>
        </div>

        {Object.keys(mapFreightCountyData).length > 0 && choroplethYear && (
          <MapboxChoroplethMap
            geojsonData={enrichedGeoJsonData}
            countyData={mapFreightCountyData}
            //countyData={mapCountyData}
            year={choroplethYear}
            selectedCounties={selectedCounties}
            onCountyClick={handleCountyClick}
            getCountyKey={getCountyKey}
            dataField="tons"
            valueLabel="Freight Tons"
            tooltipFields={[
              { label: "Tons", field: "tons", format: (v) => `${formatSI(v)} tons` },
              { label: "Value", field: "values", format: (v) => `$${formatDollar(v)}` },
            ]}
            formatValue={(v) => {
              if (v >= 1_000) return `${formatSI(v)} tons`;
              return `${v.toLocaleString()} tons`;
            }}


            colorScale = {dynamicTonsScale}
          />
          )}

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
      <div className="w-5/12 flex flex-col h-full" >
        
        {/* Filters */}
        <div className="p-4 border rounded-lg shadow-md bg-white mb-4 items-center flex flex-col ">
          <h4 style={{ fontSize: "15pt", fontWeight: "bold" }}>Filters</h4>
          <div className="flex flex-wrap gap-4 w-full">
            {Object.keys(selectedFilters).map(key => (
              <div key={key} className="flex-1">
                <label className="block text-sm font-medium capitalize mb-1">{startCase(key)}</label>
                <select
                  className="w-full p-2 border rounded"
                  value={(selectedFilters as any)[key]}
                  onChange={e => setSelectedFilters(prev => ({
                    ...prev, [key]: e.target.value
                  }))}
                >
                  {filterOptions[key as keyof typeof filterOptions].map(opt => (
                    <option key={(opt as any).id ?? opt} value={(opt as any).id ?? opt}>
                      {(opt as any).name ?? opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
        
        {/* Tons Chart */}
        <div className="border items-center shadow-md rounded-lg flex-1 flex flex-col p-4 mb-4 bg-white">
          <h4 style={{ fontSize: "15pt", fontWeight: "bold" }}>
            Tons over Years {selectedCounties.size > 0 && "(selected counties)"}
          </h4>
          <div className="w-full flex-1 relative" style={{ overflow: "visible" }}>
            <svg
              ref={lineGraph1Ref}
            />
          </div>
        </div>

        {/* Value Chart */}
        <div className="border items-center shadow-md rounded-lg flex-1 flex flex-col p-4 bg-white ">
          <h4 style={{ fontSize: "15pt", fontWeight: "bold" }}>
            Value over Years {selectedCounties.size > 0 && "(selected counties)"}
          </h4>
          <div className="w-full flex-1 relative" >
            <svg
              ref={lineGraph2Ref}
            />
          </div>
        </div>
      </div>
    </div>

  );
};

export default WashingtonMapWithLineGraphs;