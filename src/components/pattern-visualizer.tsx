"use client";

import React, { useEffect, useRef, useMemo } from "react";

type PatternVisualizerProps = {
  patternData: boolean[][];
  speed?: number; // delay in ms
  isPlaying: boolean;
  color?: string;
};

// Represents a single droplet of water
type Droplet = {
  x: number;
  y: number;
  vy: number; // velocity y
  len: number;
  opacity: number;
};

const GRAVITY = 0.3;
const DROPLET_BASE_LENGTH = 15;
const DROPLET_BASE_SPEED = 4;

export function PatternVisualizer({ patternData, speed = 100, isPlaying, color = 'hsl(var(--primary))' }: PatternVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number>();
  const lastTickTime = useRef<number>(0);
  const currentTimeStep = useRef<number>(0);

  // The animation should play bottom-to-top, so we reverse the pattern data just for the animation.
  const animationPattern = useMemo(() => [...patternData].reverse(), [patternData]);

  const numTimeSteps = patternData.length;
  const numValves = patternData[0]?.length || 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isPlaying || numValves === 0 || numTimeSteps === 0) {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Set canvas resolution to match its display size for high-DPI rendering.
    const parent = canvas.parentElement;
    if (parent) {
      const { width, height } = parent.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    }

    let droplets: Droplet[] = [];

    // --- DYNAMIC VALVE SPACING LOGIC ---
    let startX: number;
    let valveSpacing: number;
    const padding = canvas.width * 0.1; // Use 10% of canvas width as padding
    const drawableWidth = canvas.width - padding;

    if (numValves > 1) {
        valveSpacing = drawableWidth / (numValves - 1);
        startX = padding / 2;
    } else {
        valveSpacing = 0;
        startX = canvas.width / 2;
    }
    // --- END DYNAMIC LOGIC ---

    const tick = (time: number) => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Handle time step advancement
      if (time - lastTickTime.current > speed) {
        lastTickTime.current = time;
        // Use the reversed pattern for the animation to play bottom-up
        const currentPatternStep = animationPattern[currentTimeStep.current];
        if (currentPatternStep) {
          currentPatternStep.forEach((valveOn, valveIndex) => {
            if (valveOn) {
              droplets.push({
                x: startX + valveIndex * valveSpacing, // Use dynamic spacing
                y: 0,
                vy: DROPLET_BASE_SPEED + Math.random() * 2,
                len: DROPLET_BASE_LENGTH + Math.random() * 5,
                opacity: 1,
              });
            }
          });
        }
        currentTimeStep.current = (currentTimeStep.current + 1) % numTimeSteps;
      }
      
      // Update and draw droplets
      const newDroplets: Droplet[] = [];
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      for (const droplet of droplets) {
        droplet.y += droplet.vy;
        droplet.vy += GRAVITY;
        droplet.opacity = Math.max(0, 1 - (droplet.y / canvas.height));

        if (droplet.y < canvas.height) {
          newDroplets.push(droplet);
          
          ctx.beginPath();
          ctx.globalAlpha = droplet.opacity;
          ctx.moveTo(droplet.x, droplet.y);
          ctx.lineTo(droplet.x, droplet.y - droplet.len);
          ctx.stroke();
        }
      }

      droplets = newDroplets;
      ctx.globalAlpha = 1;

      // Draw valves
      ctx.fillStyle = color;
      for (let i = 0; i < numValves; i++) {
        const x = startX + i * valveSpacing; // Use dynamic spacing
        ctx.beginPath();
        ctx.arc(x, 5, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      
      animationFrameId.current = requestAnimationFrame(tick);
    };

    lastTickTime.current = performance.now();
    currentTimeStep.current = 0;
    tick(lastTickTime.current);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPlaying, animationPattern, speed, numTimeSteps, numValves, color]);
  
  // Reset animation when pattern data changes
  useEffect(() => {
    currentTimeStep.current = 0;
  }, [animationPattern]);

  if (numTimeSteps === 0 || numValves === 0) {
    return <div className="w-full h-full bg-transparent flex items-center justify-center text-muted-foreground text-xs">No pattern data</div>;
  }
  
  // Static preview grid - Renders the pattern data directly (top-to-bottom)
  if (!isPlaying) {
    const cssGridSafeTimeSteps = Math.max(1, numTimeSteps);
    const cssGridSafeNumValves = Math.max(1, numValves);
    return (
        <div className="w-full h-full grid p-1" style={{ gridTemplateColumns: `repeat(${cssGridSafeNumValves}, 1fr)`, gridTemplateRows: `repeat(${cssGridSafeTimeSteps}, 1fr)`, gap: '1px' }}>
            {/* Use patternData directly here for correct static display */}
            {patternData.map((row, timeIndex) => (
                <React.Fragment key={timeIndex}>
                {row.map((cell, valveIndex) => (
                    <div key={`${timeIndex}-${valveIndex}`} className="min-w-0 min-h-0" style={{
                        backgroundColor: cell ? color : 'hsl(var(--border) / 0.1)',
                        boxShadow: cell ? `0 0 1px ${color}` : 'none',
                        borderRadius: '1px'
                    }}></div>
                ))}
                </React.Fragment>
            ))}
        </div>
    );
  }

  // Live animated preview using canvas
  return (
    <div className="w-full h-full flex items-center justify-center">
       <canvas ref={canvasRef} className="w-full h-full"></canvas>
    </div>
  );
}
