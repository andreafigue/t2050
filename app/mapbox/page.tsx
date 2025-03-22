'use client';

import React from 'react';

const MapboxPage: React.FC = () => {
  return (
    <div style={{ padding: '20px', height: '100vh' }}>
      <h1>📊 Mapbox Visualization Dashboard</h1>
      <iframe
        src="/mapbox.html"
        style={{ width: '100%', height: '90%', border: 'none' }}
        title="MapboxViz"
      />
    </div>
  );
};

export default MapboxPage;
