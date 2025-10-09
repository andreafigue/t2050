// @ts-nocheck
/**
 * Headless route worsener — no UI.
 *
 * Call `worsenRoute(route, { targetDeltaMinutes: 10 })` and get back:
 * - adjusted congestion levels for the route's first leg (nested: severe ⊂ red ⊂ orange)
 * - an ETA estimate that is ~targetDeltaMinutes higher than baseline
 * - a shallow-cloned route with updated annotation + meta attached
 *
 * Based on the same calibration and nesting logic you used in RoutePlayground.
 */

export type CongestionLevel = "low" | "moderate" | "heavy" | "severe" | "unknown";

export interface DirectionsLegAnnotation {
  congestion?: CongestionLevel[];      // per-vertex/segment levels from Mapbox
  distance?: number[];                 // meters per segment
  duration?: number[];                 // seconds per segment (if requested)
}
export interface DirectionsLeg { annotation?: DirectionsLegAnnotation }
export interface DirectionsRoute {
  duration: number; // total seconds
  legs: DirectionsLeg[];
  geometry?: any;
}

export interface Factors { low: number; moderate: number; heavy: number; severe: number }

export interface BaseParams {
  dilOrange: number; dilRed: number; dilSevere: number;
  lenOrange: number; lenRed: number; lenSevere: number;
  runsOrange: number; runsRed: number; runsSevere: number;
}
export interface Weights {
  dO: number; dR: number; dS: number;
  lO: number; lR: number; lS: number;
  rO: number; rR: number; rS: number;
}

export interface WorsenOptions {
  targetDeltaMinutes: number;           // desired ETA increase over baseline
  preferHighways?: boolean;             // bias new runs toward longer segments
  highwayThresholdMeters?: number;      // segment length considered "highway"
  seed?: number;                        // deterministic placement for runs
  factors?: Factors;                    // congestion time multipliers
  baseParams?: BaseParams;              // intensity at m = 0
  weights?: Weights;                    // per-unit intensity growth
  intensityMax?: number;                // search upper bound for intensity
  bisections?: number;                  // search iterations
}

export interface WorsenResult {
  adjustedLevels: CongestionLevel[];    // worsened congestion per segment
  estimatedDurationSeconds: number;     // ETA estimate (seconds)
  estimatedDurationMinutes: number;     // rounded minutes
  baseDurationMinutes: number;          // rounded baseline minutes
  deltaMinutes: number;                 // estimated Δ in minutes
  paramsUsed: BaseParams & { preferHighways: boolean; seed: number };
  routeWithAnnotation: DirectionsRoute & {
    legs: [{ annotation: DirectionsLegAnnotation }];
    worsenMeta: {
      estimated_duration_seconds: number;
      estimated_duration_minutes: number;
      delta_minutes: number;
      params_used: WorsenResult["paramsUsed"];
      factors: Factors;
    }
  };
}

