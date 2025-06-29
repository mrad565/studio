"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { PatternVisualizer } from "./pattern-visualizer";
import { CodeDisplay } from "./code-display";
import type { Pattern } from "@/types";

type LivePreviewDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  pattern: Pattern;
};

export function LivePreviewDialog({ isOpen, setIsOpen, pattern }: LivePreviewDialogProps) {
  const [speed, setSpeed] = useState(100); // delay in ms, so lower is faster

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col bg-background border-primary/30">
        <DialogHeader>
          <DialogTitle className="text-primary font-headline text-2xl truncate">Live Preview: {pattern.name}</DialogTitle>
          <DialogDescription>
            Visualize the pattern and adjust its speed. The generated ESP32 code is also available.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 py-4">
            <div className="flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-foreground">Visualization</h3>
                <div className="aspect-video bg-card/50 rounded-lg p-4 border border-border flex items-center justify-center">
                    <PatternVisualizer patternData={pattern.patternData} speed={speed} />
                </div>
                <div className="grid gap-2 pt-4">
                    <Label htmlFor="speed" className="text-muted-foreground">Animation Speed</Label>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-foreground">Slow</span>
                        <Slider
                            id="speed"
                            min={20}
                            max={500}
                            step={10}
                            value={[520 - speed]} // Invert so right is faster
                            onValueChange={(value) => setSpeed(520 - value[0])}
                            className="[&>span:first-child>span]:bg-accent"
                        />
                        <span className="text-sm text-foreground">Fast</span>
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-4 min-h-0">
                 <h3 className="text-lg font-semibold text-foreground">ESP32 Code</h3>
                <CodeDisplay code={pattern.esp32Code} />
            </div>
        </div>
        <DialogFooter>
            <Button onClick={() => setIsOpen(false)} variant="outline" className="border-accent text-accent hover:bg-accent/20 hover:text-accent">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
