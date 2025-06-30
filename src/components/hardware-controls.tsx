"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import type { Pattern } from "@/types";
import { Pause, Play, Rss, UploadCloud, X, Zap, ZapOff } from "lucide-react";

type HardwareControlsProps = {
  patterns: Pattern[];
};

export function HardwareControls({ patterns }: HardwareControlsProps) {
  const [ipAddress, setIpAddress] = useState("192.168.1.100");
  const [isConnected, setIsConnected] = useState(false);
  const [speed, setSpeed] = useState(100);
  const [color, setColor] =useState("#7DF9FF");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Cleanup WebSocket on component unmount
    return () => {
      ws.current?.close();
    };
  }, []);

  const handleConnect = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.close();
      return;
    }
    
    if (!ipAddress) {
      toast({ variant: "destructive", title: "Error", description: "Please enter the ESP32 IP address." });
      return;
    }
    
    ws.current = new WebSocket(`ws://${ipAddress}/ws`);
    
    ws.current.onopen = () => {
      console.log("WebSocket Connected");
      setIsConnected(true);
      toast({ title: "Success", description: "Connected to AquaGlyph hardware!" });
      // On connect, sync initial color
      ws.current?.send(JSON.stringify({ action: "color", value: color }));
    };

    ws.current.onclose = () => {
      console.log("WebSocket Disconnected");
      setIsConnected(false);
      setIsPlaying(false);
      toast({ variant: "destructive", title: "Disconnected", description: "Connection to hardware lost." });
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket Error:", error);
      setIsConnected(false);
      setIsPlaying(false);
      toast({ variant: "destructive", title: "Connection Failed", description: "Could not connect to the specified IP address." });
    };
  };

  const sendCommand = (command: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(command));
    } else {
       toast({ variant: "destructive", title: "Not Connected", description: "Connect to the hardware first." });
    }
  };

  const handleSpeedChange = (value: number[]) => {
    const newSpeed = 520 - value[0];
    setSpeed(newSpeed);
    sendCommand({ action: "speed", value: newSpeed });
  };
  
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColor(e.target.value);
    sendCommand({ action: "color", value: e.target.value });
  };

  const handlePlayPause = () => {
    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying);
    sendCommand({ action: newIsPlaying ? "play" : "pause" });
  };
  
  const handleUploadSequence = () => {
    if (patterns.length === 0) {
        toast({ variant: "destructive", title: "Empty Sequence", description: "Generate some patterns before uploading." });
        return;
    }
    setIsUploading(true);
    // Combine all patterns into a single giant pattern array
    const combinedPatternData = patterns.flatMap(p => p.patternData);

    sendCommand({ action: "load_pattern", pattern: combinedPatternData });
    toast({ title: "Sequence Uploaded", description: `Sent ${patterns.length} patterns to the hardware.` });
    
    // Reset play state after upload
    if (isPlaying) {
      setIsPlaying(false);
      sendCommand({ action: "pause" });
    }

    setTimeout(() => setIsUploading(false), 1000);
  };

  return (
    <Card className="bg-card border-border shadow-2xl shadow-black/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary font-headline">
          <Rss className="h-6 w-6" />
          Hardware Controls
        </CardTitle>
        <CardDescription>Connect to and control your physical AquaGlyph curtain.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
            <Label htmlFor="ip-address">ESP32 IP Address</Label>
            <div className="flex gap-2">
                <Input id="ip-address" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} placeholder="e.g., 192.168.1.100" className="bg-input border-border" disabled={isConnected} />
                <Button onClick={handleConnect} variant={isConnected ? "destructive" : "default"} className="w-[120px]">
                    {isConnected ? <><ZapOff /> Disconnect</> : <><Zap /> Connect</>}
                </Button>
            </div>
             <p className={`text-xs pl-1 ${isConnected ? 'text-accent' : 'text-muted-foreground'}`}>
                Status: {isConnected ? 'Connected' : 'Disconnected'}
            </p>
        </div>
        
        <div className={`space-y-6 transition-opacity ${!isConnected ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <div className="space-y-2">
                <Label htmlFor="speed">Animation Speed</Label>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-foreground">Slow</span>
                    <Slider
                        id="speed"
                        min={20}
                        max={500}
                        step={10}
                        value={[520 - speed]}
                        onValueChange={handleSpeedChange}
                        className="[&>span:first-child>span]:bg-accent"
                    />
                    <span className="text-sm text-foreground">Fast</span>
                </div>
            </div>
            
            <div className="flex items-center justify-around gap-4 pt-2">
                <div className="flex flex-col items-center gap-2">
                    <Label className="text-muted-foreground">Playback</Label>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handlePlayPause}
                        className="h-12 w-12 rounded-full border-accent text-accent hover:bg-accent/20 hover:text-accent"
                        aria-label={isPlaying ? "Pause" : "Play"}
                    >
                        {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                    </Button>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Label htmlFor="color-picker" className="text-muted-foreground">LED Color</Label>
                    <Input
                        id="color-picker"
                        type="color"
                        value={color}
                        onChange={handleColorChange}
                        className="w-12 h-12 p-1 bg-transparent border-border rounded-full cursor-pointer"
                    />
                </div>
            </div>

            <Button onClick={handleUploadSequence} className="w-full bg-accent hover:bg-accent/80 text-black font-bold text-lg py-6" disabled={isUploading}>
                <UploadCloud className="mr-2" />
                {isUploading ? 'Uploading...' : 'Upload Sequence to Curtain'}
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
