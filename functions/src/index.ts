/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { defineString } from "firebase-functions/params";

admin.initializeApp();

const discordWebhookUrl = defineString("DISCORD_WEBHOOK_URL");

// This is an HTTP Callable function that can be called from the frontend.
export const sendDiscordMessage = onCall(async (request) => {
  const message = request.data.message;

  if (!message) {
    logger.warn("No message provided to sendDiscordMessage function.");
    throw new onCall.HttpsError(
      "invalid-argument",
      "The function must be called with one argument 'message' containing the string to send."
    );
  }

  try {
    const response = await fetch(discordWebhookUrl.value(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: message }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        `Error from Discord API: ${response.status}`,
        { errorBody }
      );
      throw new onCall.HttpsError(
        "internal",
        "Failed to send message to Discord."
      );
    }

    logger.info("Successfully sent message to Discord.");
    return { success: true };
  } catch (error) {
    logger.error("Error sending message to Discord:", error);
    throw new onCall.HttpsError(
      "internal",
      "An unexpected error occurred while trying to send the message."
    );
  }
});
