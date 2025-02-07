'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';  // Import the jsx-runtime

const Page: React.FC = () => {
  const [MapboxViz, setMapboxViz] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    console.log('Exposing React and jsx-runtime globally...');
    (window as any).React = React;
    (window as any).jsxRuntime = jsxRuntime;  // Expose jsx-runtime

    const script = document.createElement('script');
    script.src = '/lib/mapbox-viz/mapbox-viz.umd.js';  // Ensure this path is correct
    script.async = true;

    script.onload = () => {
      console.log('Script loaded successfully.');
      console.log('Checking if MapboxViz is defined:', (window as any).MapboxViz);

      if ((window as any).MapboxViz) {
        setMapboxViz(() => (window as any).MapboxViz);
      } else {
        console.error('MapboxViz is not defined in the global scope.');
      }
    };

    script.onerror = () => {
      console.error('Failed to load the MapboxViz script.');
    };

    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>📊 Mapbox Visualization Dashboard</h1>
      {MapboxViz ? <MapboxViz /> : <p>Loading MapboxViz...</p>}
    </div>
  );
};

export default Page;
