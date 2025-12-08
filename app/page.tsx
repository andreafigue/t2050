// @ts-nocheck
'use client';

import React from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useScroll, useTransform, motion, useMotionValue } from 'framer-motion';
import { useRef, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import "./globals2.css";
import Population from './components/Population';
import BridgeNeedsMap from './components/BridgeMap2';
import Airport from './components/Airport';

const DynamicMapRoute = dynamic(() => import('./components/MapRoute2'), {
  ssr: false,
  loading: () => <p className="text-center py-6">Loading commute map…</p>,
});
const DynamicWashingtonMapWithLineGraphs = dynamic(() => import('./components/Freight'), {
  ssr: false,
  loading: () => <p className="text-center py-6">Loading freight trends…</p>,
});
const DynamicChartComponent = dynamic(() => import('./components/hsr2'), {
  ssr: false,
  loading: () => <p className="text-center py-6">Loading HSR chart…</p>,
});

function ViewportGate({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { rootMargin: '200px 0px' } // start mounting a bit before it enters
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return <div ref={ref}>{visible ? children : null}</div>;
}

const Page = () => {

  const containerRef = useRef(null);

  const nextSectionRef = useRef<HTMLElement | null>(null);


  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const { scrollYProgress: heroProgress } = useScroll({
    target: containerRef,
    // starts when Section 1 enters the viewport, ends when its bottom reaches the top
    offset: ["start start", "end start"],
  });

  const textDesktopRef = React.useRef<HTMLDivElement | null>(null);
  const textMobileRef  = React.useRef<HTMLDivElement | null>(null);
  const [introRevealed, setIntroRevealed] = React.useState(false);

  function handleScrollMoreClick() {
    const section = containerRef.current;
    if (!section) return;

    const viewportH = window.innerHeight;
    const sectionRect = section.getBoundingClientRect();
    const sectionTop = window.scrollY + sectionRect.top;
    const totalScrollable = section.offsetHeight - viewportH;

    const scrollInSection = window.scrollY - sectionTop;

    // First click → scroll to show full intro text
    if (!introRevealed && scrollInSection < totalScrollable * 0.8) {
      const targetY = sectionTop + totalScrollable ;
      window.scrollTo({ top: targetY, behavior: "smooth" });
      setIntroRevealed(true);
    } else {
      // Second click → scroll to next section
      nextSectionRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  // Auto-reset state when user scrolls back up
  React.useEffect(() => {
    function handleScroll() {
      const section = containerRef.current;
      if (!section) return;

      const viewportH = window.innerHeight;
      const sectionRect = section.getBoundingClientRect();

      const sectionTop = window.scrollY + sectionRect.top;
      const totalScrollable = section.offsetHeight - viewportH;

      const scrollInSection = window.scrollY - sectionTop;
      const progress = scrollInSection / totalScrollable;

      // If user scrolls back up above 0.3 of hero, reset state
      if (progress < 0.8 && introRevealed) {
        console.log("NOW")
        setIntroRevealed(false);
      }
    }

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [introRevealed]);

  function getViewportHeight() {
    // iOS/iPadOS Safari reports innerHeight inconsistently when toolbars collapse
    return (window.visualViewport?.height ?? window.innerHeight);
  }

  const reduceMotion = useReducedMotion();
  
  const arrowOpacity = reduceMotion ? 1 : useTransform(scrollYProgress, [0, 0.1, 0.9], [1, 1, 0]);
  //const titleScale  = reduceMotion ? 1 : useTransform(scrollYProgress, [0, 0.5, 0.7], [1.4, 1, 1]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.5, 0.7], [0.5, 0.7, 0.7]);

  const textOpacity = useTransform(scrollYProgress, [0.25, 0.5, 0.7], [0, 1, 1]);
  const textY = useTransform(scrollYProgress, [0, 0.5, 0.7], ['25rem', '5rem', '5rem']);

  // Desktop/tablet title: center -> top-left
  const dtTitleTop = reduceMotion
    ? '6rem'
    : useTransform(scrollYProgress, [0, 0.45], ['28%', '6rem']);

  const dtTitleLeft = reduceMotion
    ? '7.5rem'
    : useTransform(scrollYProgress, [0, 0.45, 0.6], ['60%', '7.5rem', '7.5rem']);

  const dtTitleX = reduceMotion
    ? '0%'
    : useTransform(scrollYProgress, [0, 0.45, 0.6], ['-50%', '0%', '0%']);

  const dtTitleY = reduceMotion
    ? '0%'
    : useTransform(scrollYProgress, [0, 0.45, 0.6], ['-50%', '0%', '0%']);

  const dtTitleScale = reduceMotion
    ? 1
    : useTransform(scrollYProgress, [0, 0.45], [1.5, 1]);

  // Mobile: center → top-left, drop the centering offsets as you scroll
  const mbTitleTop = reduceMotion
    ? '1svh'
    : useTransform(scrollYProgress, [0, 0.5], ['50svh', '12svh']);

  const mbTitleLeft = reduceMotion
    ? '4vw'
    : useTransform(scrollYProgress, [0, 0.5], ['50vw', '8vw']);

  const mbTranslateY = reduceMotion
    ? '0%'
    : useTransform(scrollYProgress, [0, 0.5], ['-50%', '0%']);

  const mbTranslateX = reduceMotion
    ? '0%'
    : useTransform(scrollYProgress, [0, 0.5], ['-50%', '0%']);

  const mbTitleScale = reduceMotion
    ? 0.9
    : useTransform(scrollYProgress, [0, 0.6], [1.5, 0.9]);

  
  const mbTransform = reduceMotion
    ? 'translate(0, -50%) scale(1)'
    : useTransform(
        scrollYProgress,
        [0, 1],
        ['translate(-50%, -50%) scale(1.05)', 'translate(0, -50%) scale(0.9)']
      );

  const mbTitleX = reduceMotion ? '0%' : useTransform(scrollYProgress, [0, 1], ['-50%', '0%']);

  // Mobile intro text: start below centered title → tuck under top-left title, full width
  const mobileTextTop = reduceMotion
    ? '7.5rem'
    : useTransform(scrollYProgress, [0, 0.5], ['calc(38% + 5rem)', '7.5rem']);

// useScroll with a unique name
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  // numeric MotionValue for the animation progress
  const progress = useMotionValue(0);

  useEffect(() => {
    if (!heroScrollProgress) return; // prevents .on() undefined error

    const unsubscribe = heroScrollProgress.on('change', (v) => {
      const t = Math.max(0, Math.min(1, v / 0.5)); // map 0–0.8 → 0–1
      progress.set(t);
    });

    return () => unsubscribe?.();
  }, [heroScrollProgress, progress]);

  // optional scale animation (safe numeric transform)
  const titleScale = useTransform(progress, [0, 1], [1.5, 1]);

  interface FootnoteProps {
    id: string;
    noteId: string;
  }

  function Footnote({ id, noteId }: FootnoteProps) {
    return (
      <sup id={id}>
        {id}
      </sup>
    );
  }

  return (
    <main style={{ fontFamily: 'Encode Sans Compressed, sans-serif' }}>
      {/* Pinned Scroll Transition */}
      <section ref={containerRef} className="relative h-[200svh] sm:h-[240svh] md:h-[300svh] bg-black">
        {/* Sticky wrapper */}
         <div className="sticky top-0 h-[100svh] md:h-screen w-full overflow-hidden z-10">
          {/* Background image */}
          <Image
            src="/img/background.jpg"
            alt="Background"
            fill
            style={{ objectFit: "cover" }}
            className="z-0"
          />
          <motion.div
            className="absolute inset-0 bg-black z-10"
            style={{ opacity: overlayOpacity }}
          />
         <motion.div
            className="
              absolute z-30 text-white text-left
              [--hero-top-end:9rem]   [--hero-left-end:8rem]
              sm:[--hero-top-end:10%] sm:[--hero-left-end:10%]
              md:[--hero-top-end:15rem] md:[--hero-left-end:12rem]
              lg:[--hero-top-end:10rem] lg:[--hero-left-end:19rem]
            "
            style={{
              // expose numeric progress to CSS
              ['--p' as any]: progress,

              // CSS does interpolation from 50% → responsive vars
              top:  'calc((1 - var(--p)) * 50% + var(--p) * var(--hero-top-end))',
              left: 'calc((1 - var(--p)) * 50% + var(--p) * var(--hero-left-end))',

              translateX: '-50%',
              translateY: '-50%',
              scale: titleScale,
              willChange: 'top,left,transform',
              position: "absolute"
            }}
          >
            <h1 className="font-bold drop-shadow-lg text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-1 lg:mb-2">
              Challenge 2050
            </h1>
            <p className="drop-shadow text-base sm:text-lg md:text-xl lg:text-2xl">
              The Future in Motion
            </p>
          </motion.div>

          {/* Section 1 Text Desktop*/}
          <motion.div
            className="
              absolute z-20 text-white px-4 hidden sm:block sm:px-16
              [--text-top:30%] [--text-left:3%]        /* base (mobile/tablet) */
              md:[--text-top:15rem] md:[--text-left:1rem]  /* tablet */
              lg:[--text-top:10rem] lg:[--text-left:3rem]  /* desktop */
            "
            ref={textDesktopRef}
            style={{
              top: 'var(--text-top)',
              left: 'var(--text-left)',
              opacity: textOpacity,
              translateX: '0%',
              y: textY,
            }}
          >
            <div className="mx-auto sm:mx-0 sm:max-w-xl">
              <p className="text-xl mb-4">
                By the year 2050, Washington State will be home to 10 million people—a population surge of 1.8 million,
                with the vast majority settling in the already-bustling central Puget Sound region.
              </p>
              <p className="text-xl mb-4">
                Washington’s future hinges on one critical question: <strong>How will 10 million people move safely and efficiently across our state?</strong>
              </p>
              <p className="text-xl mb-4">
                As roads, bridges, ferries, railways, and airports strain under increased demand, state and regional leaders
                face a stark choice—invest boldly and strategically now, or face the rising costs of inaction: clogged highways,
                delayed flights, and a quality of life diminished by congestion.
              </p>
              <p className="text-xl mb-4">
                Challenge 2050 is a data-driven initiative to help Washingtonians understand and prepare for the transportation 
                challenges of a rapidly growing state. Explore the trends, impacts, and choices we face—and discover how informed 
                decisions today can shape a better tomorrow. 
              </p>
            </div>
          </motion.div>

          {/* Section 1 Text Mobile*/}
          <motion.div
            ref={textMobileRef}
            className="absolute z-20 text-white px-4 sm:hidden"
            style={{
              top: mobileTextTop,          // or your mobileTextTop motion value
              left: '50%',
              translateX: '-50%',
              width: "95vw",
              opacity: textOpacity,
              y: textY,
            }}
          >
            <div className="mx-auto">
              <p className="text-md mb-4">
                By the year 2050, Washington State will be home to 10 million people—a population surge of 1.8 million,
                with the vast majority settling in the already-bustling central Puget Sound region.
              </p>
              <p className="text-md mb-4">
                Washington’s future hinges on one critical question: <strong>How will 10 million people move safely and efficiently across our state?</strong>
              </p>
              <p className="text-md mb-4">
                As roads, bridges, ferries, railways, and airports strain under increased demand, state and regional leaders
                face a stark choice—invest boldly and strategically now, or face the rising costs of inaction: clogged highways,
                delayed flights, and a quality of life diminished by congestion.
              </p>
              <p className="text-md mb-4">
                Challenge 2050 is a data-driven initiative to help Washingtonians understand and prepare for the transportation 
                challenges of a rapidly growing state. Explore the trends, impacts, and choices we face—and discover how informed 
                decisions today can shape a better tomorrow. 
              </p>
            </div>
          </motion.div>

          {/* Logos — padded and spaced like before */}
          <motion.div
            className="
              absolute z-20 text-white
              px-2 sm:px-14 
              top-8 right-4 sm:top-16  sm:right-8
              flex flex-col items-end gap-8 sm:gap-12
            "
          >
            <a
              href="https://www.washington.edu/"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Image
                src="/logos/Signature_Stacked_White.png"
                alt="UW"
                width={250}
                height={67}
                className="w-32 sm:w-36 md:w-[180px] lg:w-[250px] h-auto"
                sizes="(max-width: 480px) 96px, (max-width: 640px) 144px, 250px"
                priority
              />
            </a>

            <a
              href="https://www.washington.edu/"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Image
                src="/logos/mic.png"
                alt="MIC"
                width={250}
                height={67}
                className="w-32 sm:w-36 md:w-[180px] lg:w-[250px] h-auto"
                sizes="(max-width: 480px) 96px, (max-width: 640px) 144px, 250px"
              />
            </a>
          </motion.div>


          {/* Bouncing arrow */}
          <motion.button
            aria-label="Scroll to content"
            className="absolute z-30 left-1/2 -translate-x-1/2 bottom-6 md:bottom-10 flex flex-col items-center text-white focus:outline-none"
            style={{ opacity: arrowOpacity }}
            onClick={handleScrollMoreClick}
          >
            <span className="text-md mb-1 tracking-wide opacity-90 font-[Encode_Sans_Compressed]">
              Scroll for More
            </span>

            <motion.svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              initial={reduceMotion ? false : { y: 0 }}
              animate={reduceMotion ? undefined : { y: [0, 8, 0] }}
              transition={reduceMotion ? undefined : { duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              role="img"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </motion.svg>
          </motion.button>

        </div>
      </section>

      {/* Section 2 */}
      <motion.section
        ref={nextSectionRef}
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
                src="/img/search2.png" 
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> See how our state’s population has changed since 1961 and is predicted to continue to grow over the next 25 years.
            </p>
            <ViewportGate>
              <Population />
            </ViewportGate>

            <div className="pl-3" style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#4b5563" }}>
              <ol style={{ margin: "1rem 0 0 0rem", padding: 0, listStyleType: "circle" }}>
                <li>
                  Washington State Office of Financial Management (OFM),
                  <em> Growth Management Act Population Projections for Counties: 2020–2050</em>.
                </li>
              </ol>
            </div>
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
                This growth is more than abstract data—it affects everyday lives. Longer commutes mean less time with family, 
                more stress, and higher costs. Without action, travel times will exceed tolerable limits.
              </p>
              <p className="text-lg mb-4 font-semibold">Did you know?</p>
              <ul className="list-disc list-inside text-lg mb-4 space-y-2">
                <li>In 2022, the average commuter in Central Puget Sound spent 82 hours stuck in traffic at an annual cost of $1,874 <Footnote id="1" noteId="note1" />.</li>
                <li>Congestion contributes 621,000 metric tons of excess carbon dioxide emissions annually in Central Puget Sound, contributing to climate change<Footnote id="1" noteId="note1" />.</li>
              </ul>           
            </div>
          </div>
          <div className="mt-12 p-6 border bg-gray-100" style={{borderRadius: 8}}>
            <p className="text-2xl mb-4">
              <Image
                src="/img/search2.png" 
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> Just 10 minutes of added travel time each day adds up to more than 40 hours a year. See how much trips will change in the years ahead.
            </p>
            <ViewportGate>
              <DynamicMapRoute />
            </ViewportGate>
            <br/>
            <div className="pl-3" style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#4b5563" }}>
              <ol style={{ margin: "0rem 0 0 1.25rem", padding: 0, listStyleType: "circle" }}>
                <li>
                  Current peak-time travel conditions using Mapbox Directions API. 
                </li>
                <li>
                  Puget Sound Regional Council (PSRC),
                  <em> Vision 2050 – Regional Transportation Model, assumes the build out of Transit 3.</em>
                </li>

                <li>
                  Thurston Regional Planning Council (TRPC),
                  <em> 2022 South Sound Travel Study – Travel Demand Modeling</em>.
                </li>
              </ol>
            </div>
          </div>
          {/*Commenting on Aug 20*/}
          {/*<div className="mt-12 p-6 bg-gray-100 border" style={{borderRadius: 8}}>
            <p className="text-2xl mb-4">
              <Image
                src="/img/search2.png" 
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> See how much longer travel on I-5 and I-205 in Clark County could take by 2045 if no improvements are made.
            </p>
            <DynamicMapComponent/>
          </div>*/}


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
                Air travel, too, will feel the crunch. Without expanded airport capacity, Puget Sound’s population growth will hinder both travel and trade—affecting everything from holiday plans to Washington’s global exports. 
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
                src="/img/search2.png" 
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> Watch how rising passenger demand begins to outpace airport capacity. As demand grows, unmet needs appear and increase, showing how much traffic our airports can't accommodate without further investment.
            </p>

            <div style={{width: "100%", height: "600px" }}>
              <ViewportGate>
               <Airport />
              </ViewportGate>
            </div>

            <div className="pl-2" style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#4b5563" }}>
              <ol style={{ margin: "0rem 0 0 1rem", padding: 0, listStyleType: "circle" }}>
                <li>
                  Federal Aviation Administration (FAA),
                  <em>Passenger Boarding (Enplanement) Data (ACAIS)</em>.
                </li>      
                <li>
                Puget Sound Regional Council
                <em>Regional Aviation Baseline Study.</em>
                </li>

              </ol>
            </div>
          </div>

          {/*Commenting on Aug 20*/}
          {/*<div className="mt-12 bg-white p-6 border" style={{borderRadius: 8}}>
            <p className="text-2xl mb-4">
              <Image
                src="/img/search2.png" 
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
          </div>*/}


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
                Freight is the lifeblood of Washington’s economy. With a 45% increase in cargo expected by 2050, 
                our infrastructure must keep pace—or risk losing billions in trade and thousands of jobs. 
                As Washington’s economy grows, so will the demand on freight corridors—by highway, rail, sea, and air.
              </p>
              <p className="text-lg mb-4 font-semibold">Did you know?</p>
              <ul className="list-disc list-inside text-lg mb-4 space-y-2">
                <li>In 2022, over 600 million tons of freight moved through Washington state, with a total value of just over $700 billion<Footnote id="2" noteId="note2" />.</li>
                <li>By 2050, freight movements in Washington are forecast to increase 45%, from 603 million tons of cargo to 872 million tons<Footnote id="2" noteId="note2" />.</li>
              </ul>
              
            </div>
          </div>
          <div className="mt-12 bg-gray-100 p-6 border" style={{borderRadius: 8}}>
            <p className="text-2xl mb-4">
              <Image
                src="/img/search2.png" 
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> Learn how cargo moves around the state and how it is expected to grow to meet the increased demand of a growing population.
              Cargo that can’t get to overseas markets harms our state’s economy, including the 1 in 4 jobs dependent on international trade.
            </p>
            <div className="w-full" >
              <ViewportGate>
                <DynamicWashingtonMapWithLineGraphs/>
              </ViewportGate>
            </div>

            <div className="pl-0" style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#4b5563" }}>
              <ol style={{ margin: "0rem 0 0 1rem", padding: 0, listStyleType: "circle" }}>
                <li>
                  U.S. Department of Transportation, Federal Highway Administration &amp; Bureau of Transportation Statistics,
                  <em>Freight Analysis Framework Version 5 (FAF5)</em>.
                </li>              
              </ol>
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
                <li>Over half of Washington’s bridges are aging into poor condition.</li>
                <li>In April 2025, WSDOT permanently closed the 103-year old SR 165 Carbon River/Fairfax Bridge because it was no longer safe to drive on, cutting off access to Mount Rainier recreation areas and requiring a 9-mile emergency access detour.</li>
                <li>Preservation funding is only 40% of what is needed to keep our infrastructure in a state of good repair.</li>
              </ul>
              
            </div>
          </div>
          <div className="mt-12 bg-white p-6 border" style={{borderRadius: 8}}>
            <p className="text-2xl mb-4">
              <Image
                src="/img/search2.png" 
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> Inspect the condition of spans across the state and see what detours would be required if bridges were closed before they could be repaired or replaced.
            </p>

            <div style={{ padding: '1rem 1rem' }}>
              <ViewportGate>
                <BridgeNeedsMap />
              </ViewportGate>
            </div>

            <div className="pl-3" style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#4b5563" }}>
              <ol style={{ margin: "0.25rem 0 0 1rem", padding: 0, listStyleType: "circle" }}>
                <li>
                  Washington State Department of Transportation (WSDOT), 
                  <em> Bridge Needs</em>. Accessed Oct 31, 2024. 
                </li>
              </ol>
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
                src="/img/search2.png" 
                alt="Explore icon"
                width={35}
                height={35} 
                className="inline-block opacity-90 mr-2"
              />
              <strong>Explore:</strong> Trips between Seattle and Vancouver, BC or Seattle and Portland, OR could be an hour or shorter—
              redefining what it means to live and work in the Pacific Northwest.
            </p>

            <div className="mb-4" style={{ padding: '1rem 1rem', width: "100%", height: "320px" }}>
              <div className=" w-full h-full">
                <ViewportGate>
                  <DynamicChartComponent />
                </ViewportGate>
              </div>
            </div>

            <div style={{ marginTop: "0rem", marginLeft: "1rem", fontSize: "0.9rem", color: "#4b5563" }}>
              <ol style={{ margin: "2rem 0 0 0.5rem", padding: 0, listStyleType: "circle" }}>
                <li>
                  Washington State Department of Transportation (WSDOT),
                  <em>Ultra-High-Speed Ground Transportation Study — Business Case Analysis(2019)</em>.
                </li>            
              </ol>
              <p style={{fontStyle: 'italic', fontSize: "0.9rem", color: "#4b5563", paddingRight: "5px", textAlign: "left", marginTop: "5px"}}>
            Note: High-speed rail is defined as speeds between 160 to 250 miles per hour. Travel time is based on seat time and does not include airport security screening. High-speed rail times are based on projections from feasibility studies and are subject to change as the project develops.
            </p>
            </div>
                
          </div>
        </div>
      </motion.section>

      {/* Section 8  - Commenting on Aug 20*/}
      {/*<motion.section
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
                src="/img/search2.png" 
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
      </motion.section>*/}

      <motion.section
        className="px-4 md:px-16 py-16 bg-gray-100"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}>
      
        <div className="max-w-6xl mx-auto">
          <div className="md:flex-row-reverse items-start">
              <h3 className="text-2xl md:text-3xl font-semibold mb-4 text-gray-600">
                Sources
              </h3> 
          </div>
          <div className="pl-3" style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#4b5563" }}>
              <ol style={{ margin: "1rem 0 0 0rem", padding: 0, listStyleType: "decimal" }}>
                <li>
                  Texas Transportation Institute, Urban Mobility Report 2023.
                </li>
                <li>
                  Washington State Freight System Plan (2022).
                </li>
              </ol>
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
          © {new Date().getFullYear()} Challenge 2050 • The Future in Motion • <a href="mailto:mobility@uw.edu">Contact us</a>
        </p>
      </footer>

    </main>
  );
};

export default Page;