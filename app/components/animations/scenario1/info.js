import React, { useState } from 'react';
//import { useWindowSize } from 'react-use';
import useWindowSize from '../../../hooks/useWindowSize';

const Scenario1Info = () => {
  const [showInfo, setShowInfo] = useState(true);
  const { width } = useWindowSize();
  const isMobile = width < 768;

  if (!showInfo) return null;

  return (
     <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      backdropFilter: "blur(5px)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start",
      alignItems: "center",
      zIndex: 1000,
      color: "white",
      gap: "20px",
      padding: "60px 20px 20px",
      boxSizing: "border-box",
      overflow: "auto"
    }}>
      <button
        onClick={() => setShowInfo(false)}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          backgroundColor: "transparent",
          border: "none",
          color: "white",
          fontSize: "24px",
          cursor: "pointer",
          padding: "10px",
          zIndex: 1001
        }}
      >
        ✕
      </button>
      
      <div style={{
        backgroundColor: "#1a1a1a",
        padding: isMobile ? "15px" : "20px",
        borderRadius: "12px",
        border: "2px solid #333",
        width: "100%",
        boxSizing: "border-box",
        textAlign: "left",
        maxWidth: "600px",
        margin: "0 auto"
      }}>
        <h3 style={{ color: "#ff6b00", marginBottom: "15px" }}>Info</h3>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          fontSize: isMobile ? "14px" : "16px"
        }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "10px" 
          }}>
            <div>~850-1100 cars are recorded every hour per seattle traffic <a href="https://wsdot.wa.gov/about/transportation-data/travel-data/traffic-count-data/design-hour-report" target="_blank" style={{color: "white"}}>data</a></div>
          </div>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "10px" 
          }}>
            <div>Every ~15 minutes a bus runs</div>
          </div>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "10px" 
          }}>
            <div>Every ~15 minutes a train runs</div>
          </div>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "10px" 
          }}>
            <div>The number of people moved in a car/bus/train will be displayed on the screen at the end of the simulation</div>
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}>
            <div>The simulation runs for ~4 minutes representing 8 hours in an actual day</div>
          </div>
          <h3 style={{ color: "#ff6b00", marginBottom: "15px", marginTop: "15px" }}>Inference</h3>
          <div>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px" 
            }}>
              <div>There is severe congestion on the road due to cars while the trains move 0.34x as many people as cars at a staggering 1:275 trains:cars ratio</div>
            </div>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px",
              marginTop: "15px"
            }}>
              <div>The traffic congestion causes bumper to bumper traffic wasting fuel and increases travel time while these stay consistent with trains</div>
            </div>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px",
              marginTop: "15px" 
            }}>
              <div>There is room to add more coaches to the trains and if more people start taking trains, a likewise increase in frequency of buses will further optimize commutes en masse</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Scenario1Info;