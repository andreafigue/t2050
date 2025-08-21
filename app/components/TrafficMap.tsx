'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

const origin: [number, number] = [-122.29906608956142, 47.6618835713566]; // [lon, lat] , 
const destination: [number, number] = [-122.30882971528085, 47.448720316916734]; 

mapboxgl.accessToken = MAPBOX_TOKEN;

type TrafficLevel = 'low' | 'medium' | 'high';

const getTrafficColor = (speedKph: number): string => {
  if (speedKph < 15) return '#FF0000'; // Red
  if (speedKph < 30) return '#FFA500'; // Orange
  return '#00FF00'; // Green
};

const TrafficMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    const fetchAndRenderRoute = async () => {
      //const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_TOKEN}&start=${origin[0]},${origin[1]}&end=${destination[0]},${destination[1]}`;

      const res = await fetch(`/api/ors/route?start=${origin[0]},${origin[1]}&end=${destination[0]},${destination[1]}`);

      const data = await res.json();

      const coords: [number, number][] = data.features[0].geometry.coordinates;
      const steps = data.features[0].properties.segments[0].steps;

      if (!mapRef.current) return;

      steps.forEach((step: any, i: number) => {
        const stepCoords = coords.slice(step.way_points[0], step.way_points[1] + 1);
        const distanceKm = step.distance / 1000;
        const durationHr = step.duration / 3600;
        const speedKph = distanceKm / durationHr;

        const trafficColor = getTrafficColor(speedKph);

        const stepLine: GeoJSON.Feature<GeoJSON.LineString> = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: stepCoords,
          },
          properties: {
            color: trafficColor,
          },
        };

        const layerId = `step-${i}`;

        mapRef.current!.addSource(layerId, {
          type: 'geojson',
          data: stepLine,
        });

        mapRef.current!.addLayer({
          id: layerId,
          type: 'line',
          source: layerId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 5,
          },
        });
      });

      mapRef.current!.fitBounds([origin, destination], { padding: 50 });
    };

    if (!mapRef.current && mapContainer.current) {
      mapRef.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: origin,
        zoom: 12,
      });

      mapRef.current.on('load', fetchAndRenderRoute);
    }
  }, []);

  return <div ref={mapContainer} className="w-full h-[600px]" />;
};

export default TrafficMap;
