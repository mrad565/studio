import { Droplets } from 'lucide-react';

export function AppHeader() {
  return (
    <header className="flex items-center justify-between p-4 border-b border-border/50 shadow-lg shadow-black/25">
      <div className="flex items-center gap-3">
        <Droplets className="h-8 w-8 text-primary animate-pulse" />
        <h1 className="text-3xl font-bold text-foreground font-headline tracking-wider">
          AquaGlyph
        </h1>
      </div>
    </header>
  );
}
