'use client';

import * as React from 'react';
import { format, addDays, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { User } from 'firebase/auth';
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

type ScrimSyncDashboardProps = {
    user: User;
};

export function ScrimSyncDashboard({ user }: ScrimSyncDashboardProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [currentDate, setCurrentDate] = React.useState(() => new Date());
  
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);

  // Firestore References
  const profileRef = useMemoFirebase(() => doc(firestore, 'users', user.uid), [firestore, user.uid]);
  const allUsersRef = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  
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
  const { data: allProfiles, isLoading: areProfilesLoading } = useCollection<PlayerProfileData>(allUsersRef);
  const { data: scheduledEventsData, isLoading: areEventsLoading } = useCollection<FirestoreScheduleEvent>(eventsQuery);
  const { data: allVotesData, isLoading: areVotesLoading } = useCollection<Vote>(votesQuery);
  
  const scheduledEvents: ScheduleEvent[] = React.useMemo(() => {
    if (!scheduledEventsData) return [];
    // Convert date strings from Firestore to Date objects
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
            path: `users/${user.uid}/votes`,
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
            path: `users/${user.uid}/votes`,
            operation: 'write',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  };

  const handleClearAllVotes = async () => {
    if (!firestore) return;
    const batch = writeBatch(firestore);
    let votesToDelete = 0;

    for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);
        const dateKey = format(date, 'yyyy-MM-dd');
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
    }

    if (votesToDelete === 0) {
        toast({
            description: "You have no votes to clear for this week.",
        });
        return;
    }

    batch.commit().then(() => {
        toast({
            title: "Votes Cleared",
            description: "All your votes for this week have been removed.",
        });
    }).catch(e => {
        const permissionError = new FirestorePermissionError({
            path: `users/${user.uid}/votes`,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
};


  const handleAddEvent = (data: { type: 'Training' | 'Tournament'; date: Date; time: string }) => {
    if (!firestore) return;
    const eventsRef = collection(firestore, 'scheduledEvents');
    const newEvent: FirestoreScheduleEvent = {
      ...data,
      date: format(data.date, 'yyyy-MM-dd'),
      creatorId: user.uid,
      id: '', // ID will be auto-generated by Firestore, but needed for type
    };
    addDocumentNonBlocking(eventsRef, newEvent);
    toast({
      title: 'Event Scheduled!',
      description: `${data.type} on ${format(data.date, 'd MMM, yyyy')} at ${data.time} has been added.`,
    });
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
  
  const allPlayerNames = React.useMemo(() => {
      if (!allProfiles) return [];
      return allProfiles.map(p => p.username).filter(Boolean);
  }, [allProfiles]);

  const isLoading = areEventsLoading || areVotesLoading || areProfilesLoading;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <PlayerProfile 
                initialProfile={profile ?? { id: user.uid, username: user.displayName || '', favoriteTank: '', role: '' }} 
                onSave={handleProfileSave}
                isSaving={isSavingProfile}
                isLoading={isProfileLoading}
            />
            <ScheduleForm onAddEvent={handleAddEvent} currentDate={currentDate} />
            <ScheduledEvents 
                events={scheduledEvents} 
                votes={allVotes} 
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
                      onClearAllVotes={handleClearAllVotes}
                      currentDate={currentDate}
                      scheduledEvents={scheduledEvents}
                  />
                )}
              </TabsContent>
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
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
