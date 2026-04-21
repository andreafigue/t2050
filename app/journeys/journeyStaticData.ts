import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { point, booleanPointInPolygon, lineString, pointToLineDistance } from "@turf/turf";
import { csvParse } from "d3-dsv";
import type { Feature, Polygon } from "geojson";

import type {
  CommuteRoutesByTime,
  JourneyBridgeData,
  JourneyRouteData,
  JourneyStaticData,
  JourneyTimeKey,
} from "./types";

const ORIGIN: [number, number] = [-122.4443, 47.2529];
const DESTINATION: [number, number] = [-122.3321, 47.6062];
const STATIC_DEPARTURE_DATE = "2026-04-23";
const TIME_KEYS: JourneyTimeKey[] = ["07:30", "12:00", "17:30"];

function getMapboxToken() {
  const token =
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? process.env.MAPBOX_ACCESS_TOKEN;

  if (!token) {
    throw new Error("Missing Mapbox access token for static journeys build.");
  }

  return token;
}

function normalizeRoute(route: any): JourneyRouteData {
  return {
    duration: route.duration,
    geometry: route.geometry,
    legs: (route.legs ?? []).map((leg: any) => ({
      annotation: {
        congestion: leg?.annotation?.congestion ?? [],
      },
    })),
  };
}

async function fetchStaticRoute(time: JourneyTimeKey): Promise<JourneyRouteData> {
  const departAt = `${STATIC_DEPARTURE_DATE}T${time}`;
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    steps: "false",
    alternatives: "false",
    annotations: "congestion,duration,distance",
    depart_at: departAt,
    access_token: getMapboxToken(),
  });

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
    `${ORIGIN[0]},${ORIGIN[1]};${DESTINATION[0]},${DESTINATION[1]}?${params.toString()}`;

  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Mapbox directions request failed with ${response.status}`);
  }

  const data = await response.json();
  const route = data?.routes?.[0];

  if (!route?.geometry?.coordinates?.length) {
    throw new Error(`No static route returned for ${time}`);
  }

  return normalizeRoute(route);
}

async function getPsrcMultiplier() {
  const tazPath = path.join(process.cwd(), "public", "data/psrc/psrc_taz.geojson");
  const tazData = JSON.parse(await fs.readFile(tazPath, "utf8"));

  const originPoint = point([ORIGIN[0], ORIGIN[1]]);
  const destinationPoint = point([DESTINATION[0], DESTINATION[1]]);

  let originTaz: number | null = null;
  let destinationTaz: number | null = null;

  for (const feature of tazData.features) {
    const polygon = feature as Feature<Polygon>;

    if (!originTaz && booleanPointInPolygon(originPoint, polygon)) {
      originTaz = feature.properties.taz;
    }

    if (!destinationTaz && booleanPointInPolygon(destinationPoint, polygon)) {
      destinationTaz = feature.properties.taz;
    }

    if (originTaz && destinationTaz) {
      break;
    }
  }

  if (originTaz === null || destinationTaz === null) {
    throw new Error("Could not resolve PSRC TAZ pair for journeys page.");
  }

  const batchFile = `batch_${Math.floor(originTaz / 100)
    .toString()
    .padStart(3, "0")}.json`;

  const multiplierPath = path.join(process.cwd(), "public", "data/psrc/batches", batchFile);
  const sourcePath = path.join(process.cwd(), "public", "data/psrc/sources", batchFile);

  const multiplierBatch = JSON.parse(await fs.readFile(multiplierPath, "utf8"));
  const sourceBatch = JSON.parse(await fs.readFile(sourcePath, "utf8"));

  return {
    multiplier: multiplierBatch?.[originTaz]?.[destinationTaz] ?? null,
    sourceMultiplier: sourceBatch?.[originTaz]?.[destinationTaz] ?? null,
  };
}

async function getCorridorBridges(route: JourneyRouteData): Promise<JourneyBridgeData[]> {
  const csvPath = path.join(process.cwd(), "public", "Bridge Needs GIS data.csv");
  const csv = await fs.readFile(csvPath, "utf8");
  const rows = csvParse(csv);

  const normalized = rows.map((row) => ({
    ...row,
    Longitude: row.Longitude ? Number(row.Longitude) : null,
    Latitude: row.Latitude ? Number(row.Latitude) : null,
    Detour: row.Detour ? Number(row.Detour) : null,
  })) as JourneyBridgeData[];

  const coords = route.geometry.coordinates;
  const corridor = lineString(coords);

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  minLng -= 0.01;
  maxLng += 0.01;
  minLat -= 0.01;
  maxLat += 0.01;

  return normalized.filter((bridge) => {
    if (bridge.Longitude == null || bridge.Latitude == null) {
      return false;
    }

    if (
      bridge.Longitude < minLng ||
      bridge.Longitude > maxLng ||
      bridge.Latitude < minLat ||
      bridge.Latitude > maxLat
    ) {
      return false;
    }

    return (
      pointToLineDistance(point([bridge.Longitude, bridge.Latitude]), corridor, {
        units: "kilometers",
      }) <= 0.25
    );
  });
}

export const getJourneyStaticData = cache(async (): Promise<JourneyStaticData> => {
  const routes = await Promise.all(TIME_KEYS.map((time) => fetchStaticRoute(time)));
  const commuteRoutes = Object.fromEntries(
    TIME_KEYS.map((time, index) => [time, routes[index]])
  ) as CommuteRoutesByTime;

  const [psrc, corridorBridges] = await Promise.all([
    getPsrcMultiplier(),
    getCorridorBridges(commuteRoutes["07:30"]),
  ]);

  return {
    commuteRoutes,
    forecast: {
      route: commuteRoutes["07:30"],
      multiplier: psrc.multiplier,
      sourceMultiplier: psrc.sourceMultiplier,
    },
    bridges: {
      route: commuteRoutes["07:30"],
      corridorBridges,
    },
  };
});
