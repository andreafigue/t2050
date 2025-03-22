// pages/index.tsx
import WashingtonMapWithLineGraphs from '../components/Freight';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8" style={{ margin: '20px', width: '1300px', height: '600px'}}>
      <WashingtonMapWithLineGraphs/>
    </div>
  );
}
