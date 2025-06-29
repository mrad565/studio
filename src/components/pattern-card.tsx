"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LivePreviewDialog } from "./live-preview-dialog";
import { PatternVisualizer } from "./pattern-visualizer";
import type { Pattern } from "@/types";
import { FileCode, ImageIcon, TextIcon, Trash2, PenSquare } from "lucide-react";

type PatternCardProps = {
  pattern: Pattern;
  deletePattern: (id: string) => void;
};

export function PatternCard({ pattern, deletePattern }: PatternCardProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const getSourceIcon = () => {
    switch(pattern.source) {
      case 'image': return <ImageIcon className="h-4 w-4" />;
      case 'svg': return <FileCode className="h-4 w-4" />;
      case 'manual': return <PenSquare className="h-4 w-4" />;
      case 'text':
      default:
        return <TextIcon className="h-4 w-4" />;
    }
  }

  return (
    <>
      <Card className="h-full flex flex-col justify-between bg-card/50 border-primary/20 hover:border-primary/50 transition-colors shadow-md hover:shadow-primary/20 hover:shadow-lg">
        <CardHeader className="relative">
          <CardTitle className="flex items-start justify-between">
            <span className="truncate text-base font-semibold text-foreground pr-8">{pattern.name}</span>
          </CardTitle>
          <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deletePattern(pattern.id)}>
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete pattern</span>
            </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            {getSourceIcon()}
            <span className="capitalize">{pattern.source}</span>
          </div>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center p-2">
            <div className="w-full aspect-square bg-background/50 rounded-md overflow-hidden border border-border">
                <PatternVisualizer patternData={pattern.patternData} isPlaying={false} />
            </div>
        </CardContent>
        <CardFooter className="p-4">
          <Button onClick={() => setIsPreviewOpen(true)} className="w-full bg-primary/20 hover:bg-primary/30 text-primary font-bold border border-primary/30">
            Live Preview
          </Button>
        </CardFooter>
      </Card>
      <LivePreviewDialog
        isOpen={isPreviewOpen}
        setIsOpen={setIsPreviewOpen}
        pattern={pattern}
      />
    </>
  );
}
