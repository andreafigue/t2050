// pages/index.tsx
import React from 'react';
import Population from '../components/Population';

const HomePage: React.FC = () => {
  return (
    <div className = "w-full h-[80svh] p-2 md:p-4">
      <Population />
    </div>
  );
};

export default HomePage;
