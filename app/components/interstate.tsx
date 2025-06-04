"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import * as d3 from "d3";
import * as d3Fetch from "d3-fetch";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

const routes = [
  {
    id: "route-1",
    label: "I-5 Clark County",
    highway: "I-5",
    county: "Clark County",
    nb: [
      [-122.6765, 45.5152],
      [-122.6650, 45.7500],
    ],
    sb: [
      [-122.6650, 45.7500],
      [-122.6765, 45.5152],
    ],
  },
  {
    id: "route-2",
    label: "I-205 Clark County",
    highway: "I-205",
    county: "Clark County",
    nb: [
      [-122.5730, 45.5160],
      [-122.5730, 45.7500],
    ],
    sb: [
      [-122.5730, 45.7500],
      [-122.5730, 45.5160],
    ],
  },
  // {
  //   id: "route-3",
  //   label: "I-5 Oregon",
  //   highway: "I-5",
  //   county: "Portland, OR",
  //   nb: [
  //     [-122.7715, 45.2654],
  //     [-122.6765, 45.5152],
  //   ],
  //   sb: [
  //     [-122.6765, 45.5152],
  //     [-122.7715, 45.2654],
  //   ],
  // },
  // {
  //   id: "route-4",
  //   label: "I-205 Oregon",
  //   highway: "I-205",
  //   county: "Portland, OR",
  //   nb: [
  //     [-122.7555, 45.3720],
  //     [-122.5730, 45.5160],
  //   ],
  //   sb: [
  //     [-122.5730, 45.5160],
  //     [-122.7555, 45.3720],
  //   ],
  // },
];

const metrics = ["Travel Time", "Speed", "Total Volume", "Truck Volume", "Truck %"];

const haversineDistance = ([lon1, lat1], [lon2, lat2]) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
};

