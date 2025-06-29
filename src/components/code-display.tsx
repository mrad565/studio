"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Check, Clipboard } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";

type CodeDisplayProps = {
  code: string;
};

export function CodeDisplay({ code }: CodeDisplayProps) {
  const [hasCopied, setHasCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="relative h-full bg-card/50 rounded-lg border border-border flex flex-col">
       <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:bg-primary/20 hover:text-primary z-10"
        onClick={copyToClipboard}
        aria-label="Copy code"
       >
        {hasCopied ? <Check className="h-5 w-5 text-accent" /> : <Clipboard className="h-5 w-5" />}
       </Button>
       <ScrollArea className="h-full w-full rounded-lg">
        <pre className="text-xs text-foreground/80 font-code whitespace-pre-wrap p-4">
          <code>
            {code}
          </code>
        </pre>
       </ScrollArea>
    </div>
  );
}
