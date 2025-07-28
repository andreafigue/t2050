// pages/index.tsx
import React from 'react';
import Airport from '../components/Airport';


const Page: React.FC = () => {
  return (
    <div style={{ padding: '1rem 1rem', width: "70%", height: "600px" }}>
     <Airport />
    </div>
  );
};

export default Page;
