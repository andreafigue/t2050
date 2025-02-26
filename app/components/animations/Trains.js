'use client'
import React, { useRef, useState, useEffect, useMemo } from "react";
import { motion, useMotionValue, AnimatePresence } from "motion/react";
import { random, uniqueId } from "lodash";
import { style } from "motion/react-m";

var countedTrains = new Array();

const FreightTrains = () => {
  // Copy all the existing code from App.js here
  const rightSquareRef = useRef(null);
  const endOfTrack = 585;
  const trackSteps = 6;
  const carRefs = useRef({});
  const [carCount, setCarCount] = useState(0);
  //const basePath = window.location.href
  const basePath = "/animations/"


  // Add auto-generation effect
  useEffect(() => {
    // Function to get random interval between 6.5 and 7.4 seconds
    const getRandomInterval = () => Math.floor(Math.random() * (7400 - 6500 + 1)) + 6500;
    
    let timeoutId;
    const startTime = Date.now();
    const duration = 225000; // 195 seconds in milliseconds
    
    const scheduleNextClick = () => {
      const currentTime = Date.now();
      if (currentTime - startTime < duration) {
        timeoutId = setTimeout(() => {
          setCars(prev => [...prev, uniqueId('car_')]);
          setCarCount(prev => prev + 1);
          scheduleNextClick(); // Schedule next click with new random interval
        }, getRandomInterval());
      }
    };

    scheduleNextClick(); // Start the first timeout

    // Cleanup timeout
    return () => clearTimeout(timeoutId);
  }, []);

  const createOrGetRef = (refs, id) => {
    if (!refs.current[id]) {
      // console.log("create", id)
      refs.current[id] = React.createRef();
    }
    return refs.current[id];
  };

  const variants = {
    start: {
      x: [110, 195, 292.5, 390, 487.5, endOfTrack],
      transition: {
        duration: 6,
        times: [0, 0.20, 0.40, 0.60, 0.80, 1],
        type: "linear",
        ease: "linear",
        // ease: [0.6, 0.05, -0.01, 0.9],
        // repeat: Infinity,
        // repeatType: "loop",
        // delay: 0.5
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

  const trackLength = 25;

  // const inTrack = useMotionValue(0);

  const [discardedCars, setDiscardedCars] = useState(new Set());


  const [cars, setCars] = useState([]);

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

  // console.log(cars, carRefs, discardedCars)

  const [cues, setCues] = useState([]);

  useEffect(() => {
    // Clean up expired cues
    const timer = setInterval(() => {
      setCues(prevCues => 
        prevCues.filter(cue => Date.now() - cue.timestamp < 1000)
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const addCue = () => {
    // Random position within a larger area around the right square
    const x = (Math.random() - 0.5) * 300;  // -150 to 150 pixels
    const y = (Math.random() - 0.5) * 300;  // -150 to 150 pixels

    setCues(prevCues => [...prevCues, {
      id: Math.random(),  // More random ID to ensure uniqueness
      timestamp: Date.now(),
      position: { 
        x: x,
        y: y
      }
    }]);
  };

  const [eta, setEta] = useState("00:00");

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

  const [peopleMoved, setPeopleMoved] = useState(0);

  const [etaHistory, setEtaHistory] = useState([]);
  const maxDataPoints = 10;

  useEffect(() => {
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "left",
        justifyContent: "flex-start",
        // minHeight: "100vh",
        padding: "20px",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden"
      }}
    > 
      <div style={{ 
          position: "relative", 
          width: "900px",
          // height: "200vh",
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

            {/* Left square */}
            <motion.div
              whileTap={isClickable ? { scale: 0.7 } : {}}
              style={{
                width: "70px",
                height: "60px",
                backgroundColor: "#F1F0DF",
                borderRadius: "15px",
                flexShrink: 0,
                opacity: isClickable ? 1 : 0.5,
                position: "relative"
              }}>
              <button 
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  backgroundColor: "transparent",
                  cursor: isClickable ? "pointer" : "not-allowed",
                }}
                disabled={!isClickable}
                onClick={() => {
                  if (isClickable) {
                    setCars([...cars, uniqueId('car_')]);
                    setIsClickable(false);
                    const randomTimeout = Math.floor(Math.random() * (4500 - 1500 + 1)) + 1500;  // Random between 1500-4500ms
                    animateTimeout(Date.now(), randomTimeout);
                    setTimeout(() => {
                      setIsClickable(true);
                      cancelAnimationFrame(animationFrameId);
                      setTimeoutProgress(0);
                    }, randomTimeout);
                  }
                }}>
                <img src={ basePath + "/cargo-train.png" } style={{ width: "100%", height: "100%" }}></img>
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
            </motion.div>

            {/* Track */}
            <div
              style={{
                width: "500px",
                height: "60px",
                backgroundColor: "#F1F0DF",
                borderRadius: "15px",
                position: "relative",
                overflow: "hidden",
                flexShrink: 0
              }}
            >
              {/* Railroad ties */}
              {Array.from({ length: 17 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    position: "absolute",
                    top: "0",
                    left: `${index * 30}px`,
                    width: "20px",
                    height: "100%",
                    backgroundColor: "#8B4513",
                    opacity: 0.3,
                    zIndex: 1
                  }}
                />
              ))}
              {/* Rails */}
              <div style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                backgroundImage: `
                  linear-gradient(90deg, #666 10px, transparent 10px),
                  linear-gradient(90deg, #666 10px, transparent 10px)
                `,
                backgroundSize: "30px 3px",
                backgroundPosition: "0 15px, 0 45px",
                backgroundRepeat: "repeat-x",
                zIndex: 2
              }} />
            </div>

            {/* Right square with cues */}
            <div
              ref={rightSquareRef}
              style={{
                width: "60px",
                height: "60px",
                backgroundColor: "#F1F0DF",
                borderRadius: "15px",
                position: "relative",
                flexShrink: 0
              }}
            >
              <AnimatePresence mode='popLayout'>
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
              </AnimatePresence>
            </div>

            

            

            {/* Freight Moved Board */}
            <div style={{
              width: "240px",
              height: "40px",
              backgroundColor: "#1a1a1a",
              borderRadius: "12px",
              padding: "10px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              border: "2px solid #333",
              position: "relative",
              overflow: "hidden",
              flexShrink: 0
            }}>
              {/* Left section with icon and label */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px"
              }}>
                <div style={{ fontSize: "20px" }}>👥</div>
                <div style={{
                  color: "#ff6b00",
                  fontSize: "10px",
                  fontFamily: "monospace",
                  textTransform: "uppercase",
                  letterSpacing: "1px"
                }}>
                  Freight Moved
                </div>
              </div>

              {/* Right section with counter */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                backgroundColor: "#000",
                padding: "8px 10px",
                borderRadius: "8px",
                minWidth: "110px"
              }}>
                <div style={{
                  color: "#4CAF50",
                  fontSize: "24px",
                  fontFamily: "digital, monospace",
                  fontWeight: "bold",
                  letterSpacing: "2px",
                  textShadow: "0 0 8px rgba(76,175,80,0.5)"
                }}>
                  {peopleMoved.toLocaleString()}
                </div>
                <motion.div
                  style={{
                    width: "100%",
                    height: "2px",
                    backgroundColor: "#4CAF50",
                    marginTop: "3px",
                    opacity: 0.5
                  }}
                  animate={{
                    opacity: [0.2, 1, 0.2]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
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
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "2px"
                }}>
                  {etaHistory.map((value, index) => {
                    const heightPercentage = Math.min((value / 480) * 100, 100);
                    return (
                      <div
                        key={index}
                        style={{
                          flex: 1,
                          backgroundColor: value > 300 ? "#ff4444" : "#4CAF50",
                          height: `${heightPercentage}%`,
                          minHeight: "2px"
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Active cars */}
          {activeCars.map((car, originalIndex) => (
            <AnimatePresence mode="sync" key={`active-${car}`}>
              <motion.div
                variants={variants}
                ref={createOrGetRef(carRefs, car)}
                style={{
                  width: "100px",  // Fixed width for trains
                  height: "100px", // Fixed height for trains
                  position: "absolute",
                  top: "-20px",
                  left: "20px",
                  zIndex: 2,
                }}
                animate="start"
                onAnimationStart={() => {
                  const activeCount = activeCars.length;
                  if (activeCount > trackLength) {
                    setDiscardedCars(prev => new Set([...prev, originalIndex]));
                  }
                }}
                onUpdate={(latest) => {
                  latest.display = "block";
                  if (latest.x >= endOfTrack - 3) {
                    latest.zIndex = 0;
                    latest.display = "none";
                    if (!countedTrains.includes(car)) {
                      const randomPeople = Math.floor(Math.random() * (150 - 82 + 1)) + 82;
                      setPeopleMoved(prev => prev + randomPeople);
                      countedTrains.push(car);
                    }
                  } else {
                    countedTrains = countedTrains.filter(c => c !== car);
                  }
                }}
                onAnimationComplete={() => {
                  setCars(prev => prev.filter(c => c !== car));
                }}
              >
                <img src={ basePath + "/cargo-train.png" } style={{ width: "100%", height: "100%" }}></img>
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

export default FreightTrains; 