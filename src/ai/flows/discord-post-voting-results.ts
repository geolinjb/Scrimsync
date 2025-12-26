'use server';

/**
 * @fileOverview A flow to generate a summary of voting results and availability information.
 *
 * - discordPostVotingResults - A function that handles generating the summary.
 * - DiscordPostVotingResultsInput - The input type for the discordPostVotingResults function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DiscordPostVotingResultsInputSchema = z.object({
  votingResults: z
    .string()
    .describe('The voting results data for selected days.'),
  availabilityInfo: z
    .string()
    .describe('The availability information for selected days.'),
  selectedDays: z.array(z.string()).describe('The days selected for the report.')
});
export type DiscordPostVotingResultsInput = z.infer<
  typeof DiscordPostVotingResultsInputSchema
>;

export async function discordPostVotingResults(
  input: DiscordPostVotingResultsInput
): Promise<string> {
  return await discordPostVotingResultsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'discordPostVotingResultsPrompt',
  input: {schema: DiscordPostVotingResultsInputSchema},
  prompt: `You are a helpful assistant that posts a summary of team availability to a Discord channel.
  
  You will be given voting results and scheduled events for the following days: {{{selectedDays}}}.

  Voting Results (Player availability counts for each time slot):
  {{{votingResults}}}

  Scheduled Events:
  {{{availabilityInfo}}}

  Generate a clear, concise, and easy-to-understand summary of the team's availability for the selected days.
  Highlight the most popular time slots and any scheduled events.
  The message should be formatted nicely for Discord.
  Return only the summary message that will be posted to discord.
  `,
});

const discordPostVotingResultsFlow = ai.defineFlow(
  {
    name: 'discordPostVotingResultsFlow',
    inputSchema: DiscordPostVotingResultsInputSchema,
    outputSchema: z.string(),
  },
  async input => {
    const discordPost = await prompt(input);
    return discordPost.output ?? '';
  }
);
