"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { Pattern } from "@/types";
import { Eraser, Save } from "lucide-react";

type ManualPatternEditorDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  addPattern: (pattern: Omit<Pattern, 'id'>) => void;
  initialNumValves: number;
};

const MAX_ROWS = 100;

export function ManualPatternEditorDialog({
  isOpen,
  setIsOpen,
  addPattern,
  initialNumValves,
}: ManualPatternEditorDialogProps) {
  const [name, setName] = useState("My Manual Pattern");
  const [rows, setRows] = useState(16);
  const [cols, setCols] = useState(initialNumValves);
  const [grid, setGrid] = useState<boolean[][]>([]);
  const { toast } = useToast();

  const [isMouseDown, setIsMouseDown] = useState(false);
  const [drawMode, setDrawMode] = useState<'draw' | 'erase' | null>(null);

  useEffect(() => {
    if (isOpen) {
        setCols(initialNumValves);
        setRows(16);
        setName("My Manual Pattern");
    }
  }, [isOpen, initialNumValves]);

  useEffect(() => {
    const safeRows = Math.max(1, Math.min(rows, MAX_ROWS));
    const safeCols = Math.max(8, cols);
    setGrid(Array.from({ length: safeRows }, () => Array(safeCols).fill(false)));
  }, [rows, cols, isOpen]);

  // Global mouse up handler to stop drawing
  useEffect(() => {
    const handleMouseUp = () => {
        setIsMouseDown(false);
        setDrawMode(null);
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => {
        window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);
  
  const handleCellMouseDown = (rowIndex: number, colIndex: number) => {
    setIsMouseDown(true);
    const newGrid = grid.map((row) => [...row]);
    const newCellState = !newGrid[rowIndex][colIndex];
    newGrid[rowIndex][colIndex] = newCellState;
    setGrid(newGrid);
    setDrawMode(newCellState ? 'draw' : 'erase');
  };

  const handleCellMouseEnter = (rowIndex: number, colIndex: number) => {
    if (!isMouseDown || !drawMode) return;

    const newGrid = grid.map((row) => [...row]);
    const shouldBeDrawn = drawMode === 'draw';
    
    if (newGrid[rowIndex][colIndex] !== shouldBeDrawn) {
        newGrid[rowIndex][colIndex] = shouldBeDrawn;
        setGrid(newGrid);
    }
  };


  const handleSave = () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Pattern name is required." });
      return;
    }
    const safeRows = Math.max(1, Math.min(rows, MAX_ROWS));
    if (safeRows < 1 || cols < 8 || cols % 8 !== 0) {
      toast({ variant: "destructive", title: "Error", description: "Columns (valves) must be at least 8 and a multiple of 8." });
      return;
    }

    addPattern({
      name,
      patternData: grid,
      source: "manual",
      promptOrFile: `${safeRows}x${cols} grid`,
    });
    toast({ title: "Success", description: "Manual pattern saved!" });
    setIsOpen(false);
  };

  const handleClear = () => {
    setGrid(Array.from({ length: rows }, () => Array(cols).fill(false)));
  };

  const gridStyles = useMemo(() => ({
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  }), [cols, rows]);


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl bg-background border-primary/30">
        <DialogHeader>
          <DialogTitle className="text-primary font-headline text-2xl">Manual Pattern Editor</DialogTitle>
          <DialogDescription>
            Click and drag to create your own pattern. Define the dimensions and give it a name.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid md:grid-cols-3 gap-6 py-4">
          <div className="md:col-span-1 flex flex-col gap-4">
            <div>
                <Label htmlFor="pattern-name" className="text-muted-foreground">Pattern Name</Label>
                <Input id="pattern-name" value={name} onChange={(e) => setName(e.target.value)} className="bg-card border-border" />
            </div>
            <div>
                <Label htmlFor="pattern-rows" className="text-muted-foreground">Rows (Time Steps)</Label>
                <Input id="pattern-rows" type="number" value={rows} onChange={(e) => setRows(Math.min(Number(e.target.value), MAX_ROWS))} min="1" max={MAX_ROWS} className="bg-card border-border" />
            </div>
            <div>
                <Label htmlFor="pattern-cols" className="text-muted-foreground">Columns (Valves)</Label>
                <Input id="pattern-cols" type="number" value={cols} onChange={(e) => setCols(Number(e.target.value))} min="8" step="8" className="bg-card border-border" />
            </div>
            <div className="flex flex-col gap-2 pt-4">
                 <Button onClick={handleClear} variant="outline" className="border-accent text-accent hover:bg-accent/20 hover:text-accent">
                    <Eraser className="mr-2 h-4 w-4" />
                    Clear Grid
                </Button>
                <Button onClick={handleSave} className="bg-accent hover:bg-accent/80 text-black font-bold">
                    <Save className="mr-2 h-4 w-4" />
                    Save Pattern
                </Button>
            </div>
          </div>
          <div className="md:col-span-2 bg-card/50 rounded-lg p-2 border border-border aspect-video">
            <ScrollArea className="w-full h-full">
              <div
                className="grid gap-px p-1"
                style={gridStyles}
                onMouseLeave={() => setIsMouseDown(false)}
              >
                {grid.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <button
                      key={`${rowIndex}-${colIndex}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleCellMouseDown(rowIndex, colIndex);
                      }}
                      onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                      className={`w-full aspect-square rounded-sm transition-colors ${
                        cell ? "bg-primary hover:bg-primary/80" : "bg-background hover:bg-border"
                      }`}
                      aria-label={`Cell ${rowIndex}, ${colIndex}`}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => setIsOpen(false)} variant="ghost">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
