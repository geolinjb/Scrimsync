/**
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";

// Initialize the Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

// Define the shape of your data
interface ScheduledEvent {
    id: string;
    type: "Training" | "Tournament";
    date: string; // Stored as 'YYYY-MM-DD' string
    time: string;
    creatorId: string;
}

interface UserProfile {
    id: string;
    username: string;
}

interface Vote {
    userId: string;
    timeslot: string; // format: 'YYYY-MM-DD_HH:mm AM/PM'
}

// Function to set environment variables for the project
// Note: This requires the `firebase-functions-helper` library or similar manual setup in GCP
// For simplicity, we use `functions.config()` which is the older, but still functional way
const setWebhookUrlCallable = functions.https.onCall(async (data, context) => {
    // Make sure the user is an admin
    if (context.auth?.uid !== "BpA8qniZ03YttlnTR25nc6RrWrZ2") {
        throw new functions.https.HttpsError("permission-denied", "You must be an administrator to perform this action.");
    }

    const webhookUrl = data.url;
    if (typeof webhookUrl !== "string" || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
        throw new functions.https.HttpsError("invalid-argument", "A valid Discord webhook URL is required.");
    }

    // Set the environment variable for the webhook URL
    // Important: This requires manual configuration or a helper script
    // Using `firebase functions:config:set discord.webhook_url="..."` is the recommended way.
    // This function will throw an error to guide the developer.
    throw new functions.https.HttpsError(
        "failed-precondition",
        "To set the webhook URL, run this command in your terminal, then redeploy functions: firebase functions:config:set discord.webhook_url=\"" + webhookUrl + "\""
    );
});


const testDiscordWebhookCallable = functions.https.onCall(async (data, context) => {
    if (context.auth?.uid !== "BpA8qniZ03YttlnTR25nc6RrWrZ2") {
        throw new functions.https.HttpsError("permission-denied", "You must be an administrator to perform this action.");
    }

    const webhookUrl = functions.config().discord?.webhook_url;
    if (!webhookUrl) {
        throw new functions.https.HttpsError("failed-precondition", "Discord webhook URL is not configured. Please save it first.");
    }

    const testMessage = {
        embeds: [{
            title: "Webhook Test Successful!",
            description: "If you can see this message, your ScrimSync integration is working correctly.",
            color: 0x00ff00, // Green
            footer: {
                text: "ScrimSync Notifications",
            },
        }, ],
    };

    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testMessage),
    });

    if (!response.ok) {
        throw new functions.https.HttpsError("internal", `Discord API returned status ${response.status}.`);
    }

    return { success: true, message: "Test message sent successfully!" };
});


const sendDiscordReminders = functions.pubsub.schedule("every 15 minutes").onRun(async (context) => {
    const webhookUrl = functions.config().discord?.webhook_url;
    if (!webhookUrl) {
        console.log("Discord webhook URL not set. Skipping reminders.");
        return null;
    }

    const now = new Date();
    // Look for events starting in the next 15-30 minute window
    const reminderWindowStart = new Date(now.getTime() + 15 * 60 * 1000);
    const reminderWindowEnd = new Date(now.getTime() + 30 * 60 * 1000);

    const eventsSnapshot = await db.collection("scheduledEvents").get();
    const allEvents = eventsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ScheduledEvent));

    const upcomingEvents = allEvents.filter((event) => {
        // Combine date and time string to parse it
        const eventDateTimeStr = `${event.date}T${convertTimeTo24Hour(event.time)}:00`;
        const eventDate = new Date(eventDateTimeStr);
        return eventDate > reminderWindowStart && eventDate <= reminderWindowEnd;
    });

    if (upcomingEvents.length === 0) {
        console.log("No upcoming events to send reminders for.");
        return null;
    }

    // Fetch all user profiles and votes once
    const [profilesSnapshot, votesSnapshot] = await Promise.all([
        db.collection("users").get(),
        db.collection("votes").get(),
    ]);

    const allProfiles = new Map(profilesSnapshot.docs.map((doc) => [doc.id, doc.data() as UserProfile]));
    const allVotes = votesSnapshot.docs.map((doc) => doc.data() as Vote);

    for (const event of upcomingEvents) {
        await sendReminderForEvent(event, allProfiles, allVotes, webhookUrl);
    }

    return null;
});


async function sendReminderForEvent(event: ScheduledEvent, allProfiles: Map<string, UserProfile>, allVotes: Vote[], webhookUrl: string) {
    const eventTimeSlot = `${event.date}_${event.time}`;

    const availableUserIds = new Set(
        allVotes
        .filter((vote) => vote.timeslot === eventTimeSlot)
        .map((vote) => vote.userId)
    );

    const allUsernames = Array.from(allProfiles.values()).map((p) => p.username).filter(Boolean);
    const availablePlayers = Array.from(availableUserIds)
        .map((uid) => allProfiles.get(uid)?.username)
        .filter((name): name is string => !!name);

    const unavailablePlayers = allUsernames.filter((name) => !availablePlayers.includes(name));

    const neededPlayers = Math.max(0, 7 - availablePlayers.length); // Assuming MINIMUM_PLAYERS is 7

    const embed = {
        title: `🔔 Event Reminder: ${event.type} starts in ~30 minutes!`,
        description: `**${event.date} at ${event.time}**`,
        color: event.type === "Tournament" ? 0xffa500 : 0x0099ff, // Orange for tournament, blue for training
        fields: [
            {
                name: `✅ Available Players (${availablePlayers.length})`,
                value: availablePlayers.length > 0 ? availablePlayers.join("\n") : "None",
                inline: true,
            },
            {
                name: `❌ Unavailable Players (${unavailablePlayers.length})`,
                value: unavailablePlayers.length > 0 ? unavailablePlayers.join("\n") : "None",
                inline: true,
            },
            {
                name: `🔥 Players Needed`,
                value: `${neededPlayers}`,
                inline: false,
            },
        ],
        footer: {
            text: "ScrimSync Notifications",
        },
        timestamp: new Date().toISOString(),
    };

    try {
        await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ embeds: [embed] }),
        });
        console.log(`Sent reminder for event ${event.id}`);
    } catch (error) {
        console.error(`Failed to send reminder for event ${event.id}:`, error);
    }
}

function convertTimeTo24Hour(timeStr: string): string {
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":");

    if (hours === "12") {
        hours = "00";
    }
    if (modifier === "PM") {
        hours = (parseInt(hours, 10) + 12).toString();
    }
    return `${hours.padStart(2, '0')}:${minutes}`;
}


module.exports = {
    setWebhookUrl: setWebhookUrlCallable,
    testDiscordWebhook: testDiscordWebhookCallable,
    sendDiscordReminders,
};
