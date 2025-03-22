// pages/index.tsx
import WashingtonMap from '../components/Freight';



export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8" style={{ margin: '20px', width: '900px'}}>
      <WashingtonMap/>
    </div>
  );
}
