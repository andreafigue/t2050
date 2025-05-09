'use client';

import React from 'react';
import { TRACK_CONSTANTS } from './constants';

export const EtaGraph = ({ etaHistory }) => {
  return (
    <div className="eta-graph">
      <div className="eta-graph-bars">
        {etaHistory.map((value, index) => {
          const heightPercentage = Math.min((value / 480) * 100, 100);
          return (
            <div
              key={index}
              className={`eta-bar ${value > 300 ? 'eta-bar-high' : 'eta-bar-normal'}`}
              style={{ height: `${heightPercentage}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}; 