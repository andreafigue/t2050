// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import * as d3 from "d3";
import * as d3Fetch from "d3-fetch";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

const routes = [
  {
    id: "route-1",
    label: "I-5",
    highway: "I-5",
    county: "Clark County",
    nb: [
      [-122.675045, 45.618140],  // Columbia River Bridge (Interstate Bridge)
      [-122.739470, 45.900791],  // Clark County Line (north)
    ],
    sb: [
      [-122.739629, 45.900399],
      [-122.675339, 45.618273],
    ],
  },
  {
    id: "route-2",
    label: "I-205",
    highway: "I-205",
    county: "Clark County",
    nb: [
      [-122.550088, 45.597248],  // Columbia River (Glenn Jackson Bridge)
      [-122.654696, 45.725555],  // Junction with I-5 (Salmon Creek area)
    ],
    sb: [
      [-122.656403, 45.729530],
      [-122.550391, 45.597354],
    ],
  },
];

const HARDCODED_ROUTES = {
  // I-5 NB route
  "route-1-nb": [[-122.675035,45.618137],[-122.661885,45.637077],[-122.661698,45.650181],[-122.667164,45.665328],[-122.663904,45.687482],[-122.652871,45.709648],[-122.654875,45.725497],[-122.676525,45.795737],[-122.704618,45.856541],[-122.706993,45.867503],[-122.714182,45.875713],[-122.730526,45.886047],[-122.739513,45.900779]],

  // I-205 NB route
  "route-2-nb": [[-122.550131,45.597241],[-122.552788,45.612003],[-122.558746,45.620154],[-122.559701,45.632873],[-122.566817,45.651622],[-122.577311,45.664296],[-122.586001,45.678236],[-122.599469,45.686375],[-122.613242,45.697468],[-122.624742,45.700892],[-122.632227,45.70774],[-122.645271,45.71541],[-122.652446,45.720747],[-122.654733,45.725548]],

  // I-5 SB route
  "route-1-sb": [[-122.739646,45.900394],[-122.730861,45.885981],[-122.714354,45.875462],[-122.707977,45.868073],[-122.67694,45.795612],[-122.656331,45.729636],[-122.653152,45.709973],[-122.664189,45.687501],[-122.66741,45.66524],[-122.661968,45.650295],[-122.662096,45.637503],[-122.675311,45.618265]],

  // I-205 SB route
  "route-2-sb": [[-122.656315,45.729537],[-122.656062,45.724093],[-122.65423,45.721411],[-122.63196,45.707078],[-122.625215,45.700809],[-122.613456,45.697187],[-122.600909,45.686962],[-122.586016,45.677501],[-122.5776,45.66409],[-122.568358,45.653104],[-122.560471,45.633998],[-122.559099,45.620036],[-122.553135,45.612165],[-122.550379,45.597356]],
}

const metrics = ["Travel Time"];

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

const routeDescriptions = {
  "route-1": {
    start: "Columbia River Bridge (Start of I-5 in Clark County)",
    end: "Clark County Line (North end of I-5 in Clark County)",
  },
  "route-2": {
    start: "Columbia River (Start of I-205 in Clark County)",
    end: "Junction with I-5 (North end of I-205 in Clark County)",
  },
};

