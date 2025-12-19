// pages/index.tsx
import React from 'react';
import BridgeNeedsMap from '../components/BridgeMap2';

const HomePage: React.FC = () => {
  return (
    <div className="p-2 md:p-4 h-[95svh]">
      <BridgeNeedsMap />
    </div>
  );
};

export default HomePage;
