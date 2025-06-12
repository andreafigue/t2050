'use client';

import React from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useScroll, useTransform, motion } from 'framer-motion';
import { useRef } from 'react';

import Population from '../components/Population';
import BridgeNeedsMap from '../components/BridgeMap2';
import InteractiveGame from '../components/InteractiveGame';
import AirportQueue from '../components/AirportQueue';

const DynamicMapRoute = dynamic(() => import('../components/MapRoute2'), { loading: () => <p>Loading commute map…</p> });
const DynamicWashingtonMapWithLineGraphs = dynamic(() => import('../components/Freight'), { loading: () => <p>Loading freight trends…</p> });
const DynamicChartComponent = dynamic(() => import('../components/hsr2'), { loading: () => <p>Loading HSR chart…</p> });
const DynamicMapComponent = dynamic(() => import('../components/interstate'), { loading: () => <p>Loading freight map…</p> });
const DynamicDashboard = dynamic(() => import('../components/Dashboard'), { loading: () => <p>Loading dashboard…</p> });

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
      {/* Pinned Scroll Transition */}
      <section ref={containerRef} className="relative h-[300vh] bg-black">
        {/* Sticky wrapper */}
         <div className="sticky top-0 h-screen w-full overflow-hidden z-10">
          {/* Background image */}
          <Image
            src="/img/link.jpg"
            alt="Background"
            layout="fill"
            objectFit="cover"
            className="z-0"
          />
          <motion.div
            className="absolute inset-0 bg-black z-10"
            style={{ opacity: overlayOpacity }}
          />

          {/* Title */}
          <motion.div
            className="absolute z-20 text-white"
            style={{
              top: titleTop,
              left: titleLeft,
              translateX: titleX,
              translateY: titleY,
              scale: titleScale
            }}
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-2 drop-shadow-lg">
              Challenge 2050
            </h1>
            <p className="text-xl md:text-2xl drop-shadow">The Future in Motion</p>
          </motion.div>

          {/* Section 1 Text */}
          <motion.div
            className="absolute z-20 text-white px-4 md:px-16"
            style={{
              top: '10rem',
              left: '6rem',
              opacity: textOpacity,
              y: textY,
            }}
          >
            <div className="max-w-xl">
              <p className="text-xl mb-4">
                By the year 2050, Washington State will be home to 10 million people—a population surge of 1.8 million,
                with the vast majority settling in the already-bustling central Puget Sound region.
              </p>
              <p className="text-xl mb-4">
                Such growth poses profound questions for the state’s future. Chief among them: <strong>How will Washingtonians move?</strong>
              </p>
              <p className="text-xl mb-4">
                As roads, bridges, ferries, railways, and airports strain under increased demand, state and regional leaders
                face a stark choice—invest boldly and strategically now, or face the rising costs of inaction: clogged highways,
                delayed flights, and a quality of life diminished by congestion.
              </p>
            </div>
          </motion.div>

          <motion.div
            className="absolute z-20 text-white px-4 md:px-8"
            style={{
              top: '4rem',
              right: '4rem',
              //opacity: logoOpacity,
              //x: logoY,
            }}
          >
            <a href="https://https://www.washington.edu//" target="_blank" rel="noopener noreferrer">
              <Image src="/logos/Signature_Stacked_White.png" alt="UW" width={250} height={67} />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Section 2 */}
      <motion.section
        className="px-4 md:px-16 py-16 bg-gray-100"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row-reverse gap-8 items-start">
            <Image
              src="/img/pikeplace.jpg"
              alt="A Changing State"
              width={450}
              height={300}
              className="rounded-xl shadow-lg"
            />
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">A Changing State</h2>
              <p className="text-lg mb-4">
                Washington’s evolution has been decades in the making. From 1961 through projections for 2050,
                population growth has shifted the balance across counties, reshaping urban and rural communities alike.
              </p>
            </div>
          </div>

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
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <Image
              src="/img/i5corridor.jpg"
              alt="The Commute, Reimagined"
              width={450}
              height={300}
              className="rounded-xl shadow-lg"
            />
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">The Commute, Reimagined</h2>
              <p className="text-lg mb-4">
                This growth is more than abstract data—it affects everyday lives. More cars on the road mean
                longer commutes, greater stress, and fewer hours at home. Without preservation of our existing
                roads and bridges and new investments, average travel times could stretch well beyond tolerable limits.
              </p>
              <p className="text-lg mb-4 font-semibold">Did you know?</p>
              <ul className="list-disc list-inside text-lg mb-4 space-y-2">
                <li>In 2022, the average commuter spent 82 hours stuck in traffic at an annual cost of $1,874.</li>
                <li>Congestion contributes 621,000 metric tons of excess carbon dioxide emissions annually, contributing to climate change.</li>
              </ul>           
            </div>
          </div>
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

            <div className="container mb-16">
              <DynamicMapRoute />
            </div>

            <br/>
          </div>
          <div className="mt-12 p-6 bg-gray-100 border" style={{borderRadius: 8}}>
            <p className="text-2xl mb-4">
              <Image
                src="/img/search2.png" // adjust this path to match your public folder
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> See how much longer travel on I-5 and I-205 in Clark County could take by 2045 if no improvements are made.
            </p>
            <DynamicMapComponent/>
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
          <div className="flex flex-col md:flex-row-reverse gap-8 items-start">
            <Image
              src="/img/tsa.JPG"
              alt="Airports Under Pressure"
              width={450}
              height={300}
              className="rounded-xl shadow-lg"
            />
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">Airports Under Pressure</h2>
              <p className="text-lg mb-4">
                Air travel, too, will feel the crunch. With Puget Sound’s population expected to swell, we need more capacity.
                TSA wait times could soar—especially during holidays and peak seasons—slowing both leisure travelers and the cargo planes that carry Washington’s exports abroad.
              </p>
              <p className="text-lg mb-4">
                Without serious investment in airport capacity, delays and bottlenecks will become more than an inconvenience—they’ll be an impediment to commerce and global connectivity.
              </p>
              <p className="text-lg mb-4 font-semibold">Did you know?</p>
              <ul className="list-disc list-inside text-lg mb-4 space-y-2">
                <li>Demand for take-offs and landings are projected to double by 2050, resulting in unmet demand roughly equivalent to all passengers served at Sea-Tac in 2019.</li>
                <li>The region will fall short of on-airport warehouse space for air cargo by 2027.</li>
              </ul>
            </div>
          </div>
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
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <Image
              src="/img/WA-port.jpg"
              alt="Freight and the Backbone of Commerce"
              width={450}
              height={300}
              className="rounded-xl shadow-lg"
            />
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">Freight and the Backbone of Commerce</h2>
              <p className="text-lg mb-4">
                Goods movement is no less essential. As Washington’s economy grows, so will the demand on freight corridors—by highway, rail, sea, and air.
              </p>
              <p className="text-lg mb-4 font-semibold">Did you know?</p>
              <ul className="list-disc list-inside text-lg mb-4 space-y-2">
                <li>Freight transported within Washington is forecast to increase by more than 40%, and imports and exports by more than 50%.</li>
                <li>The number of truck miles traveled per day is forecast to increase by 27%.</li>
              </ul>
              
            </div>
          </div>
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
          <div className="flex flex-col md:flex-row-reverse gap-8 items-start">
            <Image
              src="/img/bridge.jpg"
              alt="The Quiet Crisis Beneath Our Roads"
              width={450}
              height={300}
              className="rounded-xl shadow-lg"
            />
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">The Quiet Crisis Beneath Our Roads</h2>
              <p className="text-lg mb-4">
                Beneath the weight of growth lies a quieter crisis: infrastructure decay. The state’s 8,400-plus bridges—
                essential connectors for people and goods—are aging. A bridge in disrepair may not make headlines until it fails,
                but the data reveals a system in urgent need of maintenance.
              </p>
              <p className="text-lg mb-4 font-semibold">Did you know?</p>
              <ul className="list-disc list-inside text-lg mb-4 space-y-2">
                <li>More than 55% of bridges across the state are in only fair condition and inching ever closer to falling into poor condition.</li>
                <li>In April 2025, WSDOT permanently closed the 103-year old SR 165 Carbon River/Fairfax Bridge because it was no longer safe to drive on, cutting off access to Mount Rainier recreation areas and requiring a 9-mile emergency access detour.</li>
                <li>Preservation funding is only 40% of what is needed to keep our infrastructure in a state of good repair.</li>
              </ul>
              
            </div>
          </div>
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
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <Image
              src="/img/hsr.jpg"
              alt="A High-Speed Vision"
              width={450}
              height={300}
              className="rounded-xl shadow-lg"
            />
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold mb-10 text-center md:text-left">
                A High-Speed Vision
              </h2>
              
              <p className="text-lg mb-4">
                The future isn’t just about fixing what’s broken—it’s also about imagining what could be.
                One vision being explored is the development of an ultra-high-speed rail system linking Vancouver, BC; Seattle, WA; and Portland, OR,
                with trains topping 250 mph.
              </p>
              
            </div>  
          </div>
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

      {/* Section 8 */}
      <motion.section
        className="px-4 md:px-16 py-16 bg-gray-100"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="md:flex-row-reverse items-start">
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">
                An Invitation to Explore and Shape the Future
              </h2>
              <p className="text-lg">
                The future is in your hands.
              </p>              
            </div>
          </div>
          <div className="mt-12 bg-white p-6 border" style={{borderRadius: 8}}>
            <p className="text-2xl mb-4">
              <Image
                src="/img/search2.png" // adjust this path to match your public folder
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> Use this interactive tool to watch in real time how each decision affects congestion.
              It’s an engaging—and sobering—look at how transportation planning decisions ripple outward.
            </p>
            <InteractiveGame  />
          </div>

        </div>
      </motion.section>

      {/* Footer */}
      <footer className="bg-gray-50 text-sm text-gray-600 pt-16 pb-12 text-center">
        <h2 className="text-2xl font-semibold mb-4">Partners</h2>
        <div className="flex flex-wrap justify-center items-center gap-8 px-4 mb-10">
          <a href="https://wsdot.wa.gov/" target="_blank" rel="noopener noreferrer">
            <Image src="/logos/wsdot.png" alt="WSDOT" width={150} height={40} />
          </a>
          <a href="https://kingcounty.gov/" target="_blank" rel="noopener noreferrer">
            <Image src="/logos/king-county.png" alt="King County" width={150} height={40} />
          </a>
          <a href="https://www.challengeseattle.com/" target="_blank" rel="noopener noreferrer">
            <Image src="/logos/challenge-seattle.png" alt="Challenge Seattle" width={150} height={40} />
          </a>
          <a href="https://www.alaskaair.com/" target="_blank" rel="noopener noreferrer">
            <Image src="/logos/alaska-airlines.png" alt="Alaska Airlines" width={150} height={40} />
          </a>
          <a href="https://www.microsoft.com/" target="_blank" rel="noopener noreferrer">
            <Image src="/logos/microsoft.png" alt="Microsoft" width={150} height={40} />
          </a>
          <a href="https://www.boeing.com/" target="_blank" rel="noopener noreferrer">
            <Image src="/logos/boeing.png" alt="Boeing" width={150} height={40} />
          </a>
        </div>
        <p className="text-s text-gray-500">
          © {new Date().getFullYear()} Challenge 2050 • The Future in Motion
        </p>
      </footer>

    </main>
  );
};

export default Page;