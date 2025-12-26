'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Send } from 'lucide-react';

import { postToDiscordAction } from '@/app/actions';
import type { PlayerProfileData, ScheduleEvent } from '@/lib/types';
import { gameRoles, timeSlots } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

import { AvailabilityGrid } from './availability-grid';
import { Header } from './header';
import { PlayerProfile } from './player-profile';
import { ScheduleForm } from './schedule-form';

export function ScrimSyncDashboard() {
  const { toast } = useToast();

  const [profile, setProfile] = React.useState<PlayerProfileData>({
    username: 'Player1',
    favoriteTank: 'M4A3E8 Sherman',
    role: 'Medium Tank',
  });

  const [votes, setVotes] = React.useState<Record<string, number>>({});

  const [userVotes, setUserVotes] = React.useState<Set<string>>(() => new Set(['7:30 PM', '8:00 PM']));

  const [scheduledEvents, setScheduledEvents] = React.useState<ScheduleEvent[]>([
    {
      id: '1',
      type: 'Training',
      date: new Date(),
      time: '6:30 PM',
    },
    {
        id: '2',
        type: 'Tournament',
        date: new Date(),
        time: '8:30 PM'
    }
  ]);

  React.useEffect(() => {
    const initialVotes: Record<string, number> = {};
    timeSlots.forEach(slot => {
        initialVotes[slot] = Math.floor(Math.random() * 10);
    });
    setVotes(initialVotes);
  }, []);
  
  const handleVote = (timeSlot: string) => {
    const newVotes = { ...votes };
    const newUserVotes = new Set(userVotes);

    if (newUserVotes.has(timeSlot)) {
      newUserVotes.delete(timeSlot);
      newVotes[timeSlot] = (newVotes[timeSlot] || 1) - 1;
    } else {
      newUserVotes.add(timeSlot);
      newVotes[timeSlot] = (newVotes[timeSlot] || 0) + 1;
    }

    setUserVotes(newUserVotes);
    setVotes(newVotes);
  };

  const handleAddEvent = (data: { type: 'Training' | 'Tournament'; date: Date; time: string }) => {
    const newEvent: ScheduleEvent = {
      id: new Date().toISOString(),
      ...data,
    };
    setScheduledEvents([...scheduledEvents, newEvent]);
    toast({
      title: 'Event Scheduled!',
      description: `${data.type} on ${format(data.date, 'PPP')} at ${data.time} has been added.`,
    });
  };

  const handlePostToDiscord = async () => {
    const votingResultsString = timeSlots
      .map(slot => `${slot}: ${votes[slot] || 0} votes`)
      .join('\n');
    
    const availabilityInfoString = scheduledEvents
      .map(event => `Scheduled ${event.type} at ${event.time} on ${format(event.date, 'PPP')}`)
      .join('\n');
      
    const result = await postToDiscordAction(votingResultsString, availabilityInfoString);

    if (result.success) {
      toast({
        title: 'Success!',
        description: result.message,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.message,
      });
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
          <div className="md:col-span-1 lg:col-span-1 space-y-8">
            <PlayerProfile profile={profile} onProfileChange={setProfile} />
            <ScheduleForm onAddEvent={handleAddEvent} />
          </div>
          <div className="md:col-span-2 lg:col-span-3 space-y-6">
            <AvailabilityGrid
              votes={votes}
              userVotes={userVotes}
              scheduledEvents={scheduledEvents}
              onVote={handleVote}
            />
            <div className="flex justify-end">
              <Button onClick={handlePostToDiscord}>
                <Send className="mr-2 h-4 w-4" />
                Post Results to Discord
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
