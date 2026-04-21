// @ts-nocheck
"use client";

import React from "react";

const DRIVE_MINUTES = 62;
const LINK_MINUTES = 86;
const HSR_MINUTES = 36;

const DAILY_MINUTES_RETURNED = (DRIVE_MINUTES - HSR_MINUTES) * 2;
const YEARLY_MINUTES_RETURNED = DAILY_MINUTES_RETURNED * 250;
const YEARLY_HOURS_RETURNED = Math.round(YEARLY_MINUTES_RETURNED / 60);
const YEARLY_DAYS_RETURNED = Math.round(YEARLY_HOURS_RETURNED / 24);
const YEARLY_WORKWEEKS_RETURNED = Math.round((YEARLY_DAYS_RETURNED / 5) * 10) / 10;

const MODES = [
  {
    id: "drive",
    label: "Drive today",
    subtitle: "I-5 peak commute",
    minutes: DRIVE_MINUTES,
    icon: "/animations/car.png",
    barClass: "bg-gray-800",
    textClass: "text-gray-900",
    chipClass: "border-gray-200 text-gray-600",
    segments: [
      { label: "Drive", minutes: DRIVE_MINUTES, className: "bg-gray-800" },
    ],
    routeLabel: "Home → drive on I-5 → work",
  },
  {
    id: "link",
    label: "Link + transfer",
    subtitle: "Door-to-door transit option",
    minutes: LINK_MINUTES,
    icon: "/animations/train.png",
    barClass: "bg-gray-300",
    textClass: "text-gray-700",
    chipClass: "border-gray-200 text-gray-500",
    segments: [
      { label: "Drive to station", minutes: 14, className: "bg-slate-400" },
      { label: "Link ride", minutes: 58, className: "bg-blue-400" },
      { label: "Walk / transfer", minutes: 14, className: "bg-sky-200" },
    ],
    routeLabel: "Home → drive / park → Link → walk to work",
  },
  {
    id: "hsr",
    label: "High-speed rail",
    subtitle: "Assuming a Tacoma stop",
    minutes: HSR_MINUTES,
    icon: "/animations/hsr.png",
    barClass: "bg-emerald-500",
    textClass: "text-emerald-700",
    chipClass: "border-emerald-200 text-emerald-700",
    segments: [
      { label: "Access to station", minutes: 8, className: "bg-emerald-300" },
      { label: "HSR ride", minutes: 18, className: "bg-emerald-500" },
      { label: "Walk / local transfer", minutes: 10, className: "bg-lime-300" },
    ],
    routeLabel: "Home → Tacoma stop → HSR → local transfer → work",
  },
];

const MAX_MINUTES = Math.max(...MODES.map((mode) => mode.minutes));

const ElenaHSR: React.FC = () => {
  return (
    <div
      className="flex flex-col gap-4 w-full"
      style={{ fontFamily: "Encode Sans Compressed, sans-serif" }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
            Elena's route • Tacoma to Seattle
          </div>
          <h3 className="mt-3 text-2xl md:text-3xl font-semibold text-gray-900 leading-tight">
            High-speed rail could still cut Elena's full commute dramatically
          </h3>
          <p className="mt-2 text-sm md:text-base text-gray-600 max-w-2xl">
            This version compares estimated door-to-door commute scenarios, not just
            the in-vehicle rail segment. It assumes Elena can access a Tacoma HSR stop.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm md:max-w-xs">
          <div className="text-xs uppercase tracking-widest text-emerald-600">
            What Elena gets back
          </div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700">
            ~{YEARLY_WORKWEEKS_RETURNED} workweeks a year
          </div>
          <div className="text-sm text-emerald-700/90">
            About {YEARLY_HOURS_RETURNED} hours returned to her time
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 md:p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            {MODES.map((mode) => {
              return (
                <div key={mode.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={mode.icon}
                        alt=""
                        className="h-10 w-10 object-contain shrink-0"
                      />
                      <div className="min-w-0">
                        <div className={`text-lg font-semibold ${mode.textClass}`}>
                          {mode.label}
                        </div>
                        <div className="text-sm text-gray-500">{mode.subtitle}</div>
                      </div>
                    </div>
                    <div
                      className={`shrink-0 rounded-full border bg-white px-3 py-1 text-xs font-medium shadow-sm ${mode.chipClass}`}
                    >
                      {mode.minutes} min
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    {mode.routeLabel}
                  </div>

                  <div className="h-5 rounded-full bg-gray-100 overflow-hidden flex">
                    {mode.segments.map((segment, idx) => (
                      <div
                        key={`${mode.id}-${segment.label}`}
                        className={`h-full transition-all duration-1000 ${segment.className} ${
                          idx === 0 ? "rounded-l-full" : ""
                        } ${idx === mode.segments.length - 1 ? "rounded-r-full" : ""}`}
                        style={{ width: `${(segment.minutes / MAX_MINUTES) * 100}%` }}
                        title={`${segment.label}: ${segment.minutes} min`}
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    {mode.segments.map((segment) => (
                      <div
                        key={`${mode.id}-${segment.label}-legend`}
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1"
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${segment.className}`} />
                        <span>{segment.label}</span>
                        <span className="text-gray-400">{segment.minutes} min</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs uppercase tracking-widest text-gray-500">
              Today vs. HSR
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-xs uppercase tracking-widest text-gray-400">
                  Today
                </div>
                <div className="mt-1 text-xl font-semibold text-gray-900">
                  ~{DRIVE_MINUTES} min
                </div>
                <div className="text-sm text-gray-600">
                  vulnerable to I-5 traffic
                </div>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-white p-3">
                <div className="text-xs uppercase tracking-widest text-emerald-600">
                  With HSR
                </div>
                <div className="mt-1 text-xl font-semibold text-emerald-700">
                  ~{HSR_MINUTES} min
                </div>
                <div className="text-sm text-emerald-700/90">
                  assuming a Tacoma stop and local access
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="text-xs uppercase tracking-widest text-red-500">
                Time saved
              </div>
              <div className="mt-1 text-lg font-semibold text-red-700">
                ~{Math.round(DAILY_MINUTES_RETURNED / 60)} hour and {DAILY_MINUTES_RETURNED % 60} minutes back every workday
              </div>
              <div className="text-sm text-red-700/90">
                That compounds into roughly {YEARLY_WORKWEEKS_RETURNED} workweeks returned each year.
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-500 leading-relaxed">
              This is an illustrative door-to-door scenario for Elena. Driving reflects
              a peak commute, Link includes access and transfer time, and HSR assumes a
              Tacoma stop plus local access on both ends. Yearly time returned assumes a
              round-trip commute, five days a week, across 250 workdays.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElenaHSR;
