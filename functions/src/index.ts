import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { defineString } from "firebase-functions/params";

admin.initializeApp();
const auth = admin.auth();

const SUPER_ADMIN_UID = defineString("SUPER_ADMIN_UID", {
  description:
    "The UID of the user who has ultimate administrative privileges.",
  default: "BpA8qniZ03YttlnTR25nc6RrWrZ2",
});

export const setAdminClaim = onCall(async (request) => {
  // Check if the user is authenticated
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to perform this action."
    );
  }

  const callerUid = request.auth.uid;
  const targetUid = request.data.uid;

  if (typeof targetUid !== "string" || targetUid.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with a 'uid' argument."
    );
  }

  try {
    const callerUserRecord = await auth.getUser(callerUid);
    const isSuperAdmin = callerUserRecord.uid === SUPER_ADMIN_UID.value();
    const isAdmin = callerUserRecord.customClaims?.["admin"] === true;

    // Only allow an existing admin or the super admin to proceed
    if (!isAdmin && !isSuperAdmin) {
      throw new HttpsError(
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
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError(
      "internal",
      "An unexpected error occurred while setting the admin claim."
    );
  }
});