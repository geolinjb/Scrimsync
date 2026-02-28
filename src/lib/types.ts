
export type ScheduleEvent = {
  id: string;
  type: 'Training' | 'Tournament';
  date: Date;
  time: string;
  creatorId: string;
  isRecurring?: boolean;
  imageURL?: string;
  description?: string;
  status?: 'Active' | 'Cancelled';
  discordRoleId?: string;
};

export type FirestoreScheduleEvent = Omit<ScheduleEvent, 'date'> & {
  date: string;
}

export type PlayerProfileData = {
  id: string;
  username: string;
  discordUsername?: string;
  photoURL?: string;
  favoriteTank: string;
  role: (typeof gameRoles)[number] | '';
  rosterStatus?: (typeof rosterStatuses)[number];
  playstyleTags?: (typeof playstyleTags)[number][];
  lastNotificationReadTimestamp?: string;
};

export type Vote = {
    id: string;
    userId: string;
    timeslot: string;
    voteValue: boolean;
    eventId?: string;
}

export type AvailabilityOverride = {
  id: string;
  eventId: string;
  userId: string;
  status: 'Possibly Available';
};

export type AppNotification = {
    id: string;
    message: string;
    timestamp: string;
    createdBy: string;
    icon: string;
}

export type EventBanner = {
    id: string;
    url: string;
    description: string;
    uploadedBy: string;
    timestamp: string;
}

export const gameRoles = ['Tank Destroyer', 'Medium Tank', 'Heavy Tank', 'Assaulter', 'Defender', 'Light Tank'] as const;

export const rosterStatuses = ["Main Roster", "Standby Player"] as const;
export const playstyleTags = ["Assaulter", "Defender", "Scout", "Harvester"] as const;

export const timeSlots = [
  "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM",
  "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM"
];

export const daysOfWeek = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
] as const;

export type UserVotes = {
  [dateKey: string]: Set<string>;
};

export type AllVotes = {
  [voteKey: string]: string[];
}

export const MINIMUM_PLAYERS = 7;
