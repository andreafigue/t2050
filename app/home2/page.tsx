// app/choropleth/page.tsx
import React from 'react';
import dynamic from 'next/dynamic';
//import fs from 'fs';
//import path from 'path';
//import type { FeatureCollection } from 'geojson';
//import { csvParse } from 'd3-dsv';
//import type { CountyCsvRow } from '../components/ChoroplethMap';
import FreightFlights from "../components/animations/flights";
import FreightShips from "../components/animations/ships";
import FreightTrains from "../components/animations/Trains";
import FreightCars from "../components/animations/Cars";
import BridgeNeedsMap from '../components/BridgeMap2';
import InteractiveGame from '../components/InteractiveGame';
import AirportQueue from '../components/AirportQueue';
import Population from '../components/Population';

//export const revalidate = 3600;

// const geojsonPath = path.join(process.cwd(), 'public', 'wa_counties.geojson');
// const csvPath = path.join(process.cwd(), 'public', 'county_data.csv');
// const geojsonData: FeatureCollection = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
// const countyCsvData: CountyCsvRow[] = csvParse(
//   fs.readFileSync(csvPath, 'utf-8'),
//   (d) => ({
//     County: d.County,
//     Year: Number(d.Year),
//     Population: Number(d.Population),
//     Source: d.Source,
//     rate: Number(d.rate),
//   })
// );

