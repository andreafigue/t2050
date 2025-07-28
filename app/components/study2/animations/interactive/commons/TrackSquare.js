'use client';

import { motion } from "framer-motion";

export const TrackSquare = ({ isLeft, isClickable, onClick, children, timeoutProgress }) => {
  return (
    <motion.div
      whileTap={isClickable ? { scale: 0.7 } : {}}
      className="track-square"
      style={{ opacity: isClickable ? 1 : 0.5 }}
    >
      <button 
        className="track-square-button"
        disabled={!isClickable}
        onClick={onClick}
      >
        {children}
      </button>
      
      {!isClickable && (
        <svg className="timeout-indicator" viewBox="0 0 100 100">
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
  );
}; 