'use server';

export async function postToDiscordWebhook(
  webhookUrl: string,
  message: string
): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl) {
    return { success: false, message: 'Webhook URL is required.' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: message }),
    });

    if (response.ok) {
      return { success: true, message: 'Successfully posted to Discord!' };
    } else {
      const errorText = await response.text();
      console.error('Discord webhook error:', errorText);
      return {
        success: false,
        message: `Failed to post to Discord. Status: ${response.status}.`,
      };
    }
  } catch (error) {
    console.error('Failed to post to Discord:', error);
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
        return { success: false, message: 'Failed to send request. Please check the webhook URL and your network connection.'};
    }
    return {
      success: false,
      message: 'An unexpected error occurred.',
    };
  }
}
