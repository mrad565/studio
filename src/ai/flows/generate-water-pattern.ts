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
  esp32Code: z.string().describe('The generated ESP32 code to control the water curtain.'),
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

  Text Prompt: {{{textPrompt}}}
  
  Also generate the ESP32 code to control the water curtain based on the generated pattern. Use the following hardware pin definitions:
  SHIFT_DATA_PIN    13
  SHIFT_LATCH_PIN   12
  SHIFT_CLOCK_PIN   14
  LED_DATA_PIN      19
  NUM_VALVES should be defined from the interface web
  NUM_LEDS should be according the number valves

  Ensure that the generated code is efficient and well-commented, and that it can be easily integrated into an ESP32 project.
  
  Return both the patternData and the esp32Code in the required JSON format.
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
