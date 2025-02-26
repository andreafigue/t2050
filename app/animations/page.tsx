'use client';

import React, { useState } from "react";
import FreightCars from "../components/animations/Cars";
import FreightBuses from "../components/animations/Buses";
import FreightTrains from "../components/animations/Trains";
import FreightFlights from "../components/animations/flights";
import FreightUltra from "../components/animations/ultra";
import FreightInfo from "../components/animations/info";
import FreightShips from "../components/animations/ships";


export default function Home() {
  return (
    <div className="App">
      <div>
        <h2 style={{ marginBottom: "40px", textAlign: "center" }}>
          Freight : [TO BE TITLED]
        </h2>
        <div style={{ position: "relative"}}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "50px",
            padding: "20px",
            overflow: "auto"
          }}>
            <FreightCars />
            {/* <Scenario1Buses /> */}
            <FreightTrains />
            <FreightFlights />
            <FreightShips />
            {/* <FreightUltra /> */}
          </div>
          <FreightInfo />
        </div>
      </div>
    </div>
  )};