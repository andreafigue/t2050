'use client'

import React, { useRef, useState, useEffect, useMemo } from "react";
import { motion, useMotionValue, AnimatePresence } from "motion/react";
import { random, uniqueId } from "lodash";
import { style } from "motion/react-m";
import { use } from "react";
//  import { isLabelWithInternallyDisabledControl } from "@testing-library/user-event/dist/utils";

var countedCars = new Array();


const FreightCars = () => {
  // Copy all the existing code from App.js here
  const rightSquareRef = useRef(null);
  const endOfTrack = 650;
  const trackSteps = 6;
  const carRefs = useRef({});
  // ... all other state and functions

  const createOrGetRef = (refs, id) => {
    if (!refs.current[id]) {
    //   console.log("create", id)
      refs.current[id] = React.createRef();
    }
    return refs.current[id];
  };

    // const inTrack = useMotionValue(0);

  const [discardedCars, setDiscardedCars] = useState(new Set());


  const [cars, setCars] = useState([]);
  const trackLength = 125;
  
    
  
  //   console.log(cars, carRefs, discardedCars)
  
  const [cues, setCues] = useState([]);

  // Memoize active and discarded cars
  const { activeCars, discardedCarsList } = useMemo(() => {
    // Check track length before creating active cars list
    const activeCount = cars.filter((_, index) => !discardedCars.has(index)).length;
    
    if (activeCount > trackLength) {
      // Mark the newest car as discarded
      setDiscardedCars(prev => new Set([...prev, cars.length - 1]));
    }

    return {
      activeCars: cars.filter((_, index) => !discardedCars.has(index)),
      discardedCarsList: cars.filter((_, index) => discardedCars.has(index))
    };
  }, [cars, discardedCars, trackLength]);

  const variants = {
    start: {
      x: [145, 190, 235, 280, 325, 375], // Equal steps from 145 to endOfTrack
      transition: {
        duration: 6,
        times: [0, 0.20, 0.40, 0.60, 0.80, 1],
        type: "linear",
        ease: "linear",
      },
      opacity: [1, 1, 1, 1, 1, 1],
    },
    discard: {
      y: [-15, -75, 250, 550, 650],
      x: [-15, -45, -90, -150, -175],
      transition: {
        duration: 6,
        times: [0, 0.20, 0.40, 0.70, 1],
        ease: "easeOut",
        // type: "linear",
        
      },
      opacity: [1, 1, 0.7, 0.4, 0],
      backgroundColor: ["blue", "blue", "red", "red", "red"]
    }
  };

  



  useEffect(() => {
    // Clean up expired cues
    const timer = setInterval(() => {
      setCues(prevCues => 
        prevCues.filter(cue => Date.now() - cue.timestamp < 1000)
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const addCue = (carId) => {
    setCues(prevCues => [...prevCues, {
      id: Math.random(),
      carId: carId,
      timestamp: Date.now(),
      offset: { 
        x: (Math.random() - 0.5) * 100,  // -50 to 50 pixels horizontally
        y: -(Math.random() * 50 + 175)   // -225 to -175 pixels vertically (much higher above)
      }
    }]);
  };

  const [eta, setEta] = useState("00:00");

  //console.log(eta)

  useEffect(() => {
    // Update ETA every second
    const timer = setInterval(() => {
      // Base time in seconds (2 minutes)
      const baseTime = 120;
      
      // Only add time for cars beyond the track length (5)
      const excessCars = Math.max(0, activeCars.length - 10);
      const additionalTime = excessCars * 30;
      
      // Add random delay between -15 and +15 seconds
      const randomDelay = Math.floor(Math.random() * 31) - 15;  // Random number between -15 and +15
      
      // Calculate total time in seconds
      const totalSeconds = baseTime + additionalTime + randomDelay;
      
      // Convert to minutes and seconds
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      // Format with leading zeros
      if (activeCars.length > 0) {
        setEta(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeCars.length, trackLength]);

  const [etaHistory, setEtaHistory] = useState([]);
  const maxDataPoints = 10;

  //const basePath = window.location.href
  const basePath = "/animations/"


  useEffect(() => {
    // Initialize with current ETA
    const currentEtaInSeconds = parseInt(eta.split(':')[0]) * 60 + parseInt(eta.split(':')[1]);
    if (currentEtaInSeconds > 0) {
      setEtaHistory([currentEtaInSeconds]);
    }

    const interval = setInterval(() => {
      const etaInSeconds = parseInt(eta.split(':')[0]) * 60 + parseInt(eta.split(':')[1]);
      setEtaHistory(prev => {
        if (etaInSeconds > 0) {
          const newHistory = [...prev, etaInSeconds];
          if (newHistory.length > maxDataPoints) {
            newHistory.shift();
          }
          return newHistory;
        }
        return prev;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const etaInSeconds = parseInt(eta.split(':')[0]) * 60 + parseInt(eta.split(':')[1]);
    setEtaHistory(prev => {
      if (etaInSeconds > 0) {
        const newHistory = [...prev, etaInSeconds];
        if (newHistory.length > maxDataPoints) {
          newHistory.shift();
        }
        return newHistory;
      }
      return prev;
    });
  }, [eta]);

  const [peopleMoved, setPeopleMoved] = useState(0);

  const [isClickable, setIsClickable] = useState(true);
  const [timeoutProgress, setTimeoutProgress] = useState(0);
  const [animationFrameId, setAnimationFrameId] = useState(null);

  const animateTimeout = (startTime, duration) => {
    const animate = () => {
      const now = Date.now();
      const progress = Math.min(1, (now - startTime) / duration);
      setTimeoutProgress(progress);
      
      if (progress < 1) {
        setAnimationFrameId(requestAnimationFrame(animate));
      } else {
        setTimeoutProgress(0);
      }
    };
    
    setAnimationFrameId(requestAnimationFrame(animate));
  };

  // Add this state to track animation speed
  const [animationDuration, setAnimationDuration] = useState(6);

  // Add this effect to update duration when cars change
  // useEffect(() => {
  //   setAnimationDuration(3 + Math.max(0, activeCars.length - 1));
  // }, [activeCars.length]);

  // Add this effect to update duration for all cars when count changes
  useEffect(() => {
    activeCars.map(car => {
      let ref = createOrGetRef(carRefs, car)
      ref.current.duration = topLaneAssignments.has(car)
        ? Math.min(30, 2 + Math.max(0, activeCars.length - 1/3))
        : Math.min(45, 3 + Math.max(0, activeCars.length - 1/3))
    })
  }, [activeCars.length])

  // useEffect(() => {
  //   // Add cars based on carCount
  //   const newCars = [];
  //   for (let i = 0; i < carCount; i++) {
  //     newCars.push(uniqueId('car_'));
  //   }
  //   setCars([...cars, ...newCars]);
  //   console.log("cars Effect", cars)
  // }, []);

  // Add this with other state declarations at the top
  const [carCount, setCarCount] = useState(0);

  //console.log("cars", carCount)

  // Add this state to store passenger counts for each car
  const [carPassengers, setCarPassengers] = useState({});

  // Add this state to track which cars are assigned to the top lane
  const [topLaneAssignments] = useState(new Set());

  // Add this state to store lane assignments for non-top lanes
  const [laneAssignments] = useState(new Map());

  // Add these states to track cars in each non-top lane
  const [lane2Count, setLane2Count] = useState(0);
  const [lane3Count, setLane3Count] = useState(0);
  const [lane4Count, setLane4Count] = useState(0);

  // Add these states to track car positions and prevent collisions
  const [carPositions, setCarPositions] = useState(new Map());
  const safeDistance = 97.5; // Minimum distance between cars

  useEffect(() => {
    const getRandomInterval = () => Math.floor(Math.random() * (740 - 200 + 1)) + 200;
    
    let timeoutId;
    const startTime = Date.now();
    const duration = 195000; // 195 seconds in milliseconds
    
    const scheduleNextClick = () => {
      const currentTime = Date.now();
      if (currentTime - startTime < duration) {
        timeoutId = setTimeout(() => {
          const newCarId = uniqueId('car_');
          const randomPeople = Math.floor(Math.random() * 4) + 1;  // 1-4 people
          
          setCars(prev => [...prev, newCarId]);
          setCarCount(prev => prev + 1);
          setCarPassengers(prev => ({
            ...prev,
            [newCarId]: randomPeople * 3 * 6  // Same multiplier as before
          }));
          
          scheduleNextClick();
        }, getRandomInterval() + 250);
      }
    };

    scheduleNextClick();

    return () => clearTimeout(timeoutId);
  }, []);

  // Update the lane tracking
  const { topLaneCars, bottomLaneCars } = useMemo(() => {
    // First, count only cars that haven't reached destination
    const activePositions = {};
    activeCars.forEach(car => {
      const ref = carRefs.current[car];
      if (ref && ref.current) {
        activePositions[car] = ref.current.x;
      }
    });

    // Only count cars that are actively on the track (not at destination)
    const activeTopLaneCars = activeCars.filter(car => {
      const ref = carRefs.current[car];
      const isAtDestination = ref && ref.current && ref.current.x >= endOfTrack - 3;
      if (isAtDestination) {
        topLaneAssignments.delete(car); // Remove from assignments when reaching destination
        return false;
      }
      return topLaneAssignments.has(car);
    });

    // If a car qualifies for top lane and there's space, add it to assignments
    activeCars.forEach(car => {
      if (carPassengers[car] >= 70 && activeTopLaneCars.length < 30 && 
          (!activePositions[car] || activePositions[car] < endOfTrack - 3)) {
        topLaneAssignments.add(car);
      }
    });

    //console.log('Active top lane cars:', activeTopLaneCars.length); // Debug log

    return {
      topLaneCars: activeTopLaneCars,
      bottomLaneCars: activeCars.filter(car => !topLaneAssignments.has(car))
    };
  }, [activeCars, carPassengers]);

  const [canSpawn, setCanSpawn] = useState(true);

  // Add state to track vehicle type
  const [vehicleTypes, setVehicleTypes] = useState({});

  // Add separate state for truck auto-spawn
  const [canSpawnTruck, setCanSpawnTruck] = useState(true);

  // Truck auto-spawn
  useEffect(() => {
    const spawnInterval = setInterval(() => {
      if (canSpawnTruck) {
        const newTruckId = uniqueId('delivery_');
        const randomPeople = Math.floor(Math.random() * 4) + 1;
        
        setCars(prev => [...prev, newTruckId]);
        setCarCount(prev => prev + 1);
        setVehicleTypes(prev => ({
          ...prev,
          [newTruckId]: 'delivery-truck'
        }));
        setCarPassengers(prev => ({
          ...prev,
          [newTruckId]: randomPeople * 3 * 9
        }));
        
        // Remove top lane assignment and use bottom lane
        laneAssignments.set(newTruckId, "50px");  // Assign to bottom lane
        
        setCanSpawnTruck(false);

        setTimeout(() => {
          setCanSpawnTruck(true);
        }, 5000);
      }
    }, 5000);

    return () => clearInterval(spawnInterval);
  }, [canSpawnTruck]);

  // Keep the original button click handler separate
  const handleTruckClick = () => {
    if (isClickable && canSpawn) {
      const newTruckId = uniqueId('delivery_');
      const randomPeople = Math.floor(Math.random() * 4) + 1;
      
      setCars(prev => [...prev, newTruckId]);
      setCarCount(prev => prev + 1);
      setVehicleTypes(prev => ({
        ...prev,
        [newTruckId]: 'delivery-truck'
      }));
      setCarPassengers(prev => ({
        ...prev,
        [newTruckId]: randomPeople * 3 * 9
      }));
      
      // Set to bottom lane (25px)
      laneAssignments.set(newTruckId, "25px");
      
      setIsClickable(false);
      setCanSpawn(false);

      setTimeout(() => {
        setCanSpawn(true);
      }, 1000);

      const randomTimeout = Math.floor(Math.random() * (1500 - 500 + 1)) + 500;
      animateTimeout(Date.now(), randomTimeout);
      setTimeout(() => {
        setIsClickable(true);
        cancelAnimationFrame(animationFrameId);
        setTimeoutProgress(0);
      }, randomTimeout);
    }
  };

  // Add separate counters for cars and buses
  const [carPeopleMoved, setCarPeopleMoved] = useState(0);
  const [busPeopleMoved, setBusPeopleMoved] = useState(0);

  // Add at the top with other state declarations
  const [canSpawnBus, setCanSpawnBus] = useState(true);

  // Bus auto-spawn useEffect
  useEffect(() => {
    const spawnInterval = setInterval(() => {
      if (canSpawnBus) {
        const newBusId = uniqueId('bus_');
        const randomPeople = Math.floor(Math.random() * 4) + 1;
        
        setCars(prev => [...prev, newBusId]);
        setCarCount(prev => prev + 1);
        setVehicleTypes(prev => ({
          ...prev,
          [newBusId]: 'bus'
        }));
        setCarPassengers(prev => ({
          ...prev,
          [newBusId]: randomPeople * 3 * 12
        }));
        
        topLaneAssignments.add(newBusId);
        setCanSpawnBus(false);

        setTimeout(() => {
          setCanSpawnBus(true);
        }, 5000);
      }
    }, 5000);

    return () => clearInterval(spawnInterval);
  }, [canSpawnBus]);

  // In the render section, verify the image selection logic:
  {activeCars.map((vehicle, originalIndex) => (
    <AnimatePresence mode="sync" key={`active-${vehicle}`}>
      <motion.div
        ref={createOrGetRef(carRefs, vehicle)}
        initial={{ x: 145, opacity: 1}}
        style={{
          width: vehicleTypes[vehicle] === 'delivery-truck' ? "60px" : "40px",  // Larger width for trucks
          height: vehicleTypes[vehicle] === 'delivery-truck' ? "60px" : "40px", // Larger height for trucks
          position: "absolute",
          top: topLaneAssignments.has(vehicle) 
            ? vehicleTypes[vehicle] === 'delivery-truck' ? "-15px" : "-5px"   // Adjusted top position for trucks
            : !laneAssignments.has(vehicle)
              ? (() => {
                  // Find lane with lowest count
                  const minCount = Math.min(lane2Count, lane3Count, lane4Count);
                  let position;
                  
                  if (lane2Count === minCount) {
                    position = "25px";
                    setLane2Count(prev => prev + 1);
                  } else if (lane3Count === minCount) {
                    position = "55px";
                    setLane3Count(prev => prev + 1);
                  } else {
                    position = "85px";
                    setLane4Count(prev => prev + 1);
                  }
                  
                  laneAssignments.set(vehicle, position);
                  return position;
                })()
              : laneAssignments.get(vehicle),
          left: "20px",
          zIndex: 2,
        }}
        animate={{
          x: endOfTrack,
          transition: {
            duration: topLaneAssignments.has(vehicle)
              ? Math.min(15, 1 + Math.max(0, activeCars.length - 1/3))
              : Math.min(45, 3 + Math.max(0, activeCars.length - 1/3)),
            type: "linear",
            ease: "linear",
          }
        }}
        onUpdate={(latest) => {
          latest.display = "block";
          latest.duration = topLaneAssignments.has(vehicle)
            ? 1 + Math.max(0, activeCars.length - 1)
            : 3 + Math.max(0, activeCars.length - 1)
          
          // Update position for this car
          setCarPositions(prev => new Map(prev).set(vehicle, latest.x));
          
          if (parseInt(eta.split(':')[0]) > 5 && Math.random() < 0.01) {
            addCue(vehicle);
          }
          
          // Check for potential collisions
          const currentLane = topLaneAssignments.has(vehicle) ? "top" 
                             : laneAssignments.get(vehicle);
          
          const carsInSameLane = Array.from(carPositions.entries())
            .filter(([otherCar, _]) => {
              const otherLane = topLaneAssignments.has(otherCar) ? "top"
                               : laneAssignments.get(otherCar);
              return otherLane === currentLane && otherCar !== vehicle;
            });
          
          // Adjust speed if too close to car in front
          for (const [_, otherPosition] of carsInSameLane) {
            if (otherPosition > latest.x && otherPosition - latest.x < safeDistance) {
              // Slow down this car
              latest.duration *= 1.5;
              break;
            }
          }
          
          if (latest.x >= endOfTrack - 3) {
            latest.zIndex = 0;
            latest.display = "none";
            if (!countedCars.includes(vehicle)) {
              if (vehicleTypes[vehicle] === 'bus') {
                setBusPeopleMoved(prev => prev + (carPassengers[vehicle] || 0));
              } else {
                setCarPeopleMoved(prev => prev + (carPassengers[vehicle] || 0));
              }
              countedCars.push(vehicle);
            }
            // Clean up position when car reaches destination
            setCarPositions(prev => {
              const newPositions = new Map(prev);
              newPositions.delete(vehicle);
              return newPositions;
            });
            // Decrease lane count when car reaches destination
            const lane = laneAssignments.get(vehicle);
            if (lane === "25px") setLane2Count(prev => Math.max(0, prev - 1));
            if (lane === "55px") setLane3Count(prev => Math.max(0, prev - 1));
            if (lane === "85px") setLane4Count(prev => Math.max(0, prev - 1));
            laneAssignments.delete(vehicle);
          } else {
            countedCars = countedCars.filter(c => c !== vehicle);
          }
        }}
        onAnimationComplete={() => {
          setCars(prev => prev.filter(c => c !== vehicle));
          setCarPassengers(prev => {
            const newPassengers = {...prev};
            delete newPassengers[vehicle];
            return newPassengers;
          });
        }}
      >
        <img 
          src={vehicleTypes[vehicle] === 'delivery-truck' 
            ? basePath + "/delivery-truck.png" 
            : vehicleTypes[vehicle] === 'bus' 
              ? basePath + "/bus.png" 
              : basePath + "/car.png"} 
          style={{ 
            width: "100%", 
            height: "100%",
          }}
        />
        <AnimatePresence mode='popLayout'>
          {cues
            .filter(cue => cue.carId === vehicle)
            .map(cue => (
              <motion.div
                key={cue.id}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                style={{
                  position: "absolute",
                  // top: "-200px",
                  left: "50%",
                  transform: `translate(
                    calc(-50% + ${cue.offset.x}px), 
                    ${cue.offset.y}px
                  )`,
                  backgroundColor: "#ff4444",
                  color: "white",
                  padding: "4px 8px",
                  fontSize: "12px",
                  whiteSpace: "nowrap",
                  zIndex: 100,
                  pointerEvents: "none",
                  clipPath: "polygon(0% 20%, 60% 20%, 100% 0%, 100% 100%, 60% 80%, 0% 80%)",
                  display: "flex",
                  alignItems: "left",
                  justifyContent: "left",
                  minWidth: "60px",
                  minHeight: "30px"
                }}
              >
                HONK! 🚗
              </motion.div>
            ))}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  ))}

  // Also verify the bus button click handler:
  const handleBusClick = () => {
    if (isClickable && canSpawn) {
      const newBusId = uniqueId('bus_');
      const randomPeople = Math.floor(Math.random() * 4) + 1;
      
      setCars(prev => [...prev, newBusId]);
      setCarCount(prev => prev + 1);
      setVehicleTypes(prev => ({
        ...prev,
        [newBusId]: 'bus'  // Make sure this is 'bus'
      }));
      // ... rest of the handler
    }
  };

  

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "left",
        justifyContent: "flex-start",
        padding: "20px",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <div style={{ 
          position: "relative", 
          width: "900px",
        //   height: "200vh",
          overflow: "visible",
          perspective: "1000px"
        }}>
          {/* Car track */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              marginBottom: "20px",
              zIndex: 1, // Ensure tracks are behind
            }}
          >
            {/* Minus Button
            <button
              onClick={() => {
                if (activeCars.length > 0) {
                  // Remove the first active car
                  const firstActiveCar = activeCars[0];
                  setCars(prev => prev.filter(c => c !== firstActiveCar));
                }
              }}
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: "#ff4444",
                border: "none",
                borderRadius: "8px",
                color: "white",
                fontSize: "24px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "10px",
                flexShrink: 0
              }}
            >
              -
            </button> */}

            {/* Left square with spawn buttons in 2x2 grid */}
            <motion.div
              whileTap={isClickable ? { scale: 0.7 } : {}}
              style={{
                display: "grid",
                gridTemplateColumns: "70px 70px",  // Two columns
                gridTemplateRows: "60px 60px",     // Two rows
                gap: "10px",
                flexShrink: 0,
              }}>
              {/* Truck button - top left */}
              <div style={{
                width: "70px",
                height: "60px",
                backgroundColor: "#F1F0DF",
                borderRadius: "15px",
                position: "relative",
                opacity: isClickable ? 1 : 0.5,
              }}>
                <button 
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: isClickable && canSpawn ? "pointer" : "not-allowed",
                  }}
                  disabled={!isClickable || !canSpawn}
                  onClick={handleTruckClick}>
                  <img src={ basePath + "/delivery-truck.png" } style={{ width: "100%", height: "100%" }}></img>
                </button>
                
                {/* Timeout Progress Indicator */}
                {!isClickable && (
                  <svg
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      transform: "rotate(-90deg)",
                      pointerEvents: "none"
                    }}
                    viewBox="0 0 100 100"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="#ff4444"
                      strokeWidth="10"
                      strokeDasharray={`${(1 - timeoutProgress) * 283} 283`}
                    />
                  </svg>
                )}
              </div>

              {/* Car button - top right */}
              <div style={{
                width: "70px",
                height: "60px",
                backgroundColor: "#F1F0DF",
                borderRadius: "15px",
                position: "relative",
                opacity: isClickable ? 1 : 0.5,
              }}>
                <button 
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: isClickable && canSpawn ? "pointer" : "not-allowed",
                  }}
                  disabled={!isClickable || !canSpawn}
                  onClick={() => {
                    if (isClickable && canSpawn) {
                      const newCarId = uniqueId('car_');
                      setCars(prev => [...prev, newCarId]);
                      setCarCount(prev => prev + 1);
                      setVehicleTypes(prev => ({
                        ...prev,
                        [newCarId]: 'car'
                      }));
                      setIsClickable(false);
                      setCanSpawn(false);

                      setTimeout(() => {
                        setCanSpawn(true);
                      }, 1000);

                      const randomTimeout = Math.floor(Math.random() * (1500 - 500 + 1)) + 500;
                      animateTimeout(Date.now(), randomTimeout);
                      setTimeout(() => {
                        setIsClickable(true);
                        cancelAnimationFrame(animationFrameId);
                        setTimeoutProgress(0);
                      }, randomTimeout);
                    }
                  }}>
                  <img src={ basePath + "/car.png" } style={{ width: "100%", height: "100%" }}></img>
                </button>
                
                {/* Timeout Progress Indicator */}
                {!isClickable && (
                  <svg
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      transform: "rotate(-90deg)",
                      pointerEvents: "none"
                    }}
                    viewBox="0 0 100 100"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="#ff4444"
                      strokeWidth="10"
                      strokeDasharray={`${(1 - timeoutProgress) * 283} 283`}
                    />
                  </svg>
                )}
              </div>

              {/* Bus button - bottom left */}
              <div style={{
                width: "70px",
                height: "60px",
                backgroundColor: "#F1F0DF",
                borderRadius: "15px",
                position: "relative",
                opacity: isClickable ? 1 : 0.5,
              }}>
                <button 
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: isClickable && canSpawn ? "pointer" : "not-allowed",
                  }}
                  disabled={!isClickable || !canSpawn}
                  onClick={handleBusClick}>
                  <img src={ basePath + "/bus.png" } style={{ width: "100%", height: "100%" }}></img>
                </button>
                
                {/* Timeout Progress Indicator */}
                {!isClickable && (
                  <svg
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      transform: "rotate(-90deg)",
                      pointerEvents: "none"
                    }}
                    viewBox="0 0 100 100"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="#ff4444"
                      strokeWidth="10"
                      strokeDasharray={`${(1 - timeoutProgress) * 283} 283`}
                    />
                  </svg>
                )}
              </div>

              {/* Empty space or future button - bottom right */}
            </motion.div>

            {/* Track */}
            <div
              style={{
                width: "500px",
                height: "120px",
                backgroundColor: "#F1F0DF",
                borderRadius: "15px",
                position: "relative",
                overflow: "hidden",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column"
              }}
            >
              {/* Top lane with diamonds */}
              <div style={{
                height: "25%",
                borderBottom: "3px dashed #666",
                position: "relative"
              }}>
                {/* Three diamonds */}
                {[1, 2, 3].map((_, index) => (
                  <div
                    key={index}
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: `${25 + (index * 25)}%`,
                      transform: "translate(-50%, -50%) rotate(45deg)",
                      width: "12px",
                      height: "12px",
                      backgroundColor: "white",
                      border: "1px solid #666"
                    }}
                  />
                ))}
              </div>
              {/* Other lanes */}
              <div style={{
                height: "25%",
                borderBottom: "3px dashed #666"
              }} />
              <div style={{
                height: "25%",
                borderBottom: "3px dashed #666"
              }} />
              <div style={{
                height: "25%"
              }} />
            </div>

            {/* Right square */}
            <div
              ref={rightSquareRef}
              style={{
                width: "60px",
                height: "120px",  // Match track height
                backgroundColor: "#F1F0DF",
                borderRadius: "15px",
                position: "relative",
                flexShrink: 0
              }}
            >
              {/* <AnimatePresence mode='popLayout'>
                {cues.map(cue => (
                  <motion.div
                    key={cue.id}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: `translate(
                        calc(-50% + ${(Math.random() - 0.5) * 300}px), 
                        calc(-50% + ${(Math.random() - 0.5) * 300}px)
                      )`,
                      backgroundColor: "#4CAF50",
                      color: "white",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      whiteSpace: "nowrap",
                      zIndex: 10
                    }}
                  >
                    { parseInt(eta.split(':')[0]) < 5 ? "Yay! 🎉" : "Phew! 😢"}
                  </motion.div>
                ))}
              </AnimatePresence> */}
            </div>

            {/* Freight Moved Board */}
            <div style={{
              width: "240px",
              backgroundColor: "#1a1a1a",
              borderRadius: "12px",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              border: "2px solid #333",
            }}>
              {/* Title */}
              <div style={{
                color: "#fff",
                fontSize: "10px",
                fontFamily: "monospace",
                textTransform: "uppercase",
                letterSpacing: "1px",
                textAlign: "center",
                marginBottom: "2px",
                borderBottom: "1px solid #333",
                paddingBottom: "2px"
              }}>
                Freight Moved
              </div>
              
              {/* Cars section */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <div style={{ fontSize: "20px" }}>🚗</div>
                  <div style={{
                    color: "#ff6b00",
                    fontSize: "10px",
                    fontFamily: "monospace",
                    textTransform: "uppercase",
                    letterSpacing: "1px"
                  }}>
                    Cars
                  </div>
                </div>
                <div style={{
                  backgroundColor: "#000",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  minWidth: "110px",
                  textAlign: "right"
                }}>
                  <div style={{
                    color: "#4CAF50",
                    fontSize: "18px",
                    fontFamily: "digital, monospace",
                    fontWeight: "bold",
                    letterSpacing: "2px",
                    textShadow: "0 0 8px rgba(76,175,80,0.5)"
                  }}>
                    {carPeopleMoved.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Buses section */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <div style={{ fontSize: "20px" }}>🚌</div>
                  <div style={{
                    color: "#ff6b00",
                    fontSize: "10px",
                    fontFamily: "monospace",
                    textTransform: "uppercase",
                    letterSpacing: "1px"
                  }}>
                    Buses
                  </div>
                </div>
                <div style={{
                  backgroundColor: "#000",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  minWidth: "110px",
                  textAlign: "right"
                }}>
                  <div style={{
                    color: "#4CAF50",
                    fontSize: "18px",
                    fontFamily: "digital, monospace",
                    fontWeight: "bold",
                    letterSpacing: "2px",
                    textShadow: "0 0 8px rgba(76,175,80,0.5)"
                  }}>
                    {busPeopleMoved.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* ETA Graph */}
            <div style={{
              position: "relative",
              height: "60px",
            }}>
              <div style={{
                color: "#000000",
                fontSize: "10px",
                fontFamily: "monospace",
                textTransform: "uppercase",
                letterSpacing: "1px",
                position: "absolute",
                top: "-20px",     // Position above the graph
                width: "100%",
                textAlign: "center",
                zIndex: 1,        // Ensure text appears above other elements
                pointerEvents: "none"  // Prevent text from interfering with interactions
              }}>
                Time of Day
              </div>
              <div style={{
                height: "40px",
                backgroundColor: "#1a1a1a",
                border: "2px solid #333",
                borderRadius: "8px",
                padding: "8px 15px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                width: "120px",
                flexShrink: 0,
                position: "relative"
              }}>
                <div style={{
                  width: "100%",
                  height: "40px",
                  position: "relative",
                  // backgroundColor: "#333",
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "2px"
                }}>
                  {etaHistory.map((value, index) => {
                    const heightPercentage = Math.min((value / 600) * 100, 100);
                    return (
                      <div
                        key={index}
                        style={{
                          flex: 1,
                          backgroundColor: value > 300 ? "#ff4444" : "#4CAF50",
                          height: `${heightPercentage}%`,
                          minHeight: "1px"
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Active cars */}
          {activeCars.map((vehicle, originalIndex) => (
            <AnimatePresence mode="sync" key={`active-${vehicle}`}>
              <motion.div
                ref={createOrGetRef(carRefs, vehicle)}
                initial={{ x: 145, opacity: 1}}
                style={{
                  width: vehicleTypes[vehicle] === 'delivery-truck' ? "60px" : "40px",  // Larger width for trucks
                  height: vehicleTypes[vehicle] === 'delivery-truck' ? "60px" : "40px", // Larger height for trucks
                  position: "absolute",
                  top: topLaneAssignments.has(vehicle) 
                    ? vehicleTypes[vehicle] === 'delivery-truck' ? "-15px" : "-5px"   // Adjusted top position for trucks
                    : !laneAssignments.has(vehicle)
                      ? (() => {
                          // Find lane with lowest count
                          const minCount = Math.min(lane2Count, lane3Count, lane4Count);
                          let position;
                          
                          if (lane2Count === minCount) {
                            position = "25px";
                            setLane2Count(prev => prev + 1);
                          } else if (lane3Count === minCount) {
                            position = "55px";
                            setLane3Count(prev => prev + 1);
                          } else {
                            position = "85px";
                            setLane4Count(prev => prev + 1);
                          }
                          
                          laneAssignments.set(vehicle, position);
                          return position;
                        })()
                      : laneAssignments.get(vehicle),
                  left: "20px",
                  zIndex: 2,
                }}
                animate={{
                  x: endOfTrack,
                  transition: {
                    duration: topLaneAssignments.has(vehicle)
                      ? Math.min(15, 1 + Math.max(0, activeCars.length - 1/3))
                      : Math.min(45, 3 + Math.max(0, activeCars.length - 1/3)),
                    type: "linear",
                    ease: "linear",
                  }
                }}
                onUpdate={(latest) => {
                  latest.display = "block";
                  latest.duration = topLaneAssignments.has(vehicle)
                    ? 1 + Math.max(0, activeCars.length - 1)
                    : 3 + Math.max(0, activeCars.length - 1)
                  
                  // Update position for this car
                  setCarPositions(prev => new Map(prev).set(vehicle, latest.x));
                  
                  if (parseInt(eta.split(':')[0]) > 5 && Math.random() < 0.01) {
                    addCue(vehicle);
                  }
                  
                  // Check for potential collisions
                  const currentLane = topLaneAssignments.has(vehicle) ? "top" 
                                     : laneAssignments.get(vehicle);
                  
                  const carsInSameLane = Array.from(carPositions.entries())
                    .filter(([otherCar, _]) => {
                      const otherLane = topLaneAssignments.has(otherCar) ? "top"
                                       : laneAssignments.get(otherCar);
                      return otherLane === currentLane && otherCar !== vehicle;
                    });
                  
                  // Adjust speed if too close to car in front
                  for (const [_, otherPosition] of carsInSameLane) {
                    if (otherPosition > latest.x && otherPosition - latest.x < safeDistance) {
                      // Slow down this car
                      latest.duration *= 1.5;
                      break;
                    }
                  }
                  
                  if (latest.x >= endOfTrack - 3) {
                    latest.zIndex = 0;
                    latest.display = "none";
                    if (!countedCars.includes(vehicle)) {
                      if (vehicleTypes[vehicle] === 'bus') {
                        setBusPeopleMoved(prev => prev + (carPassengers[vehicle] || 0));
                      } else {
                        setCarPeopleMoved(prev => prev + (carPassengers[vehicle] || 0));
                      }
                      countedCars.push(vehicle);
                    }
                    // Clean up position when car reaches destination
                    setCarPositions(prev => {
                      const newPositions = new Map(prev);
                      newPositions.delete(vehicle);
                      return newPositions;
                    });
                    // Decrease lane count when car reaches destination
                    const lane = laneAssignments.get(vehicle);
                    if (lane === "25px") setLane2Count(prev => Math.max(0, prev - 1));
                    if (lane === "55px") setLane3Count(prev => Math.max(0, prev - 1));
                    if (lane === "85px") setLane4Count(prev => Math.max(0, prev - 1));
                    laneAssignments.delete(vehicle);
                  } else {
                    countedCars = countedCars.filter(c => c !== vehicle);
                  }
                }}
                onAnimationComplete={() => {
                  setCars(prev => prev.filter(c => c !== vehicle));
                  setCarPassengers(prev => {
                    const newPassengers = {...prev};
                    delete newPassengers[vehicle];
                    return newPassengers;
                  });
                }}
              >
                <img 
                  src={vehicleTypes[vehicle] === 'delivery-truck' 
                    ? basePath + "/delivery-truck.png" 
                    : vehicleTypes[vehicle] === 'bus' 
                      ? basePath + "/bus.png" 
                      : basePath + "/car.png"} 
                  style={{ 
                    width: "100%", 
                    height: "100%",
                  }}
                />
                <AnimatePresence mode='popLayout'>
                  {cues
                    .filter(cue => cue.carId === vehicle)
                    .map(cue => (
                      <motion.div
                        key={cue.id}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        style={{
                          position: "absolute",
                          // top: "-200px",
                          left: "50%",
                          transform: `translate(
                            calc(-50% + ${cue.offset.x}px), 
                            ${cue.offset.y}px
                          )`,
                          backgroundColor: "#ff4444",
                          color: "white",
                          padding: "4px 8px",
                          fontSize: "12px",
                          whiteSpace: "nowrap",
                          zIndex: 100,
                          pointerEvents: "none",
                          clipPath: "polygon(0% 20%, 60% 20%, 100% 0%, 100% 100%, 60% 80%, 0% 80%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: "60px",
                          minHeight: "30px"
                        }}
                      >
                        HONK! 🚗
                      </motion.div>
                    ))}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          ))}

          {/* Discarded cars */}
          {discardedCarsList.map((car) => (
            <AnimatePresence mode="sync" key={`discarded-${car}`}>
              <motion.div
                variants={variants}
                ref={createOrGetRef(carRefs, car)}
                style={{
                  width: "40px",
                  height: "40px",
                  backgroundColor: "blue",
                  borderRadius: "50%",
                  position: "absolute",
                  top: "10px",
                  left: "20px",
                  zIndex: 2,
                }}
                animate="discard"
                onAnimationComplete={() => {
                  setCars(prev => prev.filter(c => c !== car));
                }}
              />
            </AnimatePresence>
          ))}
        </div>
      
    </div>
  );
};

export default FreightCars; 