const MapComponent = () => {
  const mapContainer = useRef(null);
  const chartRef = useRef(null);
  const map = useRef(null);

  const [selectedRoute, setSelectedRoute] = useState("route-1");
  const [direction, setDirection] = useState("nb");
  const [yMetric, setYMetric] = useState("Travel Time");
  const [chartData, setChartData] = useState([]);
  const [routeMiles, setRouteMiles] = useState(0);

  const fetchAndUpdateData = async () => {
    const route = routes.find(r => r.id === selectedRoute);
    if (route && map.current) {
      const bounds = new mapboxgl.LngLatBounds();
      route[direction].forEach(coord => bounds.extend(coord));
      // @ts-ignore
      map.current.fitBounds(bounds, { padding: 50 });
    }

    const csv = await d3Fetch.csv("/data/2020&2045_ InterstateTravelTimes_RTC.csv", d => {
      return {
        Highway: d["Highway"].trim(),
        County: d["County"].trim(),
        Direction: d["Direction"].trim(),
        // @ts-ignore
        StartTime: parseInt(d["Start Time"].split(":"[0])),
        Year: +d["Year"],
        Miles: +d["Miles"],
        "Travel Time": +d["Travel Time"],
        Speed: +d["Speed"],
        "Total Volume": + parseFloat(d["Total Volume"].replace(",", "")),
        "Truck Volume": +d["Truck Volume"],
        "Truck %": parseFloat(d["Truck %"].replace("%", ""))
      }
    });

    const filtered = csv.filter(d =>
      // @ts-ignore
      d.Highway === route.highway &&
      // @ts-ignore
      d.County === route.county &&
      d.Direction === direction.toUpperCase()
    );

    const grouped = d3.groups(filtered, d => d.StartTime);

    const data = grouped.map(([hour, entries]) => {
      const byYear = Object.fromEntries(
        entries.map(e => [e.Year, e[yMetric]])
      );
      return {
        hour,
        ...byYear
      };
    }).sort((a, b) => a.hour - b.hour);
    // @ts-ignore
    setChartData(data);
    // @ts-ignore
    if (filtered.length > 0) setRouteMiles(filtered[0].Miles.toFixed(2));
  };

  useEffect(() => {
    fetchAndUpdateData();
  }, [selectedRoute, direction, yMetric]);

    useEffect(() => {
    if (map.current) return;
    // @ts-ignore
    map.current = new mapboxgl.Map({
      // @ts-ignore
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-122.6750, 45.5231],
      zoom: 9,
    });

    // @ts-ignore
    map.current.on("load", () => {
      routes.forEach(async (route) => {
        for (const dir of ["nb", "sb"]) {
          const coords = route[dir];
          const [start, end] = coords;
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`;

          const res = await fetch(url);
          const data = await res.json();
          const geometry = data.routes[0].geometry;

          const sourceId = `${route.id}-${dir}`;

          // @ts-ignore
          map.current.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              geometry,
            },
          });

          // @ts-ignore
          map.current.addLayer({
            id: sourceId,
            type: "line",
            source: sourceId,
            layout: { visibility: "none" },
            paint: {
              "line-color": "blue",
              "line-width": 5,
            },
          });

          if (route.id === selectedRoute && dir === direction) {
            // @ts-ignore
            map.current.setLayoutProperty(sourceId, "visibility", "visible");
          }
        }
      });
    });
  }, []);

  useEffect(() => {
    if (!map.current) return;

    routes.forEach((route) => {
      ["nb", "sb"].forEach((dir) => {
        const layerId = `${route.id}-${dir}`;
        const isVisible = selectedRoute === route.id && direction === dir;
        // @ts-ignore
        if (map.current.getLayer(layerId)) {
          // @ts-ignore
          map.current.setLayoutProperty(
            layerId,
            "visibility",
            isVisible ? "visible" : "none"
          );
        }
      });
    });
  }, [selectedRoute, direction]);

  useEffect(() => {
    if (!chartRef.current) return;
    d3.select(chartRef.current).selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3
      .select(chartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, 23]).range([0, width]);
    const yMax = d3.max(chartData.flatMap(d => [d["2020"], d["2045"]]));
    // @ts-ignore
    const y = d3.scaleLinear().domain([0, yMax ? yMax * 1.1 : 60]).range([height, 0]);


    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(12).tickFormat((d) => `${d}:00`));

    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height + 40)
      .attr("text-anchor", "middle")
      .text("Hour of Day");

    svg.append("g").call(d3.axisLeft(y));

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -50)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .text(`${yMetric} (units)`);

    // @ts-ignore
    const tooltip = d3.select(chartRef.current.parentNode)
      .append("div")
      .style("position", "absolute")
      .style("background", "white")
      .style("border", "1px solid #ccc")
      .style("padding", "5px")
      .style("display", "none");

    const drawLine = (year, color) => {
      svg.append("path")
        .datum(chartData)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("d", d3.line()
          // @ts-ignore
          .x(d => x(d.hour))
          .y(d => y(d[year])))
        .attr("stroke-dasharray", function () {
          const length = this.getTotalLength();
          return `${length} ${length}`;
        })
        .attr("stroke-dashoffset", function () {
          return this.getTotalLength();
        })
        .transition()
        .duration(1000)
        .attr("stroke-dashoffset", 0);

      svg.selectAll(`.dot-${year}`)
        .data(chartData)
        .enter().append("circle")
        .attr("class", `dot-${year}`)
        // @ts-ignore
        .attr("cx", d => x(d.hour))
        .attr("cy", d => y(d[year]))
        .attr("r", 4)
        .attr("fill", color)
        .on("mouseover", (event, d) => {
          // @ts-ignore
          tooltip.style("display", "block").html(`${year} - ${d.hour}:00<br/>${d[year]} ${yMetric}`);
        })
        .on("mousemove", (event) => {
          tooltip.style("left", `${event.pageX + 10}px`).style("top", `${event.pageY - 20}px`);
        })
        .on("mouseout", () => {
          tooltip.style("display", "none");
        });
    };

    drawLine("2020", "#8884d8");
    drawLine("2045", "#82ca9d");

    // Add legend to top right
    svg.append("circle").attr("cx", width - 100).attr("cy", 10).attr("r", 6).style("fill", "#8884d8");
    svg.append("text").attr("x", width - 90).attr("y", 14).text("2020").style("font-size", "12px").attr("alignment-baseline", "middle");

    svg.append("circle").attr("cx", width - 100).attr("cy", 30).attr("r", 6).style("fill", "#82ca9d");
    svg.append("text").attr("x", width - 90).attr("y", 34).text("2045").style("font-size", "12px").attr("alignment-baseline", "middle");
  }, [selectedRoute, direction, yMetric, chartData]);

  return (
    <div className="flex gap-4 p-4" style={{ width: "100%", height:"700px" }}>
      <div className="w-1/6 p-4 border bg-white"  style={{borderRadius: 8}}>
        <h2 className="text-lg font-bold mb-4">Select Route</h2>
        {routes.map((route) => (
          <label key={route.id} className="block text-sm font-medium capitalize">
            <input
              type="radio"
              name="route"
              value={route.id}
              checked={selectedRoute === route.id}
              onChange={() => setSelectedRoute(route.id)}
              className="mr-2"
            />
            {route.label}
          </label>
        ))}
        <h2 className="text-lg font-semibold mt-6 mb-2">Select Direction</h2>
        <label className="block text-sm font-medium capitalize">
          <input
            type="radio"
            name="direction"
            value="nb"
            checked={direction === "nb"}
            onChange={() => setDirection("nb")}
            className="mr-2"
          />
          Northbound
        </label>
        <label className="block text-sm font-medium capitalize ">
          <input
            type="radio"
            name="direction"
            value="sb"
            checked={direction === "sb"}
            onChange={() => setDirection("sb")}
            className="mr-2"
          />
          Southbound
        </label>
        <h2 className="text-lg font-semibold mt-6 mb-2">Y-Axis Metric</h2>
        <select
          className="w-full p-2 border rounded"
          value={yMetric}
          onChange={(e) => {
            setYMetric(e.target.value);
          }}
        >
          {metrics.map((metric) => (
            <option key={metric} value={metric}>{metric}</option>
          ))}
        </select>
        <p className="mt-6 text-md font-semibold ">Distance: {routeMiles} miles</p>
      </div>
      <div className="w-5/6 flex flex-col gap-4 border p-4 bg-white" style={{borderRadius: 8}}>
        <div ref={mapContainer} className="flex flex-col border h-1/2 " style={{borderRadius: 8}}/>
        <div className="flex flex-col items-center h-1/2">
          <div ref={chartRef} />
        </div>
      </div>
    </div>
  );
};

export default MapComponent;
