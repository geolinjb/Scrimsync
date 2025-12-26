export type ScheduleEvent = {
  id: string;
  type: 'Training' | 'Tournament';
  date: Date;
  time: string;
};

export type PlayerProfileData = {
  username: string;
  favoriteTank: string;
  role: (typeof gameRoles)[number] | '';
};

export const gameRoles = ['Tank Destroyer', 'Medium Tank', 'Heavy Tank', 'Assaulter', 'Defender', 'Light Tank'] as const;

export const timeSlots = [
  "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM",
  "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM"
];

export const daysOfWeek = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
] as const;

export type UserVotes = {
  [dateKey: string]: Set<string>; // Key is 'yyyy-MM-dd'
};

export type AllVotes = {
  [voteKey: string]: string[]; // Key is 'yyyy-MM-dd-HH:mm', value is array of player names
}

export const mockPlayers = [
  'Player1', 'TankMaster', 'SniperSue', 'GeneralGeorge', 'RookieRick', 'MajorMary', 'CaptainCarl', 'LieutenantLana'
];
