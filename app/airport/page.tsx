// pages/index.tsx
import React from 'react';
import Airport from '../components/Airport';


const Page: React.FC = () => {
  return (
    <div className="h-[70svh] md:h-[65svh] min-h-[600px] md:min-h-[500px] p-4">
     <Airport />
    </div>
  );
};

export default Page;
