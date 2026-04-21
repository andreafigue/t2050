export type JourneyTimeKey = "07:30" | "12:00" | "17:30";

export interface JourneyRouteData {
  duration: number;
  geometry: GeoJSON.LineString;
  legs: Array<{
    annotation?: {
      congestion?: string[];
    };
  }>;
}

export interface JourneyBridgeData {
  Longitude: number | null;
  Latitude: number | null;
  BridgeNumber: string;
  BridgeName: string;
  CountyName: string;
  YearBuilt: string | number | null;
  BridgeOverallConditionState: string | null;
  Detour: number | null;
  [key: string]: string | number | null;
}

export type CommuteRoutesByTime = Record<JourneyTimeKey, JourneyRouteData>;

export interface JourneyStaticData {
  commuteRoutes: CommuteRoutesByTime;
  forecast: {
    route: JourneyRouteData;
    multiplier: number | null;
    sourceMultiplier: string | null;
  };
  bridges: {
    route: JourneyRouteData;
    corridorBridges: JourneyBridgeData[];
  };
}
