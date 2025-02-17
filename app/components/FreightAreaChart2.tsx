'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface CargoData {
  year: number;
  cargoType: string;
  tons: number;
  mode: string;
}

// Define an interface for the processed data used for stacking.
// Each object has a year and keys for each mode (with numeric values).
interface ProcessedDatum {
  year: number;
  [key: string]: number;
}

const FreightAreaChart: React.FC = () => {
  const [data, setData] = useState<CargoData[]>([]);
  const [cargoTypes, setCargoTypes] = useState<string[]>([]);
  const [selectedCargo, setSelectedCargo] = useState<string>("");
  const [filteredModes, setFilteredModes] = useState<string[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Load CSV data
  useEffect(() => {
    d3.csv("/freight_data_base.csv", (d) => {
      return d.Year && d.sctg2 && d.tons && d.dms_mode
        ? {
            year: +d.Year,
            cargoType: d.sctg2,
            tons: +d.tons,
            mode: d.dms_mode,
          }
        : null;
    }).then((loadedData) => {
      const validData = loadedData.filter(Boolean) as CargoData[];
      setData(validData);
      const uniqueCargoTypes = [...new Set(validData.map((d) => d.cargoType))];
      setCargoTypes(uniqueCargoTypes);
      if (uniqueCargoTypes.length > 0) {
        setSelectedCargo(uniqueCargoTypes[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (!data.length || !selectedCargo) return;

    // Filter data for the selected cargo type
    const filteredData = data.filter((d) => d.cargoType === selectedCargo);
    if (!filteredData.length) return;
    
    // Get unique modes from the filtered data
    const modes = [...new Set(filteredData.map(d => d.mode))];
    setFilteredModes(modes);

    // Create a stack generator with proper generic types.
    // This tells TypeScript that each stacked point comes from a ProcessedDatum.
    const stack = d3.stack<ProcessedDatum, string>()
      .keys(modes)
      .value((d, key) => d[key] || 0);
    
    // Process the data: group by year and sum tons for each mode.
    const processedData = d3.rollup(
      filteredData,
      (v) =>
        Object.fromEntries(
          modes.map(mode => [mode, d3.sum(v, d => d.mode === mode ? d.tons : 0)])
        ),
      (d) => d.year
    );
    
    // Convert the processed rollup to an array of objects with a year and summed values.
    const processedArray = Array.from(processedData, ([year, values]) => ({
      year,
      ...values,
    })) as ProcessedDatum[];

    // Generate the stacked data
    const stackedData = stack(processedArray);

    const width = 900;
    const height = 500;
    const margin = { top: 10, right: 40, bottom: 20, left: 60 };

    // Select the SVG and clear previous content
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);
    svg.selectAll('*').remove();

    // Create scales
    const x = d3.scaleLinear()
      .domain(d3.extent(filteredData, (d) => d.year) as [number, number])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(stackedData, series => d3.max(series, d => d[1])) || 0])
      .rangeRound([height - margin.bottom, margin.top]);

    // Provide explicit types so the color scale returns a string.
    const color = d3.scaleOrdinal<string, string>()
      .domain(modes)
      .range(d3.schemeTableau10);

    // Use a generic type for the area generator so that each point is of type d3.SeriesPoint<ProcessedDatum>
    const area = d3.area<d3.SeriesPoint<ProcessedDatum>>()
      .x(d => x(d.data.year))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]));

    const svgEl = svg;
    const chart = svgEl.append('g');

    // Draw the stacked areas
    chart.selectAll('.area')
      .data(stackedData)
      .enter()
      .append('path')
      .attr('d', d => area(d) || "")
      .attr('fill', d => color(d.key))
      .attr('opacity', 0.7)
      .on('dblclick', (event, d) => {
        setFilteredModes([d.key]);
      })
      .on('mouseover', (event, d) => {
        setTooltip({ x: event.pageX, y: event.pageY, text: d.key });
      })
      .on('mouseout', () => setTooltip(null));

    // X-axis
    svgEl.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat(d3.format('d')));

    // Y-axis
    svgEl.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));
    
    // Create legend outside the chart to the right
    const legend = d3.select(legendRef.current);
    legend.selectAll("*").remove();
    
    modes.forEach((mode) => {
      const legendRow = legend.append('div')
        .style("display", "flex")
        .style("align-items", "center")
        .style("margin-bottom", "5px");
      
      legendRow.append('div')
        .style("width", "15px")
        .style("height", "15px")
        .style("background", color(mode))
        .style("margin-right", "10px");
      
      legendRow.append('span')
        .text(mode);
    });

    // Add vertical line for forecast start (2023)
    svgEl.append('line')
      .attr('x1', x(2023))
      .attr('x2', x(2023))
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('stroke', 'red')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4 4');

    svgEl.append('text')
      .attr('x', x(2023) + 5)
      .attr('y', margin.top + 10)
      .attr('fill', 'dark-red')
      .text('Forecast Start');
  }, [data, selectedCargo]);

  return (
    <div className="p-5">
      <div>
        <h2 className="text-2xl font-semibold mb-4">
          Annual Freight Movement by Transportation Mode and Cargo
        </h2>
      </div>
      <div className="flex">
        <div className="flex flex-col">
          <select style={{ width: 300 }} value={selectedCargo} onChange={(e) => setSelectedCargo(e.target.value)}>
            {cargoTypes.map((cargo) => (
              <option key={cargo} value={cargo}>{cargo}</option>
            ))}
          </select>
          <br />
          <svg ref={svgRef} className="border rounded" />
        </div>
        <div ref={legendRef} className="ml-4"></div>
        {tooltip && (
          <div className="absolute bg-white p-2 shadow" style={{ top: tooltip.y, left: tooltip.x }}>
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default FreightAreaChart;
 