const MapComponent = () => {
  const mapContainer = useRef(null);
  const chartRef = useRef(null);
  const map = useRef(null);

  const [selectedRoute, setSelectedRoute] = useState("route-1");
  const [direction, setDirection] = useState("nb");

  const yMetric = "Travel Time";

  const [chartData, setChartData] = useState([]);
  const [routeMiles, setRouteMiles] = useState(0);

  const [startMarker, setStartMarker] = useState(null);
  const [endMarker, setEndMarker] = useState(null);

  const [mapReady, setMapReady] = useState(false);


  const fetchAndUpdateData = async () => {
    const route = routes.find(r => r.id === selectedRoute);
    if (route && map.current && map.current.isStyleLoaded()) {
      const bounds = new mapboxgl.LngLatBounds();
      route[direction].forEach(coord => bounds.extend(coord));
      map.current.fitBounds(bounds, { padding: 100 });
    }

    const csv = await d3Fetch.csv("/data/2020&2045_InterstateTravelTimes_RTC.csv", d => {
      return {
        Highway: d["Highway"].trim(),
        County: d["County"].trim(),
        Direction: d["Direction"].trim(),
        // @ts-ignore
        StartTime: parseInt(d["Start Time"].split(":"[0])),
        Year: +d["Year"],
        Miles: +d["Miles"],
        "Travel Time": +d["Travel Time"],
        // Speed: +d["Speed"],
        // "Total Volume": + parseFloat(d["Total Volume"].replace(",", "")),
        // "Truck Volume": +d["Truck Volume"],
        // "Truck %": parseFloat(d["Truck %"].replace("%", ""))
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

    // Remove old markers if any
    if (startMarker) startMarker.remove();
    if (endMarker) endMarker.remove();

    const coords = route[direction];
    const desc = routeDescriptions[selectedRoute];

    const newStartPopup = new mapboxgl.Popup({ offset: {top: [0, 0], bottom: [0, -25]}, closeButton: false}).setText(desc?.start || "Start");
    const newEndPopup = new mapboxgl.Popup({ offset: {top: [0, 0], bottom: [0, -25]}, closeButton: false}).setText(desc?.end || "End");

    const newStart = new mapboxgl.Marker({ color: "blue" })
      .setLngLat(coords[0])
      .addTo(map.current);

    const newEnd = new mapboxgl.Marker({ color: "red" })
      .setLngLat(coords[coords.length - 1])
      .addTo(map.current);

    // Show popup on hover for Start Marker
    newStart.getElement().addEventListener("mouseenter", () => newStartPopup.addTo(map.current).setLngLat(coords[0]));
    newStart.getElement().addEventListener("mouseleave", () => newStartPopup.remove());

    // Show popup on hover for End Marker
    newEnd.getElement().addEventListener("mouseenter", () => newEndPopup.addTo(map.current).setLngLat(coords[coords.length - 1]));
    newEnd.getElement().addEventListener("mouseleave", () => newEndPopup.remove());

    setStartMarker(newStart);
    setEndMarker(newEnd);

  };

  useEffect(() => {
    if (mapReady){
      fetchAndUpdateData();
    }
  }, [selectedRoute, direction, mapReady]);

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

          //  Fetching coordinates from mapbox API
          //const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`;
          //const res = await fetch(url);
          //const data = await res.json();
          //const geometry = data.routes[0].geometry;
          //console.log(
          //  `// ${route.label} ${dir.toUpperCase()} route\nconst ${route.id}_${dir}_route = ${JSON.stringify(geometry.coordinates)};\n`
          //);

          const sourceId = `${route.id}-${dir}`;

          const routeCoords = HARDCODED_ROUTES[`${route.id}-${dir}`];

          // @ts-ignore
          map.current.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: routeCoords,
              },
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
          }, "road-label");

          if (route.id === selectedRoute && dir === direction) {
            // @ts-ignore
            map.current.setLayoutProperty(sourceId, "visibility", "visible");

            const bounds = new mapboxgl.LngLatBounds();
            HARDCODED_ROUTES[`${route.id}-${dir}`].forEach(coord => bounds.extend(coord));
            map.current.fitBounds(bounds, { padding: 100 });
          }
        }
      });

      setMapReady(true)
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

    const renderChart = () => {
      d3.select(chartRef.current).selectAll("*").remove();

      const margin = { top: 10, right: 30, bottom: 130, left: 60 };
      const containerWidth = chartRef.current.clientWidth;
      const containerHeight = chartRef.current.clientHeight;
      const width = containerWidth - margin.left - margin.right;
      const height = containerHeight - margin.top - margin.bottom;

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
        .call(d3.axisBottom(x).ticks(12).tickFormat((d) => {
          const hour = +d;
          const ampm = hour >= 12 ? "PM" : "AM";
          const displayHour = hour % 12 === 0 ? 12 : hour % 12;
          return `${displayHour} ${ampm}`;
        }));

      svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("text-anchor", "middle")
        .text("Hour of Day");

      svg.append("g").call(d3.axisLeft(y));

      svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -30)
        .attr("x", -height / 2)
        .attr("text-anchor", "middle")
        .text(`${yMetric} (min)`);

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
            const hour = d.hour;
            const ampm = hour >= 12 ? "PM" : "AM";
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            const formattedTime = `${displayHour} ${ampm}`;
            tooltip.style("display", "block").html(`${year} - ${formattedTime}<br/>${d[year]} mins ${yMetric}`);
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
      svg.append("circle").attr("cx", width - 40).attr("cy", 3).attr("r", 6).style("fill", "#8884d8");
      svg.append("text").attr("x", width - 30).attr("y", 4).text("2020").style("font-size", "12px").attr("alignment-baseline", "middle");

      svg.append("circle").attr("cx", width - 40).attr("cy", 23).attr("r", 6).style("fill", "#82ca9d");
      svg.append("text").attr("x", width - 30).attr("y", 24).text("2045").style("font-size", "12px").attr("alignment-baseline", "middle");
    };

    renderChart();

    const resizeObserver = new ResizeObserver(() => {
      renderChart();
    });

    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
    };

  }, [selectedRoute, direction, chartData]);

  return (

    <div className="flex gap-4 p-0 w-full h-full">
      {/* Left column: Map with overlayed filter box */}
      <div className="relative w-1/2 ">
        <div ref={mapContainer} className="h-[400px] w-full rounded-lg border shadow-md" />
        <div className="absolute top-2 left-2 bg-white p-2 border shadow-md rounded-md w-32 z-10 opacity-90 text-sm">
          <h2 className="text-lg font-semibold mb-1">Direction</h2>
          <div className="flex gap-1 flex-col">
            {["nb", "sb"].map((dir) => (
              <button
                key={dir}
                onClick={() => setDirection(dir)}
                className={`px-2 py-1 rounded-md text-sm capitalize border 
                  ${direction === dir ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100"}`}
              >
                {dir === "nb" ? "Northbound" : "Southbound"}
              </button>
            ))}
          </div>
        </div>

        {/* Floating Filter Box */}
        <div className="absolute top-32 left-2 bg-white p-2 border shadow-md rounded-md w-32 z-10 opacity-90 text-sm">
          <h2 className="text-lg font-semibold mb-1">Route</h2>
          <div className="flex gap-1">
            {routes.map((route) => (
              <button
                key={route.id}
                onClick={() => setSelectedRoute(route.id)}
                className={`px-2 py-1 rounded-md text-sm text-left border 
                  ${selectedRoute === route.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100"}`}
              >
                {route.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="absolute top-2 right-2 bg-white p-2 border shadow-md rounded-lg opacity-90">
          <p className="text-md font-semibold mb-0">Distance: {routeMiles} miles</p>
        </div>
      </div>

      {/* Right column: Chart */}
      <div className="w-1/2 bg-white border shadow-md rounded-lg h-[400px]">
        <h2 className="text-lg font-semibold pt-4 pl-4 pb-1">Travel Time Trends</h2>
        <div className="flex flex-col items-center h-full pb-4" ref={chartRef} />
      </div>
    </div>
  );
};

export default MapComponent;
