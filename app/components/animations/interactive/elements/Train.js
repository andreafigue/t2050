'use client';

import React, { useRef, useEffect, useState } from 'react';
import { AnimatePresence, motion } from "framer-motion";
import { useTrackConstants } from '../commons/constants';
import { useInteractive } from '../../context/InteractiveContext';

export const Train = ({ 
  car, 
  isActive, 
  originalIndex, 
  createOrGetRef, 
  carRefs,
  activeCarsLength,
  onComplete,
  basePath,
  countedCars,
  setPeopleMoved
}) => {
  const hasBeenCounted = useRef(false);
  const animationRef = useRef(null);
  const positionRef = useRef(0);
  const [opacity, setOpacity] = useState(1);
  const { trackConstants, ANIMATION_VARIANTS } = useTrackConstants();
  const STEP_SIZE = 40;
  const CAR_WIDTH = 50;
  const CAR_HEIGHT = 50;
//   const GAP_BETWEEN_CARS = 120;
  const SAFETY_BUFFER = 30;
  const { addMovedPeopleTrain, addNumberOfTrains } = useInteractive();

  const checkCollisions = () => {
    const currentCarLeft = positionRef.current;
    const currentCarRight = currentCarLeft + CAR_WIDTH;
    let safePosition = currentCarLeft + STEP_SIZE; // Default next position

    // Find the closest car ahead
    Object.entries(carRefs.current).forEach(([otherCarId, otherCarRef]) => {
      if (otherCarId !== car && otherCarRef.current) {
        const otherCarTransform = otherCarRef.current.style.transform;
        const otherCarPosition = otherCarTransform 
          ? parseInt(otherCarTransform.match(/translateX\((\d+)px\)/)?.[1] || 0)
          : 0;
        
        // Only check cars that are ahead of us
        if (otherCarPosition > currentCarLeft) {
          const otherCarLeft = otherCarPosition;
          
          // If we would get too close to the car ahead
          if (safePosition + CAR_WIDTH + SAFETY_BUFFER > otherCarLeft) {
            // Set position to maintain safe distance
            safePosition = Math.max(currentCarLeft, otherCarLeft - (CAR_WIDTH + SAFETY_BUFFER));
          }
        }
      }
    });

    return safePosition;
  };

  useEffect(() => {
    if (!isActive) return;

    const element = carRefs.current[car]?.current;
    if (!element) return;

    const animate = () => {
      // Get safe position considering cars ahead
      const nextPosition = checkCollisions();
      positionRef.current = nextPosition;
      
      if (positionRef.current >= trackConstants.END_OF_TRACK) {
        if (!hasBeenCounted.current) {
          hasBeenCounted.current = true;
          const randomPeople = Math.floor(Math.random() * (150 - 82 + 1)) + 82;  // Random between 82-150 for trains
          setPeopleMoved(prev => prev + randomPeople);
          addMovedPeopleTrain(randomPeople);
          addNumberOfTrains(1);
          if (!countedCars.includes(car)) {
            countedCars.push(car);
          }
        }
        
        setOpacity(0);
        
        setTimeout(() => {
          positionRef.current = 0;
          element.style.transition = 'none';
          element.style.transform = `translateX(${positionRef.current}px)`;
          
          setTimeout(() => {
            setOpacity(1);
            hasBeenCounted.current = false;
            animationRef.current = setTimeout(animate, 300);
          }, 50);
        }, 300);
        
        return;
      }

      element.style.transition = 'transform 0.4s linear';
      element.style.transform = `translateX(${positionRef.current}px)`;

      animationRef.current = setTimeout(animate, 300);
    };

    // const startDelay = originalIndex * 1000;
    const timeoutId = setTimeout(() => {
      animate();
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isActive, car]);

  if (isActive) {
    return (
      <div
        ref={createOrGetRef(carRefs, car)}
        className="car active-train"
        style={{
          width: `${CAR_WIDTH}px`,
          height: `${CAR_HEIGHT}px`,
          position: "absolute",
          top: "10px",
          left: "20px",
          zIndex: 2,
          transform: `translateX(0px)`,
          transition: 'transform 0.2s linear, opacity 0.3s ease',
          opacity: opacity
        }}
      >
        <img 
          src={`${basePath}/train.png`} 
          alt="Car" 
          style={{ 
            width: "100%", 
            height: "100%",
            display: "block"
          }} 
        />
      </div>
    );
  }

  return (
    <AnimatePresence mode="sync" key={`discarded-${car}`}>
      <motion.div
        ref={createOrGetRef(carRefs, car)}
        className="car discarded-car"
        variants={ANIMATION_VARIANTS}
        animate="discard"
        onAnimationComplete={onComplete}
        style={{
          width: `${CAR_WIDTH}px`,
          height: `${CAR_WIDTH}px`,
          position: "absolute",
          top: "10px",
          left: "20px",
          zIndex: 2
        }}
      >
        <img src={`${basePath}/train.png`} alt="Car" style={{ width: "100%", height: "100%" }} />
      </motion.div>
    </AnimatePresence>
  );
}; 