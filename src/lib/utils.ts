import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a Discord dynamic timestamp string.
 * @param date The date of the event.
 * @param timeStr The time string in "H:mm AM/PM" format.
 * @param flag Discord timestamp flag (e.g., 'F' for full date/time, 'R' for relative).
 * @returns A formatted Discord timestamp string like <t:123456789:F>
 */
export function getDiscordTimestamp(date: Date | string, timeStr: string, flag: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' = 'F') {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  
  // Parse "4:30 PM"
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  
  // Set the hours and minutes in the local timezone of the browser creating the message
  d.setHours(hours, minutes, 0, 0);
  
  const unix = Math.floor(d.getTime() / 1000);
  return `<t:${unix}:${flag}>`;
}
