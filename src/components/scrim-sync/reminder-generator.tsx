'use client';

import * as React from 'react';
import { format, startOfToday, differenceInMinutes } from 'date-fns';
import { Copy, Megaphone, Check } from 'lucide-react';
import type { AllVotes, PlayerProfileData, ScheduleEvent } from '@/lib/types';
import { MINIMUM_PLAYERS } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';

type ReminderGeneratorProps = {
  events: ScheduleEvent[] | null;
  allVotes: AllVotes;
  allProfiles: PlayerProfileData[];
};

export function ReminderGenerator({ events, allVotes, allProfiles }: ReminderGeneratorProps) {
  const { toast } = useToast();
  const [selectedEventId, setSelectedEventId] = React.useState<string>('');
  const [reminderMessage, setReminderMessage] = React.useState<string>('');
  const [hasCopied, setHasCopied] = React.useState(false);
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const upcomingEvents = React.useMemo(() => {
    if (!events) return [];
    const today = startOfToday();
    return events
      .filter(event => event.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events]);

  const generateReminder = (eventId: string) => {
    if (!eventId) {
      setReminderMessage('');
      return;
    }
    const event = upcomingEvents.find(e => e.id === eventId);
    if (!event) return;

    // Logic to get players
    const dateKey = format(event.date, 'yyyy-MM-dd');
    const voteKey = `${dateKey}-${event.time}`;
    const availablePlayers = allVotes[voteKey] || [];
    const allPlayerNames = allProfiles.map(p => p.username).filter(Boolean);
    const unavailablePlayers = allPlayerNames.filter(p => !availablePlayers.includes(p));
    const neededPlayers = Math.max(0, MINIMUM_PLAYERS - availablePlayers.length);
    
    // Time formatting
    const timeRemaining = formatTimeRemaining(event.date, event.time);
    const formattedDate = format(event.date, 'EEEE, d MMMM');

    // Message construction (Discord Markdown)
    const header = `**🔔 REMINDER: ${event.type.toUpperCase()} @Spartan [Tour chad]! 🔔**`;
    const eventInfo = `> **When:** ${formattedDate} at **${event.time}** (Starts in ~${timeRemaining})`;
    const rosterHeader = `--- \n**ROSTER (${availablePlayers.length}/${MINIMUM_PLAYERS})**`;
    
    const availableHeader = `✅ **Available Players (${availablePlayers.length}):**`;
    const availableList = availablePlayers.length > 0 ? availablePlayers.map(p => `- ${p}`).join('\n') : '> - *None yet*';
    
    const unavailableHeader = `❌ **Unavailable Players (${unavailablePlayers.length}):**`;
    const unavailableList = unavailablePlayers.length > 0 ? unavailablePlayers.map(p => `- ${p}`).join('\n') : '> - *Everyone is available!*';
    
    const neededText = `🔥 **Players Needed: ${neededPlayers}**`;
    const footer = `\n---\nVote or update your availability:\nhttps://scrimsync.vercel.app/`;

    const fullMessage = [
      header,
      eventInfo,
      rosterHeader,
      neededText,
      '',
      availableHeader,
      availableList,
      '',
      unavailableHeader,
      unavailableList,
      footer,
    ].join('\n');
    
    setReminderMessage(fullMessage);
    setHasCopied(false);
  };
  
  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    generateReminder(eventId);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(reminderMessage).then(() => {
      setHasCopied(true);
      toast({
        title: 'Copied to Clipboard!',
        description: 'The reminder message is ready to be pasted.',
      });
      setTimeout(() => setHasCopied(false), 2000);
    }).catch(err => {
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Could not copy the message.',
      });
    });
  };

  const formatTimeRemaining = (eventDate: Date, eventTime: string) => {
    const [time, modifier] = eventTime.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    const eventDateTime = new Date(eventDate);
    eventDateTime.setHours(hours, minutes, 0, 0);

    const totalMinutes = differenceInMinutes(eventDateTime, now);
    if (totalMinutes <= 0) return 'Already Started';

    const days = Math.floor(totalMinutes / 1440);
    const hoursLeft = Math.floor((totalMinutes % 1440) / 60);
    const minutesLeft = totalMinutes % 60;
    
    let result = [];
    if (days > 0) result.push(`${days}d`);
    if (hoursLeft > 0) result.push(`${hoursLeft}h`);
    if (days === 0 && minutesLeft > 0) result.push(`${minutesLeft}m`);
    
    return result.join(' ') || 'Now';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-gold" />
          <CardTitle>Reminder Generator</CardTitle>
        </div>
        <CardDescription>
          Select an event to generate a formatted reminder message for Discord.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedEventId} onValueChange={handleEventChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select an upcoming event..." />
          </SelectTrigger>
          <SelectContent>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map(event => (
                <SelectItem key={event.id} value={event.id}>
                  {event.type} - {format(event.date, 'EEE, d MMM')} @ {event.time}
                </SelectItem>
              ))
            ) : (
              <div className='p-4 text-center text-sm text-muted-foreground'>No upcoming events.</div>
            )}
          </SelectContent>
        </Select>
        
        {reminderMessage && (
            <div className='space-y-2'>
                 <Separator />
                 <h4 className='text-sm font-medium pt-2'>Generated Message:</h4>
                <Textarea
                    readOnly
                    value={reminderMessage}
                    className="min-h-[250px] font-mono text-xs bg-muted/50"
                />
            </div>
        )}

      </CardContent>
      {reminderMessage && (
        <CardFooter>
          <Button onClick={handleCopyToClipboard} className="w-full">
            {hasCopied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {hasCopied ? 'Copied!' : 'Copy to Clipboard'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
