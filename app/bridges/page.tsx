// pages/index.tsx
import React from 'react';
import BridgeNeedsMap from '../components/BridgeMap';

const HomePage: React.FC = () => {
  return (
    <div style={{ padding: '1rem 1rem' }}>
      <BridgeNeedsMap />
    </div>
  );
};

export default HomePage;
