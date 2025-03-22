'use client';
// pages/index.tsx
import React from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Typography from '@mui/material/Typography';
//import {ArrowDownwardIcon, ArrowDropDownIcon} from '@material-ui/icons';
//import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
//import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

import ChoroplethMap, { CountyCsvRow } from '../components/ChoroplethMap';
import GraySquare from '../components/GraySquare';
import { promises as fs } from 'fs'
import path from 'path';
import type { FeatureCollection } from 'geojson';
import { csvParse } from 'd3-dsv';
//import MapWrapper from '../components/MapWrapper';
import AirportQueue from '../components/AirportQueue';
import FreightAreaChart from '../components/FreightAreaChart';
import FreightFlights from "../components/animations/flights";
import FreightShips from "../components/animations/ships";
import FreightTrains from "../components/animations/Trains";
import FreightCars from "../components/animations/Cars";


// Dynamically import heavy components (client-side only)
//const Visualization = dynamic(() => import('../components/Visualization'), { ssr: false });
//const InteractiveComponent = dynamic(() => import('../components/InteractiveComponent'), { ssr: false });

const Home: React.FC = () => {
  return (
    <>
      <header style={{ padding: '2rem', textAlign: 'center', background: '#f8f8f8' }}>
        <h1>Challenge 2050</h1>
        <p>
          <br/>
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
      </header>

      <main>
        <section style={{ padding: '4rem 2rem', maxWidth: '1000px', margin: '0 auto' }}>
          <article>
            <h2>A Region on the Rise: Population Growth from 1961 to 2050</h2>
            <p>
              Population growth doesn’t happen overnight—it unfolds over decades. Using historical data 
              from 1961 and projections through 2050, we can trace how demographic shifts have shaped, 
              and will continue to shape, our state. Explore the interactive map below to see growth 
              trends across counties. Use the slider to move through time, and hover over each county to 
              view detailed population changes year by year.
            </p>
          

        <div>
      <Accordion>
        <AccordionSummary
          aria-controls="panel1-content"
          id="panel1-header"
        >
          <Typography component="span">Accordion 1</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse
            malesuada lacus ex, sit amet blandit leo lobortis eget.
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary
          aria-controls="panel2-content"
          id="panel2-header"
        >
          <Typography component="span">Accordion 2</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse
            malesuada lacus ex, sit amet blandit leo lobortis eget.
          </Typography>
        </AccordionDetails>
      </Accordion>
    </div>
</article>
        </section>
        <section style={{ padding: '4rem 2rem', background: '#eef2f5' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          

            <h2>The Road Ahead: How Growth Impacts You</h2>

            <p>
              Population growth isn’t just a statistic—it’s a reality that will reshape your daily life. 
              More people mean more cars on the road, higher demand for public transit, and increased strain 
              infrastructure. Without preservation of our existing infrastructure and strategic investments in 
              mobility, longer commutes that reduce our quality of life will become the norm. As millions of new 
              residents rely on the same roads, rail lines, and airports, commute times, travel costs, and overall 
              mobility will be significantly impacted. 
            </p>

            <FreightCars />

            <p>
              How will this affect you? Use the interactive tool below to see how your daily commute might 
              change by 2050. Simply enter your origin and destination to compare current travel times with 
              projections for the future, based on different infrastructure investment scenarios.
            </p>
            
            

            <p>
              Your commute is more than just a trip—it’s time out of your day, every day. This visualization 
              helps you understand how future growth and infrastructure decisions will directly affect the 
              time you spend getting to your destination, enabling you to see why we need to start now to 
              plan for Washington’s transportation future.
            </p>

          </div>
        </section>

        {/* Interactive Component Section */}
        <section style={{ padding: '4rem 2rem' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h2>Cleared for Takeoff? The Future of TSA Wait Times at SEA-TAC Airport</h2>
            <FreightFlights />
            <p className="mt-4 mb-8">
              As the central Puget Sound region’s population surges toward 5.8 million by 2050, airports will face unprecedented passenger volumes. This growth will directly impact TSA security wait times, with delays affecting leisure and business travelers and air cargo planes exporting Washington’s agriculture products to international customers. Without an increase in capacity, Washington residents will experience significantly longer security lines, especially during peak travel seasons.
            </p>
            <div>
              <AirportQueue />
            </div>
          </div>
        </section>

        {/* Conclusion Story Section */}
        <section style={{ padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
          <article>
            <h2>Conclusion</h2>
            <p>
              Thank you for exploring our story. We hope the combination of narrative and interactive elements provided new insights and a memorable experience.
            </p>
          </article>
        </section>
      </main>

      <footer style={{ padding: '2rem', textAlign: 'center', background: '#f8f8f8' }}>
        <p>&copy; 2025 My Interactive Story</p>
      </footer>
    </>
  );
};

export default Home;
