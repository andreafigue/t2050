// pages/index.tsx
import React from 'react';
import FerryRidership from '../components/Ferry';

const HomePage: React.FC = () => {
  return (
    <div className="p-2 md:p-4 h-[95svh] w-[60svw]">
      <FerryRidership />
    </div>
  );
};

export default HomePage;
