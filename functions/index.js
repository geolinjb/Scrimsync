
const functions = require("firebase-functions/v2");
const https = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const auth = admin.auth();
const firestore = admin.firestore();
const storage = admin.storage();

// The hardcoded UID for the super admin.
const SUPER_ADMIN_UID = "BpA8qniZ03YttlnTR25nc6RrWrZ2";

exports.setAdminClaim = https.onCall(async (request) => {
  // Check if the user is authenticated
  if (!request.auth) {
    throw new https.HttpsError(
      "unauthenticated",
      "You must be logged in to perform this action."
    );
  }

  const callerUid = request.auth.uid;
  const targetUid = request.data.uid;

  // Allow a super admin to make themselves an admin
  if (callerUid === SUPER_ADMIN_UID && targetUid === SUPER_ADMIN_UID) {
     await auth.setCustomUserClaims(SUPER_ADMIN_UID, { admin: true });
     logger.info(`Super Admin ${SUPER_ADMIN_UID} set admin claim on themselves.`);
     return {
        message: `Success! Super Admin ${SUPER_ADMIN_UID} has been made an admin.`,
     };
  }

  if (typeof targetUid !== "string" || targetUid.length === 0) {
    throw new https.HttpsError(
      "invalid-argument",
      "The function must be called with a 'uid' argument."
    );
  }

  try {
    const isSuperAdmin = callerUid === SUPER_ADMIN_UID;
    const callerClaims = (await auth.getUser(callerUid)).customClaims;
    const isAdmin = callerClaims?.admin === true;

    // Only allow an existing admin or the super admin to proceed
    if (!isAdmin && !isSuperAdmin) {
      throw new https.HttpsError(
        "permission-denied",
        "You do not have permission to perform this action."
      );
    }

    // Set the custom claim on the target user
    await auth.setCustomUserClaims(targetUid, { admin: true });

    logger.info(
      `Admin claim set for user ${targetUid} by admin ${callerUid}.`
    );
    return {
      message: `Success! User ${targetUid} has been made an admin.`,
    };
  } catch (error) {
    logger.error("Error setting admin claim:", error);
    if (error instanceof https.HttpsError) {
      throw error;
    }
    throw new https.HttpsError(
      "internal",
      "An unexpected error occurred while setting the admin claim."
    );
  }
});

exports.uploadProfilePicture = https.onCall(async (request) => {
  if (!request.auth) {
    throw new https.HttpsError('unauthenticated', 'You must be logged in to upload a file.');
  }

  const { fileDataUrl, fileName } = request.data;
  const uid = request.auth.uid;

  if (!fileDataUrl || typeof fileDataUrl !== 'string' || !fileDataUrl.startsWith('data:image')) {
    throw new https.HttpsError('invalid-argument', 'The function must be called with a valid base64 image data URL.');
  }

  try {
    const bucket = storage.bucket();
    // Extract mime type and base64 data
    const matches = fileDataUrl.match(/^data:(image\/[a-z]+);base64,(.*)$/);
    if (!matches || matches.length !== 3) {
      throw new https.HttpsError('invalid-argument', 'Invalid data URL format.');
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    const fileBuffer = Buffer.from(base64Data, 'base64');
    
    const filePath = `avatars/${uid}/${fileName || 'avatar.jpg'}`;
    const file = bucket.file(filePath);

    await file.save(fileBuffer, {
      metadata: { contentType: mimeType },
    });

    // Make the file public to get a download URL
    await file.makePublic();
    const photoURL = file.publicUrl();

    // Now update Auth and Firestore
    await auth.updateUser(uid, { photoURL });
    const userDocRef = firestore.collection('users').doc(uid);
    await userDocRef.update({ photoURL });

    logger.info(`Successfully updated profile picture for user ${uid}.`);
    return { photoURL };

  } catch (error) {
    logger.error(`Error uploading profile picture for user ${uid}:`, error);
    throw new https.HttpsError('internal', 'An unexpected error occurred during file upload.');
  }
});
