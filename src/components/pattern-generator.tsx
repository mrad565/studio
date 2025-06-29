"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { generatePatternFromImage } from "@/ai/flows/generate-pattern-from-image";
import { generatePatternFromSvg } from "@/ai/flows/generate-pattern-from-svg";
import { generateWaterPattern } from "@/ai/flows/generate-water-pattern";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Pattern } from "@/types";
import { FileCode, ImageIcon, Loader2, PenSquare, Sparkles, TextIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { ManualPatternEditorDialog } from "./manual-pattern-editor-dialog";


const textSchema = z.object({
  textPrompt: z.string().min(10, "Prompt must be at least 10 characters long."),
  numValves: z.coerce.number().int().min(4, "Must have at least 4 valves.").max(64, "Cannot exceed 64 valves."),
});

const imageSchema = z.object({
  image: z.any().refine(fileList => fileList?.length > 0, "Image is required."),
  numValves: z.coerce.number().int().min(4, "Must have at least 4 valves.").max(64, "Cannot exceed 64 valves."),
});

const svgSchema = z.object({
  svg: z.any().refine(fileList => fileList?.length > 0, "SVG file is required."),
  numValves: z.coerce.number().int().min(4, "Must have at least 4 valves.").max(64, "Cannot exceed 64 valves."),
});

type PatternGeneratorProps = {
  addPattern: (pattern: Omit<Pattern, 'id'>) => void;
};

export function PatternGenerator({ addPattern }: PatternGeneratorProps) {
  const [activeTab, setActiveTab] = useState("text");
  const [isLoading, setIsLoading] = useState(false);
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
    setIsLoading(true);
    try {
      const result = await generateWaterPattern(values);
      if (result && result.patternData && result.patternData.length > 0 && result.patternData[0].length > 0) {
        addPattern({
          name: values.textPrompt.substring(0, 30) + (values.textPrompt.length > 30 ? "..." : ""),
          patternData: result.patternData,
          source: 'text',
          promptOrFile: values.textPrompt,
        });
        toast({ title: "Success", description: "New text pattern generated!" });
        textForm.reset({ ...values, textPrompt: "" });
      } else {
        throw new Error("Invalid response from AI");
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate pattern from text." });
    } finally {
      setIsLoading(false);
    }
  };

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });

  const toText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const handleImageSubmit = async (values: z.infer<typeof imageSchema>) => {
    setIsLoading(true);
    try {
      const file = values.image[0];
      const photoDataUri = await toBase64(file);

      const result = await generatePatternFromImage({
        photoDataUri,
        numValves: values.numValves,
      });

      if (result && result.patternData) {
        addPattern({
          name: file.name,
          patternData: result.patternData,
          source: 'image',
          promptOrFile: file.name,
        });
        toast({ title: "Success", description: "New image pattern generated!" });
        imageForm.reset({ ...values, image: null });
      } else {
        throw new Error("Invalid response from AI");
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate pattern from image." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSvgSubmit = async (values: z.infer<typeof svgSchema>) => {
    setIsLoading(true);
    try {
      const file = values.svg[0];
      const svgData = await toText(file);

      const result = await generatePatternFromSvg({
        svgData,
        numValves: values.numValves,
      });

      if (result && result.patternData) {
        addPattern({
          name: file.name,
          patternData: result.patternData,
          source: 'svg',
          promptOrFile: file.name,
        });
        toast({ title: "Success", description: "New SVG pattern generated!" });
        svgForm.reset({ ...values, svg: null });
      } else {
        throw new Error("Invalid response from AI");
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate pattern from SVG." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    <Card className="bg-card/50 border-primary/20 shadow-lg shadow-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary font-headline">
          <Sparkles className="h-6 w-6" />
          Pattern Generator
        </CardTitle>
        <CardDescription>Create waterfall designs from text, images, SVGs, or from scratch.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-background/50 border border-primary/20">
            <TabsTrigger value="text" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-inner data-[state=active]:shadow-primary/10 gap-2">
              <TextIcon /> Text
            </TabsTrigger>
            <TabsTrigger value="image" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-inner data-[state=active]:shadow-primary/10 gap-2">
              <ImageIcon /> Image
            </TabsTrigger>
            <TabsTrigger value="svg" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-inner data-[state=active]:shadow-primary/10 gap-2">
              <FileCode /> SVG
            </TabsTrigger>
            <TabsTrigger value="manual" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-inner data-[state=active]:shadow-primary/10 gap-2">
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
                      <FormLabel className="text-foreground/80">Text Prompt</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g., a shooting star, geometric shapes..." {...field} className="bg-background/50 border-primary/20 focus:ring-primary min-h-[100px]" />
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
                      <FormLabel className="text-foreground/80">Number of Valves</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} className="bg-background/50 border-primary/20 focus:ring-primary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLoading} className="w-full bg-accent hover:bg-accent/80 text-black font-bold text-lg py-6">
                  {isLoading ? <Loader2 className="animate-spin" /> : "Generate with AI"}
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
                         <FormLabel className="text-foreground/80">Upload Image</FormLabel>
                         <FormControl>
                           <Input type="file" accept="image/*" onChange={(e) => onChange(e.target.files)} {...rest} className="text-foreground/80 file:text-accent file:font-bold bg-background/50 border-primary/20 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-accent/20 file:text-accent hover:file:bg-accent/30" />
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
                      <FormLabel className="text-foreground/80">Number of Valves</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} className="bg-background/50 border-primary/20 focus:ring-primary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLoading} className="w-full bg-accent hover:bg-accent/80 text-black font-bold text-lg py-6">
                  {isLoading ? <Loader2 className="animate-spin" /> : "Generate with AI"}
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
                         <FormLabel className="text-foreground/80">Upload SVG</FormLabel>
                         <FormControl>
                           <Input type="file" accept="image/svg+xml" onChange={(e) => onChange(e.target.files)} {...rest} className="text-foreground/80 file:text-accent file:font-bold bg-background/50 border-primary/20 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-accent/20 file:text-accent hover:file:bg-accent/30" />
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
                      <FormLabel className="text-foreground/80">Number of Valves</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} className="bg-background/50 border-primary/20 focus:ring-primary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLoading} className="w-full bg-accent hover:bg-accent/80 text-black font-bold text-lg py-6">
                  {isLoading ? <Loader2 className="animate-spin" /> : "Generate with AI"}
                </Button>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="manual" className="mt-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center p-8 border-2 border-dashed border-primary/20 rounded-lg bg-card/20 h-full">
                <h3 className="text-lg font-semibold text-foreground">Create Your Own Pattern</h3>
                <p className="text-muted-foreground">
                    Use the grid editor to design a custom water curtain pattern from scratch.
                </p>
                <Button onClick={() => setIsManualEditorOpen(true)} className="bg-primary/80 hover:bg-primary text-primary-foreground font-bold">
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
