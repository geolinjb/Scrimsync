export type ScheduleEvent = {
  id: string;
  type: 'Training' | 'Tournament';
  date: Date;
  time: string;
  creatorId: string;
  isRecurring?: boolean;
};

export type FirestoreScheduleEvent = Omit<ScheduleEvent, 'date'> & {
  date: string; // Firestore stores dates as strings or Timestamps
}

export type PlayerProfileData = {
  id: string;
  username: string;
  photoURL?: string;
  favoriteTank: string;
  role: (typeof gameRoles)[number] | '';
  rosterStatus?: (typeof rosterStatuses)[number];
  playstyleTags?: (typeof playstyleTags)[number][];
};

export type Vote = {
    id: string; // composite key: `${userId}_${date}_${timeslot}`
    userId: string;
    timeslot: string; // format: 'YYYY-MM-DD_HH:mm'
    voteValue: boolean;
}

export const gameRoles = ['Tank Destroyer', 'Medium Tank', 'Heavy Tank', 'Assaulter', 'Defender', 'Light Tank'] as const;

export const rosterStatuses = ["Main Roster", "Standby Player"] as const;
export const playstyleTags = ["Assaulter", "Defender", "LT", "Harvester"] as const;

export const timeSlots = [
  "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM",
  "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM"
];

export const daysOfWeek = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
] as const;

export type UserVotes = {
  [dateKey: string]: Set<string>; // Key is 'yyyy-MM-dd', value is set of time slots
};

export type AllVotes = {
  [voteKey: string]: string[]; // Key is 'yyyy-MM-dd-HH:mm PM/AM', value is array of player usernames
}

export const MINIMUM_PLAYERS = 7;
