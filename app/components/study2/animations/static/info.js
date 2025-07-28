import React, { useState, useEffect } from 'react';

const StaticInfo = () => {
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
        maxWidth: "350px",
        textAlign: "left"
      }}>
        <h3 style={{ color: "#ff6b00", marginBottom: "15px" }}>Transport Capacity</h3>
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
            <div style={{ fontSize: "24px" }}>🚗</div>
            <div>Cars carry a maximum of 4 people</div>
          </div>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "10px" 
          }}>
            <div style={{ fontSize: "24px" }}>🚌</div>
            <div>Buses carry a maximum of 82 people</div>
          </div>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "10px" 
          }}>
            <div style={{ fontSize: "24px" }}>🚂</div>
            <div>Trains carry a maximum of 800 people</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaticInfo;