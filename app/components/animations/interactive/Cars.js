'use client';

import React, { useRef, useState, useEffect, useMemo } from "react";
import { motion, useMotionValue, AnimatePresence } from "motion/react";
import { random, uniqueId } from "lodash";
import { style } from "motion/react-m";
import { use } from "react";
//import { isLabelWithInternallyDisabledControl } from "@testing-library/user-event/dist/utils";
import { Track } from './commons/Track';
import { EtaGraph } from './commons/EtaGraph';
import { Car } from './elements/Car';
import { TrackSquare } from './commons/TrackSquare';
import { RightSquare } from './commons/RightSquare';
import { PeopleMovedBoard } from './commons/PeopleMovedBoard';
import { TRACK_CONSTANTS } from './commons/constants';
import "./styles/cars.css";
import Grid from '@mui/material/Grid';
import { useTrackConstants } from './commons/constants';
import { useForceSimulation } from './commons/useForceSimulation';
import { useInteractive } from '../context/InteractiveContext';

var countedCars = new Array();


const Cars = () => {
  const { trackConstants, ANIMATION_VARIANTS } = useTrackConstants();
  const rightSquareRef = useRef(null);
  const endOfTrack = trackConstants.END_OF_TRACK;
  const trackSteps = trackConstants.TRACK_STEPS;
  const carRefs = useRef({});
  //const basePath = window.location.href
  const basePath = "/animations/"
  const [trackSlots, setTrackSlots] = useState(new Map());
  const { addMovedPeopleCar, addNumberOfCars, addNumberOfBuses, addNumberOfTrains, addMovedPeopleBus, addMovedPeopleTrain } = useInteractive();

  // ... all other state and functions

  const createOrGetRef = (refs, id) => {
    if (!refs.current[id]) {
    //   // console.log("create", id)
      refs.current[id] = React.createRef();
    }
    return refs.current[id];
  };

    // const inTrack = useMotionValue(0);

  const [discardedCars, setDiscardedCars] = useState(new Set());


  const [cars, setCars] = useState([]);
  const trackLength = trackConstants.TRACK_LENGTH;
  
    
  
  //   // console.log(cars, carRefs, discardedCars)
  
  const [cues, setCues] = useState([]);

  // Memoize active and discarded cars
  const { activeCars, discardedCarsList } = useMemo(() => {
    // Check track length before creating active cars list
    const activeCount = cars.filter((_, index) => !discardedCars.has(index)).length;
    
    if (activeCount > trackConstants.TRACK_LENGTH) {
      // Mark the newest car as discarded
      setDiscardedCars(prev => new Set([...prev, cars.length - 1]));
    }

    return {
      activeCars: cars.filter((_, index) => !discardedCars.has(index)),
      discardedCarsList: cars.filter((_, index) => discardedCars.has(index))
    };
  }, [cars, discardedCars]);

  const variants = ANIMATION_VARIANTS;

  



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

  const [etaHistory, setEtaHistory] = useState([]);
  const maxDataPoints = trackConstants.MAX_DATA_POINTS;

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
  const [animationDuration, setAnimationDuration] = useState(trackConstants.BASE_ANIMATION_DURATION);

  // Add this effect to update duration when cars change
  useEffect(() => {
    setAnimationDuration(trackConstants.BASE_ANIMATION_DURATION + Math.max(0, activeCars.length - 1));
  }, [activeCars.length]);

  // Add this effect to update duration for all cars when count changes
  useEffect(() => {
    activeCars.forEach(car => {
      let ref = createOrGetRef(carRefs, car);
      ref.current.duration = trackConstants.BASE_ANIMATION_DURATION + Math.max(0, activeCars.length - 1);
    });
  }, [activeCars.length]);

  // useEffect(() => {
  //   // Add cars based on carCount
  //   const newCars = [];
  //   for (let i = 0; i < carCount; i++) {
  //     newCars.push(uniqueId('car_'));
  //   }
  //   setCars([...cars, ...newCars]);
  //   // console.log("cars Effect", cars)
  // }, []);

  // Add this with other state declarations at the top
  const [carCount, setCarCount] = useState(0);

  // console.log("cars", carCount)

  const handleCarAdd = () => {
    if (isClickable) {
      setCarCount(prev => prev + 1);
      setCars([...cars, uniqueId('car_')]);
      setIsClickable(false);
      const randomTimeout = Math.floor(Math.random() * (1500 - 500 + 1)) + 500;  // Random between 500-1500ms
      animateTimeout(Date.now(), randomTimeout);
      setTimeout(() => {
        setIsClickable(true);
        cancelAnimationFrame(animationFrameId);
        setTimeoutProgress(0);
      }, randomTimeout);
    }
  };

  // Initialize force simulation with cars and track constants
  const forceSimulation = useForceSimulation(cars, trackConstants);

  return (
    <div className="cars-container">
      <Grid container spacing={2} direction="row">
        <Grid >
          <button
            className="minus-button"
            onClick={() => {
              if (activeCars.length > 0) {
                const firstActiveCar = activeCars[0];
                setCars(prev => prev.filter(c => c !== firstActiveCar));
              }
            }}
          >
            -
          </button>
        </Grid>
        <Grid item xs={12} md={6}>
          <TrackSquare
            isLeft={true}
            isClickable={isClickable}
            onClick={handleCarAdd}
            timeoutProgress={timeoutProgress}
          >
            <img src={`${basePath}/car.png`} alt="Car" />
          </TrackSquare>
        </Grid>
        <Grid item xs={12} md={6}>
          <div className="track-animation-container">
            <Grid container spacing={0.1} direction="column">
              <Grid item xs={12} md={6}>
              <div className="cars-animation-wrapper">
                <Grid container spacing={0.1} direction="row">
                  <Grid item xs={12} md={6}>
                    <Track />
                  </Grid>
                  <Grid item xs={12} md={6}>
                      {cars.map((car, index) => (
                        <Car
                          key={car}
                          car={car}
                          isActive={!discardedCars.has(index)}
                          originalIndex={index}
                          createOrGetRef={createOrGetRef}
                          carRefs={carRefs}
                          activeCarsLength={activeCars.length}
                          onComplete={() => {
                            setCars(prev => prev.filter(c => c !== car));
                          }}
                          basePath={basePath}
                          countedCars={countedCars}
                          setPeopleMoved={setPeopleMoved}
                          forceSimulation={forceSimulation}
                          activeCars={activeCars}
                          trackSlots={trackSlots}
                          setTrackSlots={setTrackSlots}
                        />
                      ))}
                  </Grid>
                </Grid>
              </div>
              </Grid>
              {/* <Grid item xs={12} md={6}>
                <PeopleMovedBoard peopleMoved={peopleMoved} />
              </Grid> */}
            </Grid>
          </div>
        </Grid>
        <Grid item xs={12} md={6}>
          <RightSquare ref={rightSquareRef} />
        </Grid>
      </Grid>
    </div>
  );
};

export default Cars; 