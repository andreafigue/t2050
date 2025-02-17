'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface CargoData {
  year: number;
  cargoType: string;
  tons: number;
  mode: string;
}

// Define an interface for the processed data used in stacking.
// Each object has a year property and cargo types as keys.
interface ProcessedDatum {
  year: number;
  [key: string]: number;
}

const FreightAreaChart: React.FC = () => {
  const [data, setData] = useState<CargoData[]>([]);
  const [modes, setModes] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<string>("");
  const svgRef = useRef<SVGSVGElement | null>(null);
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
      const uniqueModes = [...new Set(validData.map((d) => d.mode))];
      setModes(uniqueModes);
      if (uniqueModes.length > 0) {
        setSelectedMode(uniqueModes[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (!data.length || !selectedMode) return;

    const filteredData = data.filter((d) => d.mode === selectedMode);
    if (!filteredData.length) return;
    
    // Extract the unique cargo types from the filtered data.
    const cargoTypes = [...new Set(filteredData.map(d => d.cargoType))];

    // Process the data by grouping by year and summing tons for each cargo type.
    const processedData = d3.rollup(
      filteredData,
      (v) =>
        Object.fromEntries(
          cargoTypes.map((type) => [
            type,
            d3.sum(v, d => (d.cargoType === type ? d.tons : 0))
          ])
        ),
      (d) => d.year
    );

    // Get the sorted list of years (the keys of the rollup).
    const processedDataKeys = Array.from(processedData.keys()).sort(d3.ascending) as number[];
    
    // Create a stack generator with proper generic types.
    // This ensures each stacked point has a `data` property of type ProcessedDatum.
    const stack = d3.stack<ProcessedDatum, string>()
      .keys(cargoTypes)
      .value((d, key) => d[key] || 0);
    
    // Create the array of processed data objects.
    const stackedData = stack(
      processedDataKeys.map(year => ({
        year,
        ...processedData.get(year),
      }))
    );

    const width = 928;
    const height = 500;
    const margin = { top: 10, right: 20, bottom: 20, left: 60 };

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Clear previous renderings.
    svg.selectAll('*').remove();

    // Create scales.
    const x = d3.scaleLinear()
      .domain(d3.extent(filteredData, d => d.year) as [number, number])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(stackedData, series => d3.max(series, d => d[1])) || 0])
      .rangeRound([height - margin.bottom, margin.top]);

    const color = d3.scaleOrdinal()
      .domain(cargoTypes)
      .range(d3.schemeTableau10);

    // Use the generic type for the area generator so that each point is of type d3.SeriesPoint<ProcessedDatum>.
    const area = d3.area<d3.SeriesPoint<ProcessedDatum>>()
      .x(d => x(d.data.year))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]));

    const svgEl = svg;
    const chart = svgEl.append('g');

    // Render the stacked areas.
    chart.selectAll('.area')
      .data(stackedData)
      .enter()
      .append('path')
      .attr('d', d => area(d) || "")
      .attr('fill', d => color(d.key) as string)
      .attr('opacity', 0.7)
      .on('mouseover', (event, d) => {
        setTooltip({ x: event.pageX, y: event.pageY, text: d.key });
      })
      .on('mouseout', () => setTooltip(null));

    // Add the X-axis.
    svgEl.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat(d3.format('d')));

    // Add the Y-axis.
    svgEl.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    // Add a vertical line for forecast start (2023).
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
  }, [data, selectedMode]);

  return (
    <div className="p-4">
      <div>
        <h2 className="text-2xl font-semibold mb-4">
          Annual Freight Movement by Transportation Mode and Cargo
        </h2>
      </div>

      {modes.length > 0 && (
        <select value={selectedMode} onChange={(e) => setSelectedMode(e.target.value)}>
          {modes.map((mode) => (
            <option key={mode} value={mode}>{mode}</option>
          ))}
        </select>
      )}
      <div>
        <br />
        <svg ref={svgRef} className="border rounded" />
      </div>

      {tooltip && (
        <div className="absolute bg-white p-2 shadow" style={{ top: tooltip.y, left: tooltip.x }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
};

export default FreightAreaChart;
