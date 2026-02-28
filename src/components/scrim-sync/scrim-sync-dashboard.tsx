'use client';

import * as React from 'react';
import { format, addDays, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react';
import type { User as AuthUser } from 'firebase/auth';
import { collection, doc, writeBatch, setDoc } from 'firebase/firestore';

import type { PlayerProfileData, ScheduleEvent, UserVotes, AllVotes, Vote, FirestoreScheduleEvent, AvailabilityOverride } from '@/lib/types';
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
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from '../ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { UserDataPanel } from './user-data-panel';
import { WelcomeInstructions } from './welcome-instructions';
import { DailyVotingGrid } from './daily-voting-grid';
import { ADMIN_UID, FALLBACK_ADMIN_UID } from '@/lib/config';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EventVotingDialog } from './event-voting-dialog';


type TeamSyncDashboardProps = {
    user: AuthUser;
};

export function TeamSyncDashboard({ user: authUser }: TeamSyncDashboardProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [mounted, setMounted] = React.useState(false);
  const [currentDate, setCurrentDate] = React.useState<Date | null>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('daily');
  const [dayOffset, setDayOffset] = React.useState(0);
  
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [eventToVoteOn, setEventToVoteOn] = React.useState<ScheduleEvent | null>(null);
  const [isEventVotingOpen, setIsEventVotingOpen] = React.useState(false);
  
  const { user } = useUser();

  React.useEffect(() => {
    setMounted(true);
    const now = new Date();
    setCurrentDate(now);
    setDayOffset((now.getDay() + 6) % 7);
  }, []);

  React.useEffect(() => {
    if (user) {
      if (user.uid === ADMIN_UID || user.uid === FALLBACK_ADMIN_UID) {
          setIsAdmin(true);
          return;
      }
      
      user.getIdTokenResult().then(idTokenResult => {
        const claims = idTokenResult.claims;
        setIsAdmin(claims.admin === true);
      }).catch(err => {
          console.error("Error fetching token claims:", err);
      });
    } else {
        setIsAdmin(false);
    }
  }, [user]);

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser.uid]);
  
  const weekStart = React.useMemo(() => {
    if (!currentDate) return new Date();
    return startOfWeek(currentDate, { weekStartsOn: 1 });
  }, [currentDate]);

  const weekEnd = React.useMemo(() => {
    if (!currentDate) return new Date();
    return endOfWeek(currentDate, { weekStartsOn: 1 });
  }, [currentDate]);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'scheduledEvents');
  }, [firestore]);

  const votesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'votes');
  }, [firestore]);

  const overridesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'availabilityOverrides');
  }, [firestore]);

  const { data: profile, isLoading: isProfileLoading } = useDoc<PlayerProfileData>(profileRef);
  
  const allProfilesForHeatmapRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  const { data: allProfiles, isLoading: areProfilesLoading } = useCollection<PlayerProfileData>(allProfilesForHeatmapRef);

  const { data: scheduledEventsData, isLoading: areEventsLoading } = useCollection<FirestoreScheduleEvent>(eventsQuery);
  const { data: allVotesData, isLoading: areVotesLoading } = useCollection<Vote>(votesQuery);
  const { data: availabilityOverridesData, isLoading: areOverridesLoading } = useCollection<AvailabilityOverride>(overridesQuery);
  
  const scheduledEvents: ScheduleEvent[] = React.useMemo(() => {
    if (!scheduledEventsData) return [];
    return scheduledEventsData.map(e => ({...e, date: parseISO(e.date)}));
  }, [scheduledEventsData]);

    const { userCombinedVotes, userEventVotes, allCombinedVotes, allEventVotes } = React.useMemo(() => {
        if (!allVotesData || !allProfiles) {
            return { 
                userCombinedVotes: {}, 
                userEventVotes: new Set<string>(), 
                allCombinedVotes: {}, 
                allEventVotes: {} 
            };
        }
        
        const userCombinedVotes: UserVotes = {};
        const userEventVotes = new Set<string>();

        const allCombinedVotes: AllVotes = {};
        const allEventVotes: { [key: string]: string[] } = {};

        const profileMap = new Map(allProfiles.map(p => [p.id, p.username]));

        for (const vote of allVotesData) {
            const username = profileMap.get(vote.userId);
            if (!username || !vote.timeslot) continue;

            const [dateKey, slot] = vote.timeslot.split('_');

            if (vote.eventId) {
                if (!allEventVotes[vote.eventId]) {
                    allEventVotes[vote.eventId] = [];
                }
                if(!allEventVotes[vote.eventId].includes(username)) {
                    allEventVotes[vote.eventId].push(username);
                }

                if (vote.userId === authUser.uid) {
                    userEventVotes.add(vote.eventId);
                }
            }
            
            const voteKey = `${dateKey}-${slot}`;

            if (!allCombinedVotes[voteKey]) {
                allCombinedVotes[voteKey] = [];
            }
            if (!allCombinedVotes[voteKey].includes(username)) {
                allCombinedVotes[voteKey].push(username);
            }

            if (vote.userId === authUser.uid) {
                if (!userCombinedVotes[dateKey]) {
                    userCombinedVotes[dateKey] = new Set();
                }
                userCombinedVotes[dateKey].add(slot);
            }
        }

        return { userCombinedVotes, userEventVotes, allCombinedVotes, allEventVotes };

    }, [allVotesData, allProfiles, authUser.uid]);

    const isVotingOnEvent = React.useMemo(() => {
        if (!eventToVoteOn || !userEventVotes) return false;
        return userEventVotes.has(eventToVoteOn.id);
    }, [eventToVoteOn, userEventVotes]);


  const handleEventVote = async (eventId: string, date: Date, timeSlot: string) => {
    if (!firestore) return;
    const voteId = `${authUser.uid}_${eventId}`;
    const voteRef = doc(firestore, 'votes', voteId);

    const isVoted = userEventVotes.has(eventId);

    if (isVoted) {
        deleteDocumentNonBlocking(voteRef);
    } else {
        const voteData: Vote = {
            id: voteId,
            userId: authUser.uid,
            timeslot: `${format(date, 'yyyy-MM-dd')}_${timeSlot}`,
            voteValue: true,
            eventId: eventId,
        };
        setDocumentNonBlocking(voteRef, voteData, {});
    }
  };

  const handleGeneralVote = async (date: Date, timeSlot: string) => {
    if (!firestore) return;
    const dateKey = format(date, 'yyyy-MM-dd');
    const timeslotId = `${dateKey}_${timeSlot}`;
    const voteId = `${authUser.uid}_${timeslotId}`;
    const voteRef = doc(firestore, 'votes', voteId);

    const isVoted = userCombinedVotes[dateKey]?.has(timeSlot);


    if (isVoted) {
        deleteDocumentNonBlocking(voteRef);
    } else {
        const voteData: Vote = {
            id: voteId,
            userId: authUser.uid,
            timeslot: timeslotId,
            voteValue: true,
        };
        setDocumentNonBlocking(voteRef, voteData, {});
    }
  };


  const handleVoteAllDay = async (date: Date) => {
    if (!firestore) return;
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayVotes = userCombinedVotes[dateKey] || new Set();
    const allSelected = timeSlots.every(slot => dayVotes.has(slot));
    
    const batch = writeBatch(firestore);

    timeSlots.forEach(slot => {
        const timeslotId = `${dateKey}_${slot}`;
        const voteId = `${authUser.uid}_${timeslotId}`;
        const voteRef = doc(firestore, 'votes', voteId);

        if (allSelected) {
            const isEventVote = allVotesData?.some(v => v.timeslot === timeslotId && v.userId === authUser.uid && v.eventId);
            if(!isEventVote) {
                batch.delete(voteRef);
            }
        } else {
            if (!dayVotes.has(slot)) {
                const voteData: Vote = {
                    id: voteId,
                    userId: authUser.uid,
                    timeslot: timeslotId,
                    voteValue: true,
                };
                batch.set(voteRef, voteData);
            }
        }
    });

    batch.commit().catch(e => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'votes', operation: 'write' }));
    });
  };

  const handleVoteAllTime = async (timeSlot: string) => {
    if (!firestore || !currentDate) return;
    const weekStartVote = startOfWeek(currentDate, { weekStartsOn: 1 });
    const allSelected = Array.from({length: 7}).every((_, i) => {
        const date = addDays(weekStartVote, i);
        const dateKey = format(date, 'yyyy-MM-dd');
        return userCombinedVotes[dateKey]?.has(timeSlot);
    });

    const batch = writeBatch(firestore);

    for (let i=0; i<7; i++) {
        const date = addDays(weekStartVote, i);
        const dateKey = format(date, 'yyyy-MM-dd');
        const timeslotId = `${dateKey}_${timeSlot}`;
        const voteId = `${authUser.uid}_${timeslotId}`;
        const voteRef = doc(firestore, 'votes', voteId);

        if (allSelected) {
            const isEventVote = allVotesData?.some(v => v.timeslot === timeslotId && v.userId === authUser.uid && v.eventId);
            if(!isEventVote) {
                batch.delete(voteRef);
            }
        } else {
             if (!userCombinedVotes[dateKey]?.has(timeSlot)) {
                const voteData: Vote = {
                    id: voteId,
                    userId: authUser.uid,
                    timeslot: timeslotId,
                    voteValue: true,
                };
                batch.set(voteRef, voteData);
            }
        }
    }
    
    batch.commit().catch(e => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'votes', operation: 'write' }));
    });
  };

  const handleClearAllVotes = async (date?: Date) => {
    if (!firestore) return;
    const batch = writeBatch(firestore);
    let votesToDelete = 0;
    
    const datesToClear = date ? [date] : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    datesToClear.forEach(d => {
        const dateKey = format(d, 'yyyy-MM-dd');
        const dayVotes = userCombinedVotes[dateKey];
        if (dayVotes) {
            dayVotes.forEach(slot => {
                const isEventVote = allVotesData?.some(v => v.timeslot === `${dateKey}_${slot}` && v.userId === authUser.uid && v.eventId);
                if (!isEventVote) {
                    const timeslotId = `${dateKey}_${slot}`;
                    const voteId = `${authUser.uid}_${timeslotId}`;
                    const voteRef = doc(firestore, 'votes', voteId);
                    batch.delete(voteRef);
                    votesToDelete++;
                }
            });
        }
    });
    

    if (votesToDelete === 0) {
        toast({
            description: `You have no general availability votes to clear for ${date ? 'this day' : 'this week'}.`,
        });
        return;
    }

    batch.commit().then(() => {
        toast({
            title: "Votes Cleared",
            description: `Your general votes for ${date ? 'this day' : 'this week'} have been removed.`,
        });
    }).catch(e => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'votes', operation: 'delete' }));
    });
};

