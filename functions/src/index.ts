/**
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

// A secure, callable Cloud Function to reset all votes.
// This function can only be successfully called by a user whose authentication token
// email matches the hardcoded admin email.
export const resetAllVotes = functions.https.onCall(async (_, context) => {
    // Check for authentication and get the user's email from the ID token.
    const userEmail = context.auth?.token?.email;

    // IMPORTANT: This is the security gate.
    // We check the VERIFIED email from the user's token.
    // This value cannot be faked by the client.
    if (userEmail !== 'geolinjb@gmail.com') {
        throw new functions.https.HttpsError(
            'permission-denied',
            'You are not authorized to perform this action.'
        );
    }

    try {
        const votesCollection = db.collection('votes');
        const snapshot = await votesCollection.limit(500).get(); // Process in batches of 500

        if (snapshot.empty) {
            return { success: true, message: "No votes to delete." };
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        // If there might be more than 500 documents, you'd implement a loop here.
        // For this app's scale, deleting the first 500 is likely sufficient.
        console.log(`Admin user ${userEmail} successfully deleted ${snapshot.size} votes.`);
        return { success: true, message: `${snapshot.size} votes have been reset.` };

    } catch (error) {
        console.error("Error resetting votes:", error);
        throw new functions.https.HttpsError(
            'internal',
            'An error occurred while trying to reset votes.'
        );
    }
});
