'use client';

import * as React from 'react';
import { format, addDays, startOfWeek, endOfWeek, subWeeks, isSameDay } from 'date-fns';
import { Send, ChevronLeft, ChevronRight, Copy } from 'lucide-react';

import { postToDiscordAction } from '@/app/actions';
import type { PlayerProfileData, ScheduleEvent, UserVotes, AllVotes } from '@/lib/types';
import { timeSlots, mockPlayers } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { HeatmapGrid } from './heatmap-grid';
import { Header } from './header';
import { PlayerProfile } from './player-profile';
import { ScheduleForm } from './schedule-form';
import { IndividualVotingGrid } from './individual-voting-grid';
import { ScheduledEvents } from './scheduled-events';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';


export function ScrimSyncDashboard() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = React.useState(new Date());

  const [profile, setProfile] = React.useState<PlayerProfileData>({
    username: 'Player1',
    favoriteTank: 'M4A3E8 Sherman',
    role: 'Medium Tank',
  });

  const [allVotes, setAllVotes] = React.useState<AllVotes>({});
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
  
  const [postDialogOpen, setPostDialogOpen] = React.useState(false);
  const [selectedDaysForPost, setSelectedDaysForPost] = React.useState<Date[]>([]);


  React.useEffect(() => {
    const generateRandomData = () => {
        const initialVotes: AllVotes = {};
        const weekStart = startOfWeek(currentDate);

        for (let i = 0; i < 7; i++) {
            const day = addDays(weekStart, i);
            const dayKey = format(day, 'yyyy-MM-dd');
            
            timeSlots.forEach(slot => {
                const voteKey = `${dayKey}-${slot}`;
                const availablePlayers = new Set<string>();
                
                // Add current user if they voted
                if (userVotes[dayKey]?.has(slot)) {
                    availablePlayers.add(profile.username);
                }

                // Add other random mock players
                const otherPlayers = mockPlayers.filter(p => p !== profile.username);
                const voterCount = Math.floor(Math.random() * (otherPlayers.length + 1));
                
                const shuffledPlayers = otherPlayers.sort(() => 0.5 - Math.random());
                for(let j = 0; j < voterCount; j++) {
                    availablePlayers.add(shuffledPlayers[j]);
                }
                
                initialVotes[voteKey] = Array.from(availablePlayers);
            });
        }
        setAllVotes(initialVotes);
    };
    
    generateRandomData();
    
  }, [currentDate, userVotes, profile.username]);


  const handleVote = (date: Date, timeSlot: string) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setUserVotes(prev => {
        const newVotes = { ...prev };
        if (!newVotes[dateKey]) {
            newVotes[dateKey] = new Set();
        }
        
        const dayVotes = new Set(newVotes[dateKey]);
        if (dayVotes.has(timeSlot)) {
            dayVotes.delete(timeSlot);
        } else {
            dayVotes.add(timeSlot);
        }
        newVotes[dateKey] = dayVotes;
        return newVotes;
    });
  };

  const handleVoteAllDay = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setUserVotes(prev => {
        const newVotes = { ...prev };
        const dayVotes = new Set(newVotes[dateKey]);
        const allSelected = timeSlots.every(slot => dayVotes.has(slot));

        if (allSelected) {
            newVotes[dateKey] = new Set();
        } else {
            newVotes[dateKey] = new Set(timeSlots);
        }
        return newVotes;
    });
  };

  const handleVoteAllTime = (timeSlot: string) => {
    const weekStart = startOfWeek(currentDate);
    setUserVotes(prev => {
        const newVotes = { ...prev };
        const allSelected = Array.from({length: 7}).every((_, i) => {
            const date = addDays(weekStart, i);
            const dateKey = format(date, 'yyyy-MM-dd');
            return newVotes[dateKey]?.has(timeSlot);
        });

        for (let i=0; i<7; i++) {
            const date = addDays(weekStart, i);
            const dateKey = format(date, 'yyyy-MM-dd');
            if (!newVotes[dateKey]) {
                newVotes[dateKey] = new Set();
            }
            const dayVotes = new Set(newVotes[dateKey]);
            if (allSelected) {
                dayVotes.delete(timeSlot);
            } else {
                dayVotes.add(timeSlot);
            }
            newVotes[dateKey] = dayVotes;
        }
        return newVotes;
    });
  };

  const handleCopyPreviousWeek = () => {
    const previousWeekStart = startOfWeek(subWeeks(currentDate, 1));
    const currentWeekStart = startOfWeek(currentDate);

    let copiedVotes = 0;
    const newUserVotes = { ...userVotes };

    for (let i = 0; i < 7; i++) {
      const prevDate = addDays(previousWeekStart, i);
      const prevDateKey = format(prevDate, 'yyyy-MM-dd');
      
      const currentDate = addDays(currentWeekStart, i);
      const currentDateKey = format(currentDate, 'yyyy-MM-dd');

      if (userVotes[prevDateKey]) {
        newUserVotes[currentDateKey] = new Set(userVotes[prevDateKey]);
        copiedVotes += userVotes[prevDateKey].size;
      } else {
        newUserVotes[currentDateKey] = new Set();
      }
    }
    
    setUserVotes(newUserVotes);

    if (copiedVotes > 0) {
        toast({
            title: 'Availability Copied',
            description: `Copied ${copiedVotes} time slots from the previous week.`,
        });
    } else {
        toast({
            title: 'Nothing to Copy',
            description: 'You had no availability set for the previous week.',
        });
    }
  };


  const handleAddEvent = (data: { type: 'Training' | 'Tournament'; date: Date; time: string }) => {
    const newEvent: ScheduleEvent = {
      id: new Date().toISOString(),
      ...data,
    };
    setScheduledEvents([...scheduledEvents, newEvent]);
    toast({
      title: 'Event Scheduled!',
      description: `${data.type} on ${format(data.date, 'd MMM, yyyy')} at ${data.time} has been added.`,
    });
  };

  const handlePostToDiscord = async () => {
    if (selectedDaysForPost.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No days selected',
            description: 'Please select at least one day to post results.',
        });
        return;
    }

    const selectedDayStrings = selectedDaysForPost.map(d => format(d, 'yyyy-MM-dd'));

    const votingResultsString = Object.entries(allVotes)
        .filter(([key]) => selectedDayStrings.some(d => key.startsWith(d)))
        .map(([key, players]) => `${key.replace(/-/g, ' ')}: ${players.length} votes`)
        .join('\n');
    
    const availabilityInfoString = scheduledEvents
        .filter(event => selectedDaysForPost.some(d => isSameDay(d, event.date)))
        .map(event => `Scheduled ${event.type} at ${event.time} on ${format(event.date, 'd MMM, yyyy')}`)
        .join('\n');
      
    const result = await postToDiscordAction(
        votingResultsString, 
        availabilityInfoString,
        selectedDaysForPost.map(d => format(d, 'EEEE'))
    );

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
    setPostDialogOpen(false);
    setSelectedDaysForPost([]);
  };

  const handleDaySelectForPost = (day: Date, checked: boolean) => {
    setSelectedDaysForPost(prev => {
        if (checked) {
            return [...prev, day];
        } else {
            return prev.filter(d => !isSameDay(d, day));
        }
    })
  }

  const goToPreviousWeek = () => {
    setCurrentDate(prev => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setCurrentDate(prev => addDays(prev, 7));
  };
  
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
          <div className="md:col-span-1 lg:col-span-1 space-y-8">
            <PlayerProfile profile={profile} onProfileChange={setProfile} />
            <ScheduleForm onAddEvent={handleAddEvent} currentDate={currentDate} />
            <ScheduledEvents events={scheduledEvents} votes={allVotes} currentDate={currentDate} />
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
                    <div className="text-sm font-medium text-center w-40">
                        {format(weekStart, 'd MMM')} - {format(weekEnd, 'd MMM, yyyy')}
                    </div>
                    <Button variant="outline" size="icon" onClick={goToNextWeek}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline">
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Previous Week
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Copy Previous Week's Availability?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will overwrite your current selections for this week with your availability from last week. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCopyPreviousWeek}>
                          Copy Availability
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Send className="mr-2 h-4 w-4" />
                        Post Results
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Post to Discord</DialogTitle>
                            <DialogDescription>
                                Select the days you want to include in the availability report.
                            </DialogDescription>
                        </DialogHeader>
                        <div className='grid grid-cols-2 gap-4 py-4'>
                            {weekDates.map(day => (
                                <div key={day.toISOString()} className='flex items-center space-x-2'>
                                    <Checkbox
                                        id={format(day, 'yyyy-MM-dd')}
                                        onCheckedChange={(checked) => handleDaySelectForPost(day, checked as boolean)}
                                        checked={selectedDaysForPost.some(d => isSameDay(d, day))}
                                    />
                                    <Label htmlFor={format(day, 'yyyy-MM-dd')} className='text-sm font-medium leading-none'>
                                        {format(day, 'EEEE, d MMM')}
                                    </Label>
                                </div>
                            ))}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setPostDialogOpen(false)}>Cancel</Button>
                          <Button onClick={handlePostToDiscord}>
                              <Send className="mr-2 h-4 w-4" />
                              Send to Discord
                          </Button>
                        </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <TabsContent value="individual">
                <IndividualVotingGrid 
                    userVotes={userVotes} 
                    onVote={handleVote}
                    onVoteAllDay={handleVoteAllDay}
                    onVoteAllTime={handleVoteAllTime}
                    currentDate={currentDate}
                    scheduledEvents={scheduledEvents}
                />
              </TabsContent>
              <TabsContent value="heatmap">
                <HeatmapGrid
                  allVotes={allVotes}
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
