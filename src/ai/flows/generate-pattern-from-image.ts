'use server';
/**
 * @fileOverview An AI agent that generates water curtain patterns from images.
 *
 * - generatePatternFromImage - A function that handles the pattern generation process.
 * - GeneratePatternFromImageInput - The input type for the generatePatternFromImage function.
 * - GeneratePatternFromImageOutput - The return type for the generatePatternFromImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePatternFromImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to use as a pattern, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  numValves: z.number().describe('The number of valves in the water curtain.'),
});
export type GeneratePatternFromImageInput = z.infer<typeof GeneratePatternFromImageInputSchema>;

const GeneratePatternFromImageOutputSchema = z.object({
  patternData: z.string().describe('The generated pattern data as a string representation of a 2D array.'),
});
export type GeneratePatternFromImageOutput = z.infer<typeof GeneratePatternFromImageOutputSchema>;

export async function generatePatternFromImage(input: GeneratePatternFromImageInput): Promise<GeneratePatternFromImageOutput> {
  return generatePatternFromImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePatternFromImagePrompt',
  input: {schema: GeneratePatternFromImageInputSchema},
  output: {schema: GeneratePatternFromImageOutputSchema},
  prompt: `You are an AI that generates patterns for a digital water curtain from images.

The water curtain has {{{numValves}}} valves.

You will receive a photo and must convert it into a pattern suitable for display on the water curtain.

Consider the limitations of the water curtain when generating the pattern. It has a limited resolution, with the number of valves specified by the user.
Thus, it is important to convert complex imagery to a low-resolution equivalent appropriate for the output.

Here is the photo:
{{media url=photoDataUri}}

Output the pattern data as a string representation of a 2D array, with each row representing a valve and each column representing a time slice.  Use '1' to represent water being on, and '0' for water being off.

For example, if the water curtain had 4 valves and 4 time slices, the output might look like this:

[ [0, 1, 0, 1],
  [1, 0, 1, 0],
  [0, 1, 0, 1],
  [1, 0, 1, 0] ]`,
});

const generatePatternFromImageFlow = ai.defineFlow(
  {
    name: 'generatePatternFromImageFlow',
    inputSchema: GeneratePatternFromImageInputSchema,
    outputSchema: GeneratePatternFromImageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
