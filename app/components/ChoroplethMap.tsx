// components/ChoroplethMap.tsx
"use client";

import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import * as d3 from 'd3';
import 'mapbox-gl/dist/mapbox-gl.css';

// –––––– CSV Row Interface ––––––
export interface CountyCsvRow {
  County: string;
  Year: number;
  Population: number;
  Source: string;
  rate: number;
}

// –––––– Internal Data Structure ––––––
interface CountyData {
  // For the choropleth fill: a mapping of year to growth rate.
  growthRates: { [year: number]: number };
  // For the tooltip’s line chart: an array of { year, population }.
  populations: { year: number; population: number }[];
  // For displaying the data source for the growth rate.
  sources: { [year: number]: string };
}

interface ChoroplethMapProps {
  geojsonData: GeoJSON.FeatureCollection<GeoJSON.Geometry, any>;
  countyCsvData?: CountyCsvRow[];
}

// Set your Mapbox access token from the environment.
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string;

const ChoroplethMap: React.FC<ChoroplethMapProps> = ({ geojsonData, countyCsvData }) => {
  // Refs for the map container and tooltip.
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // State: current year (from slider), hovered county, tooltip position, and grouped county data.
  const [year, setYear] = useState<number>(1961);
  const [hoveredCounty, setHoveredCounty] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [countyData, setCountyData] = useState<Record<string, CountyData>>({});

  // Process the CSV data (if provided) into our combined data structure.
  useEffect(() => {
    if (countyCsvData && countyCsvData.length > 0) {
      // Group rows by county.
      const grouped: Record<string, { year: number; population: number; rate: number; source: string }[]> = {};
      countyCsvData.forEach((row) => {
        const county = row.County;
        if (!grouped[county]) {
          grouped[county] = [];
        }
        grouped[county].push({
          year: row.Year,
          population: row.Population,
          rate: row.rate,
          source: row.Source,
        });
      });
      // Sort each county’s data by year.
      Object.keys(grouped).forEach((county) => {
        grouped[county].sort((a, b) => a.year - b.year);
      });
      // Build our CountyData structure.
      const combinedData: Record<string, CountyData> = {};
      Object.entries(grouped).forEach(([county, rows]) => {
        combinedData[county] = {
          populations: rows.map(r => ({ year: r.year, population: r.population })),
          growthRates: rows.reduce((acc, r) => {
            acc[r.year] = r.rate;
            return acc;
          }, {} as { [year: number]: number }),
          sources: rows.reduce((acc, r) => {
            acc[r.year] = r.source;
            return acc;
          }, {} as { [year: number]: string }),
        };
      });
      setCountyData(combinedData);
    } else if (geojsonData && geojsonData.features) {
      // Fallback: generate random data if no CSV is provided.
      const data: Record<string, CountyData> = {};
      geojsonData.features.forEach((feature) => {
        const countyId =
          feature.properties?.id ||
          feature.properties?.NAME ||
          feature.properties?.county ||
          Math.random().toString(36).substr(2, 9);
        const growthRates: { [year: number]: number } = {};
        const populations: { year: number; population: number }[] = [];
        const sources: { [year: number]: string } = {};
        for (let yr = 2000; yr <= 2050; yr++) {
          growthRates[yr] = Math.random();
          populations.push({ year: yr, population: Math.floor(Math.random() * 100000) });
          sources[yr] = "RandomSource";
        }
        data[countyId] = { growthRates, populations, sources };
      });
      setCountyData(data);
    }
  }, [countyCsvData, geojsonData]);

  // Initialize Mapbox map (only once).
  useEffect(() => {
    if (mapRef.current) return;
    if (!mapContainerRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v10',
      center: [-120.4472, 47.3826], // roughly center over Washington state
      zoom: 5.8,
    });

    mapRef.current.on('load', () => {
      if (!mapRef.current) return;
      // Add GeoJSON source.
      mapRef.current.addSource('counties', {
        type: 'geojson',
        data: geojsonData,
      });

      // Add a fill layer for the choropleth.
      mapRef.current.addLayer({
        id: 'counties-layer',
        type: 'fill',
        source: 'counties',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'growthRate'],
            -0.08333333333333337,
            '#f2f0f7',
            0.12195121951219523,
            '#54278f',
          ],
          'fill-opacity': 0.8,
          'fill-outline-color': '#000',
        },
      });

      // Set the initial growthRate property on each feature.
      updateChoropleth();

      // Update hovered county on mousemove.
      mapRef.current.on('mousemove', 'counties-layer', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const countyId =
            feature.properties?.id ||
            feature.properties?.NAME ||
            feature.properties?.county;
          if (countyId) {
            setHoveredCounty(countyId);
            setTooltipPos({ x: e.point.x, y: e.point.y });
          }
        }
      });

      // Clear hovered county on mouse leave.
      mapRef.current.on('mouseleave', 'counties-layer', () => {
        setHoveredCounty(null);
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, [geojsonData]);

  // Update choropleth when the selected year or county data changes.
  useEffect(() => {
    if (mapRef.current && mapRef.current.getSource('counties')) {
      updateChoropleth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, countyData]);

  // Helper: Update each GeoJSON feature’s growthRate property.
  const updateChoropleth = () => {
    if (!mapRef.current) return;
    const source = mapRef.current.getSource('counties') as mapboxgl.GeoJSONSource;
    if (!source) return;
    const data = {
      ...geojsonData,
      features: geojsonData.features.map((feature) => {
        const countyId =
          feature.properties?.id ||
          feature.properties?.NAME ||
          feature.properties?.county;
        const rate =
          countyData[countyId as string] !== undefined
            ? countyData[countyId as string].growthRates[year]
            : 0;
        feature.properties = {
          ...feature.properties,
          growthRate: rate,
        };
        return feature;
      }),
    };
    source.setData(data);
  };

  // Render tooltip with county name, growth rate (with Source), and a line chart.
  useEffect(() => {
    if (hoveredCounty && tooltipRef.current && countyData[hoveredCounty]) {
      const data = countyData[hoveredCounty].populations;
      const container = d3.select(tooltipRef.current);
      container.selectAll('*').remove();

      // Get county name, growth rate, and source for the selected year.
      const countyName = hoveredCounty;
      const growthRate = countyData[hoveredCounty].growthRates[year] || 0;
      const source = countyData[hoveredCounty].sources[year] || "";

      // Append header with county name.
      container
        .append('div')
        .style('font-weight', 'bold')
        .style('margin-bottom', '5px')
        .text(`County: ${countyName}`);

      // Append growth rate and source.
      container
        .append('div')
        .style('margin-bottom', '5px')
        .text(`Growth Rate: ${(growthRate * 100).toFixed(2)}% (Source: ${source})`);

      // Append Title of graph
      container
        .append('div')
        .style('font-weight', 'bold')
        .style('margin-bottom', '5px')
        .text(`Population Growth`);

      // Append an SVG for the line chart.
      const svgWidth = 200;
      const svgHeight = 100;
      const svg = container
        .append('svg')
        .attr('width', svgWidth)
        .attr('height', svgHeight);

      const margin = { top: 5, right: 10, bottom: 20, left: 60 };
      const width = svgWidth - margin.left - margin.right;
      const height = svgHeight - margin.top - margin.bottom;

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3
        .scaleLinear()
        .domain(d3.extent(data, (d) => d.year) as [number, number])
        .range([0, width]);
      const y = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.population) || 0])
        .nice()
        .range([height, 0]);

      const line = d3
        .line<{ year: number; population: number }>()
        .x((d) => x(d.year))
        .y((d) => y(d.population));

      // X-axis.
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')));
      // Y-axis.
      g.append('g').call(d3.axisLeft(y).ticks(5));
      // Draw the line.
      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 1.5)
        .attr('d', line);
    }
  }, [hoveredCounty, countyData, year]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Map container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '600px' }} />

      {/* Year slider */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'white',
          padding: '10px',
          zIndex: 2,
        }}
      >
        <label htmlFor="yearSlider">Year: {year}</label>
        <br />
        <input
          id="yearSlider"
          type="range"
          min="1961"
          max="2050"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </div>

      {/* Tooltip */}
      {hoveredCounty && (
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            left: tooltipPos.x + 10,
            top: tooltipPos.y + 10,
            background: 'white',
            padding: '5px',
            border: '1px solid #ccc',
            pointerEvents: 'none',
            zIndex: 2,
            minWidth: '220px',
          }}
        />
      )}

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          background: 'white',
          padding: '10px',
          border: '1px solid #ccc',
          zIndex: 2,
          width: '220px',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Growth Rate</div>
        <div
          style={{
            width: '100%',
            height: '20px',
            background: 'linear-gradient(to right, #f2f0f7, #54278f)',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>-8.34%</span>
          <span>12.2%</span>
        </div>
      </div>
    </div>
  );
};

export default ChoroplethMap;
