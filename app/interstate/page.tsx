// pages/index.tsx
import React from 'react';
import Map from '../components/interstate';

const HomePage: React.FC = () => {
  return (
    <div style={{ padding: '4rem 2rem' }}>
      <Map />
    </div>
  );
};

export default HomePage;
