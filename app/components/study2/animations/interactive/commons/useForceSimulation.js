'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export const useForceSimulation = (cars, trackConstants) => {
  const simulationRef = useRef(null);
  const positionsRef = useRef(new Map()); // Track actual positions

  useEffect(() => {
    simulationRef.current = d3.forceSimulation()
      // Stronger collision force with larger radius
      .force('collision', d3.forceCollide()
        .radius(60)  // Increased radius for more spacing
        .strength(1) // Much stronger collision force
        .iterations(4)) // More iterations for better collision resolution
      .force('x', d3.forceX().x(d => d.targetX).strength(0.5)) // Weaker x force to let collisions dominate
      .velocityDecay(0.2) // Less decay to allow more movement
      .on('tick', () => {
        const nodes = simulationRef.current.nodes();
        nodes.forEach(node => {
          // Store actual positions
          positionsRef.current.set(node.id, {
            x: Math.max(120, Math.min(trackConstants.END_OF_TRACK, node.x)),
            y: 0
          });

          // Handle repeating cars differently
          if (node.isRepeating) {
            // Find the rightmost non-repeating car
            const rightmostX = Math.max(...Array.from(positionsRef.current.values())
              .filter(n => !n.isRepeating)
              .map(n => n.x));
            
            // Position repeating car behind the rightmost car
            node.x = Math.min(node.x, rightmostX - 120);
          }

          // Ensure cars maintain minimum distance
          nodes.forEach((otherNode, j) => {
            if (node.id !== otherNode.id) {
              const dx = node.x - otherNode.x;
              if (Math.abs(dx) < 50) { // Minimum distance between cars
                const adjustment = (50 - Math.abs(dx)) * Math.sign(dx) * 0.5;
                node.x += adjustment;
                otherNode.x -= adjustment;
              }
            }
          });
          
          // Constrain to track bounds after collision adjustment
          node.x = Math.max(120, Math.min(trackConstants.END_OF_TRACK, node.x));
          node.y = 0;
        });
      });

    // Initialize nodes
    const nodes = cars.map(car => ({
      id: car,
      x: positionsRef.current.get(car)?.x || 120,
      y: 0,
      targetX: positionsRef.current.get(car)?.x || 120,
      isRepeating: false
    }));

    simulationRef.current.nodes(nodes);

    return () => {
      simulationRef.current.stop();
    };
  }, [cars]);

  const updatePositions = (carId, targetX) => {
    if (!simulationRef.current) return;
    
    // Only update if position would change significantly
    const currentPos = positionsRef.current.get(carId)?.x || 120;
    if (Math.abs(currentPos - targetX) > 5) {
      const nodes = simulationRef.current.nodes();
      const node = nodes.find(n => n.id === carId);
      if (node) {
        node.targetX = targetX;
        simulationRef.current.alpha(1).restart();
      }
    }
  };

  const resetPosition = (carId) => {
    // When resetting, check other cars' positions first
    const otherPositions = Array.from(positionsRef.current.entries())
      .filter(([id]) => id !== carId)
      .map(([_, pos]) => pos.x);
    
    // Find a safe starting position
    let safeX = 120;
    if (otherPositions.length > 0) {
      const minPos = Math.min(...otherPositions);
      safeX = Math.max(120, minPos - 80); // Keep good distance from other cars
    }

    positionsRef.current.set(carId, { x: safeX, y: 0 });
    
    if (simulationRef.current) {
      const nodes = simulationRef.current.nodes();
      const node = nodes.find(n => n.id === carId);
      if (node) {
        node.x = safeX;
        node.targetX = safeX;
        simulationRef.current.alpha(1).restart();
      }
    }
  };

  const getPosition = (carId) => {
    return positionsRef.current.get(carId) || { x: 120, y: 0 };
  };

  return { updatePositions, getPosition, resetPosition };
}; 