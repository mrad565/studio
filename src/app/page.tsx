// Remove the "use client" directive as it's not needed with Vite

import { useState, useEffect, useRef } from "react";
import { AppHeader } from "@/components/app-header";
import { PatternGenerator } from "@/components/pattern-generator";
import { PatternGrid } from "@/components/pattern-grid";
import { HardwareControls } from "@/components/hardware-controls";
import type { Pattern } from "@/types";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [draggedItem, setDraggedItem] = useState<Pattern | null>(null);

  // Lifted state from HardwareControls
  const [ipAddress, setIpAddress] = useState("192.168.4.1"); // Default to AP IP
  const [isConnected, setIsConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Cleanup WebSocket on component unmount
    return () => {
      ws.current?.close();
    };
  }, []);

  const sendCommand = (command: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(command));
      return true;
    } else {
       toast({ variant: "destructive", title: "Not Connected", description: "Connect to the hardware first." });
       return false;
    }
  };
  
  const handleConnect = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.close();
      return;
    }
    
    if (!ipAddress) {
      toast({ variant: "destructive", title: "Error", description: "Please enter the ESP32 IP address." });
      return;
    }
    
    // Default to AP IP if user clears it
    const targetIp = ipAddress || "192.168.4.1";

    ws.current = new WebSocket(`ws://${targetIp}/ws`);
    
    ws.current.onopen = () => {
      console.log("WebSocket Connected");
      setIsConnected(true);
      toast({ title: "Success", description: "Connected to Digital Water Curtain hardware!" });
    };

    ws.current.onclose = () => {
      console.log("WebSocket Disconnected");
      setIsConnected(false);
      toast({ variant: "destructive", title: "Disconnected", description: "Connection to hardware lost." });
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket Error:", error);
      setIsConnected(false);
      toast({ variant: "destructive", title: "Connection Failed", description: `Could not connect to ${targetIp}. Check IP and network.` });
    };
  };

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

  const handleUploadSequence = () => {
    if (patterns.length === 0) {
        toast({ variant: "destructive", title: "Empty Sequence", description: "Generate some patterns before uploading." });
        return;
    }
    setIsUploading(true);

    const numValves = patterns[0]?.patternData[0]?.length || 0;
    const numLeds = numValves; // LEDs = Valves
    if (numValves === 0) {
        toast({ variant: "destructive", title: "Invalid Pattern", description: "Cannot upload a pattern with zero valves." });
        setIsUploading(false);
        return;
    }

    // Send configuration first to allow ESP32 to re-initialize if needed
    if (!sendCommand({ action: "config", valves: numValves, leds: numLeds })) {
        setIsUploading(false);
        return;
    }
    
    // Give ESP32 a moment to process config before sending the large pattern
    setTimeout(() => {
        // Combine all patterns into a single giant pattern array
        const combinedPatternData = patterns.flatMap(p => p.patternData);

        sendCommand({ action: "load_pattern", pattern: combinedPatternData });
        toast({ title: "Sequence Uploaded", description: `Sent ${patterns.length} patterns (${numValves} valves) to the hardware.` });
        
        // Reset play state after upload
        sendCommand({ action: "pause" });

        setTimeout(() => setIsUploading(false), 500);
    }, 200);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background relative pb-16">
      <AppHeader isConnected={isConnected} />
      <main className="flex flex-1 flex-col xl:flex-row gap-8 p-4 md:p-8">
        <div className="w-full xl:w-[420px] xl:max-w-[420px] flex-shrink-0 flex flex-col gap-8">
          <PatternGenerator addPattern={addPattern} />
          <HardwareControls
            ipAddress={ipAddress}
            setIpAddress={setIpAddress}
            isConnected={isConnected}
            handleConnect={handleConnect}
            sendCommand={sendCommand}
            isUploading={isUploading}
            handleUploadSequence={handleUploadSequence}
          />
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
      <footer className="fixed bottom-0 left-0 right-0 p-2 text-center bg-card/80 backdrop-blur-sm border-t border-border/50 shadow-lg">
        <p className="text-sm text-muted-foreground">
          Digital Water Curtain Developed By <strong>JA3Jou3</strong> And <strong>Ehsen</strong>
        </p>
      </footer>
    </div>
  );
}
