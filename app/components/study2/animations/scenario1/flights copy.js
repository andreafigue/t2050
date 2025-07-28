import React, { useRef, useState, useEffect, useMemo } from "react";
import { motion, useMotionValue, AnimatePresence } from "motion/react";
import { random, uniqueId } from "lodash";
import { style } from "motion/react-m";
import { useWindowSize } from "react-use";

var countedTrains = new Array();

const Scenario1Flights = () => {
  const { isMobile, width } = useWindowSize();
  const scaleFactor = useMemo(() => {
    if (width < 768) {
      return Math.min(1, (width - 20) / 800);
    }
    return 1;
  }, [width]);

  const rightSquareRef = useRef(null);
  const endOfTrack = 585;
  const trackSteps = 6;
  const carRefs = useRef({});
  const [carCount, setCarCount] = useState(0);

  useEffect(() => {
    const getRandomInterval = () => Math.floor(Math.random() * (7400 - 6500 + 1)) + 6500;
    
    let timeoutId;
    const startTime = Date.now();
    const duration = 225000;
    
    const scheduleNextClick = () => {
      const currentTime = Date.now();
      if (currentTime - startTime < duration) {
        timeoutId = setTimeout(() => {
          setCars(prev => [...prev, uniqueId('car_')]);
          setCarCount(prev => prev + 1);
          scheduleNextClick();
        }, getRandomInterval());
      }
    };

    scheduleNextClick();

    return () => clearTimeout(timeoutId);
  }, []);

  const createOrGetRef = (refs, id) => {
    if (!refs.current[id]) {
      refs.current[id] = React.createRef();
    }
    return refs.current[id];
  };

  const variants = {
    start: {
      x: [20, 110, 195, 292.5, 390, 487.5, endOfTrack],
      y: [0, -20, -40, -50, -40, -20, 0],
      transition: {
        duration: 6,
        times: [0, 0.15, 0.30, 0.50, 0.70, 0.85, 1],
        type: "linear",
        ease: "linear",
      },
      opacity: [1, 1, 1, 1, 1, 1, 1],
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

  const [discardedCars, setDiscardedCars] = useState(new Set());

  const [cars, setCars] = useState([]);

  const { activeCars, discardedCarsList } = useMemo(() => {
    const activeCount = cars.filter((_, index) => !discardedCars.has(index)).length;
    
    if (activeCount > trackLength) {
      setDiscardedCars(prev => new Set([...prev, cars.length - 1]));
    }

    return {
      activeCars: cars.filter((_, index) => !discardedCars.has(index)),
      discardedCarsList: cars.filter((_, index) => discardedCars.has(index))
    };
  }, [cars, discardedCars, trackLength]);

  const [cues, setCues] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCues(prevCues => 
        prevCues.filter(cue => Date.now() - cue.timestamp < 1000)
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const addCue = () => {
    const x = (Math.random() - 0.5) * 300;
    const y = (Math.random() - 0.5) * 300;

    setCues(prevCues => [...prevCues, {
      id: Math.random(),
      timestamp: Date.now(),
      position: { 
        x: x,
        y: y
      }
    }]);
  };

  const [eta, setEta] = useState("00:00");

  useEffect(() => {
    const timer = setInterval(() => {
      const baseTime = 120;
      
      const excessCars = Math.max(0, activeCars.length - 10);
      const additionalTime = excessCars * 30;
      
      const randomDelay = Math.floor(Math.random() * 31) - 15;
      
      const totalSeconds = baseTime + additionalTime + randomDelay;
      
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
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

  const basePath = window.location.href

  const [showMobileGraph, setShowMobileGraph] = useState(false);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      padding: "10px",
      boxSizing: "border-box",
      position: "relative",
      overflow: "visible",
      maxWidth: "100%",
      margin: "0",
      minHeight: scaleFactor < 1 ? `${150 * scaleFactor}px` : "auto"
    }}>
      <div style={{
        position: "relative",
        width: "900px",
        overflow: "visible",
        perspective: "1000px",
        transform: `scale(${scaleFactor})`,
        transformOrigin: "top left",
        marginBottom: "0",
        height: scaleFactor < 1 ? "150px" : "auto"
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "15px",
          marginBottom: "20px",
          zIndex: 1,
        }}>
          {/* Left square */}
          <motion.div
            whileTap={isClickable ? { scale: 0.7 } : {}}
            style={{
              width: isMobile ? "90px" : "70px",
              height: isMobile ? "72px" : "60px",
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
                  const randomTimeout = Math.floor(Math.random() * (4500 - 1500 + 1)) + 1500;
                  animateTimeout(Date.now(), randomTimeout);
                  setTimeout(() => {
                    setIsClickable(true);
                    cancelAnimationFrame(animationFrameId);
                    setTimeoutProgress(0);
                  }, randomTimeout);
                }
              }}>
              <img src={ basePath + "/airplane.png" } style={{ width: "100%", height: "100%" }}></img>
            </button>
            
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
                height: "120px",
                position: "relative",
                flexShrink: 0,
                overflow: "visible"
              }}
            >
              <svg
                width="100%"
                height="100%"
                style={{
                  position: "absolute",
                  top: "-30px",
                  left: "0"
                }}
              >
                {/* Dashed parabolic curve */}
                <path
                  d="M 0,100 Q 250,-20 500,100"
                  fill="none"
                  stroke="#666"
                  strokeWidth="2"
                  strokeDasharray="8,8"
                  style={{ opacity: 0.5 }}
                />
                
                {/* Clouds */}
                <g style={{ opacity: 0.6 }}>
                  {/* Background clouds - Layer 1 */}
                  <text x="30" y="85" fontSize="24">☁️</text>
                  <text x="90" y="65" fontSize="28">☁️</text>
                  <text x="160" y="35" fontSize="26">☁️</text>
                  <text x="220" y="15" fontSize="30">☁️</text>
                  <text x="280" y="25" fontSize="28">☁️</text>
                  <text x="340" y="45" fontSize="26">☁️</text>
                  <text x="400" y="75" fontSize="24">☁️</text>
                  <text x="460" y="90" fontSize="28">☁️</text>
                  
                  {/* Middle clouds - Layer 2 */}
                  <text x="50" y="70" fontSize="20">☁️</text>
                  <text x="120" y="40" fontSize="22">☁️</text>
                  <text x="190" y="20" fontSize="20">☁️</text>
                  <text x="250" y="10" fontSize="24">☁️</text>
                  <text x="310" y="30" fontSize="22">☁️</text>
                  <text x="370" y="60" fontSize="20">☁️</text>
                  <text x="430" y="80" fontSize="22">☁️</text>
                  
                  {/* Foreground clouds - Layer 3 */}
                  <text x="70" y="75" fontSize="16">☁️</text>
                  <text x="140" y="45" fontSize="18">☁️</text>
                  <text x="200" y="25" fontSize="16">☁️</text>
                  <text x="260" y="20" fontSize="18">☁️</text>
                  <text x="320" y="40" fontSize="16">☁️</text>
                  <text x="380" y="65" fontSize="18">☁️</text>
                  <text x="440" y="85" fontSize="16">☁️</text>
                </g>
              </svg>
          </div>

          {/* Right square */}
          <div
            ref={rightSquareRef}
            style={{
              width: isMobile ? "72px" : "60px",
              height: isMobile ? "72px" : "60px",
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

          {/* People Moved Board */}
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
              top: "-20px",
              width: "100%",
              textAlign: "center",
              zIndex: 1,
              pointerEvents: "none"
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

        {/* Mobile stats icon */}
        {isMobile && (
          <button
            onClick={() => setShowMobileGraph(!showMobileGraph)}
            style={{
              position: "absolute",
              top: "185px",
              left: "10px",
              width: "48px",
              height: "48px",
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
              width="28" 
              height="28" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </button>
        )}

        {/* Mobile stats overlay */}
        {showMobileGraph && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(5px)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "60px 20px 20px 20px",
            transition: "all 0.3s ease"
          }}>
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

            <div style={{
              width: "90%",
              maxWidth: "340px",
              backgroundColor: "#1a1a1a",
              borderRadius: "12px",
              padding: "15px",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              border: "2px solid #333"
            }}>
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

            <div style={{
              width: "90%",
              maxWidth: "340px",
              backgroundColor: "#1a1a1a",
              borderRadius: "12px",
              padding: "15px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              border: "2px solid #333"
            }}>
              <div style={{
                color: "#ffffff",
                fontSize: "12px",
                fontFamily: "monospace",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "15px",
                textAlign: "center"
              }}>
                Time of Day
              </div>
              <div style={{
                height: "150px",
                display: "flex",
                alignItems: "flex-end",
                gap: "4px"
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
                        minHeight: "4px",
                        borderRadius: "2px",
                        opacity: 0.9
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Active cars */}
        {activeCars.map((car, originalIndex) => (
          <AnimatePresence mode="sync" key={`active-${car}`}>
            <motion.div
              variants={variants}
              ref={createOrGetRef(carRefs, car)}
              style={{
                width: "70px",
                height: "60px",
                position: "absolute",
                top: "40px",
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
              <img src={ basePath + "/airplane.png" } style={{ 
                width: "100%", 
                height: "100%",
              }}></img>
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

export default Scenario1Flights; 