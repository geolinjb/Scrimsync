/**
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/pubsub";
import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";

// node-fetch is a CommonJS module, so we need to import it this way
const fetch = require('node-fetch');

// Initialize the Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Set the region for all functions to ensure consistency
setGlobalOptions({ region: 'us-central1' });

// --- HARDCODED VALUES ---
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1454808762475872358/vzp7fiSxE7THIR5sc6npnuAG2TVl_B3fikdS_WgZFnzxQmejMJylsYafopfEkzU035Yt";
const ADMIN_UID = 'BpA8qniZ03YttlnTR25nc6RrWrZ2';


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

// v2 Callable Function to send a test message to the configured Discord webhook
export const testDiscordWebhook = onCall(async (request) => {
    // Check for admin privileges
    if (request.auth?.uid !== ADMIN_UID) {
        throw new HttpsError('permission-denied', 'You must be an administrator to perform this action.');
    }
    
    if (!DISCORD_WEBHOOK_URL) {
        console.error("Discord webhook URL is not configured.");
        throw new HttpsError('failed-precondition', 'The Discord webhook URL is not configured in the backend.');
    }

    const testMessage = {
        embeds: [{
            title: "Webhook Test Successful!",
            description: "If you can see this message, your ScrimSync integration is working correctly.",
            color: 0x00ff00, // Green
            footer: { text: "ScrimSync Notifications" },
        }],
    };

    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(testMessage),
        });

        if (!response.ok) {
            // Log the error response from Discord for better debugging
            const responseBody = await response.text();
            console.error(`Discord API Error: ${response.status} ${response.statusText}`, responseBody);
            throw new HttpsError('internal', `Discord API returned status ${response.status}. Check function logs for details.`);
        }
    } catch (error) {
        console.error("Error sending test webhook message:", error);
        // This will be caught by the client as an 'internal' error
        throw new HttpsError('internal', 'Failed to send the test message to Discord. See function logs.');
    }

    // Return a success response to the client
    return { success: true, message: "Test message sent successfully!" };
});

// v2 Scheduled function to send reminders for upcoming events
export const sendDiscordReminders = onSchedule("every 15 minutes", async (event) => {
    const webhookUrl = DISCORD_WEBHOOK_URL;
    
    if (!webhookUrl) {
        console.log("Discord webhook URL not set. Skipping reminders.");
        return;
    }

    const now = new Date();
    // Look for events starting in the next 15-30 minute window to give a heads-up
    const reminderWindowStart = new Date(now.getTime() + 15 * 60 * 1000);
    const reminderWindowEnd = new Date(now.getTime() + 30 * 60 * 1000);

    const eventsSnapshot = await db.collection("scheduledEvents").get();
    if (eventsSnapshot.empty) {
        console.log("No scheduled events found.");
        return;
    }
    
    const allEvents = eventsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ScheduledEvent));

    const upcomingEvents = allEvents.filter((eventDoc) => {
        try {
            // Combine date and time into a single string for robust parsing
            const eventDateTimeStr = `${eventDoc.date}T${convertTimeTo24Hour(eventDoc.time)}:00`;
            const eventDate = new Date(eventDateTimeStr);
            // Check if the event is within our target window
            return eventDate > reminderWindowStart && eventDate <= reminderWindowEnd;
        } catch (e) {
            console.error(`Could not parse date/time for event ${eventDoc.id}: '${eventDoc.date}' '${eventDoc.time}'`, e);
            return false;
        }
    });

    if (upcomingEvents.length === 0) {
        console.log("No upcoming events to send reminders for in the current window.");
        return;
    }

    // Fetch all user profiles and votes once to be efficient
    const [profilesSnapshot, votesSnapshot] = await Promise.all([
        db.collection("users").get(),
        db.collection("votes").get(),
    ]);

    const allProfiles = new Map(profilesSnapshot.docs.map((doc) => [doc.id, doc.data() as UserProfile]));
    const allVotes = votesSnapshot.docs.map((doc) => doc.data() as Vote);

    // Send a reminder for each upcoming event
    for (const eventDoc of upcomingEvents) {
        await sendReminderForEvent(eventDoc, allProfiles, allVotes, webhookUrl);
    }
});


async function sendReminderForEvent(event: ScheduledEvent, allProfiles: Map<string, UserProfile>, allVotes: Vote[], webhookUrl: string) {
    const eventTimeSlot = `${event.date}_${event.time}`;

    // Find all votes for this specific event time slot
    const availableUserIds = new Set(
        allVotes
        .filter((vote) => vote.timeslot === eventTimeSlot)
        .map((vote) => vote.userId)
    );

    const allUsernames = Array.from(allProfiles.values()).map((p) => p.username).filter(Boolean);
    
    const availablePlayers = Array.from(availableUserIds)
        .map((uid) => allProfiles.get(uid)?.username)
        .filter((name): name is string => !!name); // Filter out any undefined names

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

/**
 * Converts a 12-hour time string (e.g., "6:30 PM") to a 24-hour format string ("18:30").
 * @param timeStr The time string to convert.
 * @returns The time in 24-hour format.
 */
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
