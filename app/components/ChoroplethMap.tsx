"use client";

import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import * as d3 from 'd3';
import 'mapbox-gl/dist/mapbox-gl.css';

export interface CountyCsvRow {
  County: string;
  Year: number;
  Population: number;
  Source: string;
  rate: number;
}

interface CountyData {
  growthRates: { [year: number]: number };
  populations: { year: number; population: number }[];
  sources: { [year: number]: string };
}

interface ChoroplethMapProps {
  geojsonData: GeoJSON.FeatureCollection<GeoJSON.Geometry, any>;
  countyCsvData?: CountyCsvRow[];
}

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string;

const ChoroplethMap: React.FC<ChoroplethMapProps> = ({ geojsonData, countyCsvData }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [year, setYear] = useState<number>(1961);
  const [validYears, setValidYears] = useState<number[]>([]);
  const [hoveredCounty, setHoveredCounty] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [countyData, setCountyData] = useState<Record<string, CountyData>>({});

  const [mapLoaded, setMapLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (countyCsvData && countyCsvData.length > 0) {
      const grouped: Record<string, { year: number; population: number; rate: number; source: string }[]> = {};
      countyCsvData.forEach((row) => {
        const county = row.County;
        if (!grouped[county]) grouped[county] = [];
        grouped[county].push({ year: row.Year, population: row.Population, rate: row.rate, source: row.Source });
      });
      Object.keys(grouped).forEach((county) => grouped[county].sort((a, b) => a.year - b.year));

      const combinedData: Record<string, CountyData> = {};
      Object.entries(grouped).forEach(([county, rows]) => {
        combinedData[county] = {
          populations: rows.map(r => ({ year: r.year, population: r.population })),
          growthRates: rows.reduce((acc, r) => { acc[r.year] = r.rate; return acc; }, {} as { [year: number]: number }),
          sources: rows.reduce((acc, r) => { acc[r.year] = r.source; return acc; }, {} as { [year: number]: string })
        };
      });
      setCountyData(combinedData);

      const yearsSet = new Set<number>();
      Object.values(combinedData).forEach(data => {
        Object.keys(data.growthRates).forEach(yearStr => yearsSet.add(Number(yearStr)));
      });
      const sortedYears = Array.from(yearsSet).sort((a, b) => a - b);
      setValidYears(sortedYears);
      setYear(sortedYears[0]);
    }
  }, [countyCsvData, geojsonData]);

  useEffect(() => {
    if (mapRef.current) return;
    if (!mapContainerRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v10',
      center: [-120.4472, 47.3826],
      zoom: 5.8,
    });

    mapRef.current.on('load', () => {
      if (!mapRef.current) return;
      mapRef.current.addSource('counties', { type: 'geojson', data: geojsonData });

      mapRef.current.addLayer({
        id: 'counties-layer',
        type: 'fill',
        source: 'counties',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'growthRate'], -9999],
            -9999, '#ccc',
            -0.08333333333333337, '#f2f0f7',
            0.12195121951219523, '#54278f'
          ],
          'fill-opacity': 0.8,
          'fill-outline-color': '#000',
        },
      });

      setMapLoaded(true);

      mapRef.current.on('mousemove', 'counties-layer', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const countyId = feature.properties?.id || feature.properties?.NAME || feature.properties?.county;
          if (countyId) {
            setHoveredCounty(countyId);
            setTooltipPos({ x: e.point.x, y: e.point.y });
          }
        }
      });

      mapRef.current.on('mouseleave', 'counties-layer', () => setHoveredCounty(null));
    });

    return () => {
      if (mapRef.current) mapRef.current.remove();
    };
  }, [geojsonData]);

  useEffect(() => {
    if (mapLoaded && Object.keys(countyData).length > 0) {
      updateChoropleth();
    }
  }, [year, countyData, mapLoaded]);

  const updateChoropleth = () => {
    if (!mapRef.current) return;
    const source = mapRef.current.getSource('counties') as mapboxgl.GeoJSONSource;
    if (!source) return;
    const data = {
      ...geojsonData,
      features: geojsonData.features.map((feature) => {
        const countyId = feature.properties?.id || feature.properties?.NAME || feature.properties?.county;
        const rate = countyData[countyId as string]?.growthRates[year] ?? null;
        feature.properties = { ...feature.properties, growthRate: rate };
        return feature;
      })
    };
    source.setData(data);
  };

  useEffect(() => {
    if (hoveredCounty && tooltipRef.current && countyData[hoveredCounty]) {
      const data = countyData[hoveredCounty].populations;
      const container = d3.select(tooltipRef.current);
      container.selectAll('*').remove();

      const countyName = hoveredCounty;
      const growthRate = countyData[hoveredCounty].growthRates[year] || 0;
      const source = countyData[hoveredCounty].sources[year] || "";

      container.append('div').style('font-weight', 'bold').style('margin-bottom', '5px').text(`County: ${countyName}`);
      container.append('div').style('margin-bottom', '5px').text(`Growth Rate: ${(growthRate * 100).toFixed(2)}% (Source: ${source})`);
      container.append('div').style('font-weight', 'bold').style('margin-bottom', '5px').text(`Population Growth`);

      const svgWidth = 200;
      const svgHeight = 100;
      const svg = container.append('svg').attr('width', svgWidth).attr('height', svgHeight);

      const margin = { top: 5, right: 10, bottom: 20, left: 60 };
      const width = svgWidth - margin.left - margin.right;
      const height = svgHeight - margin.top - margin.bottom;
      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3.scaleLinear().domain(d3.extent(data, d => d.year) as [number, number]).range([0, width]);
      const y = d3.scaleLinear().domain([0, d3.max(data, d => d.population) || 0]).nice().range([height, 0]);

      const line = d3.line<{ year: number; population: number }>().x(d => x(d.year)).y(d => y(d.population));

      g.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')));
      g.append('g').call(d3.axisLeft(y).ticks(5));

      // Add vertical line at 2020
      g.append('line')
        .attr('x1', x(2020))
        .attr('x2', x(2020))
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', 'grey')
        .attr('stroke-dasharray', '4')
        .attr('stroke-width', 1);
      
      g.append('path').datum(data).attr('fill', 'none').attr('stroke', 'steelblue').attr('stroke-width', 1.5).attr('d', line);
    }
  }, [hoveredCounty, countyData, year]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '600px', borderRadius: 8 }} />

      {validYears.length > 0 && (
        <div style={{ position: 'absolute', top: 10, left: 10, background: 'white', padding: '10px', zIndex: 2 }}>
          <label htmlFor="yearSlider">Year: {year}</label>
          <br />
          <input
            id="yearSlider"
            type="range"
            min={0}
            max={validYears.length - 1}
            value={validYears.indexOf(year)}
            onChange={(e) => setYear(validYears[Number(e.target.value)])}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{validYears[0]}</span>
            <span>{validYears[validYears.length - 1]}</span>
          </div>
        </div>
      )}

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
        <div style={{ width: '100%', height: '20px', background: 'linear-gradient(to right, #f2f0f7, #54278f)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>-8.34%</span>
          <span>12.2%</span>
        </div>
      </div>
    </div>
  );
};

export default ChoroplethMap;