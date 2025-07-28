'use client';

import React from 'react';

export const RightSquare = React.forwardRef((props, ref) => {
  return (
    <div
      ref={ref}
      className="track-square right"
    />
  );
});

RightSquare.displayName = 'RightSquare'; 