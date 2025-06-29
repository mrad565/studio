"use client";

import { useEffect, useState, useRef } from "react";

type PatternVisualizerProps = {
  patternData: boolean[][];
  speed?: number; // delay in ms
  isPlaying: boolean;
};

export function PatternVisualizer({ patternData, speed = 100, isPlaying }: PatternVisualizerProps) {
  const [currentColumn, setCurrentColumn] = useState(0);
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();

  const numRows = patternData.length;
  const numCols = patternData[0]?.length || 0;

  const animate = (time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      if (deltaTime > speed) {
        setCurrentColumn(prev => (prev + 1) % numCols);
        previousTimeRef.current = time;
      }
    } else {
      previousTimeRef.current = time;
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isPlaying && numCols > 0) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if(requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
        previousTimeRef.current = undefined;
      }
    }
    
    return () => {
      if(requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying, speed, patternData, numCols]);

  useEffect(() => {
    // Reset animation when pattern data changes
    setCurrentColumn(0);
    previousTimeRef.current = undefined;
  }, [patternData]);


  if (numRows === 0) {
    return <div className="w-full h-full bg-transparent flex items-center justify-center text-muted-foreground text-xs">No pattern data</div>;
  }
  
  // This logic is for the static preview in the PatternCard
  if (!isPlaying) {
    const maxDim = Math.max(numRows, numCols);
    // When paused, show a static grid representation of the whole pattern
    return (
        <div className="w-full h-full grid p-1" style={{ gridTemplateColumns: `repeat(${numCols}, 1fr)`, gridTemplateRows: `repeat(${numRows}, 1fr)`, gap: '1px' }}>
            {Array.from({ length: numRows }).map((_, rowIndex) => (
                <>
                {Array.from({ length: numCols }).map((_, colIndex) => (
                    <div key={`${rowIndex}-${colIndex}`} className="min-w-0 min-h-0" style={{
                        backgroundColor: patternData[rowIndex]?.[colIndex] ? 'hsl(var(--primary))' : 'hsl(var(--border) / 0.1)',
                        boxShadow: patternData[rowIndex]?.[colIndex] ? '0 0 1px hsl(var(--primary))' : 'none',
                        borderRadius: '1px'
                    }}></div>
                ))}
                </>
            ))}
        </div>
    );
  }

  // This is for the live animated preview
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-wrap justify-center gap-1.5" style={{width: `calc(${Math.ceil(Math.sqrt(numRows))} * (0.75rem + 4px))`}}>
        {Array.from({ length: numRows }).map((_, valveIndex) => (
          <div key={valveIndex} className="w-3 h-3 rounded-full transition-all duration-100"
            style={{
              backgroundColor: patternData[valveIndex]?.[currentColumn] ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              boxShadow: patternData[valveIndex]?.[currentColumn] ? '0 0 5px hsl(var(--primary)), 0 0 10px hsl(var(--primary))' : 'none',
            }}
          ></div>
        ))}
      </div>
    </div>
  );
}
