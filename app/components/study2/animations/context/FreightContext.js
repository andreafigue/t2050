import React, { createContext, useContext, useState } from 'react';

// Create a context for managing freight-related state across the application
const FreightContext = createContext();

// Provider component that wraps the app (or a part of it) to make freight state available
export const FreightProvider = ({ children }) => {
  // State for tracking total tonnage delivered by each transport type
  const [deliveredTonnageTruck, setDeliveredTonnageTruck] = useState(659);
  const [deliveredTonnageTrain, setDeliveredTonnageTrain] = useState(209);
  const [deliveredTonnagePlane, setDeliveredTonnagePlane] = useState(44);
  const [deliveredTonnageShip, setDeliveredTonnageShip] = useState(88);

  // State for tracking the number of vehicles of each type
  const [numberOfTrucks, setNumberOfTrucks] = useState(0);
  const [numberOfTrains, setNumberOfTrains] = useState(0);
  const [numberOfPlanes, setNumberOfPlanes] = useState(0);
  const [numberOfShips, setNumberOfShips] = useState(0);
  
  // Helper functions to increment tonnage for each transport type
  // Usage: addDeliveredTonnageTruck(5) will add 5 tons to the truck tonnage
  const addDeliveredTonnageTruck = (amount) => {
    setDeliveredTonnageTruck(prev => prev + amount);
  };

  const addDeliveredTonnageTrain = (amount) => {
    setDeliveredTonnageTrain(prev => prev + amount);
  };

  const addDeliveredTonnagePlane = (amount) => {
    setDeliveredTonnagePlane(prev => prev + amount);
  };

  const addDeliveredTonnageShip = (amount) => {
    setDeliveredTonnageShip(prev => prev + amount);
  };

  // Helper functions to increment the number of vehicles
  // Usage: addNumberOfTrucks(1) will add 1 truck to the fleet
  const addNumberOfTrucks = (amount) => {
    setNumberOfTrucks(prev => prev + amount);
  };

  const addNumberOfTrains = (amount) => {
    setNumberOfTrains(prev => prev + amount);
  };

  const addNumberOfPlanes = (amount) => {
    setNumberOfPlanes(prev => prev + amount);
  };

  const addNumberOfShips = (amount) => {
    setNumberOfShips(prev => prev + amount);
  };
  
  // Provide all state values and update functions to consuming components
  return (
    <FreightContext.Provider value={{ 
        deliveredTonnageTruck, 
        deliveredTonnageTrain, 
        deliveredTonnagePlane, 
        deliveredTonnageShip, 
        addDeliveredTonnageTruck, 
        addDeliveredTonnageTrain, 
        addDeliveredTonnagePlane, 
        addDeliveredTonnageShip,
        numberOfTrucks,
        numberOfTrains,
        numberOfPlanes,
        numberOfShips,
        addNumberOfTrucks,
        addNumberOfTrains,
        addNumberOfPlanes,
        addNumberOfShips
    }}>
      {children}
    </FreightContext.Provider>
  );
};

// Custom hook to use the freight context in components
// Usage: const { deliveredTonnageTruck, addDeliveredTonnageTruck } = useFreight();
export const useFreight = () => {
  const context = useContext(FreightContext);
  if (!context) {
    throw new Error('useFreight must be used within a FreightProvider');
  }
  return context;
};