// pages/index.tsx
import React from 'react';
import MapRoute from '../components/TrafficWithDepartAt';

const HomePage: React.FC = () => {
  return (
    <div className="p-4">
      <MapRoute />
    </div>
  );
};

export default HomePage;
