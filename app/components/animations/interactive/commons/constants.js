'use client';

import { useState, useEffect } from 'react';

export const useTrackConstants = () => {
  const [trackConstants, setTrackConstants] = useState({
    END_OF_TRACK: 500, // default safe fallback
    TRACK_STEPS: 6,
    TRACK_LENGTH: 25,
    BASE_ANIMATION_DURATION: 6,
    MAX_DATA_POINTS: 10,
  });

  useEffect(() => {
    const computeEndOfTrack = () => {
      const width = window.innerWidth;
      if (width <= 700) return 160;
      if (width <= 900) return 385;
      return 500;
    };

    // Set initial END_OF_TRACK on mount
    setTrackConstants(prev => ({
      ...prev,
      END_OF_TRACK: computeEndOfTrack(),
    }));

    const handleResize = () => {
      setTrackConstants(prev => ({
        ...prev,
        END_OF_TRACK: window.innerWidth <= 768 ? 300 : 500,
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const generateSteps = (endValue, steps) => {
    const stepSize = endValue / (steps - 1);
    return Array.from({ length: steps }, (_, i) => Math.round(stepSize * i));
  };

  const xSteps = generateSteps(trackConstants.END_OF_TRACK, trackConstants.TRACK_STEPS);

  const ANIMATION_VARIANTS = {
    start: {
      x: xSteps,
      transition: {
        duration: trackConstants.BASE_ANIMATION_DURATION,
        times: [0, 0.20, 0.40, 0.60, 0.80, 1],
        type: "linear",
        ease: "linear",
        repeat: Infinity,
        repeatType: "loop",
        onRepeat: () => console.log("onRepeat")
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
      },
      opacity: [1, 1, 0.7, 0.4, 0],
      backgroundColor: ["blue", "blue", "red", "red", "red"]
    },
    onRepeat: () => console.log("onRepeat")
  };

  return { trackConstants, ANIMATION_VARIANTS };
};
