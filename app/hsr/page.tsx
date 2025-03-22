// pages/index.tsx
import React from 'react';
import TravelComparison from '../components/hsr';

const HomePage: React.FC = () => {
  return (
    <div style={{ padding: '1rem 1rem' }}>
      <TravelComparison />
    </div>
  );
};

export default HomePage;
