'use server';
/**
 * @fileOverview An AI agent that generates water curtain patterns from SVG files.
 *
 * - generatePatternFromSvg - A function that handles the pattern generation process.
 * - GeneratePatternFromSvgInput - The input type for the generatePatternFromSvg function.
 * - GeneratePatternFromSvgOutput - The return type for the generatePatternFromSvg function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePatternFromSvgInputSchema = z.object({
  svgData: z
    .string()
    .describe(
      "The raw string content of an SVG file to use as a pattern."
    ),
  numValves: z.number().describe('The number of valves in the water curtain.'),
});
export type GeneratePatternFromSvgInput = z.infer<typeof GeneratePatternFromSvgInputSchema>;

const GeneratePatternFromSvgOutputSchema = z.object({
  patternData: z.array(z.array(z.boolean())).describe('The generated pattern data as a 2D array of booleans.'),
});
export type GeneratePatternFromSvgOutput = z.infer<typeof GeneratePatternFromSvgOutputSchema>;

export async function generatePatternFromSvg(input: GeneratePatternFromSvgInput): Promise<GeneratePatternFromSvgOutput> {
  return generatePatternFromSvgFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePatternFromSvgPrompt',
  input: {schema: GeneratePatternFromSvgInputSchema},
  output: {schema: GeneratePatternFromSvgOutputSchema},
  prompt: `You are an AI that generates patterns for a digital water curtain from SVG vector files.

The water curtain has {{{numValves}}} valves.

You will receive an SVG file content and must convert its vector graphics into a pattern suitable for display on the water curtain.

Consider the limitations of the water curtain when generating the pattern. It has a limited resolution, with the number of valves specified by the user.
Thus, it is important to convert the vector image to a low-resolution equivalent appropriate for the output.

Here is the SVG content:
{{{svgData}}}

Output the pattern data as a JSON 2D array of booleans. Each inner array represents a column of valves, and each boolean represents whether the valve is open (true) or closed (false).
The number of inner arrays determines the duration of the animation. The number of booleans in each inner array should correspond to the number of valves.`,
});

const generatePatternFromSvgFlow = ai.defineFlow(
  {
    name: 'generatePatternFromSvgFlow',
    inputSchema: GeneratePatternFromSvgInputSchema,
    outputSchema: GeneratePatternFromSvgOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