//const DynamicChoroplethMap = dynamic(() => import('../components/ChoroplethMap'), { loading: () => <p>Loading map…</p> });
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
        <p className="mb-4">
          By the year 2050, Washington State will be home to 10 million people—a population surge of 1.8 million, with the vast majority settling in the already-bustling central Puget Sound region. 
          <br/><br/>
          Such growth poses profound questions for the state’s future. Chief among them: How will Washingtonians move?
          <br/><br/>
          As roads, bridges, ferries, railways, and airports strain under increased demand, state and regional leaders face a stark choice—invest boldly and strategically now, or face the rising costs of inaction: clogged highways, delayed flights, and a quality of life diminished by congestion.
        </p>
        <h2 className="text-2xl font-semibold mb-4">A Changing State</h2>
        <p className="mt-4 mb-8">
          Washington’s evolution has been decades in the making. From 1961 through projections for 2050, population growth has shifted the balance across counties, reshaping urban and rural communities alike.
          <br/><br/>
          <strong>Explore:</strong> See how our state’s population has changed since 1961 and is predicted to continue to grow over the next 25 years.
        </p>
        <Population />
        <br/>
        <h2 className="text-2xl font-semibold mb-4">The Commute, Reimagined</h2>
        <p className="mt-4 mb-4">
          This growth is more than abstract data—it affects everyday lives. More cars on the road mean longer commutes, greater stress, and fewer hours at home. Without preservation of our existing roads and bridges and new investments, average travel times could stretch well beyond tolerable limits.
        </p>
        <strong>
          Did you know?
        </strong>
        <ul className="list-disc pl-6 mb-6 mt-2">
          <li>In 2022, the average commuter spent 82 hours stuck in traffic at an annual cost of $1,874.</li>
          <li>Congestion contributes 621,000 metric tons of excess carbon dioxide emissions annually, contributing to climate change.</li>
        </ul>
        <p className="mt-4 mb-4">
          <strong>Explore:</strong> See how much longer a trip will take in 2050 if we don’t plan for future growth. 
        </p>
        {/*<FreightCars />*/}

        <div className="container mb-8">
          <DynamicMapRoute />
        </div>

        <br/>

        <div className="container mt-12" style={{  width: '1300px', height: '700px'}}>
          <DynamicMapComponent/>
        </div>

        <h2 className="text-2xl font-semibold mb-4">Airports Under Pressure</h2>
        
        {/*<FreightFlights />*/}
        
        <p className="mt-4 mb-8">
          Air travel, too, will feel the crunch. With Puget Sound’s population expected to swell, we need more capacity. TSA wait times could soar—especially during holidays and peak seasons—slowing both leisure travelers and the cargo planes that carry Washington’s exports abroad.
          <br/><br/>
          Without serious investment in airport capacity, delays and bottlenecks will become more than an inconvenience—they’ll be an impediment to commerce and global connectivity.
        </p>
        <strong>
          Did you know?
        </strong>
        <ul className="list-disc pl-6 mb-6 mt-2">
          <li>Demand for take-offs and landings are projected to double by 2050, resulting in unmet demand by 2050 that is roughly equivalent to all passengers served at Sea-Tac in 2019.</li>
          <li>The region will fall short of on-airport warehouse space for air cargo by 2027.</li>
        </ul>
        <p className="mt-4 mb-4">
          <strong>Explore:</strong> See how TSA wait times – including for TSA PreCheck users – could grow without more investment in our state’s airports.  
        </p>

        <div>
          <AirportQueue />
        </div>

        <h2 className="text-2xl font-semibold mb-4 mt-4">Freight and the Backbone of Commerce</h2>

        {/*<FreightShips />*/}

        <p className="mt-4 mb-8">
          Goods movement is no less essential. As Washington’s economy grows, so will the demand on freight corridors—by highway, rail, sea, and air. 
        </p>

        <strong>
          Did you know?
        </strong>
        <ul className="list-disc pl-6 mb-6 mt-2">
          <li>Freight transported within Washington is forecast to increase by more than 40%, and imports and exports by more than 50%.</li>
          <li>The number of truck miles traveled per day is forecast to increase by 27%.</li>
        </ul>
        <p className="mt-4 mb-4">
          <strong>Explore:</strong>  Learn how cargo moves around the state and how it is expected to grow to meet the increased demand of a growing population. Cargo that can’t get to overseas markets harms our state’s economy, including the 1 in 4 jobs dependent on international trade. 
        </p>

        <div className="container " style={{  width: '1300px', height: '600px'}}>
          <DynamicWashingtonMapWithLineGraphs/>
        </div>
        <br/> 
        <h2 className="text-2xl font-semibold mb-4">
          The Quiet Crisis Beneath Our Roads
        </h2>
        <p className="mt-4 mb-8">
          Beneath the weight of growth lies a quieter crisis: infrastructure decay. The state’s 8,400-plus bridges—essential connectors for people and goods—are aging. A bridge in disrepair may not make headlines until it fails, but the data reveals a system in urgent need of maintenance.
        </p>

        <strong>
          Did you know?
        </strong>
        <ul className="list-disc pl-6 mb-6 mt-2">
          <li>More than 55% of bridges across the state are in only fair condition and inching ever closer to falling into poor condition.</li>
          <li>In April 2025, WSDOT permanently closed the 103-year old SR 165 Carbon River/Fairfax Bridge because it was no longer safe to drive on, cutting off access to popular Mount Rainier recreation areas and requiring a 9-mile emergency access detour.</li>
          <li>Preservation funding is only 40% of what is needed to keep our infrastructure in a state of good repair.  </li>
        </ul>
        <p className="mt-4 mb-4">
          <strong>Explore:</strong>  Inspect the condition of spans across the state and see what detours would be required if bridges were closed before they could be repaired or replaced.
        </p>
        <div style={{ padding: '1rem 1rem' }}>
          <BridgeNeedsMap />
        </div>
        <h2 className="text-2xl font-semibold mb-4 mt-4">
          A High-Speed Vision
        </h2>

        <p className="mt-4 mb-4">
          The future isn’t just about fixing what’s broken—it’s also about imagining what could be. One vision being explored is the development of an ultra-high-speed rail system linking Vancouver, BC; Seattle, WA; and Portland, OR, with trains topping 250 mph. This would offer an alternative to congested highways and security lines at the airport.
        </p>
        <p className="mb-4">
          <strong>Explore:</strong>   Trips between Seattle and Vancouver, BC or Seattle and Portland, OR could be an hour or shorter —redefining what it means to live and work in the Pacific Northwest.
        </p>

        <div className="mb-4" style={{ padding: '1rem 1rem', width: "100%", height: "330px" }}>
          <DynamicChartComponent />
          <p style={{fontStyle: 'italic', paddingRight: "5px", textAlign: "right"}}>
          Note: These HSR travel times are based on projections from feasibility studies and are subject to change as the project develops.
          </p>
        </div>
        
        <h2 className="text-2xl font-semibold mb-4">
        An Invitation to Explore and Shape the Future
        </h2>
        <p className="mt-4 mb-4">
          The future is in your hands. 
        </p>
        <p className="mt-4 mb-10">
          <strong>Explore:</strong> Use this interactive tool to watch in real time how each decision affects congestion. It’s an engaging—and sobering—look at how transportation planning decisions ripple outward.
        </p>
        <InteractiveGame  />
        <p className="mt-10 mb-0">
          <strong>Explore:</strong>  See how population growth will impact each Washington county.  For policymakers, commuters, and curious citizens, it’s a window into the future—and a call to action. As Washington stands on the threshold of unprecedented growth, its path forward is clear. Investment today will determine whether the state’s transportation network can carry the weight of tomorrow.
        </p>
      </div>
      <div className="mx-auto" style={{width: "90%", height: "100%", margin: "0 auto", background: '#f4f4f4', borderRadius: 2 }}>
        <DynamicDashboard />
      </div>
    </div>
  );
}