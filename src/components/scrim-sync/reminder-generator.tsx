'use client';

import * as React from 'react';
import { format, startOfToday, differenceInMinutes } from 'date-fns';
import { Send, Megaphone, Check, Loader } from 'lucide-react';
import type { AllVotes, PlayerProfileData, ScheduleEvent, AvailabilityOverride } from '@/lib/types';
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
  availabilityOverrides: AvailabilityOverride[];
};

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1454808762475872358/vzp7fiSxE7THIR5sc6npnuAG2TVl_B3fikdS_WgZFnzxQmejMJylsYafopfEkzU035Yt";

export function ReminderGenerator({ events, allVotes, allProfiles, availabilityOverrides }: ReminderGeneratorProps) {
  const { toast } = useToast();
  const [selectedEventId, setSelectedEventId] = React.useState<string>('');
  const [reminderMessage, setReminderMessage] = React.useState<string>('');
  const [isSending, setIsSending] = React.useState(false);
  const [sendSuccess, setSendSuccess] = React.useState(false);
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const upcomingEvents = React.useMemo(() => {
    if (!events) return [];
    const today = startOfToday();
    return events
      .filter(event => new Date(event.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  const generateReminder = (eventId: string) => {
    if (!eventId) {
      setReminderMessage('');
      return;
    }
    const event = upcomingEvents.find(e => e.id === eventId);
    if (!event) return;
    
    const profileMap = new Map(allProfiles.map(p => [p.id, p.username]));
    const allPlayerNames = allProfiles.map(p => p.username).filter(Boolean) as string[];

    // Logic to get players
    const dateKey = format(new Date(event.date), 'yyyy-MM-dd');
    const voteKey = `${dateKey}-${event.time}`;
    const availablePlayers = allVotes[voteKey] || [];

    const eventOverrides = availabilityOverrides.filter(o => o.eventId === eventId);
    const possiblyAvailablePlayerUsernames = eventOverrides
        .map(o => profileMap.get(o.userId))
        .filter((name): name is string => !!name);

    const unavailablePlayers = allPlayerNames.filter(p => !availablePlayers.includes(p) && !possiblyAvailablePlayerUsernames.includes(p));
    const totalAvailable = availablePlayers.length + possiblyAvailablePlayerUsernames.length;
    const neededPlayers = Math.max(0, MINIMUM_PLAYERS - totalAvailable);
    
    // Time formatting
    const timeRemaining = formatTimeRemaining(new Date(event.date), event.time);
    const formattedDate = format(new Date(event.date), 'EEEE, d MMMM');

    // Message construction (Discord Markdown)
    const header = `**🔔 REMINDER: ${event.type.toUpperCase()} @Spartan [Tour chad]! 🔔**`;
    const eventInfo = `> **When:** ${formattedDate} at **${event.time}** (Starts in ~${timeRemaining})`;
    const descriptionLine = event.description ? `> **Notes:** ${event.description}` : null;
    const rosterHeader = `--- \n**ROSTER (${totalAvailable}/${MINIMUM_PLAYERS})**`;
    
    const availableHeader = `✅ **Available Players (${availablePlayers.length}):**`;
    const availableList = availablePlayers.length > 0 ? availablePlayers.map(p => `- ${p}`).join('\n') : '> - *None yet*';
    
    const possiblyAvailableHeader = `🤔 **Possibly Available (${possiblyAvailablePlayerUsernames.length}):**`;
    const possiblyAvailableList = possiblyAvailablePlayerUsernames.length > 0 ? possiblyAvailablePlayerUsernames.map(p => `- ${p}`).join('\n') : '> - *None*';

    const unavailableHeader = `❌ **Unavailable Players (${unavailablePlayers.length}):**`;
    const unavailableList = unavailablePlayers.length > 0 ? unavailablePlayers.map(p => `- ${p}`).join('\n') : '> - *Everyone is available!*';
    
    const neededText = `🔥 **Players Needed: ${neededPlayers}**`;
    const imageLine = event.imageURL ? `\n${event.imageURL}` : '';
    const footer = `\n---\nVote or update your availability:\nhttps://scrimsync.vercel.app/`;

    const messageParts = [
      header,
      eventInfo,
      descriptionLine,
      rosterHeader,
      neededText,
      '',
      availableHeader,
      availableList,
      '',
      possiblyAvailableHeader,
      possiblyAvailableList,
      '',
      unavailableHeader,
      unavailableList,
      footer,
      imageLine,
    ];
    
    const fullMessage = messageParts.filter(line => line !== null).join('\n');
    
    setReminderMessage(fullMessage);
    setSendSuccess(false);
  };
  
  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    generateReminder(eventId);
  };

  const handleSendToDiscord = async () => {
    if (!reminderMessage) return;

    setIsSending(true);
    setSendSuccess(false);

    try {
      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: reminderMessage }),
      });

      if (response.ok) {
        setSendSuccess(true);
        toast({
          title: 'Reminder Sent!',
          description: 'The message was successfully sent to Discord.',
        });
        setTimeout(() => setSendSuccess(false), 3000);
      } else {
        throw new Error(`Discord API responded with ${response.status}`);
      }
    } catch (error) {
      console.error("Error sending to Discord:", error);
      toast({
        variant: 'destructive',
        title: 'Send Failed',
        description: 'Could not send the reminder. Check the console for details.',
      });
    } finally {
      setIsSending(false);
    }
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
          Select an event to generate and send a formatted reminder to Discord.
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
                  {event.type} - {format(new Date(event.date), 'EEE, d MMM')} @ {event.time}
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
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    className="min-h-[250px] font-mono text-xs bg-muted/50"
                />
            </div>
        )}

      </CardContent>
      {reminderMessage && (
        <CardFooter>
          <Button onClick={handleSendToDiscord} className="w-full" disabled={isSending || sendSuccess}>
            {isSending ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : (sendSuccess ? <Check className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />)}
            {isSending ? 'Sending...' : (sendSuccess ? 'Sent!' : 'Send to Discord')}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
