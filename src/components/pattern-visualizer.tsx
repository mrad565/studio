"use client";

import { useEffect, useRef } from "react";

type PatternVisualizerProps = {
  patternData: boolean[][];
  speed?: number; // delay in ms
  isPlaying: boolean;
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
const VALVE_SPACING = 12;
const DROPLET_BASE_LENGTH = 15;
const DROPLET_BASE_SPEED = 4;

export function PatternVisualizer({ patternData, speed = 100, isPlaying }: PatternVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number>();
  const lastTickTime = useRef<number>(0);
  const currentTimeStep = useRef<number>(0);

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

    let droplets: Droplet[] = [];

    const valveWidth = numValves * VALVE_SPACING;
    const startX = (canvas.width - valveWidth) / 2;

    const tick = (time: number) => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Handle time step advancement
      if (time - lastTickTime.current > speed) {
        lastTickTime.current = time;
        const currentPatternStep = patternData[currentTimeStep.current];
        if (currentPatternStep) {
          currentPatternStep.forEach((valveOn, valveIndex) => {
            if (valveOn) {
              droplets.push({
                x: startX + valveIndex * VALVE_SPACING,
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
      ctx.strokeStyle = `hsl(var(--primary))`;
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
      ctx.fillStyle = `hsl(var(--border))`;
      for (let i = 0; i < numValves; i++) {
        const x = startX + i * VALVE_SPACING;
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
  }, [isPlaying, patternData, speed, numTimeSteps, numValves]);
  
  // Reset animation when pattern data changes
  useEffect(() => {
    currentTimeStep.current = 0;
  }, [patternData]);

  if (numTimeSteps === 0 || numValves === 0) {
    return <div className="w-full h-full bg-transparent flex items-center justify-center text-muted-foreground text-xs">No pattern data</div>;
  }
  
  // Static preview grid
  if (!isPlaying) {
    const cssGridSafeTimeSteps = Math.max(1, numTimeSteps);
    const cssGridSafeNumValves = Math.max(1, numValves);
    return (
        <div className="w-full h-full grid p-1" style={{ gridTemplateColumns: `repeat(${cssGridSafeNumValves}, 1fr)`, gridTemplateRows: `repeat(${cssGridSafeTimeSteps}, 1fr)`, gap: '1px' }}>
            {Array.from({ length: numTimeSteps }).map((_, timeIndex) => (
                <React.Fragment key={timeIndex}>
                {Array.from({ length: numValves }).map((_, valveIndex) => (
                    <div key={`${timeIndex}-${valveIndex}`} className="min-w-0 min-h-0" style={{
                        backgroundColor: patternData[timeIndex]?.[valveIndex] ? 'hsl(var(--primary))' : 'hsl(var(--border) / 0.1)',
                        boxShadow: patternData[timeIndex]?.[valveIndex] ? '0 0 1px hsl(var(--primary))' : 'none',
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
       <canvas ref={canvasRef} width="300" height="150" className="w-full h-full"></canvas>
    </div>
  );
}