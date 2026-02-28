import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a Discord dynamic timestamp string.
 */
export function getDiscordTimestamp(date: Date | string, timeStr: string, flag: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' = 'F') {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  
  d.setHours(hours, minutes, 0, 0);
  return `<t:${Math.floor(d.getTime() / 1000)}:${flag}>`;
}

/**
 * Formats bytes into human-readable string.
 */
export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024, dm = decimals < 0 ? 0 : decimals, sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Formats a Discord mention string for numeric IDs.
 */
export function formatDiscordMention(input?: string) {
  if (!input) return 'Unknown';
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return `<@${trimmed}>`;
  if (trimmed.startsWith('@') && /^\d+$/.test(trimmed.slice(1))) return `<@${trimmed.slice(1)}>`;
  return trimmed;
}