const handleCopyLastWeeksVotes = React.useCallback(async () => {
    if (!firestore || !allVotesData || !currentDate) return;

    const lastWeekStartDate = addDays(weekStart, -7);
    const lastWeekEndDate = endOfWeek(lastWeekStartDate);


    const lastWeekVotes = allVotesData.filter(vote => {
        if (vote.userId !== authUser.uid) return false;
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
        let newVoteId = `${authUser.uid}_${newTimeslotId}`;
        let voteExists = userCombinedVotes[newDateKey]?.has(slot);

        if (!voteExists) {
            const voteRef = doc(firestore, 'votes', newVoteId);
            const voteData: Vote = {
                id: newVoteId,
                userId: authUser.uid,
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
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'votes', operation: 'write' }));
    }
}, [firestore, allVotesData, weekStart, authUser.uid, userCombinedVotes, toast, currentDate]);

  const handleAddEvent = (data: { type: 'Training' | 'Tournament'; date: Date; time: string; description?: string; discordRoleId?: string }) => {
    if (!firestore) return;

    const newEvent: Omit<FirestoreScheduleEvent, 'id'> = {
      type: data.type,
      date: format(data.date, 'yyyy-MM-dd'),
      time: data.time,
      creatorId: authUser.uid,
      isRecurring: false,
      description: data.description,
      status: 'Active',
      discordRoleId: data.discordRoleId,
    };
    const eventsRef = collection(firestore, 'scheduledEvents');
    addDocumentNonBlocking(eventsRef, newEvent);

    toast({
      title: 'Event Scheduled!',
      description: `${data.type} on ${format(data.date, 'd MMM, yyyy')} has been added.`,
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

  const handleProfileSave = async (updatedProfile: PlayerProfileData) => {
    if (!firestore || !authUser) return;
    setIsSavingProfile(true);
    const userDocRef = doc(firestore, 'users', authUser.uid);
    
    const dataToSave: any = {
      username: updatedProfile.username,
      discordUsername: updatedProfile.discordUsername,
      photoURL: updatedProfile.photoURL,
      favoriteTank: updatedProfile.favoriteTank,
      role: updatedProfile.role,
    };

    if (isAdmin) {
      dataToSave.rosterStatus = updatedProfile.rosterStatus;
      dataToSave.playstyleTags = updatedProfile.playstyleTags;
    }

    setDoc(userDocRef, dataToSave, { merge: true })
      .then(() => {
        toast({ title: 'Profile Updated', description: 'Your changes have been saved.' });
      })
      .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'update',
          requestResourceData: dataToSave,
        }));
      })
      .finally(() => {
        setIsSavingProfile(false);
      });
  };

  const goToPreviousWeek = () => {
    setCurrentDate(prev => prev ? addDays(prev, -7) : null);
  };

  const goToNextWeek = () => {
    setCurrentDate(prev => prev ? addDays(prev, 7) : null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  if (!mounted || !currentDate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Skeleton className="h-12 w-64" />
      </div>
    );
  }

  const isLoading = areEventsLoading || areVotesLoading || areProfilesLoading || areOverridesLoading;
  const canSeeAdminPanel = isAdmin;

  return (
    <>
      <AlertDialog open={!!eventToVoteOn} onOpenChange={(isOpen) => !isOpen && setEventToVoteOn(null)}>
          <AlertDialogContent>
              {eventToVoteOn && (
                  <>
                      <AlertDialogHeader>
                          <AlertDialogTitle>{isVotingOnEvent ? "Cancel Attendance?" : "Confirm Attendance?"}</AlertDialogTitle>
                          <AlertDialogDescription>
                              {isVotingOnEvent
                                  ? `Are you sure you want to mark yourself as unavailable for the ${eventToVoteOn.type.toLowerCase()} on ${format(new Date(eventToVoteOn.date), 'EEEE')} at ${eventToVoteOn.time}?`
                                  : `Are you sure you are available for the ${eventToVoteOn.type.toLowerCase()} on ${format(new Date(eventToVoteOn.date), 'EEEE')} at ${eventToVoteOn.time}?`
                              }
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => {
                              if (eventToVoteOn) {
                                  handleEventVote(eventToVoteOn.id, new Date(eventToVoteOn.date), eventToVoteOn.time);
                                  setEventToVoteOn(null);
                              }
                          }}>
                              {isVotingOnEvent ? "Yes, I'm Unavailable" : "Yes, I'm Available"}
                          </AlertDialogAction>
                      </AlertDialogFooter>
                  </>
              )}
          </AlertDialogContent>
      </AlertDialog>
      <EventVotingDialog 
        isOpen={isEventVotingOpen}
        onOpenChange={setIsEventVotingOpen}
        events={scheduledEvents}
        userEventVotes={userEventVotes}
        onEventVoteTrigger={setEventToVoteOn}
      />
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
          
          <WelcomeInstructions username={profile?.username || authUser.displayName || 'Player'} />
          
          <ScheduledEvents 
              events={scheduledEvents} 
              allEventVotes={allEventVotes}
              userEventVotes={userEventVotes}
              onEventVoteTrigger={setEventToVoteOn}
              onRemoveEvent={handleRemoveEvent}
              currentUser={authUser}
              isAdmin={canSeeAdminPanel}
              availabilityOverrides={availabilityOverridesData || []}
          />

          <div className="flex flex-col items-center justify-center gap-6">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-center">
                  Availability: {format(weekStart, 'd MMM')} - {format(weekEnd, 'd MMM, yyyy')}
              </h2>
              <div className='flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto justify-center'>
                  <Button onClick={() => setIsEventVotingOpen(true)} className="w-full sm:w-auto">
                    <CalendarCheck className="mr-2 h-4 w-4" />
                    Vote on Events
                  </Button>
                  <div className='flex items-center gap-2 justify-center'>
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
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" id="voting-tabs">
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
                      userVotes={userCombinedVotes} 
                      onVote={handleGeneralVote}
                      onVoteAllDay={handleVoteAllDay}
                      onClearAllVotes={handleClearAllVotes}
                      onCopyLastWeeksVotes={handleCopyLastWeeksVotes}
                      hasLastWeekVotes={!!allVotesData?.length}
                      currentDate={currentDate}
                      scheduledEvents={scheduledEvents}
                      dayOffset={dayOffset}
                      setDayOffset={setDayOffset}
                      onEventVoteTrigger={setEventToVoteOn}
                      availabilityOverrides={availabilityOverridesData || []}
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
                      userVotes={userCombinedVotes} 
                      onVote={handleGeneralVote}
                      onVoteAllDay={handleVoteAllDay}
                      onVoteAllTime={handleVoteAllTime}
                      onClearAllVotes={() => handleClearAllVotes()}
                      onCopyLastWeeksVotes={handleCopyLastWeeksVotes}
                      hasLastWeekVotes={!!allVotesData?.length}
                      currentDate={currentDate}
                      scheduledEvents={scheduledEvents}
                      onEventVoteTrigger={setEventToVoteOn}
                  />
              )}
            </TabsContent>
          </Tabs>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8">
              <div className="lg:col-span-1 space-y-8">
                  <PlayerProfile 
                      initialProfile={{ 
                          id: authUser.uid, 
                          username: profile?.username ?? authUser.displayName ?? '', 
                          photoURL: profile?.photoURL ?? authUser.photoURL,
                          email: authUser.email,
                          favoriteTank: profile?.favoriteTank ?? '', 
                          role: profile?.role ?? '',
                          rosterStatus: profile?.rosterStatus,
                          playstyleTags: profile?.playstyleTags,
                          lastNotificationReadTimestamp: profile?.lastNotificationReadTimestamp,
                      }} 
                      onSave={handleProfileSave}
                      isSaving={isSavingProfile}
                      isLoading={isProfileLoading}
                  />
                  {canSeeAdminPanel && <ScheduleForm onAddEvent={handleAddEvent} currentDate={currentDate} />}
              </div>
              <div className="lg:col-span-2 space-y-8">
                  <Tabs defaultValue="heatmap" className='w-full'>
                      <TabsList>
                          <TabsTrigger value="heatmap">Team Heatmap</TabsTrigger>
                          {canSeeAdminPanel && <TabsTrigger value="admin">User Data</TabsTrigger>}
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
                          allVotes={allCombinedVotes}
                          scheduledEvents={scheduledEvents}
                          currentDate={currentDate}
                          allProfiles={allProfiles}
                          availabilityOverrides={availabilityOverridesData || []}
                          />
                      )}
                      </TabsContent>
                      {canSeeAdminPanel && (
                      <TabsContent value="admin">
                          <UserDataPanel 
                              allProfiles={allProfiles} 
                              isLoading={areProfilesLoading || areVotesLoading}
                              events={scheduledEvents}
                              onRemoveEvent={handleRemoveEvent}
                              allVotesData={allVotesData}
                              currentUser={authUser}
                              isAdmin={canSeeAdminPanel}
                          />
                      </TabsContent>
                      )}
                  </Tabs>
              </div>
          </div>
        </main>
      </div>
    </>
  );
}
