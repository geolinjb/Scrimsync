/**
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Initialize the Firebase Admin SDK if it hasn't been already.
if (!getApps().length) {
  initializeApp();
}

/**
 * This function watches the /adminRequests/{userId} collection.
 * When a document is created, it grants the corresponding user the 'admin' custom claim.
 */
export const processAdminRequest = onDocumentCreated("adminRequests/{userId}", async (event) => {
  const userId = event.params.userId;
  const docRef = event.data.ref;

  logger.info(`Received admin request for user: ${userId}`);

  try {
    // Set the custom claim { admin: true } on the user's auth record.
    await getAuth().setCustomUserClaims(userId, { admin: true });
    logger.info(`Successfully set admin claim for user: ${userId}`);
    
    // Clean up by deleting the request document.
    await docRef.delete();
    logger.info(`Successfully processed and deleted admin request for: ${userId}`);
    
  } catch (error) {
    logger.error(`Error processing admin request for user: ${userId}`, error);
  }
});
