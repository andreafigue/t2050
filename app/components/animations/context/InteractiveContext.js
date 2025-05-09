'use client';

import React, { createContext, useContext, useState } from 'react';

// Create a context for managing Interactive-related state across the application
const InteractiveContext = createContext();

// Provider component that wraps the app (or a part of it) to make Interactive state available
export const InteractiveProvider = ({ children }) => {
  // State for tracking total People Moved by each transport type
  const [MovedPeopleCar, setMovedPeopleCar] = useState(0);
  const [MovedPeopleBus, setMovedPeopleBus] = useState(0);
  const [MovedPeopleTrain, setMovedPeopleTrain] = useState(0);
  const [MovedPeoplePlane, setMovedPeoplePlane] = useState(0);
  const [MovedPeopleUHS, setMovedPeopleUHS] = useState(0);

  // State for tracking the number of vehicles of each type
  const [numberOfCars, setNumberOfCars] = useState(0);
  const [numberOfBuses, setNumberOfBuses] = useState(0);
  const [numberOfTrains, setNumberOfTrains] = useState(0);
  const [numberOfPlanes, setNumberOfPlanes] = useState(0);
  const [numberOfUHS, setNumberOfUHS] = useState(0);
  
  // Helper functions to increment People for each transport type
  // Usage: addMovedPeopleCar(5) will add 5 tons to the Car People
  const addMovedPeopleCar = (amount) => {
    setMovedPeopleCar(prev => prev + amount);
  };
  
  const addMovedPeopleBus = (amount) => {
    setMovedPeopleBus(prev => prev + amount);
  };

  const addMovedPeopleTrain = (amount) => {
    setMovedPeopleTrain(prev => prev + amount);
  };

  const addMovedPeoplePlane = (amount) => {
    setMovedPeoplePlane(prev => prev + amount);
  };

  const addMovedPeopleUHS = (amount) => {
    setMovedPeopleUHS(prev => prev + amount);
  };

  // Helper functions to increment the number of vehicles
  // Usage: addNumberOfCars(1) will add 1 Car to the fleet
  const addNumberOfCars = (amount) => {
    setNumberOfCars(prev => prev + amount);
  };

  const addNumberOfBuses = (amount) => {
    setNumberOfBuses(prev => prev + amount);
  };

  const addNumberOfTrains = (amount) => {
    setNumberOfTrains(prev => prev + amount);
  };

  const addNumberOfPlanes = (amount) => {
    setNumberOfPlanes(prev => prev + amount);
  };

  const addNumberOfUHS = (amount) => {
    setNumberOfUHS(prev => prev + amount);
  };
  
  // Provide all state values and update functions to consuming components
  return (
    <InteractiveContext.Provider value={{ 
        MovedPeopleCar, 
        MovedPeopleBus,
        MovedPeopleTrain, 
        MovedPeoplePlane, 
        MovedPeopleUHS, 
        addMovedPeopleCar, 
        addMovedPeopleBus,
        addMovedPeopleTrain, 
        addMovedPeoplePlane, 
        addMovedPeopleUHS,
        numberOfCars,
        numberOfBuses,
        numberOfTrains,
        numberOfPlanes,
        numberOfUHS,
        addNumberOfCars,
        addNumberOfBuses,
        addNumberOfTrains,
        addNumberOfPlanes,
        addNumberOfUHS
    }}>
      {children}
    </InteractiveContext.Provider>
  );
};

// Custom hook to use the Interactive context in components
// Usage: const { MovedPeopleCar, addMovedPeopleCar } = useInteractive();
export const useInteractive = () => {
  const context = useContext(InteractiveContext);
  if (!context) {
    throw new Error('useInteractive must be used within a InteractiveProvider');
  }
  return context;
};