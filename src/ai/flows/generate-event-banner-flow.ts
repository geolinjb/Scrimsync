
'use server';
/**
 * @fileOverview A flow to generate thematic event banners using AI.
 *
 * - generateEventBanner - A function that generates an image based on event details.
 * - GenerateEventBannerInput - The input type for the function.
 * - GenerateEventBannerOutput - The return type containing the image data URI.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateEventBannerInputSchema = z.object({
  type: z.enum(['Training', 'Tournament']).describe('The type of the event.'),
  description: z.string().optional().describe('A detailed description of the event for context.'),
});
export type GenerateEventBannerInput = z.infer<typeof GenerateEventBannerInputSchema>;

const GenerateEventBannerOutputSchema = z.object({
  imageUrl: z.string().describe('A data URI of the generated image.'),
});
export type GenerateEventBannerOutput = z.infer<typeof GenerateEventBannerOutputSchema>;

export async function generateEventBanner(input: GenerateEventBannerInput): Promise<GenerateEventBannerOutput> {
  return generateEventBannerFlow(input);
}

const generateEventBannerFlow = ai.defineFlow(
  {
    name: 'generateEventBannerFlow',
    inputSchema: GenerateEventBannerInputSchema,
    outputSchema: GenerateEventBannerOutputSchema,
  },
  async (input) => {
    const prompt = `Create a cinematic, high-energy gaming banner for a ${input.type} session. 
    Context: ${input.description || 'A team-based competitive game practice.'}
    Aesthetic: Futuristic, digital, team-oriented, with dramatic lighting and professional eSports feel. 
    No text in the image. High contrast, epic scale.`;

    // Using gemini-2.5-flash-image which supports image generation on the free tier
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.5-flash-image',
      prompt: prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media || !media.url) {
      throw new Error('AI failed to generate an image. This might be due to project-level quota restrictions.');
    }

    return {
      imageUrl: media.url,
    };
  }
);
