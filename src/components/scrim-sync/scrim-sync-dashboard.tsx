'use client';

import * as React from 'react';
import { format, addDays, startOfWeek, endOfWeek, subWeeks, isSameDay } from 'date-fns';
import { Send, ChevronLeft, ChevronRight, Copy, ClipboardCopy } from 'lucide-react';

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
import { Textarea } from '../ui/textarea';


export function ScrimSyncDashboard() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = React.useState(() => new Date());
  const [isClient, setIsClient] = React.useState(false);


  const [profile, setProfile] = React.useState<PlayerProfileData>({
    username: 'Player1',
    favoriteTank: 'M4A3E8 Sherman',
    role: 'Medium Tank',
  });

  const [allVotes, setAllVotes] = React.useState<AllVotes>({});
  const [userVotes, setUserVotes] = React.useState<UserVotes>({});

  const [scheduledEvents, setScheduledEvents] = React.useState<ScheduleEvent[]>([]);
  
  const [postDialogOpen, setPostDialogOpen] = React.useState(false);
  const [generatedPost, setGeneratedPost] = React.useState<string | null>(null);
  const [selectedDaysForPost, setSelectedDaysForPost] = React.useState<Date[]>([]);


  React.useEffect(() => {
    setIsClient(true);
  }, []);
  
  const generateRandomData = React.useCallback(() => {
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
              const voterCount = Math.floor(Math.random() * (otherPlayers.length));
              
              const shuffledPlayers = otherPlayers.sort(() => 0.5 - Math.random());
              for(let j = 0; j < voterCount; j++) {
                  availablePlayers.add(shuffledPlayers[j]);
              }
              
              initialVotes[voteKey] = Array.from(availablePlayers);
          });
      }
      setAllVotes(initialVotes);
  }, [currentDate, userVotes, profile.username]);

  React.useEffect(() => {
    if (!isClient) return;

    setScheduledEvents([
        {
          id: '1',
          type: 'Training',
          date: new Date(),
          time: '6:30 PM',
        },
        {
            id: '2',
            type: 'Tournament',
            date: addDays(new Date(), 1),
            time: '8:30 PM'
        }
    ]);
    
    generateRandomData();
    
  }, [isClient, generateRandomData]);

  if (!isClient) {
    return null;
  }

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

  const handleRemoveEvent = (eventId: string) => {
    setScheduledEvents(prev => prev.filter(event => event.id !== eventId));
    toast({
      title: 'Event Removed',
      description: 'The scheduled event has been successfully removed.',
      variant: 'destructive'
    });
  };

  const handleGeneratePost = () => {
    if (selectedDaysForPost.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No days selected',
        description: 'Please select at least one day to generate a report.',
      });
      return;
    }

    const sortedDays = selectedDaysForPost.sort((a, b) => a.getTime() - b.getTime());

    let post = `**Team Availability for ${format(sortedDays[0], 'd MMM')} - ${format(sortedDays[sortedDays.length - 1], 'd MMM, yyyy')}**\n\n`;

    sortedDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      post += `**${format(day, 'EEEE, d MMM')}**\n`;

      const dayEvents = scheduledEvents.filter(event => isSameDay(day, event.date)).sort((a, b) => a.time.localeCompare(b.time));
      if (dayEvents.length > 0) {
        post += '***Scheduled Events:***\n';
        dayEvents.forEach(event => {
          post += `- ${event.type} at ${event.time}\n`;
        });
        post += '\n';
      }

      const daySlots = Object.entries(allVotes).filter(([key]) => key.startsWith(dayKey));
      
      const popularSlots = daySlots
        .map(([key, players]) => ({ slot: key.split('-').slice(3).join('-'), count: players.length, players }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count);

      if (popularSlots.length > 0) {
        post += '***Availability:***\n';
        popularSlots.forEach(({slot, count, players}) => {
          post += `- **${slot}**: ${count} players (${players.join(', ')})\n`;
        });
      } else {
        post += '_No availability submitted for this day._\n';
      }

      post += '\n';
    });

    setGeneratedPost(post);
  };
  
  const handleDaySelectForPost = (day: Date, checked: boolean) => {
    setSelectedDaysForPost(prev => {
        const newSelection = checked ? [...prev, day] : prev.filter(d => !isSameDay(d, day));
        return newSelection.sort((a,b) => a.getTime() - b.getTime());
    })
  }

  const closePostDialog = () => {
    setPostDialogOpen(false);
    setTimeout(() => {
        setGeneratedPost(null);
        setSelectedDaysForPost([]);
    }, 300);
  }

  const copyToClipboard = () => {
    if (generatedPost) {
        navigator.clipboard.writeText(generatedPost);
        toast({
            title: 'Copied to clipboard!',
        });
    }
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <PlayerProfile profile={profile} onProfileChange={setProfile} />
            <ScheduleForm onAddEvent={handleAddEvent} currentDate={currentDate} />
            <ScheduledEvents events={scheduledEvents} votes={allVotes} currentDate={currentDate} onRemoveEvent={handleRemoveEvent} />
          </div>
          <div className="lg:col-span-3 space-y-6">
            <Tabs defaultValue="individual" className='w-full'>
              <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <TabsList>
                  <TabsTrigger value="individual">Individual Voting</TabsTrigger>
                  <TabsTrigger value="heatmap">Team Heatmap</TabsTrigger>
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
              <TabsContent value="heatmap" className="space-y-4">
                <div className="flex justify-end">
                    <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
                        <DialogTrigger asChild>
                        <Button>
                            <Send className="mr-2 h-4 w-4" />
                            Send to Discord
                        </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                            {generatedPost ? (
                                <>
                                    <DialogHeader>
                                        <DialogTitle>Post to Discord</DialogTitle>
                                        <DialogDescription>
                                            Copy the message below and paste it in your Discord server.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <Textarea
                                        readOnly
                                        value={generatedPost}
                                        className="min-h-[250px] text-sm bg-muted/50"
                                    />
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setGeneratedPost(null)}>Back</Button>
                                        <Button onClick={copyToClipboard} variant="secondary">
                                            <ClipboardCopy className="mr-2 h-4 w-4" />
                                            Copy
                                        </Button>
                                        <Button onClick={closePostDialog}>Done</Button>
                                    </DialogFooter>
                                </>
                            ) : (
                                <>
                                    <DialogHeader>
                                        <DialogTitle>Create Discord Post</DialogTitle>
                                        <DialogDescription>
                                            Select the days you want to include in the availability report.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className='grid grid-cols-2 lg:grid-cols-3 gap-4 py-4'>
                                        {weekDates.map(day => (
                                            <div key={day.toISOString()} className='flex items-center space-x-2'>
                                                <Checkbox
                                                    id={format(day, 'yyyy-MM-dd')}
                                                    onCheckedChange={(checked) => handleDaySelectForPost(day, checked as boolean)}
                                                    checked={selectedDaysForPost.some(d => isSameDay(d, day))}
                                                />
                                                <Label htmlFor={format(day, 'yyyy-MM-dd')} className='text-sm font-medium leading-none cursor-pointer'>
                                                    {format(day, 'EEEE, d MMM')}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                    <DialogFooter>
                                    <Button variant="outline" onClick={closePostDialog}>Cancel</Button>
                                    <Button onClick={handleGeneratePost} disabled={selectedDaysForPost.length === 0}>
                                        Generate Post
                                    </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
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
