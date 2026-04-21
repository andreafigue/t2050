'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import "../globals2.css";
import dynamic from 'next/dynamic';

import 'mapbox-gl/dist/mapbox-gl.css';

import type { JourneyStaticData } from './types';

const ElenaCommuteMap = dynamic(() => import('../components/journeys/1/Commute'), { ssr: false, loading: () => <p className="text-center py-6">Loading map…</p> });

const ElenaForecastMap = dynamic(
  () => import('../components/journeys/1/Comparison'),
  { ssr: false, loading: () => <p className="text-center py-6">Loading map…</p> }
);
const ElenaBridgeMap = dynamic(
  () => import('../components/journeys/1/Bridges'),
  { ssr: false, loading: () => <p className="text-center py-6">Loading map…</p> }
);
const ElenaHSR = dynamic(
  () => import('../components/journeys/1/HSR'),
  { ssr: false, loading: () => <p className="text-center py-6">Loading visualization…</p> }
);

const journeys = [
  {
    id: 'commuter',
    label: 'The Commuter',
    tagline: 'Central & South Sound',
    emoji: '🚗',
    persona: {
      name: 'Elena',
      role: 'Healthcare worker · Tacoma → Seattle',
      quote: "I just want to know if my commute will still be possible in 2050.",
    },
    steps: [
      {
        id: 1,
        title: 'A Commute Already at Its Limit',
        bg: 'bg-white',
        vizBg: 'bg-gray-100',
        narrative:
          "Elena drives I-5 from Tacoma to Seattle five days a week. She's not unusual — Seattle ranks among the most congested cities in the United States. According to the INRIX 2025 Global Traffic Scorecard, the average Seattle driver lost 68 hours to congestion that year, at a personal cost of $1,253. That's nearly three days of her life, every year, just sitting still.",
        explorePrompt:
          "See current peak-time travel conditions along Elena's corridor and how congestion accumulates across the week.",
        dataLabel: 'Traffic — Current Conditions · PSRC model',
        placeholder: 'screenshot_commuter_step1_current.png',
        component: 'ElenaCommuteMap',
        hint: 'Route: Tacoma → Downtown Seattle via I-5 — current peak conditions',
        sources: [
          {
            id: 'inrix-scorecard',
            text: 'INRIX, 2022 Global Traffic Scorecard — Seattle, WA. inrix.com/scorecard-city/?city=Seattle%20WA&index=22',
          },
          {
            id: 'mapbox-api',
            text: 'Current peak-time travel conditions using Mapbox Directions API.',
          },
        ],
      },
      {
        id: 2,
        title: 'What 2050 Looks Like Without Action',
        bg: 'bg-gray-100',
        vizBg: 'bg-white',
        narrative:
          "Washington is adding 1.8 million people by 2050 — most of them settling in Central Puget Sound. Without new investment, the PSRC model projects Elena's corridor grows significantly more congested. Just 10 added minutes each way means another 40+ hours lost per year. The math compounds fast.",
        explorePrompt:
          "Compare today's travel times with the 2050 no-action forecast to see how much worse congestion gets on this corridor.",
        dataLabel: 'Traffic Forecast · 2050 No-Action · PSRC model',
        placeholder: 'screenshot_commuter_step2_2050.png',
        component: 'ElenaForecastMap',
        hint: 'Same I-5 corridor — 2050 forecast layer, no-action scenario',
        sources: [
          {
            id: 'ofm-projections',
            text: 'Washington State Office of Financial Management (OFM), Growth Management Act Population Projections for Counties: 2020–2050.',
          },
          {
            id: 'psrc-vision2050',
            text: 'Puget Sound Regional Council (PSRC), Vision 2050 – Regional Transportation Model, assumes the build out of Sound Transit 3.',
          },
        ],
      },
      {
        id: 3,
        title: "The Infrastructure Risk She Doesn't See",
        bg: 'bg-white',
        vizBg: 'bg-gray-100',
        narrative:
          "Beneath the congestion problem lies a quieter one. Elena's route crosses bridges that haven't seen serious investment in decades. Over half of Washington's 8,400+ bridges are aging into poor condition. Preservation funding covers only 40% of what's needed — and in April 2025, WSDOT permanently closed the 103-year-old SR 165 Carbon River Bridge, forcing a 9-mile detour. A similar closure on I-5 doesn't just slow Elena down — it can make her route functionally impassable.",
        explorePrompt:
          'Inspect bridge condition ratings along the I-5 corridor and see what detours a closure would require.',
        dataLabel: 'Bridge Conditions · WSDOT · I-5 Corridor',
        placeholder: 'screenshot_commuter_step3_bridges.png',
        component: 'ElenaBridgeMap',
        hint: 'Bridge condition ratings flagged along I-5 between Tacoma and Seattle',
        sources: [
          {
            id: 'wsdot-bridges',
            text: 'Washington State Department of Transportation (WSDOT), Bridge Needs. Retrieved January 15, 2026.',
          },
        ],
      },
      {
        id: 4,
        title: 'A Corridor That Could Be Different',
        bg: 'bg-gray-100',
        vizBg: 'bg-white',
        narrative:
          "There's another version of this story. Ultra-high-speed rail connecting Tacoma and Seattle could cut Elena's trip to under 20 minutes — reliable, weather-proof, and independent of highway capacity. She gets those three weeks of her year back. The question isn't whether this is possible. It's whether Washington decides to build it.",
        explorePrompt:
          "Compare Elena's commute today with a future Tacoma-to-Seattle ultra-high-speed rail trip, and see how much time it could return to her every year.",
        dataLabel: 'High-Speed Rail Vision · WSDOT UHSGT Study',
        placeholder: 'screenshot_commuter_step4_hsr.png',
        component: 'ElenaHSR',
        hint: 'Tacoma to Seattle — current peak drive compared with future ultra-high-speed rail',
        sources: [
          {
            id: 'wsdot-hsr',
            text: 'Washington State Department of Transportation (WSDOT), Ultra-High-Speed Ground Transportation Study — Business Case Analysis (2019).',
          },
        ],
        note: 'High-speed rail is defined as speeds between 160 to 250 mph. Travel time reflects seat time only and does not include boarding or security screening. Times are based on feasibility study projections and subject to change.',
      },
    ],
  },
  {
    id: 'freight',
    label: 'The Freight Shipper',
    tagline: 'Eastern Washington & Statewide',
    emoji: '🚛',
    persona: {
      name: 'Marcus',
      role: 'Wheat farmer & co-op manager · Spokane region',
      quote: "If my grain can't reach the port, it doesn't matter how good the harvest is.",
    },
    steps: [
      {
        id: 1,
        title: 'Eastern WA Feeds the World',
        bg: 'bg-white',
        vizBg: 'bg-gray-100',
        narrative:
          "Marcus manages a grain co-op in eastern Washington — one of the most productive agricultural regions on earth. In 2022, over 600 million tons of freight moved through Washington state, worth $700 billion. A disproportionate share originates east of the Cascades: wheat, apples, hops, timber. But this side of the state rarely appears in transportation conversations dominated by Seattle congestion.",
        explorePrompt:
          'See where freight originates across Washington and how cargo flows from eastern producers to ports and markets.',
        dataLabel: 'Freight Origins & Flow · FAF5 · Eastern WA',
        placeholder: 'screenshot_freight_step1_origins.png',
        hint: 'Freight origin clusters: Spokane, Yakima, Tri-Cities — statewide flow lines to ports',
        sources: [
          {
            id: 'wa-freight-plan',
            text: 'Washington State Freight System Plan (2022).',
          },
          {
            id: 'faf5',
            text: 'U.S. Department of Transportation, Federal Highway Administration & Bureau of Transportation Statistics, Freight Analysis Framework Version 5 (FAF5).',
          },
        ],
      },
      {
        id: 2,
        title: 'One Way In, One Way Out',
        bg: 'bg-gray-100',
        vizBg: 'bg-white',
        narrative:
          "To get Marcus's grain from Spokane to the Port of Seattle or the Columbia River system, it has to cross the Cascades. That means I-90 or US-2 — two corridors that carry the full weight of eastern Washington's economy. There is no real alternative. Weather, incidents, or infrastructure failures on either route don't create delays; they create crises.",
        explorePrompt:
          'Trace the primary freight corridors linking eastern Washington to western ports and see how cargo volumes concentrate on these two routes.',
        dataLabel: 'Freight Corridors · I-90 & US-2 · FAF5',
        placeholder: 'screenshot_freight_step2_corridors.png',
        hint: 'I-90 and US-2 highlighted — freight volume concentration across the Cascades',
        sources: [
          {
            id: 'faf5',
            text: 'U.S. Department of Transportation, Federal Highway Administration & Bureau of Transportation Statistics, Freight Analysis Framework Version 5 (FAF5).',
          },
        ],
      },
      {
        id: 3,
        title: 'Aging Bridges on a Critical Lifeline',
        bg: 'bg-white',
        vizBg: 'bg-gray-100',
        narrative:
          "The bridges on Marcus's routes aren't just aging — they're underfunded. Washington's bridge preservation funding covers only 40% of actual need. In April 2025, WSDOT permanently closed the 103-year-old SR 165 Carbon River Bridge, forcing a 9-mile detour. A similar closure on I-90 wouldn't just inconvenience drivers — it would sever a $700 billion trade network with no viable bypass.",
        explorePrompt:
          'Inspect bridge condition ratings along I-90 and US-2 and see what detour distances a closure would add to freight routes.',
        dataLabel: 'Bridge Conditions · WSDOT · I-90 & US-2',
        placeholder: 'screenshot_freight_step3_bridges.png',
        hint: 'Bridge ratings along east-west freight routes — detour impact on delivery times',
        sources: [
          {
            id: 'wsdot-bridges',
            text: 'Washington State Department of Transportation (WSDOT), Bridge Needs. Retrieved January 15, 2026.',
          },
          {
            id: 'wa-freight-plan',
            text: 'Washington State Freight System Plan (2022).',
          },
        ],
      },
      {
        id: 4,
        title: 'The Bottleneck at the Other End',
        bg: 'bg-gray-100',
        vizBg: 'bg-white',
        narrative:
          "Even when Marcus's grain makes it across the mountains, the challenge isn't over. By 2050, Washington freight is projected to grow 45% — from 603 million to 872 million tons. The region will run out of on-airport cargo warehouse space by 2027. Ports and airports built for today's volumes won't handle tomorrow's demand. When capacity runs short, Marcus's shipments get bumped, delayed, or rerouted — and the 1 in 4 Washington jobs tied to international trade feel it too.",
        explorePrompt:
          'See how rising cargo demand is projected to outpace airport and port capacity, and where the critical gaps emerge first.',
        dataLabel: 'Airport Cargo Capacity · FAA ACAIS · PSRC Aviation Baseline Study',
        placeholder: 'screenshot_freight_step4_airports.png',
        hint: 'Cargo demand vs. capacity by airport — 2027 warehouse shortfall and 2050 projections',
        sources: [
          {
            id: 'wa-freight-plan',
            text: 'Washington State Freight System Plan (2022).',
          },
          {
            id: 'psrc-aviation',
            text: 'Puget Sound Regional Council, Regional Aviation Baseline Study.',
          },
          {
            id: 'faa-acais',
            text: 'Federal Aviation Administration (FAA), Passenger Boarding (Enplanement) Data (ACAIS).',
          },
        ],
      },
    ],
  },
];

