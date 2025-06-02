// app/choropleth/page.tsx
import React from 'react';
import dynamic from 'next/dynamic';
import FreightFlights from "../components/animations/flights";
import FreightShips from "../components/animations/ships";
import FreightTrains from "../components/animations/Trains";
import FreightCars from "../components/animations/Cars";
import BridgeNeedsMap from '../components/BridgeMap2';
import InteractiveGame from '../components/InteractiveGame';
import AirportQueue from '../components/AirportQueue';
import Population from '../components/Population';

const DynamicMapRoute = dynamic(() => import('../components/MapRoute2'), { loading: () => <p>Loading commute map…</p> });
const DynamicWashingtonMapWithLineGraphs = dynamic(() => import('../components/Freight'), { loading: () => <p>Loading freight trends…</p> });
const DynamicChartComponent = dynamic(() => import('../components/hsr2'), { loading: () => <p>Loading HSR chart…</p> });
const DynamicMapComponent = dynamic(() => import('../components/interstate'), { loading: () => <p>Loading freight map…</p> });
const DynamicDashboard = dynamic(() => import('../components/Dashboard'), { loading: () => <p>Loading dashboard…</p> });

export default function ChoroplethPage() {
  return (
    <div>
      <div className="container mx-auto px-4 py-8 mt-4 mb-0" style={{ margin: '0px', width: '1200px'}}>
        <h1 className="text-3xl font-bold mb-6">Challenge 2050: The Future in Motion</h1>
        
        <br/><br/><br/>
       
        <div className="container mb-8">
          <DynamicMapRoute />
        </div>

        <br/><br/><br/>

        <hr/>

        <div className="mb-4" style={{ padding: '1rem 1rem', width: "100%", height: "330px" }}>
          <DynamicChartComponent />
          <p style={{fontStyle: 'italic', paddingRight: "5px", textAlign: "right"}}>
          Note: These HSR travel times are based on projections from feasibility studies and are subject to change as the project develops.
          </p>
        </div>

        <br/><br/><hr/>
        <br/><br/>

        <div className="container " style={{  width: '1300px', height: '520px'}}>
          <DynamicWashingtonMapWithLineGraphs/>
        </div>

        <br/><br/><br/><hr/>
        <br/>

        <div style={{ padding: '1rem 1rem' }}>
          <BridgeNeedsMap />
        </div>

        <br/><hr/>
        <br/><br/>

        <div style={{width: "80%"}}>
          <AirportQueue />
        </div>

        <br/><br/><hr/>

        <br/><br/>

        <Population />
       
        <br/><br/><hr/>

        <div className="container mt-12" style={{  width: '1300px', height: '700px'}}>
          <DynamicMapComponent/>
        </div>

      </div>
    </div>
  );
}