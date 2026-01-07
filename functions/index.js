const functions = require("firebase-functions/v2");
const https = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const auth = admin.auth();

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
