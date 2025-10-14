// pages/index.tsx
import React from 'react';
import ChartComponent from '../components/hsr2';

const HomePage: React.FC = () => {
  return (
    <div style={{ padding: '1rem 1rem', height: "200px" }}>
      <ChartComponent />
    </div>
  );
};

export default HomePage;
