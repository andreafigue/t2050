// pages/index.tsx
import React from 'react';
import Airport from '../components/Airport';


const Page: React.FC = () => {
  return (
    <div className="h-100 md:h-70" style={{ padding: '1rem 1rem', height: "700px" }}>
     <Airport />
    </div>
  );
};

export default Page;
