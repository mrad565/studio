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

  Based on the text prompt provided by the user, generate a 2D array of booleans representing the water curtain pattern. The water curtain has {{numValves}} valves.

  The structure of the output JSON must be \`{ "patternData": boolean[][] }\`.

  The \`patternData\` array is a 2D array where:
  - The outer array represents time steps, so its length determines the animation duration.
  - Each inner array represents the state of all valves at a single time step. Its length MUST be exactly equal to \`numValves\`.
  - \`patternData[t][v]\` is a boolean, where \`t\` is the time index and \`v\` is the valve index.
  - \`true\` means the valve \`v\` is OPEN at time \`t\`.
  - \`false\` means the valve \`v\` is CLOSED at time \`t\`.

  For example, if \`numValves\` is 8 and the prompt is "a V shape", a good pattern would be:
  {
    "patternData": [
      [false, false, false, true, true, false, false, false],
      [false, false, true, false, false, true, false, false],
      [false, true, false, false, false, false, true, false],
      [true, false, false, false, false, false, false, true]
    ]
  }

  Now, generate a pattern for the following request. Make the animation interesting and visually appealing.
  
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
