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
  votingResults: z.string().describe('The voting results data.'),
  availabilityInfo: z.string().describe('The availability information.'),
  discordChannelId: z.string().describe('The Discord channel ID to post to.'),
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
  prompt: `You are a helpful assistant that posts voting results and availability information to a Discord channel.

  Voting Results: {{{votingResults}}}
  Availability Information: {{{availabilityInfo}}}

  Determine if the provided voting results and availability information require any additional details or clarification before posting to the Discord channel.
  If so, generate the necessary details or clarification. Then generate the message to post to discord.
  The message must be concise and easy to understand.
  Do not include the channel ID in the post.
  Return only the message that will be posted to discord.
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
