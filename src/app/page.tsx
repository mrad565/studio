"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { PatternGenerator } from "@/components/pattern-generator";
import { PatternGrid } from "@/components/pattern-grid";
import type { Pattern } from "@/types";

export default function Home() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [draggedItem, setDraggedItem] = useState<Pattern | null>(null);

  const addPattern = (newPattern: Omit<Pattern, 'id'>) => {
    setPatterns(prev => [...prev, { ...newPattern, id: crypto.randomUUID() }]);
  };

  const deletePattern = (id: string) => {
    setPatterns(prev => prev.filter(p => p.id !== id));
  };
  
  const handleDragStart = (pattern: Pattern) => {
    setDraggedItem(pattern);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); 
  };

  const handleDrop = (targetPattern: Pattern) => {
    if (!draggedItem || draggedItem.id === targetPattern.id) return;

    const dragIndex = patterns.findIndex(p => p.id === draggedItem.id);
    const targetIndex = patterns.findIndex(p => p.id === targetPattern.id);

    if (dragIndex !== -1 && targetIndex !== -1) {
      setPatterns(prev => {
        const newPatterns = [...prev];
        const [dragged] = newPatterns.splice(dragIndex, 1);
        newPatterns.splice(targetIndex, 0, dragged);
        return newPatterns;
      });
    }
    setDraggedItem(null);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <AppHeader />
      <main className="flex flex-1 flex-col md:flex-row gap-8 p-4 md:p-8">
        <div className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0">
          <PatternGenerator addPattern={addPattern} />
        </div>
        <div className="w-full flex-1">
          <PatternGrid
            patterns={patterns}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            deletePattern={deletePattern}
          />
        </div>
      </main>
    </div>
  );
}
