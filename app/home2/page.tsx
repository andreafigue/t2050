// app/choropleth/page.tsx
import React from 'react';
import ChoroplethMap, { CountyCsvRow } from '../components/ChoroplethMap';
import GraySquare from '../components/GraySquare';
//import fs from 'fs/promises';
import { promises as fs } from 'fs'
import path from 'path';
import type { FeatureCollection } from 'geojson';
import { csvParse } from 'd3-dsv';
//import MapWrapper from '../components/MapWrapper';
import MapRoute from '../components/MapRoute2';
import AirportQueue from '../components/AirportQueue';
import FreightAreaChart from '../components/FreightAreaChart';
import FreightFlights from "../components/animations/flights";
import FreightShips from "../components/animations/ships";
import FreightTrains from "../components/animations/Trains";
import FreightCars from "../components/animations/Cars";
import WashingtonMapWithLineGraphs from '../components/Freight';

import TravelComparison from '../components/hsr';
import BridgeNeedsMap from '../components/BridgeMap';

export default async function ChoroplethPage() {
  // Read and parse the GeoJSON file.
  const geojsonFilePath = path.join(process.cwd(), 'public', 'wa_counties.geojson');
  const geojsonDataRaw = await fs.readFile(geojsonFilePath, 'utf-8');
  const geojsonData: FeatureCollection = JSON.parse(geojsonDataRaw);

  // Read and parse the single CSV file (county_data.csv).
  const csvFilePath = path.join(process.cwd(), 'public', 'county_data.csv');
  let countyCsvData: CountyCsvRow[] = [];
  try {
    const csvFileContent = await fs.readFile(csvFilePath, 'utf-8');
    countyCsvData = csvParse(csvFileContent, (d) => ({
      County: d.County,
      Year: Number(d.Year),
      Population: Number(d.Population),
      Source: d.Source,
      rate: Number(d.rate),
    }));
  } catch (err) {
    console.error('Error reading county CSV:', err);
  } return (
    <div className="container mx-auto px-4 py-8" style={{ margin: '40px', width: '1200px'}}>
      <h1 className="text-3xl font-bold mb-6">Challenge 2050: The Future in Motion</h1>
      <p className="mb-4">
        By 2050, Washington’s population is expected to grow by 1.8 million more people, 
        increasing to 10 million calling our state home. Of those new residents, 1.5 million 
        will be in the central Puget Sound region.  King, Pierce, Snohomish, and Kitsap counties 
        will be home to 5.8 million people, a 35% increase compared to today. 
        <br/><br/>
        This rapid growth will reshape how we live, work, and move. Our transportation system, 
        already under strain, will face unprecedented challenges that demand bold, coordinated action. 
        This visualization invites you to explore the future of Washington’s mobility needs, uncovering 
        the impacts of growth, infrastructure projects, and potential solutions.
      </p>
      <h2 className="text-2xl font-semibold mb-4">A Region on the Rise: Population Growth from 1961 to 2050</h2>
      <p className="mt-4 mb-8">
        Population growth doesn’t happen overnight—it unfolds over decades. Using historical data 
        from 1961 and projections through 2050, we can trace how demographic shifts have shaped, 
        and will continue to shape, our state. Explore the interactive map below to see growth 
        trends across counties. Use the slider to move through time, and hover over each county to 
        view detailed population changes year by year.
      </p>

      <ChoroplethMap geojsonData={geojsonData} countyCsvData={countyCsvData} />

      <br/>
      <h2 className="text-2xl font-semibold mb-4">The Road Ahead: How Growth Impacts You</h2>

      <p className="mt-4 mb-8">
        Population growth isn’t just a statistic—it’s a reality that will reshape your daily life. 
        More people mean more cars on the road, higher demand for public transit, and increased strain 
         infrastructure. Without preservation of our existing infrastructure and strategic investments in 
         mobility, longer commutes that reduce our quality of life will become the norm. As millions of new 
         residents rely on the same roads, rail lines, and airports, commute times, travel costs, and overall 
         mobility will be significantly impacted. 
      </p>

      <FreightCars />

      <p className="mt-4 mb-8">
        How will this affect you? Use the interactive tool below to see how your daily commute might 
        change by 2050. Simply enter your origin and destination to compare current travel times with 
        projections for the future, based on different infrastructure investment scenarios.
      </p>
      
      <MapRoute />

      <div style={{height: '84px'}}/>
      
      <p className="mt-4 mb-8">
      Your commute is more than just a trip—it’s time out of your day, every day. This visualization 
      helps you understand how future growth and infrastructure decisions will directly affect the 
      time you spend getting to your destination, enabling you to see why we need to start now to 
      plan for Washington’s transportation future.
      </p>

      <h2 className="text-2xl font-semibold mb-4">Cleared for Takeoff? The Future of TSA Wait Times at SEA-TAC Airport</h2>
      
      <FreightFlights />
      
      <p className="mt-4 mb-8">
        As the central Puget Sound region’s population surges toward 5.8 million by 2050, airports will face unprecedented passenger volumes. This growth will directly impact TSA security wait times, with delays affecting leisure and business travelers and air cargo planes exporting Washington’s agriculture products to international customers. Without an increase in capacity, Washington residents will experience significantly longer security lines, especially during peak travel seasons.
      </p>

      <div>
        <AirportQueue />
      </div>

      <p className="mt-4 mb-8">
        This visualization highlights the critical need for proactive airport planning and infrastructure investments. Efficient, future-ready airports aren’t just about convenience—they’re essential for keeping our state connected to the world.
      </p>

      <h2 className="text-2xl font-semibold mb-4">Freight on the Move: The Future of Goods Transportation</h2>

      <FreightShips />

      <p className="mt-4 mb-8">
        As Washington’s population and economy grow, so does the demand for efficient freight movement. 
        By 2050, the volume of goods transported across the state is expected to rise significantly, 
        impacting highways, railways, ports, and air cargo facilities. Our interactive visualization 
        allows you to explore freight projections, filtering by mode of transportation and cargo type to 
        see how different industries will be affected. Strategic investments in freight infrastructure 
        are essential to keeping supply chains moving, reducing congestion, and ensuring Washington 
        remains a key player in national and global trade.
      </p>
      <div className="container " style={{  width: '1300px', height: '700px'}}>
        <WashingtonMapWithLineGraphs/>
      </div>
      <br/> 

      <h2 className="text-2xl font-semibold mb-4">
        Ensuring Longevity: Maintenance and Preservation of Washington's Transportation Infrastructure
      </h2>

      <p className="mt-4 mb-8">
        Washington's extensive network of over 8,400 bridges serves as vital connectors for communities, commerce, and transportation. However, with approximately 5.5% of these structures classified as structurally deficient, the focus on maintenance and preservation becomes paramount. The interactive map below provides a comprehensive overview of all bridges in Washington, detailing their current conditions. This visualization underscores the critical need for targeted maintenance strategies and highlights areas where infrastructure investments are essential to ensure safety and efficiency across the state's transportation network. Failure to address these deficiencies could lead to significant traffic disruptions, increased congestion, and compromised safety for all road users.
      </p>

      <div style={{ padding: '1rem 1rem' }}>
        <BridgeNeedsMap />
      </div>

      <h2 className="text-2xl font-semibold mb-4">
        Building a Better Tomorrow: Solutions for Mobility Challenges
      </h2>

      <p className="mt-4 mb-8">
      To meet the demands of a growing population and ensure efficient, sustainable mobility across Washington, bold, coordinated action is essential. This involves investing in infrastructure projects such as expanding public transit networks, maintaining and strategically enhancing road capacity, increasing passenger and cargo air travel capabilities, and developing ultra-high-speed rail systems.​
      <br/><br/>
      High-speed rail (HSR) presents a promising solution to alleviate traffic congestion. Current initiatives are exploring the feasibility of an ultra-high-speed rail line connecting Vancouver, Seattle, and Portland, with trains operating at speeds up to 250 mph. This project aims to significantly reduce travel times between these major cities.
      <br/><br/>
      The visualization below allows you to explore and compare these travel times across different modes of transportation, providing insight into how high-speed rail could transform regional mobility. Use the interactive tool to select your origin and destination, and compare current travel times by car and train with projected times using the proposed high-speed rail system.
      </p>
      
      <TravelComparison />
      <p style={{fontStyle: 'italic', paddingTop: "65px", paddingRight: "5px", textAlign: "right"}}>
      Note: These HSR travel times are based on projections from feasibility studies and are subject to change as the project develops.
      </p>

     {/* <h2 className="text-2xl font-semibold mb-4">
        Discover the Impact: Your Interactive Mobility Dashboard
      </h2>

      <p className="mt-4 mb-8">
        Now it’s your turn to explore the future. Our interactive dashboard brings together all the data—population growth projections, commute times, transportation infrastructure scenarios, and more—into one easy-to-use platform. Dive deep into the trends, compare different future scenarios, and see exactly how changes will impact your daily life, from commute times to air travel wait times. Whether you're a commuter, policymaker, or simply curious about the region’s future, this dashboard empowers you to make informed decisions, understand the trade-offs, and envision a Washington that works for everyone.
      </p>*/}

      <h2 className="text-2xl font-semibold mb-4">
      Experience the Impact: Your Interactive Traffic Simulation Game
      </h2>

      <p className="mt-4 mb-8">
        Understanding how transportation choices affect traffic congestion is crucial for envisioning a more efficient future. Our interactive traffic simulation game allows you to explore the dynamics of various transportation modes and their influence on traffic flow. By adding or removing cars, buses, and trains, you can observe real-time changes in congestion levels, measured by the number of people moved and the resulting traffic conditions. The simulation provides immediate visual feedback, with congestion levels displayed on a graph—red indicating backed-up traffic and green representing free-flowing conditions. This engaging tool empowers you to experiment with different scenarios, deepening your understanding of how strategic transportation planning can alleviate congestion and improve mobility for all.
      </p>


      <div>
        <iframe
          src={"https://vishnupriyanr.github.io/T2050_WI25"}
          title="External Website"
          width="100%"
          height="800px"
          style={{border: 'none'}}
        />
      </div>

    </div>
  );
}
