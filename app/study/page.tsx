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
      <div className="container mx-auto px-4 py-8 mt-4 mb-0" 
        style={{ margin: '0px', width: '1200px', fontFamily: "Encode Sans Compressed, sans-serif"}}>
        <h1 className="text-3xl font-bold mb-6">Challenge 2050: The Future in Motion</h1>

        <br/>

        <h3 className="text-3xl mb-6">
          1. Map of Population Growth
        </h3><br/>

        <div >
          <Population style={{height: "700px"}}/>
        </div>

        <br/>
       
        <hr/>
        
        <br/>
        <h3 className="text-3xl mb-6">
          2. Map of Projected Traffic Levels
        </h3>
        <br/>
       
        <div className="container mb-8">
          <DynamicMapRoute />
        </div>

        <br/><br/><hr/>

        <h3 className="text-3xl mb-6">
          3. Map of Travel Times in Clark County
        </h3>

        <div className="container mt-12" style={{  width: '1300px', height: '450px'}}>
          <DynamicMapComponent/>
        </div>

        <hr/>

        <h3 className="text-3xl mb-6">
          4. TSA Wait Times
        </h3>

        <br/>

        <div style={{width: "80%" }}>
          <AirportQueue />
        </div>

        <br/><br/><hr/>
        <br/>

        <h3 className="text-3xl mb-6">
          5. Trade Map of WA State
        </h3>

        <div className="container " style={{  width: '1300px', height: '750px'}}>
          <DynamicWashingtonMapWithLineGraphs/>
        </div>
        <br/><br/>
        <hr/>
        <br/>
        <h3 className="text-3xl mb-6">
          6. Map of Bridge Conditions
        </h3>
        <div style={{ padding: '1rem 1rem' }}>
          <BridgeNeedsMap />
        </div>

        <br/><hr/>

        <h3 className="text-3xl mb-6">
          7. Traffic Mode Travel Times
        </h3>
        <div className="mb-4" style={{ padding: '1rem 1rem', width: "100%", height: "330px" }}>
          <DynamicChartComponent />
          <p style={{fontStyle: 'italic', paddingRight: "5px", textAlign: "right"}}>
          Note: These HSR travel times are based on projections from feasibility studies and are subject to change as the project develops.
          </p>
        </div>

        <br/><br/>
        
        

      </div>
    </div>
  );
}