'use client';

import React from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useScroll, useTransform, motion } from 'framer-motion';
import { useRef } from 'react';

import Population from '../components/study2/Population';
import BridgeNeedsMap from '../components/study2/BridgeMap';
import InteractiveGame from '../components/study2/InteractiveGame';
import AirportQueue from '../components/study2/AirportQueue';

const DynamicMapRoute = dynamic(() => import('../components/study2/MapRoute'), { loading: () => <p>Loading commute map…</p> });
const DynamicWashingtonMapWithLineGraphs = dynamic(() => import('../components/study2/Freight'), { loading: () => <p>Loading freight trends…</p> });
const DynamicChartComponent = dynamic(() => import('../components/study2/hsr'), { loading: () => <p>Loading HSR chart…</p> });
const DynamicMapComponent = dynamic(() => import('../components/study2/interstate'), { loading: () => <p>Loading freight map…</p> });
//const DynamicDashboard = dynamic(() => import('../components/study2/Dashboard'), { loading: () => <p>Loading dashboard…</p> });

const Page = () => {

  const containerRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  // Animations
  const titleTop = useTransform(scrollYProgress, [0, 0.5, 0.7], ['25%', '6rem', '6rem']);
  const titleLeft = useTransform(scrollYProgress, [0, 0.5, 0.7], ['45%', '7.5rem','7.5rem']);
  const titleX = useTransform(scrollYProgress, [0, 0.5, 0.7], ['-50%', '0%', "0%"]);
  const titleY = useTransform(scrollYProgress, [0, 0.5, 0.7], ['-50%', '0%', "0%"]);

  const titleScale = useTransform(scrollYProgress, [0, 0.5, 0.7], [1.4, 1, 1]);

  const overlayOpacity = useTransform(scrollYProgress, [0, 0.5, 0.7], [0.5, 0.7, 0.7]);

  const textOpacity = useTransform(scrollYProgress, [0.25, 0.5, 0.7], [0, 1, 1]);
  const textY = useTransform(scrollYProgress, [0, 0.5, 0.7], ['25rem', '5rem', '5rem']);

  return (
    <main style={{ fontFamily: 'Encode Sans Compressed, sans-serif' }}>

      {/* Section 2 */}
      <motion.section
        className="px-4 md:px-16 py-16 bg-gray-100"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">1. A Changing State</h2>
          <div className="mt-12 bg-white p-6 border" style={{borderRadius: 8}}>
            <p className="text-2xl mb-4">
              <Image
                src="/img/search2.png" // adjust this path to match your public folder
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> See how our state’s population has changed since 1961 and is predicted to continue to grow over the next 25 years.
            </p>
            <Population />
          </div>

        </div>
      </motion.section>


      {/* Section 3 */}
      <motion.section
        className="px-4 md:px-16 py-16 bg-white"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">2. The Commute, Reimagined</h2>         
    
          <div className="mt-12 p-6 border bg-gray-100" style={{borderRadius: 8}}>
            <p className="text-2xl mb-4">
              <Image
                src="/img/search2.png" // adjust this path to match your public folder
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> See how much longer a trip will take in 2050 if we don’t plan for future growth.
            </p>
            <DynamicMapRoute />
            <br/>
          </div>
          
        </div>
      </motion.section>

      {/* Section 4 */}
      <motion.section
        className="px-4 md:px-16 py-16 bg-gray-100"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto">
    
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">3. Airports Under Pressure</h2>
       
          <div className="mt-12 bg-white p-6 border" style={{borderRadius: 8}}>
            <p className="text-2xl mb-4">
              <Image
                src="/img/search2.png" // adjust this path to match your public folder
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> See how TSA wait times – including for TSA PreCheck users – could grow without more investment in our state’s airports.
            </p>

            <div style={{width: "80%"}}>
              <AirportQueue />
            </div>
          </div>
        </div>
      </motion.section>


      {/* Section 5 */}
      <motion.section
        className="px-4 md:px-16 py-16 bg-white"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">4. Freight and the Backbone of Commerce</h2>
             
              
          <div className="mt-12 bg-gray-100 p-6 border" style={{borderRadius: 8}}>
            <p className="text-2xl mb-4">
              <Image
                src="/img/search2.png" // adjust this path to match your public folder
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> Learn how cargo moves around the state and how it is expected to grow to meet the increased demand of a growing population.
              Cargo that can’t get to overseas markets harms our state’s economy, including the 1 in 4 jobs dependent on international trade.
            </p>
            <div className="w-full">
              <DynamicWashingtonMapWithLineGraphs/>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Section 6 */}
      <motion.section
        className="px-4 md:px-16 py-16 bg-gray-100"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">5. The Quiet Crisis Beneath Our Roads</h2>

          <div className="mt-12 bg-white p-6 border" style={{borderRadius: 8}}>
            <p className="text-2xl mb-4">
              <Image
                src="/img/search2.png" // adjust this path to match your public folder
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> Inspect the condition of spans across the state and see what detours would be required if bridges were closed before they could be repaired or replaced.
            </p>

            <div style={{ padding: '1rem 1rem' }}>
              <BridgeNeedsMap />
            </div>
          </div>
        </div>
      </motion.section>

      {/* Section 7 */}
      <motion.section
        className="px-4 md:px-16 py-16 bg-white"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto">

              <h2 className="text-3xl md:text-4xl font-semibold mb-10 text-left md:text-left">
                6. A High-Speed Vision
              </h2>
          <div className="mt-12 bg-gray-100 p-6 border" style={{borderRadius: 8}}>
            <p className="text-2xl mb-4">
              <Image
                src="/img/search2.png" // adjust this path to match your public folder
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> Trips between Seattle and Vancouver, BC or Seattle and Portland, OR could be an hour or shorter—
              redefining what it means to live and work in the Pacific Northwest.
            </p>

            <div className="mb-4" style={{ padding: '1rem 1rem', width: "100%", height: "330px" }}>
              <div className="max-w-5xl w-full h-full">
                <DynamicChartComponent />
              </div>
              <p style={{fontStyle: 'italic', paddingRight: "5px", textAlign: "left", marginTop: "5px"}}>
              Note: These HSR travel times are based on projections from feasibility studies and are subject to change as the project develops.
              </p>
            </div>
          </div>
        </div>
      </motion.section>



    </main>
  );
};

export default Page;