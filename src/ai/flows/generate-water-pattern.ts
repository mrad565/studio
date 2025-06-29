'use server';

/**
 * @fileOverview AI flow to generate water curtain patterns from text prompts.
 *
 * - generateWaterPattern - A function that generates water curtain patterns from text.
 * - GenerateWaterPatternInput - The input type for the generateWaterPattern function.
 * - GenerateWaterPatternOutput - The return type for the generateWaterPattern function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateWaterPatternInputSchema = z.object({
  textPrompt: z.string().describe('The text prompt to generate the water curtain pattern from.'),
  numValves: z.number().int().positive().describe('The number of valves in the water curtain.'),
});
export type GenerateWaterPatternInput = z.infer<typeof GenerateWaterPatternInputSchema>;

const GenerateWaterPatternOutputSchema = z.object({
  patternData: z
    .array(z.array(z.boolean()))
    .describe('A 2D array representing the water curtain pattern. Each inner array represents a column of valves, and each boolean represents whether the valve is open (true) or closed (false).'),
});
export type GenerateWaterPatternOutput = z.infer<typeof GenerateWaterPatternOutputSchema>;

export async function generateWaterPattern(input: GenerateWaterPatternInput): Promise<GenerateWaterPatternOutput> {
  return generateWaterPatternFlow(input);
}

const patternPrompt = ai.definePrompt({
  name: 'waterCurtainPatternPrompt',
  input: {schema: GenerateWaterPatternInputSchema},
  output: {schema: GenerateWaterPatternOutputSchema},
  prompt: `You are an expert in designing patterns for digital water curtains.

  Based on the text prompt provided by the user, generate a 2D array representing the water curtain pattern. Each inner array represents a column of valves, and each boolean represents whether the valve is open (true) or closed (false).
  The water curtain has {{numValves}} valves.
  The generated pattern should be visually appealing and suitable for display on a water curtain.
  The number of inner arrays determines the duration of the animation. The number of booleans in each inner array should correspond to the number of valves.

  Text Prompt: {{{textPrompt}}}
  
  Return the patternData in the required JSON format.
  `,
});

const generateWaterPatternFlow = ai.defineFlow(
  {
    name: 'generateWaterPatternFlow',
    inputSchema: GenerateWaterPatternInputSchema,
    outputSchema: GenerateWaterPatternOutputSchema,
  },
  async input => {
    const {output} = await patternPrompt(input);
    return output!;
  }
);
