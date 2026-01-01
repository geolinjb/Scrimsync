/**
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";

// Initialize the Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// --- HARDCODED DISCORD WEBHOOK URL ---
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

// Function to send a test message to the configured Discord webhook
export const testDiscordWebhook = functions.region('us-central1').https.onCall(async (data, context) => {
    if (context.auth?.uid !== ADMIN_UID) {
        throw new functions.https.HttpsError('permission-denied', 'You must be an administrator to perform this action.');
    }
    
    if (!DISCORD_WEBHOOK_URL) {
        throw new functions.https.HttpsError('failed-precondition', 'Discord webhook URL is not configured in the backend.');
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
            const responseBody = await response.text();
            console.error(`Discord API Error: ${response.status}`, responseBody);
            throw new functions.https.HttpsError('internal', `Discord API returned status ${response.status}.`);
        }
    } catch (error) {
        console.error("Error sending test webhook message:", error);
        throw new functions.https.HttpsError('internal', 'Failed to send test message to Discord.');
    }

    return { success: true, message: "Test message sent successfully!" };
});

// Scheduled function to send reminders for upcoming events
export const sendDiscordReminders = functions.region('us-central1').pubsub.schedule("every 15 minutes").onRun(async (context) => {
    const webhookUrl = DISCORD_WEBHOOK_URL;
    
    if (!webhookUrl) {
        console.log("Discord webhook URL not set in backend. Skipping reminders.");
        return;
    }

    const now = new Date();
    // Look for events starting in the next 15-30 minute window
    const reminderWindowStart = new Date(now.getTime() + 15 * 60 * 1000);
    const reminderWindowEnd = new Date(now.getTime() + 30 * 60 * 1000);

    const eventsSnapshot = await db.collection("scheduledEvents").get();
    if (eventsSnapshot.empty) {
        console.log("No scheduled events found.");
        return;
    }
    
    const allEvents = eventsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ScheduledEvent));

    const upcomingEvents = allEvents.filter((event) => {
        try {
            const eventDateTimeStr = `${event.date}T${convertTimeTo24Hour(event.time)}:00`;
            const eventDate = new Date(eventDateTimeStr);
            return eventDate > reminderWindowStart && eventDate <= reminderWindowEnd;
        } catch (e) {
            console.error(`Could not parse date for event ${event.id}: '${event.date}' '${event.time}'`);
            return false;
        }
    });

    if (upcomingEvents.length === 0) {
        console.log("No upcoming events to send reminders for.");
        return;
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
                value: availablePlayers.length > 0 ? availablePlayers.join("\\n") : "None",
                inline: true,
            },
            {
                name: `❌ Unavailable Players (${unavailablePlayers.length})`,
                value: unavailablePlayers.length > 0 ? unavailablePlayers.join("\\n") : "None",
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
