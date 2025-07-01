import { Droplets, Wifi, WifiOff } from 'lucide-react';

type AppHeaderProps = {
  isConnected: boolean;
};

export function AppHeader({ isConnected }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between p-4 border-b border-border/50 shadow-lg shadow-black/25">
      <div className="flex items-center gap-3">
        <Droplets className="h-8 w-8 text-primary animate-pulse" />
        <h1 className="text-3xl font-bold text-foreground font-headline tracking-wider">
          Digital Water Curtain
        </h1>
      </div>
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
          isConnected ? 'bg-accent/20 text-accent' : 'bg-destructive/20 text-destructive'
        }`}
      >
        {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        <span>{isConnected ? 'Connected' : 'Not Connected'}</span>
      </div>
    </header>
  );
}