export default function JourneysPageClient({
  staticData,
}: {
  staticData: JourneyStaticData;
}) {
  const [activeJourney, setActiveJourney] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  const stepRefs = useRef<(HTMLElement | null)[]>([]);
  const progressItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const journey = journeys[activeJourney];
  const prevJourney = activeJourney > 0 ? journeys[activeJourney - 1] : null;
  const nextJourney = activeJourney < journeys.length - 1 ? journeys[activeJourney + 1] : null;
  const journeyReferences = Array.from(
    new Map(
      journey.steps
        .flatMap((step) => step.sources ?? [])
        .map((source) => [source.id, source])
    ).values()
  );

  const setupObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const idx = stepRefs.current.indexOf(visible[0].target as HTMLElement);
          if (idx !== -1) setActiveStep(idx);
        }
      },
      { rootMargin: '-35% 0px -35% 0px', threshold: 0 }
    );
    stepRefs.current.forEach((el) => { if (el) observerRef.current!.observe(el); });
  }, []);

  useEffect(() => {
    const t = setTimeout(setupObserver, 100);
    return () => { clearTimeout(t); observerRef.current?.disconnect(); };
  }, [activeJourney, setupObserver]);

  useEffect(() => {
    progressItemRefs.current[activeStep]?.scrollIntoView({
      behavior: 'smooth', block: 'nearest', inline: 'center',
    });
  }, [activeStep]);

  function selectJourney(idx: number) {
    setActiveJourney(idx);
    setActiveStep(0);
    stepRefs.current = [];
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollToStep(idx: number) {
    stepRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main className="relative min-w-[320px]" style={{ fontFamily: 'Encode Sans Compressed, sans-serif' }}>
      <section className="bg-black text-white px-4 md:px-8 py-14 md:py-20">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm md:text-base tracking-widest uppercase text-gray-400 mb-3">
            Challenge 2050
          </p>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Guided Journeys
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl leading-relaxed">
            Washington's transportation future isn't abstract — it's personal.
            Choose a journey to see how the data shapes real lives across our state,
            from Tacoma to Spokane and everywhere in between.
          </p>
        </div>
      </section>

      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto flex overflow-x-auto">
          {journeys.map((j, idx) => (
            <button
              key={j.id}
              onClick={() => selectJourney(idx)}
              className={`
                flex-shrink-0 px-5 md:px-8 py-4 text-left border-b-2 transition-all
                ${activeJourney === idx
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              <span className="text-base md:text-lg font-semibold block leading-tight">
                {j.emoji} {j.label}
              </span>
              <span className="text-xs md:text-sm text-gray-400 tracking-wide">
                {j.tagline}
              </span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={journey.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <section className="bg-gray-100 px-4 md:px-8 py-6 border-b border-gray-200">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white border border-gray-200 flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
                  {journey.emoji}
                </div>
                <div>
                  <p className="text-xl font-semibold">{journey.persona.name}</p>
                  <p className="text-sm text-gray-500">{journey.persona.role}</p>
                </div>
              </div>
              <blockquote className="md:ml-8 text-gray-600 text-base md:text-lg italic border-l-4 border-gray-300 pl-4 leading-relaxed">
                "{journey.persona.quote}"
              </blockquote>
            </div>
          </section>

          <div className="bg-white border-b border-gray-200 sticky top-[73px] z-20 shadow-sm">
            <div className="max-w-6xl mx-auto flex items-start overflow-x-auto overflow-y-visible px-4 md:px-8 py-6 gap-0">
              {journey.steps.map((s, idx) => (
                <React.Fragment key={s.id}>
                  <button
                    ref={(el) => { progressItemRefs.current[idx] = el; }}
                    onClick={() => scrollToStep(idx)}
                    className="flex flex-col items-center gap-1 flex-shrink-0 group transition-all"
                  >
                    <span className={`
                      w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                      transition-all border-2 flex-shrink-0
                      ${idx <= activeStep
                        ? 'bg-black border-black text-white'
                        : 'bg-white border-gray-300 text-gray-400 group-hover:border-gray-500'}
                    `}>
                      {idx < activeStep ? '✓' : idx + 1}
                    </span>
                    <span className={`
                      text-xs font-medium text-center whitespace-normal transition-all max-w-[260px]
                      ${idx === activeStep ? 'text-black' : 'text-gray-400 group-hover:text-gray-600'}
                    `}>
                      {s.title}
                    </span>
                  </button>
                  {idx < journey.steps.length - 1 && (
                    <div className={`
                      h-px mx-3 flex-shrink-0 w-6 md:w-10 transition-all self-center
                      ${idx < activeStep ? 'bg-black' : 'bg-gray-200'}
                    `} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {journey.steps.map((step, idx) => (
            <motion.div
              key={`${journey.id}-${step.id}`}
              ref={(el) => { stepRefs.current[idx] = el; }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <section className={`relative px-4 md:px-8 py-8 md:py-10 ${step.bg}`}>
                <div className="max-w-6xl mx-auto">
                  <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-start">
                    <div className="flex-shrink-0">
                      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">
                        Step {idx + 1} of {journey.steps.length}
                      </p>
                      <h2 className="text-3xl md:text-4xl font-semibold leading-tight">
                        {step.title}
                      </h2>
                    </div>
                    <p className="text-lg leading-relaxed text-gray-700 md:pt-8 max-w-2xl">
                      {step.narrative}
                    </p>
                  </div>
                  <div className="mt-8 bg-white md:p-6 p-3 border rounded-lg">
                    <p className="text-lg mb-4">
                      <strong>Explore:</strong> {step.explorePrompt}
                    </p>
                    <div className="w-full" style={{ minHeight: 480 }}>
                      {step.component === 'ElenaCommuteMap' ? (
                        <ElenaCommuteMap routesByTime={staticData.commuteRoutes} />
                      ) : step.component === 'ElenaForecastMap' ? (
                        <ElenaForecastMap
                          route={staticData.forecast.route}
                          multiplier={staticData.forecast.multiplier}
                        />
                      ) : step.component === 'ElenaBridgeMap' ? (
                        <ElenaBridgeMap
                          route={staticData.bridges.route}
                          bridges={staticData.bridges.corridorBridges}
                        />
                      ) : step.component === 'ElenaHSR' ? (
                        <ElenaHSR />
                      ) : (
                        <div
                          className="border-2 border-dashed border-gray-200 rounded-md flex flex-col items-center justify-center text-center h-full"
                          style={{ minHeight: 480, background: '#f9fafb' }}
                        >
                          <div className="text-5xl mb-4">🗺️</div>
                          <p className="text-sm font-mono text-gray-400 mb-2">[ Visualization Placeholder ]</p>
                          <p className="text-xs font-mono text-gray-300 mb-3">{step.placeholder}</p>
                          <div className="bg-white border border-gray-200 rounded px-4 py-2 text-xs text-gray-400 max-w-sm">
                            <span className="font-semibold text-gray-500">Data layer:</span> {step.dataLabel}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      <span className="font-semibold">Data layer:</span> {step.dataLabel}
                    </div>
                  </div>

                  {step.note && (
                    <p className="italic mt-2 px-1" style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                      Note: {step.note}
                    </p>
                  )}
                </div>
              </section>

              {idx < journey.steps.length - 1 && (
                <div className="border-t border-gray-200" />
              )}
            </motion.div>
          ))}

          {journeyReferences.length > 0 && (
            <section className="px-4 md:px-8 py-8 border-t border-gray-200 bg-gray-50">
              <div className="max-w-6xl mx-auto">
                <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">
                  Journey References
                </p>
                <ol className="space-y-2 text-sm text-gray-600 pl-5 list-disc">
                  {journeyReferences.map((source) => (
                    <li key={source.id}>{source.text}</li>
                  ))}
                </ol>
              </div>
            </section>
          )}

          <motion.section
            className="relative px-4 md:px-8 py-12 md:py-16 bg-black text-white"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="max-w-6xl mx-auto">
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
                You've reached the end of this journey
              </p>
              <h3 className="text-2xl md:text-3xl font-semibold mb-8">
                Explore another perspective
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prevJourney ? (
                  <button
                    onClick={() => selectJourney(activeJourney - 1)}
                    className="group text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-lg p-6 transition-all"
                  >
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">← Previous journey</p>
                    <p className="text-2xl mb-1">{prevJourney.emoji}</p>
                    <p className="text-xl font-semibold group-hover:underline underline-offset-2">{prevJourney.label}</p>
                    <p className="text-sm text-gray-400 mt-1">{prevJourney.tagline}</p>
                    <p className="text-sm text-gray-500 mt-3 italic leading-relaxed">"{prevJourney.persona.quote}"</p>
                  </button>
                ) : (
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="group text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-lg p-6 transition-all"
                  >
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">↑ Back to top</p>
                    <p className="text-xl font-semibold group-hover:underline underline-offset-2">Review this journey</p>
                    <p className="text-sm text-gray-400 mt-1">Scroll back through {journey.label}'s story</p>
                  </button>
                )}

                {nextJourney ? (
                  <button
                    onClick={() => selectJourney(activeJourney + 1)}
                    className="group text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-lg p-6 transition-all"
                  >
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">Next journey →</p>
                    <p className="text-2xl mb-1">{nextJourney.emoji}</p>
                    <p className="text-xl font-semibold group-hover:underline underline-offset-2">{nextJourney.label}</p>
                    <p className="text-sm text-gray-400 mt-1">{nextJourney.tagline}</p>
                    <p className="text-sm text-gray-500 mt-3 italic leading-relaxed">"{nextJourney.persona.quote}"</p>
                  </button>
                ) : (
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="group text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-lg p-6 transition-all"
                  >
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">↑ Back to top</p>
                    <p className="text-xl font-semibold group-hover:underline underline-offset-2">Review this journey</p>
                    <p className="text-sm text-gray-400 mt-1">Scroll back through {journey.label}'s story</p>
                  </button>
                )}
              </div>
            </div>
          </motion.section>
        </motion.div>
      </AnimatePresence>

      <footer className="bg-gray-50 text-sm text-gray-500 pt-12 pb-10 text-center border-t border-gray-200">
        <p>
          © {new Date().getFullYear()} Challenge 2050 · The Future in Motion ·{' '}
          <a href="mailto:mobility@uw.edu" className="hover:underline">Contact us</a>
        </p>
      </footer>
    </main>
  );
}
