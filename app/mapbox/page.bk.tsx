'use client';

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';

const Page: React.FC = () => {
  const [MapboxViz, setMapboxViz] = useState<React.ComponentType | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  // Create the persistent container on the client only.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      let c = document.getElementById("mapbox-viz-container");
      if (!c) {
        c = document.createElement("div");
        c.id = "mapbox-viz-container";
        document.body.appendChild(c);
      }
      setContainer(c);
    }
  }, []);

  useEffect(() => {
    // Expose global dependencies for the library.
    (window as any).React = React;
    (window as any).ReactDOM = ReactDOM;
    (window as any).jsxRuntime = jsxRuntime;

    // Load the compiled library script.
    const script = document.createElement('script');
    script.src = '/lib/mapbox-viz/mapbox-viz.umd.js'; // Ensure this path is correct.
    script.async = true;

    script.onload = () => {
      console.log('Script loaded successfully.');
      if ((window as any).MapboxViz) {
        // Patch MapboxViz to prevent duplicate injection of the inner script.
        const OriginalMapboxViz = (window as any).MapboxViz;
        (window as any).MapboxViz = function PatchedMapboxViz() {
          const ref = React.useRef<HTMLDivElement | null>(null);
          React.useEffect(() => {
            if (ref.current && !ref.current.querySelector("script[src='./assets/index-D67vs96z.js']")) {
              const innerScript = document.createElement("script");
              innerScript.src = "./assets/index-D67vs96z.js";
              innerScript.async = true;
              ref.current.appendChild(innerScript);
            }
            return () => {};
          }, []);
          return <div ref={ref} />;
        };
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
      {MapboxViz && container ? (
        ReactDOM.createPortal(<MapboxViz />, container)
      ) : (
        <p>Loading MapboxViz...</p>
      )}
    </div>
  );
};

export default Page;