// ---------- utilities ----------
const CL = { low: 0, moderate: 1, heavy: 2, severe: 3 } as const;
const CL_STR: CongestionLevel[] = ["low", "moderate", "heavy", "severe"];
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
function mulberry32(a: number) { return function(){ let t=(a+=0x6d2b79f5); t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }

function dilateMask(mask: number[], radius: number) {
  if (radius <= 0) return mask.slice();
  const n = mask.length; const out = new Array(n).fill(0);
  for (let i=0;i<n;i++) if (mask[i]) { const L=clamp(i-radius,0,n-1), R=clamp(i+radius,0,n-1); for (let j=L;j<=R;j++) out[j]=1; }
  return out;
}

function amplifyWithParams(baseLevels: CongestionLevel[], segmentDists: number[], params: BaseParams & { preferHighways: boolean; seed: number; highwayThresholdMeters: number }) {
  const n = baseLevels.length; if (!n) return [] as CongestionLevel[];
  const rnd = mulberry32(Math.floor(params.seed || 1));

  const arr = baseLevels.map((s) => (CL as any)[s] ?? 0);
  let maskO = arr.map((v) => (v > 0 ? 1 : 0));   // orange or worse
  let maskR = arr.map((v) => (v >= 2 ? 1 : 0));  // red or worse
  let maskS = arr.map((v) => (v >= 3 ? 1 : 0));  // severe

  // dilate per-color
  maskO = dilateMask(maskO, params.dilOrange);
  maskR = dilateMask(maskR, params.dilRed);
  maskS = dilateMask(maskS, params.dilSevere);

  // enforce nesting: severe ⊂ red ⊂ orange
  for (let i=0;i<n;i++){ if (!maskO[i]) maskR[i]=0; if (!maskR[i]) maskS[i]=0; }

  // seed runs
  function pickPool(withinMask?: number[]) {
    const all: number[] = []; const hwy: number[] = [];
    for (let i=0;i<n;i++) if (!withinMask || withinMask[i]) { all.push(i); if ((segmentDists[i]||0) > params.highwayThresholdMeters) hwy.push(i); }
    const pool = (params.preferHighways && hwy.length) ? hwy : all; return pool.length ? pool : all;
  }
  function seedRuns(count: number, lenSeg: number, levelIdx: number, constrainMask?: number[]) {
    if (count <= 0 || lenSeg <= 0) return;
    const pool = pickPool(constrainMask); const len = clamp(lenSeg, 1, Math.max(1, Math.floor(n*0.95)));
    for (let r=0;r<count;r++) {
      const center = pool[Math.floor(rnd()*pool.length)]; const half = Math.floor(len/2);
      let L = clamp(center-half,0,n-1), R = clamp(center+half,0,n-1);
      if (constrainMask) { while(L<R && !constrainMask[L]) L++; while(R>L && !constrainMask[R]) R--; if(!constrainMask[L] && !constrainMask[R]) continue; }
      for (let i=L;i<=R;i++) { if (levelIdx===CL.moderate) maskO[i]=1; if (levelIdx===CL.heavy){ maskR[i]=1; maskO[i]=1; } if (levelIdx===CL.severe){ maskS[i]=1; maskR[i]=1; maskO[i]=1; } }
    }
  }
  seedRuns(params.runsOrange, params.lenOrange, CL.moderate /* unconstrained */);
  seedRuns(params.runsRed,    params.lenRed,    CL.heavy,  maskO);
  seedRuns(params.runsSevere, params.lenSevere, CL.severe, maskR);

  const outNum = new Array(n).fill(CL.low);
  for (let i=0;i<n;i++){ if (maskO[i]) outNum[i]=CL.moderate; if (maskR[i]) outNum[i]=CL.heavy; if (maskS[i]) outNum[i]=CL.severe; }
  return outNum.map((v)=> CL_STR[clamp(v,0,3)]);
}

function estimateMinutes(baseLevels: CongestionLevel[], ampLevels: CongestionLevel[], dists: number[], segDur: number[] | undefined | null, baseSeconds: number, factors: Factors) {
  const n = Math.min(baseLevels.length, ampLevels.length, dists.length); if (!n || baseSeconds<=0) return null;
  const F = { low: factors.low, moderate: factors.moderate, heavy: factors.heavy, severe: factors.severe } as const;

  if (segDur && segDur.length >= n) {
    let tot = 0;
    for (let i=0;i<n;i++) {
      const t0 = Math.max(0.01, segDur[i]);
      const fb = (F as any)[baseLevels[i]] ?? 1.0;
      const fa = (F as any)[ampLevels[i]] ?? 1.0;
      tot += t0 * (fa / Math.max(0.01, fb));
    }
    return Math.round(tot / 60);
  }
  // distance-weight fallback
  let sum=0, bw=0, aw=0;
  for (let i=0;i<n;i++){ const d = Math.max(0.1, dists[i]||0.1); sum+=d; bw += d*((F as any)[baseLevels[i]] ?? 1.0); aw += d*((F as any)[ampLevels[i]] ?? 1.0); }
  if (!sum) return null; const baseF = bw/sum, ampF = aw/sum; const scaled = (baseSeconds*ampF)/Math.max(0.01, baseF); return Math.round(scaled/60);
}

function paramsForIntensity(m: number, baseP: BaseParams, W: Weights) : BaseParams {
  return {
    dilOrange: clamp(Math.round(baseP.dilOrange + m*W.dO), 0, 60),
    dilRed:    clamp(Math.round(baseP.dilRed    + m*W.dR), 0, 60),
    dilSevere: clamp(Math.round(baseP.dilSevere + m*W.dS), 0, 60),
    lenOrange: clamp(Math.round(baseP.lenOrange + m*W.lO), 1, 80),
    lenRed:    clamp(Math.round(baseP.lenRed    + m*W.lR), 1, 80),
    lenSevere: clamp(Math.round(baseP.lenSevere + m*W.lS), 1, 80),
    runsOrange: clamp(Math.floor(baseP.runsOrange + m*W.rO), 0, 8),
    runsRed:    clamp(Math.floor(baseP.runsRed    + m*W.rR), 0, 8),
    runsSevere: clamp(Math.floor(baseP.runsSevere + m*W.rS), 0, 8),
  };
}

// ---------- main entry ----------
export function worsenRoute(route: DirectionsRoute, opts: WorsenOptions): WorsenResult {
  const leg = route?.legs?.[0];
  const ann = leg?.annotation || {};
  const baseLevels = (ann.congestion as CongestionLevel[]) || [];
  const dists = ann.distance || [];
  const segDur = ann.duration || null;
  const baseSeconds = route.duration || 0;

  const factors: Factors = {
    // Defaults match your calibrated, more-aggressive visual setup so that
    // the same minutes Δ results in fewer colored segments (i.e., milder look).
    low: 1.0,
    moderate: 2.0,
    heavy: 3.0,
    severe: 4.0,
    ...(opts.factors || {}),
  };

  // Baseline small params (intensity m = 0): very mild visuals
  const baseP: BaseParams = {
    dilOrange: 2, dilRed: 1, dilSevere: 0,
    lenOrange: 10, lenRed: 8, lenSevere: 6,
    runsOrange: 0, runsRed: 0, runsSevere: 0,
    ...(opts.baseParams || {}),
  };

  // Per-unit growth (Orange > Red > Severe)
  const W: Weights = {
    dO: 3.0, dR: 2.0, dS: 1.2,
    lO: 1.2, lR: 0.9, lS: 0.6,
    rO: 0.12, rR: 0.08, rS: 0.05,
    ...(opts.weights || {}),
  };

  const preferHighways = opts.preferHighways ?? true;
  const highwayThresholdMeters = opts.highwayThresholdMeters ?? 600;
  const seed = opts.seed ?? 42;

  const targetDelta = Math.max(0, opts.targetDeltaMinutes || 0);
  const baseMin = Math.round(baseSeconds / 60);

  // Quick exits
  if (!baseLevels.length || !dists.length || !route.duration) {
    const minutes = Math.round(route.duration / 60);
    return {
      adjustedLevels: baseLevels,
      estimatedDurationSeconds: route.duration,
      estimatedDurationMinutes: minutes,
      baseDurationMinutes: minutes,
      deltaMinutes: 0,
      paramsUsed: { ...baseP, preferHighways, seed },
      routeWithAnnotation: Object.assign({}, route, { worsenMeta: { estimated_duration_seconds: route.duration, estimated_duration_minutes: minutes, delta_minutes: 0, params_used: { ...baseP, preferHighways, seed }, factors } }) as any,
    };
  }

  // Bisection over intensity to hit target Δ (minutes)
  const intensityMax = opts.intensityMax ?? 200;
  const iters = clamp(opts.bisections ?? 10, 3, 20);

  let lo = 0, hi = intensityMax, best = paramsForIntensity(0, baseP, W), bestDiff = Infinity, bestLevels = baseLevels;
  for (let it=0; it<iters; it++) {
    const mid = (lo + hi) / 2;
    const p = paramsForIntensity(mid, baseP, W);
    const ampLevels = amplifyWithParams(baseLevels, dists, { ...p, preferHighways, seed, highwayThresholdMeters });
    const estMin = estimateMinutes(baseLevels, ampLevels, dists, segDur, baseSeconds, factors) ?? baseMin;
    const diff = Math.abs((estMin - baseMin) - targetDelta);
    if (diff < bestDiff) { best = p; bestDiff = diff; bestLevels = ampLevels; }
    if ((estMin - baseMin) < targetDelta) lo = mid; else hi = mid;
  }

  // One final compute with chosen params to return definitive numbers
  const adjustedLevels = amplifyWithParams(baseLevels, dists, { ...best, preferHighways, seed, highwayThresholdMeters });
  const estimatedMinutes = estimateMinutes(baseLevels, adjustedLevels, dists, segDur, baseSeconds, factors) ?? baseMin;

  const routeWithAnnotation: WorsenResult["routeWithAnnotation"] = Object.assign({}, route, {
    legs: [{ annotation: { ...ann, congestion: adjustedLevels } }],
    worsenMeta: {
      estimated_duration_seconds: estimatedMinutes * 60,
      estimated_duration_minutes: estimatedMinutes,
      delta_minutes: estimatedMinutes - baseMin,
      params_used: { ...best, preferHighways, seed },
      factors,
    },
  });

  return {
    adjustedLevels,
    estimatedDurationSeconds: estimatedMinutes * 60,
    estimatedDurationMinutes: estimatedMinutes,
    baseDurationMinutes: baseMin,
    deltaMinutes: estimatedMinutes - baseMin,
    paramsUsed: { ...best, preferHighways, seed },
    routeWithAnnotation,
  };
}

// Convenience: tiny wrapper that only returns the adjusted route copy
export function worsenRouteCopy(route: DirectionsRoute, targetDeltaMinutes: number, opts: Omit<WorsenOptions, "targetDeltaMinutes"> = {}) {
  return worsenRoute(route, { targetDeltaMinutes, ...opts }).routeWithAnnotation;
}

// --- Optional: fetch Mapbox route and worsen it in one go (no UI) ---
export interface FetchAndWorsenArgs {
  origin: [number, number];
  destination: [number, number];
  accessToken: string;
  targetDeltaMinutes: number;
  departAt?: string; // e.g. '2025-10-16T17:30' local time or ISO
  profile?: "driving-traffic" | "driving" | "walking" | "cycling";
  mapboxBaseUrl?: string; // override for testing
  options?: Omit<WorsenOptions, "targetDeltaMinutes">;
}

export async function fetchAndWorsenRoute({
  origin, destination, accessToken, targetDeltaMinutes, departAt, profile = "driving-traffic", mapboxBaseUrl = "https://api.mapbox.com", options = {},
}: FetchAndWorsenArgs): Promise<WorsenResult> {
  const [ox, oy] = origin;
  const [dx, dy] = destination;
  const base = `${mapboxBaseUrl}/directions/v5/mapbox/${profile}/${ox},${oy};${dx},${dy}`;
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    steps: "true",
    alternatives: "false",
    annotations: "congestion,distance,duration",
    access_token: accessToken,
  });
  if (departAt) params.set("depart_at", departAt);
  const res = await fetch(`${base}?${params.toString()}`);
  if (!res.ok) throw new Error(`Mapbox directions error: ${res.status}`);
  const json = await res.json();
  const route: DirectionsRoute | undefined = json?.routes?.[0];
  if (!route) throw new Error("No route returned from Mapbox");
  return worsenRoute(route, { targetDeltaMinutes, ...(options || {}) });
}
