"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Pattern } from "@/types";
import { FileCode, ImageIcon, Loader2, PenSquare, Settings2, TextIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { ManualPatternEditorDialog } from "./manual-pattern-editor-dialog";

// --- Algorithmic Pattern Generators ---

function canvasToPattern(canvas: HTMLCanvasElement): boolean[][] {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get canvas context');
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const pattern: boolean[][] = [];

    for (let y = 0; y < canvas.height; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < canvas.width; x++) {
            const index = (y * canvas.width + x) * 4;
            const alpha = data[index + 3];
            // If a pixel is more than 50% opaque, consider it "on"
            row.push(alpha > 128);
        }
        pattern.push(row);
    }
    // The pattern is read from the canvas top-to-bottom.
    return pattern;
}

function processImage(file: File, numValves: number): Promise<boolean[][]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (!e.target?.result) return reject(new Error("Failed to read file"));
            const img = new Image();
            img.onload = () => {
                const aspectRatio = img.height / img.width;
                const height = Math.max(1, Math.round(numValves * aspectRatio));

                const canvas = document.createElement('canvas');
                canvas.width = numValves;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Could not get canvas context'));
                
                ctx.drawImage(img, 0, 0, numValves, height);
                resolve(canvasToPattern(canvas));
            };
            img.onerror = () => reject(new Error("The selected image file could not be loaded. It may be corrupt or in an unsupported format."));
            img.src = e.target.result as string;
        };
        reader.onerror = () => reject(new Error("Failed to read the selected file."));
        reader.readAsDataURL(file);
    });
}

function processSvg(svgString: string, numValves: number): Promise<boolean[][]> {
    return new Promise((resolve, reject) => {
        try {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
            const svgElement = svgDoc.documentElement;

            if (svgElement.querySelector('parsererror') || svgElement.tagName.toLowerCase() === 'html') {
                 return reject(new Error("Failed to parse SVG. The file might be corrupt or not a valid SVG."));
            }

            const viewBox = svgElement.getAttribute('viewBox');
            let aspectRatio: number;

            if (viewBox) {
                const parts = viewBox.split(/[ ,]+/);
                if (parts.length === 4) {
                    const vbWidth = parseFloat(parts[2]);
                    const vbHeight = parseFloat(parts[3]);
                    aspectRatio = (vbWidth > 0 && vbHeight > 0) ? (vbHeight / vbWidth) : 1;
                } else {
                    aspectRatio = 1; 
                }
            } else {
                const widthAttr = svgElement.getAttribute('width');
                const heightAttr = svgElement.getAttribute('height');
                if (widthAttr && heightAttr) {
                    const w = parseFloat(widthAttr);
                    const h = parseFloat(heightAttr);
                    aspectRatio = (w > 0 && h > 0) ? h / w : 1;
                } else {
                    aspectRatio = 1;
                }
            }
             if (isNaN(aspectRatio)) aspectRatio = 1;

            const height = Math.max(1, Math.round(numValves * aspectRatio));

            svgElement.setAttribute('width', `${numValves}px`);
            svgElement.setAttribute('height', `${height}px`);
            svgElement.setAttribute('preserveAspectRatio', 'none');

            const serializer = new XMLSerializer();
            const sizedSvgString = serializer.serializeToString(svgElement);

            const svgBlob = new Blob([sizedSvgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = numValves;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    URL.revokeObjectURL(url);
                    return reject(new Error('Could not get canvas context'));
                }

                ctx.drawImage(img, 0, 0, numValves, height);
                URL.revokeObjectURL(url);
                resolve(canvasToPattern(canvas));
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("The selected SVG file could not be rendered. It may be corrupt or contain unsupported features."));
            };
            img.src = url;
        } catch (error) {
             if (error instanceof Error) {
                reject(error);
            } else {
                reject(new Error("An unknown error occurred while processing the SVG."));
            }
        }
    });
}


