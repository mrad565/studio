import type { Pattern } from "@/types";
import { PatternCard } from "./pattern-card";
import { GripVertical } from "lucide-react";

type PatternGridProps = {
  patterns: Pattern[];
  onDragStart: (pattern: Pattern) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (targetPattern: Pattern) => void;
  deletePattern: (id: string) => void;
};

export function PatternGrid({ patterns, onDragStart, onDragOver, onDrop, deletePattern }: PatternGridProps) {
  if (patterns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full rounded-lg border-2 border-dashed border-border/50 p-12 text-center bg-card/50">
        <h2 className="text-2xl font-bold text-foreground font-headline">Your Pattern Sequence</h2>
        <p className="mt-2 text-muted-foreground">
          Generate patterns from text or an image to start building your water curtain show.
        </p>
        <p className="mt-4 text-sm text-muted-foreground/50">
          Your generated patterns will appear here. You can drag and drop to reorder them.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
       <h2 className="text-3xl font-bold text-foreground font-headline">Pattern Sequence</h2>
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {patterns.map((pattern) => (
          <div
            key={pattern.id}
            draggable
            onDragStart={() => onDragStart(pattern)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(pattern)}
            className="relative group cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          >
            <div className="absolute top-1/2 -left-3 -translate-y-1/2 z-10 text-primary/50 opacity-0 group-hover:opacity-100 transition-opacity motion-safe:animate-pulse">
                <GripVertical />
            </div>
            <PatternCard pattern={pattern} deletePattern={deletePattern} />
          </div>
        ))}
       </div>
    </div>
  );
}
