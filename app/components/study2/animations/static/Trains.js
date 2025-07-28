import React, { useRef, useState, useEffect, useMemo } from "react";
import { motion, useMotionValue, AnimatePresence, stagger } from "motion/react";
import { random, uniqueId } from "lodash";
import { style } from "motion/react-m";
import { delay } from "motion";

var countedTrains = new Array();

const StaticTrains = () => {
  // Copy all the existing code from App.js here
  const rightSquareRef = useRef(null);
  const endOfTrack = 580;
  const trackSteps = 6;
  const carRefs = useRef({});
  const basePath = window.location.href
  // ... all other state and functions

  const createOrGetRef = (refs, id) => {
    if (!refs.current[id]) {
    //   console.log("create", id)
      refs.current[id] = React.createRef();
    }
    return refs.current[id];
  };

  const parentVariant = {
    initial: { opacity: 0 },
    /**
     * Here we are defining @param staggerChildren with 1sec.
     * You can change this time as per your need.
     * 1st child will not get delayed. delay starts from 2nd child onwards.
     * 2nd child animation will start after: 1sec
     * 2rd child animation will start after: 2sec
     * 4th child animation will start after: 3sec
     * and so on...
     */
    animate: { opacity: 1, transition: { staggerChildren: 1 }, delay: 1 }
  };

  const variants = {
    start: {
      x: [97.5, 195, 292.5, 390, 487.5, endOfTrack],
      transition: {
        duration: 6,
        times: [0, 0.20, 0.40, 0.60, 0.80, 1],
        type: "linear",
        ease: "linear",
        repeat: Infinity,
        repeatType: "loop",
        repeatDelay: 2.5,
        onRepeat: () => {
          console.log("repeat")
        },
        // delay: index => index * 2,
      },
      opacity: [1, 1, 1, 1, 1, 1]
    },
    discard: {
      y: [-15, -75, 250, 550, 650],
      x: [-15, -45, -90, -150, -175],
      transition: {
        duration: 6,
        times: [0, 0.20, 0.40, 0.70, 1],
        ease: "easeOut",
      },
      opacity: [1, 1, 0.7, 0.4, 0],
      backgroundColor: ["blue", "blue", "red", "red", "red"]
    }
  };

  const trackLength = 25;

  // const inTrack = useMotionValue(0);

  const [discardedCars, setDiscardedCars] = useState(new Set());

  const [visibleCars, setVisibleCars] = useState(1); // Start with 1 visible car

  useEffect(() => {
    // Add one car every 2 seconds
    const interval = setInterval(() => {
      setVisibleCars(prev => {
        if (prev <= 1) return prev;
        clearInterval(interval);
        return prev;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Initialize with 5 cars but only show up to visibleCars
  const [cars, setCars] = useState(() => {
    return Array.from({ length: 6 }, () => uniqueId('car_'));
  });

  // Filter cars based on visibleCars count
  const { activeCars, discardedCarsList } = useMemo(() => {
    const filtered = cars.slice(0, visibleCars);
    return {
      activeCars: filtered.filter((_, index) => !discardedCars.has(index)),
      discardedCarsList: filtered.filter((_, index) => discardedCars.has(index))
    };
  }, [cars, discardedCars, visibleCars]);



//   console.log(cars, carRefs, discardedCars)

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
      setEta(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, []);


  // console.log(activeCars)

  const [peopleMoved, setPeopleMoved] = useState(0);

  const [etaHistory, setEtaHistory] = useState([]);
  const maxDataPoints = 10;

  useEffect(() => {
    // Initialize with current ETA
    const currentEtaInSeconds = parseInt(eta.split(':')[0]) * 60 + parseInt(eta.split(':')[1]);
    if (currentEtaInSeconds > 0) {  // Only add if value is positive
      setEtaHistory([currentEtaInSeconds]);
    }

    // Set up interval for updates
    const interval = setInterval(() => {
      const etaInSeconds = parseInt(eta.split(':')[0]) * 60 + parseInt(eta.split(':')[1]);
      setEtaHistory(prev => {
        if (etaInSeconds > 0) {  // Only add if value is positive
          const newHistory = [...prev, etaInSeconds];
          if (newHistory.length > maxDataPoints) {
            newHistory.shift();
          }
          return newHistory;
        }
        return prev;  // Keep previous state if invalid value
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Update when eta changes
  useEffect(() => {
    const etaInSeconds = parseInt(eta.split(':')[0]) * 60 + parseInt(eta.split(':')[1]);
    // console.log('Current ETA value:', eta, 'converted to seconds:', etaInSeconds);  // Debug log
    
    setEtaHistory(prev => {
      if (etaInSeconds > 0) {  // Only add if value is positive
        const newHistory = [...prev, etaInSeconds];
        if (newHistory.length > maxDataPoints) {
          newHistory.shift();
        }
        return newHistory;
      }
      return prev;  // Keep previous state if invalid value
    });
  }, [eta]);

  return (
    <div>

    {/* To the left of the visuals */}

    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
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
            {/* Left square - Static version */}
            <div
              style={{
                width: "70px",
                height: "60px",
                backgroundColor: "#F1F0DF",
                borderRadius: "15px",
                position: "relative",
                zIndex: 1,
                flexShrink: 0
              }}>
              <img src={ basePath + "/train.png" } style={{ width: "100%", height: "100%" }}></img>
            </div>

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
            ></div>

            {/* Right square with cues */}
            <div
              ref={rightSquareRef}
              style={{
                width: "60px",
                height: "60px",
                backgroundColor: "#F1F0DF",
                borderRadius: "15px",
                position: "relative",
                zIndex: 1,
                flexShrink: 0
              }}
            >
              <AnimatePresence mode='popLayout'>
                {cues.map(cue => (
                  <motion.div
                    key={cue.id}
                    initial={{ opacity: 0, scale: 0.5, animationDelay: stagger(0.1, { startDelay: 0.2 }) }}
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
                      // zIndex: 10
                    }}
                  >
                    { parseInt(eta.split(':')[0]) < 5 ? "Reached! 🎉" : "Phew! 😢"}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* ETA Board */}
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
                  People Moved
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

            {/* ETA Graph Display */}
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
              {/* <div style={{
                color: "#ff6b00",
                fontSize: "10px",
                fontFamily: "monospace",
                marginBottom: "5px",
                textTransform: "uppercase",
                letterSpacing: "1px"
              }}>
                ETA
              </div> */}
              <div style={{
                width: "100%",
                height: "100%",
                position: "relative",
                // backgroundColor: "#333",
                display: "flex",
                alignItems: "flex-end",
                gap: "2px"
              }}>
                {etaHistory.map((value, index) => {
                  const heightPercentage = Math.min((value / 180) * 100, 100);
                  return (
                    <div
                      key={index}
                      style={{
                        flex: 1,
                        backgroundColor: value > 180 ? "#ff4444" : "#4CAF50",
                        height: `${heightPercentage}%`,
                        minHeight: "2px"
                      }}
                    />
                  );
                })}
              </div>
              {/* <div style={{
                position: "absolute",
                right: "15px",
                top: "8px",
                color: parseInt(eta.split(':')[0]) * 60 + parseInt(eta.split(':')[1]) > 180 ? "#ff4444" : "#4CAF50",
                fontSize: "14px",
                fontFamily: "digital, monospace",
                fontWeight: "bold"
              }}>
                {eta}
              </div> */}
            </div>
          </div>

          

          {/* Active cars */}
          {activeCars.map((car, index) => (
            <AnimatePresence
              key={`active-${car}`} 
              variants={parentVariant}
            >
              <motion.div
                variants={variants}
                animate="start"
                custom={index}
                style={{
                  width: "180px",
                  height: "40px",
                  borderRadius: "50%",
                  position: "absolute",
                  top: "10px",
                  zIndex: 2,
                }}
                onAnimationStart={() => {
                  const activeCount = activeCars.length;
                  if (activeCount > trackLength) {
                    setDiscardedCars(prev => new Set([...prev, index]));
                  }
                }}
                onUpdate={(latest) => {
                  // console.log(latest.display)
                  latest.display = "block";

                  if (latest.x >= endOfTrack - 130) {
                    // console.log(countedTrains, typeof countedTrains)
                    // latest.zIndex = 0;
                    latest.display = "none";
                    // addCue();
                    if (latest.x >= endOfTrack - 3) {
                    if (!countedTrains.includes(car)) {
                      const randomPeople = Math.floor(Math.random() * (800 - 76 + 1)) + 76;
                      // console.log("counted", car, randomPeople)
                      setPeopleMoved(prev => prev + randomPeople);
                      countedTrains.push(car);
                    }
                  } else {
                    // console.log("iteration")
                    countedTrains = countedTrains.filter(c => c !== car);
                    
                    // (prev => prev.filter(c => c !== car));
                    // const randomPeople = Math.floor(Math.random() * (236 - 56 + 1)) + 56;
                    //   setPeopleMoved(prev => prev + randomPeople);
                    //   addCue();
                  }
                  }
                }}


                onAnimationComplete={() => {
                  console.log("Complete")
                  setCars(prev => prev.filter(c => c !== car));
                  // setCountedTrains([]);
                  // setCountedTrains(prev => {
                  //   const newSet = new Set(prev);
                  //   newSet.delete(car);
                  //   return newSet;
                  // });
                }}
              >
                <img src={ basePath + "/train.png" } style={{ width: "100%", height: "100%" }}></img>
              </motion.div>
            </AnimatePresence>
          ))}

          {/* Discarded cars */}
          {discardedCarsList.map((car, index) => (
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
                  left: `${index * 75}px`,
                  zIndex: 2,
                  animationDelay: stagger(0.1, { startDelay: 0.2 }),
                  opacity: index === 0 ? 1 : 0
                }}
                transition={{ delay: index * 2 }}
                animate="discard"
                onAnimationComplete={() => {
                  setCars(prev => prev.filter(c => c !== car));
                }}
              />
            </AnimatePresence>
          ))}
        </div>
      
    </div>
    </div>
  );
};

export default StaticTrains;