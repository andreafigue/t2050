// pages/index.tsx
import React from 'react';
import MapRoute from '../components/MapRoute2';

const HomePage: React.FC = () => {
  return (
    <div className="p-4 h-[95svh] md:h-[75svh] overflow-hidden">
      <MapRoute />
    </div>
  );
};

export default HomePage;
