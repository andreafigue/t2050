// 'use client';
// import InteractiveGame from '../components/InteractiveGame';

// const Page = () => {
//   return <InteractiveGame />;
// };

// export default Page;

// pages/index.tsx
import React from 'react';
import TrafficMap from '../components/TrafficMap';


const HomePage: React.FC = () => {
  return (
    <div style={{ padding: '1rem 1rem' }}>
     < TrafficMap />
    </div>
  );
};

export default HomePage;
