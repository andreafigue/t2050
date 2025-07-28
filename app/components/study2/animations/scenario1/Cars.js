import React, { useRef, useState, useEffect, useMemo } from "react";
import { motion, useMotionValue, AnimatePresence } from "motion/react";
import { random, uniqueId } from "lodash";
import { style } from "motion/react-m";
import { use } from "react";
//import { isLabelWithInternallyDisabledControl } from "@testing-library/user-event/dist/utils";
//import { useWindowSize } from "react-use";
import useWindowSize from '../../../hooks/useWindowSize'; // adjust the relative path if needed


var countedCars = new Array();


const Scenario1Cars = () => {
  const { isMobile, width } = useWindowSize();
  const scaleFactor = width < 800 ? width / 600 : 1;
  const trackWidth = scaleFactor < 1 ? 500 * scaleFactor : 500;
  const endOfTrack = scaleFactor < 1 ? 585 * scaleFactor : 585; // Made endOfTrack responsive

  const rightSquareRef = useRef(null);
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
      x: [120, 195, 292.5, 390, 487.5, endOfTrack],
      transition: {
        duration: 3 + Math.max(0, activeCars.length - 1),
        times: [0, 0.20, 0.40, 0.60, 0.80, 1],
        type: "linear",
        ease: "linear",
        repeat: Infinity,
        repeatType: "loop",
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
  // const safeDistance = 97.5; // Minimum distance between vehicles

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

  // Add useEffect for automatic bus spawning
  useEffect(() => {
    const getRandomInterval = () => Math.floor(Math.random() * (7500 - 6000 + 1)) + 6000;
    
    let timeoutId;
    const startTime = Date.now();
    const duration = 195000; // 195 seconds in milliseconds
    
    const scheduleNextBus = () => {
      const currentTime = Date.now();
      if (currentTime - startTime < duration) {
        timeoutId = setTimeout(() => {
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
            [newBusId]: randomPeople * 3 * 12  // Double the multiplier for buses
          }));
          // Force assign to top lane
          topLaneAssignments.add(newBusId);
          
          scheduleNextBus();
        }, getRandomInterval());
      }
    };

    scheduleNextBus();

    return () => clearTimeout(timeoutId);
  }, []);

  // Add separate counters for cars and buses
  const [carPeopleMoved, setCarPeopleMoved] = useState(0);
  const [busPeopleMoved, setBusPeopleMoved] = useState(0);

  // console.log(window.location, "<<<<<<<<<<")

  //const basePath = window.location.href
  const basePath = "/animations/"

  useEffect(() => {
    // Clean up positions for completed animations
    const cleanup = setInterval(() => {
      setCarPositions(prev => {
        const newPositions = new Map(prev);
        for (const [carId, position] of newPositions.entries()) {
          if (position >= endOfTrack - 3) {
            newPositions.delete(carId);
          }
        }
        return newPositions;
      });
    }, 1000);

    return () => clearInterval(cleanup);
  }, []);

  // Separate position tracking by lane
  const [lanePositions, setLanePositions] = useState({
    top: new Map(),
    lane2: new Map(),
    lane3: new Map(),
    lane4: new Map()
  });
  
  const safeDistance = 150; // Increased from 97.5
  const [spawnQueue, setSpawnQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // Process spawn queue
  useEffect(() => {
    if (spawnQueue.length > 0 && !isProcessingQueue) {
      setIsProcessingQueue(true);
      const { vehicleType } = spawnQueue[0];
      
      // Check if safe to spawn
      const lane = vehicleType === 'bus' ? 'top' : 'lane2'; // Default to lane2 for initial spawn
      const positions = lanePositions[lane];
      let isSafeToSpawn = true;
      
      for (const position of positions.values()) {
        if (position < 200) { // Check first section of track
          isSafeToSpawn = false;
          break;
        }
      }

      if (isSafeToSpawn) {
        const newId = uniqueId(vehicleType === 'bus' ? 'bus_' : 'car_');
        setCars(prev => [...prev, newId]);
        setVehicleTypes(prev => ({
          ...prev,
          [newId]: vehicleType
        }));
        
        if (vehicleType === 'bus') {
          topLaneAssignments.add(newId);
        }
        
        // Remove from queue
        setSpawnQueue(prev => prev.slice(1));
      }

      // Allow next spawn check
      setTimeout(() => {
        setIsProcessingQueue(false);
      }, 2000); // Enforce minimum 2s between spawns
    }
  }, [spawnQueue, isProcessingQueue]);

  // Modified click handler
  const handleVehicleClick = (isBus = false) => {
    if (isClickable) {
      // Add to spawn queue instead of spawning immediately
      setSpawnQueue(prev => [...prev, { vehicleType: isBus ? 'bus' : 'car' }]);

      // Handle click timeout animation
      setIsClickable(false);
      const randomTimeout = Math.floor(Math.random() * (1500 - 500 + 1)) + 500;
      animateTimeout(Date.now(), randomTimeout);
      setTimeout(() => {
        setIsClickable(true);
        cancelAnimationFrame(animationFrameId);
        setTimeoutProgress(0);
      }, randomTimeout);
    }
  };

  // Add state for graph visibility on mobile
  const [showMobileGraph, setShowMobileGraph] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "10px 10px 0 10px",
        boxSizing: "border-box",
        position: "relative",
        overflow: "visible",
        maxWidth: width < 800 ? "800px" : "100%",
        margin: "0 0 0 0",
        minHeight: scaleFactor < 1 ? `${150 * scaleFactor}px` : "auto"
      }}
    >
      <div style={{ 
        position: "relative", 
        maxWidth: width < 800 ? "800px" : "100%",
        overflow: "visible",
        perspective: "1000px",
        transform: `scale(${scaleFactor})`,
        transformOrigin: "top left",
        marginBottom: scaleFactor < 1 ? `${(1 - scaleFactor) * -25}px` : "0px",
        height: scaleFactor < 1 ? "150px" : "auto"
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

            {/* Left square */}
            <motion.div
              whileTap={isClickable ? { scale: 0.7 } : {}}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                flexShrink: 0,
              }}>
              {/* Car button */}
              <div style={{
                width: "75px",
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
                  onClick={() => handleVehicleClick(false)}>
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

              {/* Bus button */}
              <div style={{
                width: "75px",
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
                  onClick={() => handleVehicleClick(true)}>
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
            </motion.div>

            {/* Track with responsive width */}
            <div
              style={{
                width: `${trackWidth}px`,
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
            {scaleFactor >= 1 ? (
              <>
                <div ref={rightSquareRef} style={{
                  width: "60px",
                  height: "120px",
                  backgroundColor: "#F1F0DF",
                  borderRadius: "15px",
                  position: "relative",
                  flexShrink: 0
                }} />
                {/* Desktop stats */}
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
                    People Moved
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
                <div style={{
                  position: "relative",
                  height: "60px",
                  width: "120px",
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
              </>
            ) : (
              // Mobile layout
              <>
                {/* Right square */}
                <div ref={rightSquareRef} style={{
                  width: "60px",
                  height: "120px",
                  backgroundColor: "#F1F0DF",
                  borderRadius: "15px",
                  position: "relative",
                  flexShrink: 0
                }} />
                
                {/* Graph toggle button - with fixed positioning */}
                <button
                  onClick={() => setShowMobileGraph(!showMobileGraph)}
                  style={{
                    position: "absolute",  // Changed from absolute to fixed
                    top: "135px",
                    left: "435px",
                    // right: "5px",
                    width: "40px",
                    height: "40px",
                    backgroundColor: "#F1F0DF",
                    border: "none",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    zIndex: 10,
                    animation: "pulsate 2s ease-in-out infinite"
                  }}
                >
                  <svg 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{
                      animation: "pulsateOpacity 2s ease-in-out infinite"
                    }}
                  >
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>

                  <style>
                    {`
                      @keyframes pulsate {
                        0% {
                          transform: scale(1);
                          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        50% {
                          transform: scale(1.05);
                          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                        }
                        100% {
                          transform: scale(1);
                          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                      }

                      @keyframes pulsateOpacity {
                        0% {
                          opacity: 1;
                        }
                        50% {
                          opacity: 0.7;
                        }
                        100% {
                          opacity: 1;
                        }
                      }
                    `}
                  </style>
                </button>

                {/* Mobile stats overlay - improved styling */}
                {showMobileGraph && (
                  <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.8)", // More transparent
                    backdropFilter: "blur(5px)", // Add blur effect
                    zIndex: 1000,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px",
                    transition: "all 0.3s ease" // Smooth transition
                  }}>
                    {/* Close button */}
                    <button
                      onClick={() => setShowMobileGraph(false)}
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

                    {/* Stats content */}
                    <div style={{
                      backgroundColor: "#1a1a1a",
                      borderRadius: "12px",
                      padding: "15px",
                      width: "90%",
                      maxWidth: "300px",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      animation: "fadeIn 0.3s ease"
                    }}>
                      {/* People Moved Board */}
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
                          People Moved
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
                        marginTop: "15px",
                        position: "relative",
                        height: "60px",
                        width: "120px",
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
                  </div>
                )}
              </>
            )}
          </div>

          {/* Active cars */}
          {activeCars.map((car, originalIndex) => (
            <AnimatePresence mode="sync" key={`active-${car}`}>
              <motion.div
                ref={createOrGetRef(carRefs, car)}
                initial={{ x: 70, opacity: 1 }}
                style={{
                  width: scaleFactor < 1 ? "30px" : "40px",
                  height: scaleFactor < 1 ? "30px" : "40px",
                  position: "absolute",
                  top: topLaneAssignments.has(car) 
                    ? "5px"
                    : !laneAssignments.has(car)
                      ? (() => {
                          // Find lane with lowest count
                          const minCount = Math.min(lane2Count, lane3Count, lane4Count);
                          let position;
                          
                          if (lane2Count === minCount) {
                            position = "30px";
                            setLane2Count(prev => prev + 1);
                          } else if (lane3Count === minCount) {
                            position = "60px";
                            setLane3Count(prev => prev + 1);
                          } else {
                            position = "90px";
                            setLane4Count(prev => prev + 1);
                          }
                          
                          laneAssignments.set(car, position);
                          return position;
                        })()
                      : laneAssignments.get(car),
                  left: "20px",
                  zIndex: 2,
                }}
                animate={{
                  x: endOfTrack,
                  transition: {
                    duration: topLaneAssignments.has(car)
                      ? Math.min(30, 2 + Math.max(0, activeCars.length - 1/3))
                      : Math.min(45, 3 + Math.max(0, activeCars.length - 1/3)),
                    type: "linear",
                    ease: "linear",
                  }
                }}
                onUpdate={(latest) => {
                  // Update lane positions
                  const lane = topLaneAssignments.has(car) ? 'top' : 
                              laneAssignments.get(car) === "25px" ? 'lane2' :
                              laneAssignments.get(car) === "55px" ? 'lane3' : 'lane4';
                  
                  setLanePositions(prev => {
                    const newPositions = {...prev};
                    newPositions[lane] = new Map(prev[lane]).set(car, latest.x);
                    return newPositions;
                  });

                  // Check for nearby vehicles in same lane
                  const currentLane = topLaneAssignments.has(car) ? "top" : laneAssignments.get(car);
                  const carsInSameLane = Array.from(carPositions.entries())
                    .filter(([otherId, _]) => {
                      const otherLane = topLaneAssignments.has(otherId) ? "top" : laneAssignments.get(otherId);
                      return otherLane === currentLane && otherId !== car;
                    });
                  
                  // Adjust speed if too close to vehicle in front
                  for (const [_, otherPosition] of carsInSameLane) {
                    if (otherPosition > latest.x && otherPosition - latest.x < safeDistance) {
                      latest.duration *= 1.5; // Slow down
                      break;
                    }
                  }
                  
                  if (latest.x >= endOfTrack - 3) {
                    latest.zIndex = 0;
                    latest.display = "none";
                    if (!countedCars.includes(car)) {
                      if (vehicleTypes[car] === 'bus') {
                        setBusPeopleMoved(prev => prev + (carPassengers[car] || 0));
                      } else {
                        setCarPeopleMoved(prev => prev + (carPassengers[car] || 0));
                      }
                      countedCars.push(car);

                    }
                    // Clean up position when car reaches destination
                    setCarPositions(prev => {
                      const newPositions = new Map(prev);
                      newPositions.delete(car);
                      return newPositions;
                    });
                    // Decrease lane count when car reaches destination
                    const lane = laneAssignments.get(car);
                    if (lane === "25px") setLane2Count(prev => Math.max(0, prev - 1));
                    if (lane === "55px") setLane3Count(prev => Math.max(0, prev - 1));
                    if (lane === "85px") setLane4Count(prev => Math.max(0, prev - 1));
                    laneAssignments.delete(car);
                  } else {
                    countedCars = countedCars.filter(c => c !== car);
                  }
                }}
                onAnimationComplete={() => {
                  // Clean up position tracking
                  const lane = topLaneAssignments.has(car) ? 'top' : 
                              laneAssignments.get(car) === "25px" ? 'lane2' :
                              laneAssignments.get(car) === "55px" ? 'lane3' : 'lane4';
                  
                  setLanePositions(prev => {
                    const newPositions = {...prev};
                    newPositions[lane].delete(car);
                    return newPositions;
                  });
                  
                  setCars(prev => prev.filter(c => c !== car));
                }}
              >
                <img 
                  src={vehicleTypes[car] === 'bus' ? basePath + "/bus.png" : basePath + "/car.png"} 
                  style={{ width: "100%", height: "100%" }}
                />
                <AnimatePresence mode='popLayout'>
                  {cues
                    .filter(cue => cue.carId === car)
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

export default Scenario1Cars; 
