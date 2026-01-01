'use client';

import * as React from 'react';
import { format, addDays, startOfWeek, endOfWeek, parseISO, addWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { User as AuthUser } from 'firebase/auth';
import { collection, doc, writeBatch } from 'firebase/firestore';

import type { PlayerProfileData, ScheduleEvent, UserVotes, AllVotes, Vote, FirestoreScheduleEvent } from '@/lib/types';
import { timeSlots } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { HeatmapGrid } from './heatmap-grid';
import { Header } from './header';
import { PlayerProfile } from './player-profile';
import { ScheduleForm } from './schedule-form';
import { IndividualVotingGrid } from './individual-voting-grid';
import { ScheduledEvents } from './scheduled-events';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from '../ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { ADMIN_UID } from '@/lib/config';
import { UserDataPanel } from './user-data-panel';
import { WelcomeInstructions } from './welcome-instructions';
import { DailyVotingGrid } from './daily-voting-grid';


type TeamSyncDashboardProps = {
    user: AuthUser;
};

export function TeamSyncDashboard({ user }: TeamSyncDashboardProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [currentDate, setCurrentDate] = React.useState(() => new Date());
  
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);

  const isAdmin = user.uid === ADMIN_UID;

  // Firestore References
  const profileRef = useMemoFirebase(() => doc(firestore, 'users', user.uid), [firestore, user.uid]);
  
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'scheduledEvents');
  }, [firestore]);

  const votesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'votes');
  }, [firestore]);


  // Firestore Hooks
  const { data: profile, isLoading: isProfileLoading } = useDoc<PlayerProfileData>(profileRef);
  
  const allProfilesForHeatmapRef = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allProfiles, isLoading: areProfilesLoading } = useCollection<PlayerProfileData>(allProfilesForHeatmapRef);

  const { data: scheduledEventsData, isLoading: areEventsLoading } = useCollection<FirestoreScheduleEvent>(eventsQuery);
  const { data: allVotesData, isLoading: areVotesLoading } = useCollection<Vote>(votesQuery);
  
  const scheduledEvents: ScheduleEvent[] = React.useMemo(() => {
    if (!scheduledEventsData) return [];
    return scheduledEventsData.map(e => ({...e, date: parseISO(e.date)}));
  }, [scheduledEventsData]);


  const handleProfileSave = React.useCallback(
    (newProfile: PlayerProfileData) => {
      if (!firestore) return;
      setIsSavingProfile(true);
      const profileDocRef = doc(firestore, 'users', user.uid);
      setDocumentNonBlocking(profileDocRef, { ...newProfile, id: user.uid }, { merge: true });
      toast({
        title: 'Profile Saved!',
        description: 'Your profile has been successfully updated.',
      });
      setTimeout(() => setIsSavingProfile(false), 1000);
    },
    [firestore, user.uid, toast]
  );

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
    if (!firestore) return;
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
    if (!firestore) return;
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayVotes = userVotes[dateKey] || new Set();
    const allSelected = timeSlots.every(slot => dayVotes.has(slot));
    
    const batch = writeBatch(firestore);

    timeSlots.forEach(slot => {
        const timeslotId = `${dateKey}_${slot}`;
        const voteId = `${user.uid}_${timeslotId}`;
        const voteRef = doc(firestore, 'votes', voteId);

        if (allSelected) { // Deselect all
            batch.delete(voteRef);
        } else { // Select all not already selected
            if (!dayVotes.has(slot)) {
                const voteData: Vote = {
                    id: voteId,
                    userId: user.uid,
                    timeslot: timeslotId,
                    voteValue: true,
                };
                batch.set(voteRef, voteData);
            }
        }
    });

    batch.commit().catch(e => {
        const permissionError = new FirestorePermissionError({
            path: 'votes',
            operation: 'write',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  };

  const handleVoteAllTime = async (timeSlot: string) => {
    if (!firestore) return;
    const weekStartVote = startOfWeek(currentDate, { weekStartsOn: 1 });
    const allSelected = Array.from({length: 7}).every((_, i) => {
        const date = addDays(weekStartVote, i);
        const dateKey = format(date, 'yyyy-MM-dd');
        return userVotes[dateKey]?.has(timeSlot);
    });

    const batch = writeBatch(firestore);

    for (let i=0; i<7; i++) {
        const date = addDays(weekStartVote, i);
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
    
    batch.commit().catch(e => {
        const permissionError = new FirestorePermissionError({
            path: 'votes',
            operation: 'write',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  };

  const handleClearAllVotes = async (date?: Date) => {
    if (!firestore) return;
    const batch = writeBatch(firestore);
    let votesToDelete = 0;
    
    const datesToClear = date ? [date] : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    datesToClear.forEach(d => {
        const dateKey = format(d, 'yyyy-MM-dd');
        const dayVotes = userVotes[dateKey];
        if (dayVotes) {
            dayVotes.forEach(slot => {
                const timeslotId = `${dateKey}_${slot}`;
                const voteId = `${user.uid}_${timeslotId}`;
                const voteRef = doc(firestore, 'votes', voteId);
                batch.delete(voteRef);
                votesToDelete++;
            });
        }
    });
    

    if (votesToDelete === 0) {
        toast({
            description: `You have no votes to clear for ${date ? 'this day' : 'this week'}.`,
        });
        return;
    }

    batch.commit().then(() => {
        toast({
            title: "Votes Cleared",
            description: `All your votes for ${date ? 'this day' : 'this week'} have been removed.`,
        });
    }).catch(e => {
        const permissionError = new FirestorePermissionError({
            path: 'votes',
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
};

const handleCopyLastWeeksVotes = React.useCallback(async () => {
    if (!firestore || !allVotesData) return;

    const lastWeekStartDate = addDays(weekStart, -7);
    const lastWeekEndDate = endOfWeek(lastWeekStartDate);


    const lastWeekVotes = allVotesData.filter(vote => {
        if (vote.userId !== user.uid) return false;
        try {
            const voteDate = parseISO(vote.timeslot.split('_')[0]);
            return voteDate >= lastWeekStartDate && voteDate <= lastWeekEndDate;
        } catch (e) {
            return false;
        }
    });

    if (lastWeekVotes.length === 0) {
        toast({ description: "No votes found from last week to copy." });
        return;
    }

    const batch = writeBatch(firestore);
    let newVotesCount = 0;

    lastWeekVotes.forEach(vote => {
        const [dateKey, slot] = vote.timeslot.split('_');
        const newDate = addDays(parseISO(dateKey), 7);
        const newDateKey = format(newDate, 'yyyy-MM-dd');
        
        const newTimeslotId = `${newDateKey}_${slot}`;
        const newVoteId = `${user.uid}_${newTimeslotId}`;

        // Check if the vote for the new week already exists
        const voteExists = userVotes[newDateKey]?.has(slot);

        if (!voteExists) {
            const voteRef = doc(firestore, 'votes', newVoteId);
            const voteData: Vote = {
                id: newVoteId,
                userId: user.uid,
                timeslot: newTimeslotId,
                voteValue: true,
            };
            batch.set(voteRef, voteData);
            newVotesCount++;
        }
    });

    if (newVotesCount === 0) {
        toast({ description: "Last week's votes are already present this week." });
        return;
    }

    try {
        await batch.commit();
        toast({
            title: "Votes Copied!",
            description: `Successfully copied ${newVotesCount} vote(s) from last week.`,
        });
    } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: 'votes',
            operation: 'write',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
}, [firestore, allVotesData, weekStart, user.uid, userVotes, toast]);

const hasLastWeekVotes = React.useMemo(() => {
    if (!allVotesData) return false;
    const lastWeekStartDate = addDays(weekStart, -7);
    const lastWeekEndDate = endOfWeek(lastWeekStartDate);

    return allVotesData.some(vote => {
        if (vote.userId !== user.uid) return false;
        try {
            const voteDate = parseISO(vote.timeslot.split('_')[0]);
            return voteDate >= lastWeekStartDate && voteDate <= lastWeekEndDate;
        } catch(e) {
            return false;
        }
    });
}, [allVotesData, user.uid, weekStart]);

  const handleAddEvent = (data: { type: 'Training' | 'Tournament'; date: Date; time: string, repeatWeekly?: boolean; }) => {
    if (!firestore) return;

    if (data.repeatWeekly) {
        const batch = writeBatch(firestore);
        const eventsRef = collection(firestore, 'scheduledEvents');

        for (let i = 0; i < 4; i++) {
            const eventDate = addWeeks(data.date, i);
            const newEvent: Omit<FirestoreScheduleEvent, 'id'> = {
                type: data.type,
                date: format(eventDate, 'yyyy-MM-dd'),
                time: data.time,
                creatorId: user.uid,
                isRecurring: true,
            };
            const docRef = doc(eventsRef); 
            batch.set(docRef, newEvent);
        }

        batch.commit().then(() => {
            toast({
                title: 'Recurring Event Scheduled!',
                description: `${data.type} has been scheduled for the next 4 weeks.`,
            });
        }).catch(e => {
            const permissionError = new FirestorePermissionError({
                path: 'scheduledEvents',
                operation: 'create',
            });
            errorEmitter.emit('permission-error', permissionError);
        });

    } else {
        const newEvent: Omit<FirestoreScheduleEvent, 'id'> = {
          type: data.type,
          date: format(data.date, 'yyyy-MM-dd'),
          time: data.time,
          creatorId: user.uid,
          isRecurring: false,
        };
        const eventsRef = collection(firestore, 'scheduledEvents');
        addDocumentNonBlocking(eventsRef, newEvent);
        toast({
          title: 'Event Scheduled!',
          description: `${data.type} on ${format(data.date, 'd MMM, yyyy')} at ${data.time} has been added.`,
        });
    }
  };

  const handleRemoveEvent = (eventId: string) => {
    if (!firestore) return;
    const eventRef = doc(firestore, 'scheduledEvents', eventId);
    deleteDocumentNonBlocking(eventRef);
    toast({
      title: 'Event Removed',
      description: 'The scheduled event has been successfully removed.',
    });
  };

  const goToPreviousWeek = () => {
    setCurrentDate(prev => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setCurrentDate(prev => addDays(prev, 7));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  const allPlayerNames = React.useMemo(() => {
      if (!allProfiles) return [];
      return allProfiles.map(p => p.username).filter(Boolean);
  }, [allProfiles]);

  const isLoading = areEventsLoading || areVotesLoading || areProfilesLoading;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        
        <WelcomeInstructions username={profile?.username || user.displayName || 'Player'} />

        <div className="flex justify-between items-center flex-wrap gap-4">
            <h2 className="text-2xl font-bold tracking-tight">
                Availability for: {format(weekStart, 'd MMM')} - {format(weekEnd, 'd MMM, yyyy')}
            </h2>
            <div className='flex items-center gap-2'>
                <Button variant="outline" onClick={goToToday}>Today</Button>
                <div className='flex items-center'>
                    <Button variant="outline" size="icon" onClick={goToPreviousWeek} className="rounded-r-none">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={goToNextWeek} className="rounded-l-none border-l-0">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>

        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="daily">Daily View</TabsTrigger>
            <TabsTrigger value="weekly">Weekly View</TabsTrigger>
          </TabsList>
          <TabsContent value="daily">
            {isLoading ? (
                <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[65vh] w-full" />
                </CardContent>
                </Card>
            ) : (
                <DailyVotingGrid 
                    userVotes={userVotes} 
                    onVote={handleVote}
                    onVoteAllDay={handleVoteAllDay}
                    onClearAllVotes={handleClearAllVotes}
                    onCopyLastWeeksVotes={handleCopyLastWeeksVotes}
                    hasLastWeekVotes={hasLastWeekVotes}
                    currentDate={currentDate}
                    scheduledEvents={scheduledEvents}
                />
            )}
          </TabsContent>
          <TabsContent value="weekly">
             {isLoading ? (
                <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[65vh] w-full" />
                </CardContent>
                </Card>
            ) : (
                <IndividualVotingGrid 
                    userVotes={userVotes} 
                    onVote={handleVote}
                    onVoteAllDay={handleVoteAllDay}
                    onVoteAllTime={handleVoteAllTime}
                    onClearAllVotes={() => handleClearAllVotes()}
                    onCopyLastWeeksVotes={handleCopyLastWeeksVotes}
                    hasLastWeekVotes={hasLastWeekVotes}
                    currentDate={currentDate}
                    scheduledEvents={scheduledEvents}
                />
            )}
          </TabsContent>
        </Tabs>
        
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-8">
                <PlayerProfile 
                    initialProfile={profile ?? { id: user.uid, username: user.displayName || '', favoriteTank: '', role: '' }} 
                    onSave={handleProfileSave}
                    isSaving={isSavingProfile}
                    isLoading={isProfileLoading}
                />
                 {isAdmin && <ScheduleForm onAddEvent={handleAddEvent} currentDate={currentDate} />}
            </div>
            <div className="lg:col-span-2 space-y-8">
                <ScheduledEvents 
                    events={scheduledEvents} 
                    votes={allVotes}
                    allPlayerNames={allPlayerNames}
                    onRemoveEvent={handleRemoveEvent}
                    currentUser={user}
                />
            </div>
        </div>

        <Tabs defaultValue="heatmap" className='w-full pt-8'>
            <TabsList>
                <TabsTrigger value="heatmap">Team Heatmap</TabsTrigger>
                {isAdmin && <TabsTrigger value="admin">User Data</TabsTrigger>}
            </TabsList>
            <TabsContent value="heatmap" className="space-y-4">
            {isLoading ? (
                <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[65vh] w-full" />
                </CardContent>
                </Card>
            ) : (
                <HeatmapGrid
                allVotes={allVotes}
                scheduledEvents={scheduledEvents}
                currentDate={currentDate}
                allPlayerNames={allPlayerNames}
                />
            )}
            </TabsContent>
            {isAdmin && (
            <TabsContent value="admin">
                <UserDataPanel 
                    allProfiles={allProfiles} 
                    isLoading={areProfilesLoading}
                    events={scheduledEvents}
                    onRemoveEvent={handleRemoveEvent}
                />
            </TabsContent>
            )}
        </Tabs>
      </main>
    </div>
  );
}
