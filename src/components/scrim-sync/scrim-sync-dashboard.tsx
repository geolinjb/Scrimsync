'use client';

import * as React from 'react';
import { format, addDays, startOfWeek, endOfWeek, subWeeks, isSameDay } from 'date-fns';
import { Send, ChevronLeft, ChevronRight, ClipboardCopy } from 'lucide-react';
import type { User } from 'firebase/auth';
import { collection, doc, writeBatch, deleteDoc, query, where, getDocs } from 'firebase/firestore';

import type { PlayerProfileData, ScheduleEvent, UserVotes, AllVotes, Vote } from '@/lib/types';
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
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

type ScrimSyncDashboardProps = {
    user: User;
};

export function ScrimSyncDashboard({ user }: ScrimSyncDashboardProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [currentDate, setCurrentDate] = React.useState(() => new Date());
  
  const [postDialogOpen, setPostDialogOpen] = React.useState(false);
  const [generatedPost, setGeneratedPost] = React.useState<string | null>(null);
  const [selectedDaysForPost, setSelectedDaysForPost] = React.useState<Date[]>([]);

  // Firestore References
  const profileRef = useMemoFirebase(() => doc(firestore, 'users', user.uid), [firestore, user.uid]);
  const allUsersRef = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const eventsRef = useMemoFirebase(() => collection(firestore, 'scheduledEvents'), [firestore]);
  const votesRef = useMemoFirebase(() => collection(firestore, 'votes'), [firestore]);

  // Firestore Hooks
  const { data: profile, isLoading: isProfileLoading } = useDoc<PlayerProfileData>(profileRef);
  const { data: allProfiles, isLoading: areProfilesLoading } = useCollection<PlayerProfileData>(allUsersRef);
  const { data: scheduledEvents, isLoading: areEventsLoading } = useCollection<ScheduleEvent>(eventsRef);
  const { data: allVotesData, isLoading: areVotesLoading } = useCollection<Vote>(votesRef);

  const handleProfileChange = (newProfile: PlayerProfileData) => {
    setDocumentNonBlocking(profileRef, { ...newProfile, id: user.uid }, { merge: true });
  }

  const userVotes: UserVotes = React.useMemo(() => {
    if (!allVotesData) return {};
    return allVotesData
      .filter(vote => vote.userId === user.uid)
      .reduce((acc, vote) => {
        const [dateKey, slot] = vote.timeslot.split('_');
        if (!acc[dateKey]) {
          acc[dateKey] = new Set();
        }
        acc[dateKey].add(slot);
        return acc;
      }, {} as UserVotes);
  }, [allVotesData, user.uid]);

  const allVotes: AllVotes = React.useMemo(() => {
    if (!allVotesData || !allProfiles) return {};
    const profileMap = new Map(allProfiles.map(p => [p.id, p.username]));
    return allVotesData.reduce((acc, vote) => {
      const [dateKey, slot] = vote.timeslot.split('_');
      const voteKey = `${dateKey}-${slot}`;
      const username = profileMap.get(vote.userId);

      if (username) {
        if (!acc[voteKey]) {
          acc[voteKey] = [];
        }
        acc[voteKey].push(username);
      }
      return acc;
    }, {} as AllVotes);
  }, [allVotesData, allProfiles]);

  const handleVote = async (date: Date, timeSlot: string) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const timeslotId = `${dateKey}_${timeSlot}`;
    const voteId = `${user.uid}_${timeslotId}`;
    const voteRef = doc(firestore, 'votes', voteId);

    const isVoted = userVotes[dateKey]?.has(timeSlot);

    if (isVoted) {
        deleteDocumentNonBlocking(voteRef);
    } else {
        const voteData: Vote = {
            id: voteId,
            userId: user.uid,
            timeslot: timeslotId,
            voteValue: true,
        };
        setDocumentNonBlocking(voteRef, voteData, {});
    }
  };

  const handleVoteAllDay = async (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayVotes = userVotes[dateKey] || new Set();
    const allSelected = timeSlots.every(slot => dayVotes.has(slot));
    
    const batch = writeBatch(firestore);

    if (allSelected) { // Deselect all
        timeSlots.forEach(slot => {
            const timeslotId = `${dateKey}_${slot}`;
            const voteId = `${user.uid}_${timeslotId}`;
            const voteRef = doc(firestore, 'votes', voteId);
            batch.delete(voteRef);
        });
    } else { // Select all
        timeSlots.forEach(slot => {
            if (!dayVotes.has(slot)) {
                const timeslotId = `${dateKey}_${slot}`;
                const voteId = `${user.uid}_${timeslotId}`;
                const voteRef = doc(firestore, 'votes', voteId);
                const voteData: Vote = {
                    id: voteId,
                    userId: user.uid,
                    timeslot: timeslotId,
                    voteValue: true,
                };
                batch.set(voteRef, voteData);
            }
        });
    }

    try {
        await batch.commit();
    } catch (e: any) {
        console.error(e);
        toast({
            variant: "destructive",
            title: "Uh oh! Something went wrong.",
            description: e.message || "Could not save your votes.",
        });
    }
  };

  const handleVoteAllTime = async (timeSlot: string) => {
    const weekStart = startOfWeek(currentDate);
    const allSelected = Array.from({length: 7}).every((_, i) => {
        const date = addDays(weekStart, i);
        const dateKey = format(date, 'yyyy-MM-dd');
        return userVotes[dateKey]?.has(timeSlot);
    });

    const batch = writeBatch(firestore);

    for (let i=0; i<7; i++) {
        const date = addDays(weekStart, i);
        const dateKey = format(date, 'yyyy-MM-dd');
        const timeslotId = `${dateKey}_${timeSlot}`;
        const voteId = `${user.uid}_${timeslotId}`;
        const voteRef = doc(firestore, 'votes', voteId);

        if (allSelected) {
            batch.delete(voteRef);
        } else {
            const voteData: Vote = {
                id: voteId,
                userId: user.uid,
                timeslot: timeslotId,
                voteValue: true,
            };
            batch.set(voteRef, voteData);
        }
    }

    try {
        await batch.commit();
    } catch (e: any) {
        console.error(e);
        toast({
            variant: "destructive",
            title: "Uh oh! Something went wrong.",
            description: e.message || "Could not save your votes.",
        });
    }
  };


  const handleAddEvent = (data: { type: 'Training' | 'Tournament'; date: Date; time: string }) => {
    const newEvent: Omit<ScheduleEvent, 'id'> = {
      ...data,
      date: format(data.date, 'yyyy-MM-dd'),
      creatorId: user.uid
    };
    addDocumentNonBlocking(eventsRef, newEvent);
    toast({
      title: 'Event Scheduled!',
      description: `${data.type} on ${format(data.date, 'd MMM, yyyy')} at ${data.time} has been added.`,
    });
  };

  const handleRemoveEvent = (eventId: string) => {
    const eventRef = doc(firestore, 'scheduledEvents', eventId);
    deleteDocumentNonBlocking(eventRef);
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

      const dayEvents = scheduledEvents?.filter(event => isSameDay(new Date(event.date), day)).sort((a, b) => a.time.localeCompare(b.time));
      if (dayEvents && dayEvents.length > 0) {
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
  
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const eventsForWeek = React.useMemo(() => {
    if (!scheduledEvents) return [];
    return scheduledEvents.map(e => ({...e, date: new Date(e.date)}));
  }, [scheduledEvents]);

  const allPlayerNames = React.useMemo(() => {
      if (!allProfiles) return [];
      return allProfiles.map(p => p.username);
  }, [allProfiles]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <PlayerProfile 
                profile={profile ?? { username: '', favoriteTank: '', role: '' }} 
                onProfileChange={handleProfileChange}
                isSaving={isProfileLoading}
            />
            <ScheduleForm onAddEvent={handleAddEvent} currentDate={currentDate} />
            <ScheduledEvents 
                events={eventsForWeek} 
                votes={allVotes} 
                currentDate={currentDate} 
                onRemoveEvent={handleRemoveEvent}
                currentUser={user}
            />
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
              </div>
              <TabsContent value="individual">
                <IndividualVotingGrid 
                    userVotes={userVotes} 
                    onVote={handleVote}
                    onVoteAllDay={handleVoteAllDay}
                    onVoteAllTime={handleVoteAllTime}
                    currentDate={currentDate}
                    scheduledEvents={eventsForWeek}
                />
              </TabsContent>
              <TabsContent value="heatmap" className="space-y-4">
                <div className="flex justify-end">
                    <Dialog open={postDialogOpen} onOpenChange={(isOpen) => !isOpen && closePostDialog()}>
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
                  scheduledEvents={eventsForWeek}
                  currentDate={currentDate}
                  allPlayerNames={allPlayerNames}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
