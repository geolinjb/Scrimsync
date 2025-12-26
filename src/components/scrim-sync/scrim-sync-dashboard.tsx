'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Send } from 'lucide-react';

import { postToDiscordAction } from '@/app/actions';
import type { PlayerProfileData, ScheduleEvent, UserVotes } from '@/lib/types';
import { daysOfWeek, timeSlots } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { HeatmapGrid } from './heatmap-grid';
import { Header } from './header';
import { PlayerProfile } from './player-profile';
import { ScheduleForm } from './schedule-form';
import { IndividualVotingGrid } from './individual-voting-grid';

export function ScrimSyncDashboard() {
  const { toast } = useToast();

  const [profile, setProfile] = React.useState<PlayerProfileData>({
    username: 'Player1',
    favoriteTank: 'M4A3E8 Sherman',
    role: 'Medium Tank',
  });

  const [votes, setVotes] = React.useState<Record<string, number>>({});

  const [userVotes, setUserVotes] = React.useState<UserVotes>(() => {
    const initialVotes: UserVotes = {};
    daysOfWeek.forEach(day => {
      initialVotes[day] = new Set();
    });
    initialVotes['Sunday'] = new Set(['7:30 PM', '8:00 PM']);
    return initialVotes;
  });

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
    daysOfWeek.forEach(day => {
      timeSlots.forEach(slot => {
        const key = `${day}-${slot}`;
        initialVotes[key] = Math.floor(Math.random() * 10);
      });
    });

    // Recalculate based on initial user votes for Sunday
    userVotes['Sunday'].forEach(slot => {
        const key = `Sunday-${slot}`;
        initialVotes[key] = (initialVotes[key] || 0) + 1;
    });

    setVotes(initialVotes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVote = (day: string, timeSlot: string) => {
    const newUserVotes = { ...userVotes };
    if (!newUserVotes[day]) {
      newUserVotes[day] = new Set();
    }

    const dayVotes = newUserVotes[day];
    const voteKey = `${day}-${timeSlot}`;
    const newAggregateVotes = { ...votes };

    if (dayVotes.has(timeSlot)) {
      dayVotes.delete(timeSlot);
      newAggregateVotes[voteKey] = (newAggregateVotes[voteKey] || 1) - 1;
    } else {
      dayVotes.add(timeSlot);
      newAggregateVotes[voteKey] = (newAggregateVotes[voteKey] || 0) + 1;
    }

    setUserVotes(newUserVotes);
    setVotes(newAggregateVotes);
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
    const votingResultsString = Object.entries(votes)
      .map(([key, count]) => `${key.replace('-', ' ')}: ${count} votes`)
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
            <Tabs defaultValue="individual">
              <div className="flex justify-between items-center mb-4">
                <TabsList>
                  <TabsTrigger value="individual">Individual Voting</TabsTrigger>
                  <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
                </TabsList>
                <Button onClick={handlePostToDiscord}>
                  <Send className="mr-2 h-4 w-4" />
                  Post Results to Discord
                </Button>
              </div>
              <TabsContent value="individual">
                <IndividualVotingGrid userVotes={userVotes} onVote={handleVote} />
              </TabsContent>
              <TabsContent value="heatmap">
                <HeatmapGrid
                  votes={votes}
                  scheduledEvents={scheduledEvents}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
