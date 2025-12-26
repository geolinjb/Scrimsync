'use server';

import { discordPostVotingResults } from '@/ai/flows/discord-post-voting-results';
import { revalidatePath } from 'next/cache';

export async function postToDiscordAction(
  votingResults: string,
  availabilityInfo: string,
  selectedDays: string[]
) {
  try {
    // In a real app, this would be a configurable value from environment variables or a database.
    const discordChannelId = '123456789012345678';
    
    await discordPostVotingResults({
      votingResults,
      availabilityInfo,
      discordChannelId,
      selectedDays,
    });

    revalidatePath('/');
    return { success: true, message: 'Successfully posted results to Discord.' };
  } catch (error) {
    console.error('Failed to post to Discord:', error);
    return { success: false, message: 'An error occurred while posting to Discord.' };
  }
}
