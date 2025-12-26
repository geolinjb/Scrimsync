'use client';

import * as React from 'react';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { Send, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [currentDate, setCurrentDate] = React.useState(new Date());

  const [profile, setProfile] = React.useState<PlayerProfileData>({
    username: 'Player1',
    favoriteTank: 'M4A3E8 Sherman',
    role: 'Medium Tank',
  });

  const [votes, setVotes] = React.useState<Record<string, number>>({});
  const [userVotes, setUserVotes] = React.useState<UserVotes>({});

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
    const weekStart = startOfWeek(currentDate);
    for (let i = 0; i < 7; i++) {
        const day = addDays(weekStart, i);
        const dayKey = format(day, 'yyyy-MM-dd');
        timeSlots.forEach(slot => {
            const key = `${dayKey}-${slot}`;
            initialVotes[key] = Math.floor(Math.random() * 10);
        });
    }

    Object.keys(userVotes).forEach(dateKey => {
        if(userVotes[dateKey]) {
            userVotes[dateKey].forEach(slot => {
                const key = `${dateKey}-${slot}`;
                if (initialVotes[key] !== undefined) {
                  initialVotes[key]++;
                }
            });
        }
    });

    setVotes(initialVotes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, userVotes]);


  const handleVote = (date: Date, timeSlot: string) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const newUserVotes: UserVotes = { ...userVotes };
    if (!newUserVotes[dateKey]) {
      newUserVotes[dateKey] = new Set();
    }

    const dayVotes = newUserVotes[dateKey];
    const voteKey = `${dateKey}-${timeSlot}`;
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

  const goToPreviousWeek = () => {
    setCurrentDate(prev => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setCurrentDate(prev => addDays(prev, 7));
  };
  
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);

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
              <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <TabsList>
                  <TabsTrigger value="individual">Individual Voting</TabsTrigger>
                  <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
                </TabsList>
                <div className='flex items-center gap-2'>
                    <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-sm font-medium text-center">
                        {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                    </div>
                    <Button variant="outline" size="icon" onClick={goToNextWeek}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <Button onClick={handlePostToDiscord}>
                  <Send className="mr-2 h-4 w-4" />
                  Post Results to Discord
                </Button>
              </div>
              <TabsContent value="individual">
                <IndividualVotingGrid 
                    userVotes={userVotes} 
                    onVote={handleVote} 
                    currentDate={currentDate}
                />
              </TabsContent>
              <TabsContent value="heatmap">
                <HeatmapGrid
                  votes={votes}
                  scheduledEvents={scheduledEvents}
                  currentDate={currentDate}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
