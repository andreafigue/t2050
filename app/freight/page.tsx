// pages/index.tsx
//import MapWrapper from '../components/MapWrapper';
//import AirportQueue from '../components/AirportQueue';
//import MapWrapper from '../components/MapWrapper2';
import FreightAreaChart from '../components/FreightAreaChart';
import FreightAreaChart2 from '../components/FreightAreaChart2';


export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8" style={{ margin: '20px', width: '900px'}}>
      <FreightAreaChart/>
      <p className="mb-4" style={{ margin: '20px', width: '930px'}}>
        This chart visualizes the annual movement of freight across different transportation modes. 
        It shows historical trends and projections, helping to understand how various cargo types are 
        transported over time.
      </p>
      <br/>
      <FreightAreaChart2 />
    </div>
  );
}
