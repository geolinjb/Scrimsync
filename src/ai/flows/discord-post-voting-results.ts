'use server';

/**
 * @fileOverview A flow to post voting results and availability information to a Discord channel, using GenAI to determine if additional details or clarification is needed.
 *
 * - discordPostVotingResults - A function that handles posting voting results to Discord.
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
  discordChannelId: z.string().describe('The Discord channel ID to post to.'),
  selectedDays: z.array(z.string()).describe('The days selected for the report.')
});
export type DiscordPostVotingResultsInput = z.infer<
  typeof DiscordPostVotingResultsInputSchema
>;

export async function discordPostVotingResults(
  input: DiscordPostVotingResultsInput
): Promise<void> {
  await discordPostVotingResultsFlow(input);
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
  Do not include the channel ID in the post.
  Return only the summary message that will be posted to discord.
  `,
});

const discordPostVotingResultsFlow = ai.defineFlow(
  {
    name: 'discordPostVotingResultsFlow',
    inputSchema: DiscordPostVotingResultsInputSchema,
    outputSchema: z.void(),
  },
  async input => {
    const discordPost = await prompt(input);

    // Simulate posting to Discord channel.
    // In a real application, you would use the Discord API to post the message to the specified channel ID.
    console.log(
      `Posting to Discord channel ${input.discordChannelId}: ${discordPost.output}`
    );
  }
);
