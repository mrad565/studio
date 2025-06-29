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
import { Input } from "./ui/input";
import { PatternVisualizer } from "./pattern-visualizer";
import type { Pattern } from "@/types";
import { Pause, Play } from "lucide-react";

type LivePreviewDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  pattern: Pattern;
};

export function LivePreviewDialog({ isOpen, setIsOpen, pattern }: LivePreviewDialogProps) {
  const [speed, setSpeed] = useState(100); // delay in ms, so lower is faster
  const [isPlaying, setIsPlaying] = useState(true);
  const [color, setColor] = useState("#7DF9FF"); // Default to primary color

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl bg-background border-primary/30">
        <DialogHeader>
          <DialogTitle className="text-primary font-headline text-2xl truncate">Live Preview: {pattern.name}</DialogTitle>
          <DialogDescription>
            Visualize the pattern, adjust its speed, and change the color.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
            <div className="aspect-video bg-card/50 rounded-lg p-4 border border-border flex items-center justify-center">
                <PatternVisualizer patternData={pattern.patternData} speed={speed} isPlaying={isPlaying} color={color} />
            </div>
            <div className="grid gap-4 pt-4">
                <div className="grid gap-2">
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
                 <div className="flex items-center justify-center gap-8 pt-4">
                    <div className="flex flex-col items-center gap-2">
                        <Label className="text-muted-foreground">Playback</Label>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="h-12 w-12 rounded-full border-accent text-accent hover:bg-accent/20 hover:text-accent"
                            aria-label={isPlaying ? "Pause" : "Play"}
                        >
                            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                        </Button>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <Label htmlFor="color-picker" className="text-muted-foreground">Color</Label>
                        <Input
                            id="color-picker"
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="w-12 h-12 p-1 bg-transparent border-border rounded-full cursor-pointer"
                        />
                    </div>
                </div>
            </div>
        </div>
        <DialogFooter>
            <Button onClick={() => setIsOpen(false)} variant="outline" className="border-accent text-accent hover:bg-accent/20 hover:text-accent">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
