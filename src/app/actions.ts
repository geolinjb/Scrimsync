'use server';

import { discordPostVotingResults } from '@/ai/flows/discord-post-voting-results';
import { revalidatePath } from 'next/cache';

export async function postToDiscordAction(
  votingResults: string,
  availabilityInfo: string,
  selectedDays: string[]
): Promise<{ success: boolean; message: string; }> {
  try {
    const message = await discordPostVotingResults({
      votingResults,
      availabilityInfo,
      selectedDays,
    });

    revalidatePath('/');
    return { success: true, message: message };
  } catch (error) {
    console.error('Failed to generate Discord post:', error);
    return { success: false, message: 'An error occurred while generating the post.' };
  }
}
