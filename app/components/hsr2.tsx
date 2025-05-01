"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const cities = ["Vancouver", "Seattle", "Portland"];

const travelTimes = {
  Car: {
    "Seattle-Vancouver": 210,
    "Seattle-Portland": 180,
    "Portland-Vancouver": 330,
    "Vancouver-Seattle": 210,
    "Portland-Seattle": 180,
    "Vancouver-Portland": 330,
  },
  Train: {
    "Seattle-Vancouver": 255,
    "Seattle-Portland": 225,
    "Portland-Vancouver": 495,
    "Vancouver-Seattle": 255,
    "Portland-Seattle": 225,
    "Vancouver-Portland": 495,
  },
  HSR: {
    "Seattle-Vancouver": 47,
    "Seattle-Portland": 58,
    "Portland-Vancouver": 110,
    "Vancouver-Seattle": 47,
    "Portland-Seattle": 58,
    "Vancouver-Portland": 110,
  },
  Air: {
    "Seattle-Vancouver": 60,
    "Seattle-Portland": 55,
    "Portland-Vancouver": 70,
    "Vancouver-Seattle": 60,
    "Portland-Seattle": 55,
    "Vancouver-Portland": 70,
  },
};

const ChartComponent = () => {
  const [origin, setOrigin] = useState("Vancouver");
  const [destination, setDestination] = useState("Seattle");
  const chartRef = useRef(null);

  const routeKey = `${origin}-${destination}`;
  const data = ["HSR", "Air", "Car", "Train"].map((mode) => ({
    mode,
    time: travelTimes[mode][routeKey],
  }));

  useEffect(() => {
    requestAnimationFrame(() => {
      if (!chartRef.current) return;

      const svg = d3.select(chartRef.current);
      const margin = { top: 20, right: 30, bottom: 10, left: 150 };
      const width = 600 - margin.left - margin.right;
      const height = 200;

      // const x = d3.scaleLinear().domain([0, d3.max(data, (d) => d.time) * 1.1]).range([0, width]);
      const maxTime = Math.max(
        ...Object.values(travelTimes).flatMap((mode) => Object.values(mode))
      );
      const x = d3.scaleLinear().domain([0, maxTime * 1.1]).range([0, width]);

      const y = d3.scaleBand().domain(data.map((d) => d.mode)).range([0, height]).padding(0.1);

      let g = svg.select("g");
      if (g.empty()) {
        // @ts-ignore
        g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
      }

      // === Bars ===
      // @ts-ignore
      const bars = g.selectAll("rect.bar-d3").data(data, (d) => d.mode);

      bars
        .join(
          (enter) =>
            enter
              .append("rect")
              .attr("class", "bar-d3")
              // @ts-ignore
              .attr("y", (d) => y(d.mode) + (y.bandwidth() - 10) / 2)
              .attr("height", 10)
              .attr("x", 0)
              .attr("width", 0)
              .style("fill", "#3B82F6")
              .attr("rx", 6)
              .attr("ry", 6)
              .call((enter) =>
                enter.transition().duration(1000).attr("width", (d) => x(d.time))
              ),
          (update) =>
            update.call((update) =>
              update
                .transition()
                .duration(1000)
                .attr("width", (d) => x(d.time))
            )
        );

      // === Labels (minutes) ===
      // @ts-ignore
      const labels = g.selectAll("text.label").data(data, (d) => d.mode);

      labels
        .join(
          (enter) =>
            enter
              .append("text")
              .attr("class", "label")
              // @ts-ignore
              .attr("y", (d) => y(d.mode) + y.bandwidth() / 2 + 4)
              .attr("x", 0)
              .style("font-size", "16px")
              .style("fill", "#444")
              .text((d) => `${d.time} min`)
              .call((enter) =>
                enter.transition().duration(1000).attr("x", (d) => x(d.time) + 45)
              ),
          (update) =>
            update.call((update) =>
              update
                .transition()
                .duration(1000)
                .tween("text", function (d) {
                  // @ts-ignore
                  const current = parseInt(this.textContent);
                  const i = d3.interpolate(current, d.time);
                  return function (t) {
                    const value = Math.round(i(t));
                    d3.select(this)
                      .attr("x", x(value) + 45)
                      .text(`${value} min`);
                  };
                })
            )
      );

      // === Icons ===
      const iconMap = {
        Car: "/animations/car.png",
        Train: "/animations/train.png",
        HSR: "/animations/hsr.png",
        Air: "/animations/airplane.png",
      };

      // @ts-ignore
      const icons = g.selectAll("image.icon").data(data, (d) => d.mode);

      icons
        .join(
          (enter) =>
            enter
              .append("image")
              .attr("class", "icon")
              .attr("href", (d) => iconMap[d.mode])
              // @ts-ignore
              .attr("y", (d) => y(d.mode) + y.bandwidth() / 2 - 30)
              .attr("x", 0)
              .attr("width", 60)
              .attr("height", 60)
              .call((enter) =>
                enter.transition().duration(1000).attr("x", (d) => x(d.time) - 30)
              ),
          (update) =>
            update.call((update) =>
              update.transition().duration(1000).attr("x", (d) => x(d.time) - 30)
            )
        );

      // === Mode Labels on the Left ===
        // @ts-ignore
      const modeLabels = g.selectAll("text.mode-label").data(data, (d) => d.mode);

      modeLabels
        .join(
          (enter) =>
            enter
              .append("text")
              .attr("class", "mode-label")
              .attr("x", -10)
              // @ts-ignore
              .attr("y", (d) => y(d.mode) + y.bandwidth() / 2 + 5)
              .attr("text-anchor", "end")
              .style("font-size", "16px")
              .style("fill", "#222")
              .text((d) => {
                if (d.mode === "HSR") return "High-Speed Rail";
                if (d.mode === "Air") return "Air travel";
                return d.mode;
              }),
          (update) =>
            update.call((update) =>
              update
                .transition()
                .duration(500)
                // @ts-ignore
                .attr("y", (d) => y(d.mode) + y.bandwidth() / 2 + 5)
            )
        );
    });
  }, [origin, destination]);

  return (
    <div className="flex h-full">
      {/* Filters */}
      <div className="w-2/6 p-6 bg-white border-r">
        <div className="flex justify-between gap-4">
          {/* From Column */}
          <div className="flex-1">
            <h5 className="font-semibold text-gray-700 mb-2 text-center">From</h5>
            <ul className="space-y-2">
              {cities.map((city) => (
                <li
                  key={city}
                  className={`cursor-pointer px-3 py-2 text-center rounded-md border ${
                    origin === city
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-gray-100 hover:bg-gray-200"
                  } ${city === destination ? "opacity-50 pointer-events-none" : ""}`}
                  onClick={() => city !== destination && setOrigin(city)}
                >
                  {city}
                </li>
              ))}
            </ul>
          </div>

          {/* To Column */}
          <div className="flex-1">
            <h5 className="font-semibold text-gray-700 mb-2 text-center">To</h5>
            <ul className="space-y-2">
              {cities.map((city) => (
                <li
                  key={city}
                  className={`cursor-pointer px-3 py-2 text-center rounded-md border ${
                    destination === city
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-gray-100 hover:bg-gray-200"
                  } ${city === origin ? "opacity-50 pointer-events-none" : ""}`}
                  onClick={() => city !== origin && setDestination(city)}
                >
                  {city}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>



      {/* D3 Chart */}
      <div className="w-4/6 pl-4 pr-10 py-10 flex flex-col justify-center items-start">
        <svg ref={chartRef} width={700} height={330}></svg>
      </div>
    </div>
  );
};

export default ChartComponent;