function processText(text: string, numValves: number): Promise<boolean[][]> {
    return new Promise((resolve, reject) => {
        const PADDING = 8;
        const FONT_SIZE = numValves;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));

        ctx.font = `${FONT_SIZE}px "Inter"`;
        const textMetrics = ctx.measureText(text);
        
        const textWidth = textMetrics.width;
        const finalFontSize = Math.min(FONT_SIZE, (numValves - PADDING) * FONT_SIZE / textWidth);
        
        ctx.font = `${finalFontSize}px "Inter"`;
        const finalMetrics = ctx.measureText(text);
        const finalHeight = finalMetrics.actualBoundingBoxAscent + finalMetrics.actualBoundingBoxDescent;

        canvas.width = numValves;
        canvas.height = Math.ceil(finalHeight) + PADDING;
        
        ctx.font = `${finalFontSize}px "Inter"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'black'; 
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        
        resolve(canvasToPattern(canvas));
    });
}

// --- End of Generators ---

const textSchema = z.object({
  textPrompt: z.string().min(1, "Prompt cannot be empty."),
  numValves: z.coerce.number().int().min(8, "Must have at least 8 valves.").refine(
    (n) => n % 8 === 0,
    { message: "Number of valves must be a multiple of 8." }
  ),
});

const imageSchema = z.object({
  image: z.any().refine(fileList => fileList?.length > 0, "Image is required."),
  numValves: z.coerce.number().int().min(8, "Must have at least 8 valves.").refine(
    (n) => n % 8 === 0,
    { message: "Number of valves must be a multiple of 8." }
  ),
});

const svgSchema = z.object({
  svg: z.any().refine(fileList => fileList?.length > 0, "SVG file is required."),
  numValves: z.coerce.number().int().min(8, "Must have at least 8 valves.").refine(
    (n) => n % 8 === 0,
    { message: "Number of valves must be a multiple of 8." }
  ),
});

type PatternGeneratorProps = {
  addPattern: (pattern: Omit<Pattern, 'id'>) => void;
};

export function PatternGenerator({ addPattern }: PatternGeneratorProps) {
  const [activeTab, setActiveTab] = useState("text");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isManualEditorOpen, setIsManualEditorOpen] = useState(false);
  const { toast } = useToast();

  const textForm = useForm<z.infer<typeof textSchema>>({
    resolver: zodResolver(textSchema),
    defaultValues: { textPrompt: "", numValves: 16 },
  });

  const imageForm = useForm<z.infer<typeof imageSchema>>({
    resolver: zodResolver(imageSchema),
    defaultValues: { numValves: 16 },
  });
  
  const svgForm = useForm<z.infer<typeof svgSchema>>({
    resolver: zodResolver(svgSchema),
    defaultValues: { numValves: 16 },
  });


  const handleTextSubmit = async (values: z.infer<typeof textSchema>) => {
    setIsGenerating(true);
    try {
      const result = await processText(values.textPrompt, values.numValves);
      if (result && result.length > 0 && result[0].length > 0) {
        addPattern({
          name: values.textPrompt.substring(0, 30) + (values.textPrompt.length > 30 ? "..." : ""),
          patternData: result,
          source: 'text',
          promptOrFile: values.textPrompt,
        });
        toast({ title: "Success", description: "New text pattern generated!" });
        textForm.reset({ ...values, textPrompt: "" });
      } else {
        throw new Error("Failed to generate pattern from text");
      }
    } catch (error: any) {
      console.error(error);
      const description = error.message || "Failed to generate pattern from text.";
      toast({ variant: "destructive", title: "Error", description });
    } finally {
      setIsGenerating(false);
    }
  };

  const toText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const handleImageSubmit = async (values: z.infer<typeof imageSchema>) => {
    setIsGenerating(true);
    try {
      const file = values.image[0];
      const result = await processImage(file, values.numValves);

      if (result) {
        addPattern({
          name: file.name,
          patternData: result,
          source: 'image',
          promptOrFile: file.name,
        });
        toast({ title: "Success", description: "New image pattern generated!" });
        imageForm.reset({ ...values, image: null });
      } else {
        throw new Error("Failed to process image");
      }
    } catch (error: any) {
      console.error(error);
      const description = error.message || "Failed to generate pattern from image.";
      toast({ variant: "destructive", title: "Error", description });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSvgSubmit = async (values: z.infer<typeof svgSchema>) => {
    setIsGenerating(true);
    try {
      const file = values.svg[0];
      const svgData = await toText(file);
      const result = await processSvg(svgData, values.numValves);

      if (result) {
        addPattern({
          name: file.name,
          patternData: result,
          source: 'svg',
          promptOrFile: file.name,
        });
        toast({ title: "Success", description: "New SVG pattern generated!" });
        svgForm.reset({ ...values, svg: null });
      } else {
        throw new Error("Failed to process SVG");
      }
    } catch (error: any) {
      console.error(error);
      const description = error.message || "Please check the file and try again.";
      toast({ variant: "destructive", title: "Error generating from SVG", description });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
    <Card className="bg-card border-border shadow-2xl shadow-black/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary font-headline">
          <Settings2 className="h-6 w-6" />
          Pattern Generator
        </CardTitle>
        <CardDescription>Create waterfall designs from text, images, SVGs, or from scratch.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-secondary">
            <TabsTrigger value="text" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg gap-2">
              <TextIcon /> Text
            </TabsTrigger>
            <TabsTrigger value="image" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg gap-2">
              <ImageIcon /> Image
            </TabsTrigger>
            <TabsTrigger value="svg" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg gap-2">
              <FileCode /> SVG
            </TabsTrigger>
            <TabsTrigger value="manual" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg gap-2">
                <PenSquare /> Manual
            </TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="mt-6">
            <Form {...textForm}>
              <form onSubmit={textForm.handleSubmit(handleTextSubmit)} className="space-y-6">
                <FormField
                  control={textForm.control}
                  name="textPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Text Prompt</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g., Hello World, AquaGlyph..." {...field} className="bg-input border-border focus:ring-primary min-h-[100px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={textForm.control}
                  name="numValves"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Number of Valves</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} className="bg-input border-border focus:ring-primary" step="8" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isGenerating} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg py-6">
                  {isGenerating ? <Loader2 className="animate-spin" /> : "Generate Pattern"}
                </Button>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="image" className="mt-6">
            <Form {...imageForm}>
              <form onSubmit={imageForm.handleSubmit(handleImageSubmit)} className="space-y-6">
                 <FormField
                    control={imageForm.control}
                    name="image"
                    render={({ field: { onChange, value, ...rest } }) => (
                      <FormItem>
                         <FormLabel className="text-muted-foreground">Upload Image</FormLabel>
                         <FormControl>
                           <Input type="file" accept="image/*" onChange={(e) => onChange(e.target.files)} {...rest} className="text-muted-foreground file:text-primary file:font-bold bg-input border-border file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-primary/20 hover:file:bg-primary/30" />
                         </FormControl>
                         <FormMessage />
                      </FormItem>
                    )}
                  />
                <FormField
                  control={imageForm.control}
                  name="numValves"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Number of Valves</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} className="bg-input border-border focus:ring-primary" step="8" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isGenerating} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg py-6">
                  {isGenerating ? <Loader2 className="animate-spin" /> : "Generate Pattern"}
                </Button>
              </form>
            </Form>
          </TabsContent>
           <TabsContent value="svg" className="mt-6">
            <Form {...svgForm}>
              <form onSubmit={svgForm.handleSubmit(handleSvgSubmit)} className="space-y-6">
                 <FormField
                    control={svgForm.control}
                    name="svg"
                    render={({ field: { onChange, value, ...rest } }) => (
                      <FormItem>
                         <FormLabel className="text-muted-foreground">Upload SVG</FormLabel>
                         <FormControl>
                           <Input type="file" accept="image/svg+xml" onChange={(e) => onChange(e.target.files)} {...rest} className="text-muted-foreground file:text-primary file:font-bold bg-input border-border file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-primary/20 hover:file:bg-primary/30" />
                         </FormControl>
                         <FormMessage />
                      </FormItem>
                    )}
                  />
                <FormField
                  control={svgForm.control}
                  name="numValves"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Number of Valves</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} className="bg-input border-border focus:ring-primary" step="8" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isGenerating} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg py-6">
                  {isGenerating ? <Loader2 className="animate-spin" /> : "Generate Pattern"}
                </Button>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="manual" className="mt-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center p-8 border-2 border-dashed border-border/50 rounded-lg bg-card/50 h-full">
                <h3 className="text-lg font-semibold text-foreground">Create Your Own Pattern</h3>
                <p className="text-muted-foreground">
                    Use the grid editor to design a custom water curtain pattern from scratch.
                </p>
                <Button onClick={() => setIsManualEditorOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                    Open Manual Editor
                </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
    <ManualPatternEditorDialog
        isOpen={isManualEditorOpen}
        setIsOpen={setIsManualEditorOpen}
        addPattern={addPattern}
        initialNumValves={textForm.getValues("numValves")}
    />
    </>
  );
}
