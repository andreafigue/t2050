// @ts-nocheck
'use client';

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

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

const WashingtonMapWithLineGraphs: React.FC<FreightProps> = ({
  externalSelectedCounties,
  onCountySelectionChange = () => {},
}) => {
  // --- County selection state and sync ---
  const [selectedCounties, setSelectedCounties] = useState<Set<string>>(externalSelectedCounties ?? new Set());
  const selectedCountiesRef = useRef(selectedCounties);
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
  const [waCountyMapping, setWaCountyMapping] = useState<Record<string,string>>({});
  const geojsonRef = useRef<any[]>([]);
  const mapSvgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // Load CSV
    d3.csv<FreightData>('/data/freight/sample.csv', row => ({
      ...row,
      Year: +row.Year,
      Tons: +row.Tons,
      Value: +row.Value
    })).then(setFreightCSVData);

    // Load & draw counties once
    d3.json('/data/freight/counties.geojson').then((geojson: any) => {
      const features = geojson.features.filter((f:any) => f.properties.STATEFP === '53');
      geojsonRef.current = features;

      // Build mapping for filtering
      const mapping: Record<string,string> = {};
      features.forEach((f:any) => {
        mapping[f.properties.NAME] =
          f.properties.GEOID ?? (f.properties.STATEFP + f.properties.COUNTYFP);
      });
      setWaCountyMapping(mapping);

      // Initial draw
      const svg = d3.select(mapSvgRef.current)
        .attr('width', 600)
        .attr('height', 500);
      const projection = d3.geoAlbers()
        .center([1, 47])
        .rotate([120, 0])
        .parallels([48, 49])
        .scale(8 * Math.min(600, 500))
        .translate([300, 250]);
      const path = d3.geoPath().projection(projection);

      svg.selectAll('.county')
        .data(features)
        .enter().append('path')
        .attr('class','county')
        .attr('d', path as any)
        .style('stroke','#333')
        .style('fill', (d:any) =>
          selectedCounties.has(d.properties.NAME) ? '#007bff' : '#ccc'
        )
        .on('mouseover', (event,d:any) => {
          d3.select(event.currentTarget).style('fill','orange');
          d3.select('#tooltip')
            .style('display','block')
            .html(`<strong>${d.properties.NAME}</strong>`)
            .style('left',  `${event.pageX + 10}px`)
            .style('top',   `${event.pageY - 20}px`);
        })
        .on('mousemove', (event) => {
          d3.select('#tooltip')
            .style('left',  `${event.pageX + 10}px`)
            .style('top',   `${event.pageY - 20}px`);
        })
        // ON MOUSE OUT: use the freshest ref so we don’t lose the blue
        .on('mouseout', (event,d:any) => {
          d3.select(event.currentTarget)
            .style('fill',
              selectedCountiesRef.current.has(d.properties.NAME)
                ? '#007bff'
                : '#ccc'
            );
          d3.select('#tooltip').style('display','none');
        })
        .on('click', (event,d:any) => {
          const name = d.properties.NAME;
          setSelectedCounties(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            selectedCountiesRef.current = next;
            onCountySelectionChange(next);
            return next;
          });
        });
    });
  }, []);

  // --- Whenever selection changes, repaint fill ---
  useEffect(() => {
    d3.select(mapSvgRef.current).selectAll('.county')
      .style('fill', (d:any) =>
        selectedCounties.has(d.properties.NAME) ? '#007bff' : '#ccc'
      );
  }, [selectedCounties]);

  // --- Filters & data pipeline ---
  const [filterOptions] = useState({
    commodityGroup: ["All","Industrial Manufacturing","Last-Mile Delivery","Transportation Equipment","Agriculture & Seafood","Clothing and Misc. Manufacturing","Energy","Food Manufacturing","Forestry Products","High-Tech Manufacturing","Construction"],
    tradeType: [{id:"all",name:"All"},{id:"1",name:"Domestic Only"},{id:"2",name:"Import"},{id:"3",name:"Export"}],
    mode: [{id:"all",name:"All"},{id:"1",name:"Truck"},{id:"2",name:"Rail"},{id:"3",name:"Water"},{id:"4",name:"Air"},{id:"5",name:"Multiple Modes Including Mail"}]
  });
  const [selectedFilters, setSelectedFilters] = useState({ commodityGroup:"All", tradeType:"all", mode:"all" });

  const filteredFreightData = useMemo(() => {
    if (!freightCSVData.length) return [];
    const countyIds = new Set(
      Array.from(selectedCounties)
        .map(n => waCountyMapping[n])
        .filter(Boolean)
    );
    return freightCSVData.filter(d => {
      if (countyIds.size && !countyIds.has(d["Origin County"])) return false;
      if (selectedFilters.commodityGroup !== "All" && d["Commodity Group"] !== selectedFilters.commodityGroup) return false;
      if (selectedFilters.tradeType    !== "all" && d["Trade Type"]      !== selectedFilters.tradeType)      return false;
      if (selectedFilters.mode         !== "all" && d["Mode"]            !== selectedFilters.mode)           return false;
      return true;
    });
  }, [freightCSVData, selectedFilters, selectedCounties, waCountyMapping]);

  // --- Line chart logic ---
  const lineGraph1Ref = useRef<SVGSVGElement>(null);
  const lineGraph2Ref = useRef<SVGSVGElement>(null);
  const w = 300, h = 240;
  const formatSI = d3.format("~s");
  const formatDollar = (n:number) => d3.format("~s")(n).replace("G","B");

  const updateLineGraph = (
    svgRef: React.RefObject<SVGSVGElement>,
    data: {x:number,y:number}[],
    color: string,
    yLabel: string
  ) => {
    const svg = d3.select(svgRef.current!)
      .attr("width",  w)
      .attr("height", h)
      .style("overflow","visible");    // allow labels to show
    const margin = { top: 40, right: 20, bottom: 50, left: 60 };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;
    const t = d3.transition().duration(800);

    const tickFmt = yLabel === "Value"
      ? (n:any) => formatDollar(n)
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

    g.select(".x-axis").transition(t)
      .call((d3.axisBottom(xScale).tickFormat(d3.format("d"))) as any);
    g.select(".y-axis").transition(t)
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

    const circles = g.selectAll("circle").data(data, (d:any) => d.x).join(
      enter => enter.append("circle")
        .attr("r", 4)
        .attr("fill", color)
        .call(enter => enter.transition(t)
          .attr("cx", (d:any) => xScale(d.x))
          .attr("cy", (d:any) => yScale(d.y))),
      update => update.transition(t)
        .attr("cx", (d:any) => xScale(d.x))
        .attr("cy", (d:any) => yScale(d.y)),
      exit   => exit.remove()
    );

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

    // Re-add Y‐axis label (your original “legend”)
    svg.selectAll("text.y-label").remove();
    svg.append("text")
      .attr("class","y-label")
      .attr("text-anchor","middle")
      .attr("transform",`rotate(-90)`)
      .attr("x", -h/2)
      .attr("y", 15)
      .text(yLabel);

    // Tooltip on circles
    circles.on("mouseover", (event, d:any) => {
        d3.select("#tooltip")
          .style("display","block")
          .html(`Year: ${d.x}<br/>${yLabel}: ${tickFmt(d.y)}`);
      })
      .on("mousemove", (event) => {
        d3.select("#tooltip")
          .style("left",`${event.pageX+10}px`)
          .style("top", `${event.pageY-20}px`);
      })
      .on("mouseout", () => {
        d3.select("#tooltip").style("display","none");
      });
  };

  // Update each chart when data or filters change
  useEffect(() => {
    if (!filteredFreightData.length) return;
    const aggT = Array.from(
      d3.rollups(filteredFreightData, v => d3.sum(v, d => d.Tons)*1000, d => d.Year),
      ([year, tot]) => ({ x:+year, y: tot })
    ).sort((a,b) => a.x - b.x);
    updateLineGraph(lineGraph1Ref, aggT, "steelblue", "Tons");
  }, [filteredFreightData]);

  useEffect(() => {
    if (!filteredFreightData.length) return;
    const aggV = Array.from(
      d3.rollups(filteredFreightData, v => d3.sum(v, d => d.Value)*1e6, d => d.Year),
      ([year, tot]) => ({ x:+year, y: tot })
    ).sort((a,b) => a.x - b.x);
    updateLineGraph(lineGraph2Ref, aggV, "darkorange", "Value");
  }, [filteredFreightData]);

  return (
    <div className="flex gap-4 p-4" style={{ width:'100%', margin:0 }}>
      {/* Sidebar */}
      <div className="w-1/6 p-4 border rounded">
        <h2 className="text-lg font-bold">Filters</h2>
        {Object.keys(selectedFilters).map(key => (
          <div key={key} className="mb-2">
            <label className="block text-sm font-medium capitalize">{key}</label>
            <select
              className="w-full p-2 border"
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
        <div className="mt-4 p-2 border bg-gray-100 rounded">
          <h2 className="text-base font-bold">Selected Counties</h2>
          <p>{selectedCounties.size ? Array.from(selectedCounties).join(", ") : "All"}</p>
        </div>
      </div>

      {/* Map */}
      <div className="w-3/6 border p-4 rounded">
        <svg ref={mapSvgRef} className="w-full h-full" />
      </div>

      {/* Charts */}
      <div className="w-2/6 flex flex-col gap-4 border p-4 rounded">
        <div className="flex flex-col items-center">
          <h2 className="text-lg font-bold">Tons over Years</h2>
          <svg
            ref={lineGraph1Ref}
            className="w-full h-48"
            style={{ overflow: 'visible' }}
          />
        </div>
        <div className="flex flex-col items-center">
          <h2 className="text-lg font-bold">Value over Years</h2>
          <svg
            ref={lineGraph2Ref}
            className="w-full h-48"
            style={{ overflow: 'visible' }}
          />
        </div>
      </div>
    </div>
  );
};

export default WashingtonMapWithLineGraphs;
