import React, { useState, useEffect } from 'react';

const FreightInfo = () => {
  const [showInfo, setShowInfo] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      setShowInfo(window.innerWidth > 1600);  // Hide when width is less than 1200px
    };

    // Initial check
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!showInfo) return null;

  return (
    <div style={{
      position: "absolute",
      top: "50%",
      left: "20px",
      transform: "translateY(-50%)",
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
      color: "white",
      gap: "20px",
      padding: "20px",
      borderRadius: "12px",
    }}>
      <div style={{
        backgroundColor: "#1a1a1a",
        padding: "20px",
        borderRadius: "12px",
        border: "2px solid #333",
        maxWidth: "320px",
        textAlign: "left"
      }}>
        <h3 style={{ color: "#ff6b00", marginBottom: "15px" }}>Info [TO BE CHANGED]</h3>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px"
        }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "10px" 
          }}>
            <div>~850-1100 cars are recorded every hour per seattle traffic <a href="https://wsdot.wa.gov/about/transportation-data/travel-data/traffic-count-data/design-hour-report" target="_blank" style={{color: "white"}}> data</a></div>
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
            <div>The number of freight moved in a car/bus/train will be displayed on the screen at the end of the simulation</div>
          </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <div>The simulation runs for ~4 minutes representing 8 hours in an actual day</div>
          </div>
          <h3 style={{ color: "#ff6b00", marginBottom: "15px" }}>Inference</h3>
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
            gap: "10px" 
          }}>
            <div>The traffic congestion causes bumper to bumper traffic wasting fuel and increases travel time while these stay consistent with trains</div>
          </div>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "10px" 
          }}>
            <div>There is room to add more coaches to the trains and if more people start taking trains, a likewise increase in frequency of buses will further optimize commutes en masse</div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreightInfo;