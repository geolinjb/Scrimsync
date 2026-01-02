'use client';

import * as React from 'react';
import { ShieldCheck, User, Users, Trash2, Loader, ChevronLeft, ChevronRight, Copy, ClipboardList, CalendarX2 } from 'lucide-react';
import { collection, doc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { format, startOfWeek, endOfWeek, addDays, parseISO, startOfToday, isBefore } from 'date-fns';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from '../ui/skeleton';
import type { PlayerProfileData, Vote, ScheduleEvent } from '@/lib/types';
import { timeSlots, MINIMUM_PLAYERS } from '@/lib/types';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
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
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { ReminderGenerator } from './reminder-generator';

type UserDataPanelProps = {
  allProfiles: PlayerProfileData[] | null;
  isLoading: boolean;
  events: ScheduleEvent[] | null;
  onRemoveEvent: (eventId: string) => void;
};

export function UserDataPanel({ allProfiles, isLoading, events, onRemoveEvent }: UserDataPanelProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeletingEvents, setIsDeletingEvents] = React.useState(false);
  const [deletingUserId, setDeletingUserId] = React.useState<string | null>(null);
  const [selectedDate, setSelectedDate] = React.useState(() => new Date());
  const [selectedRosterDate, setSelectedRosterDate] = React.useState<string>('');
  const [selectedRosterTime, setSelectedRosterTime] = React.useState<string>('');
  
  const votesCollectionRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'votes') : null),
    [firestore]
  );
  const { data: allVotesData, isLoading: areVotesLoading } = useCollection<Vote>(votesCollectionRef);

  const weekStart = React.useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);
  const weekEnd = React.useMemo(() => endOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);

  const weekDates = React.useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const votesInSelectedWeek = React.useMemo(() => {
    if (!allVotesData) return [];
    return allVotesData.filter(vote => {
      try {
        const voteDate = parseISO(vote.timeslot.split('_')[0]);
        return voteDate >= weekStart && voteDate <= weekEnd;
      } catch (e) { return false; }
    });
  }, [allVotesData, weekStart, weekEnd]);

  const allPlayerNames = React.useMemo(() => {
      if (!allProfiles) return [];
      return allProfiles.map(p => p.username).filter(Boolean) as string[];
  }, [allProfiles]);

  const sortedEvents = React.useMemo(() => {
      if (!events) return [];
      return [...events].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  const pastEvents = React.useMemo(() => {
    if (!events) return [];
    const today = startOfToday();
    return events.filter(e => isBefore(new Date(e.date), today));
  }, [events]);

  const handleDeleteUser = async (userId: string) => {
    if (!firestore) return;
    setDeletingUserId(userId);
    try {
        const batch = writeBatch(firestore);

        // 1. Delete user profile
        const userRef = doc(firestore, 'users', userId);
        batch.delete(userRef);

        // 2. Find and delete all votes by that user
        const votesQueryInstance = query(collection(firestore, 'votes'), where('userId', '==', userId));
        const votesSnapshot = await getDocs(votesQueryInstance);
        votesSnapshot.forEach(voteDoc => {
            batch.delete(voteDoc.ref);
        });

        await batch.commit();
        toast({
            title: 'User Deleted',
            description: `The user and their ${votesSnapshot.size} vote(s) have been removed.`,
        });
    } catch (error: any) {
        console.error('Error deleting user:', error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not delete user and their data. Check console for details.',
        });
        if (error.code === 'permission-denied') {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `/users/${userId}`,
                operation: 'delete',
            }));
        }
    } finally {
        setDeletingUserId(null);
    }
  };

  const handleDeleteWeeksVotes = async () => {
    if (!firestore || votesInSelectedWeek.length === 0) {
      toast({
          description: 'There are no votes to delete for the selected week.'
      });
      return;
    }

    setIsDeleting(true);

    try {
        const BATCH_SIZE = 500;
        for (let i = 0; i < votesInSelectedWeek.length; i += BATCH_SIZE) {
            const batch = writeBatch(firestore);
            const chunk = votesInSelectedWeek.slice(i, i + BATCH_SIZE);
            
            chunk.forEach(vote => {
                const voteRef = doc(firestore, 'votes', vote.id);
                batch.delete(voteRef);
            });

            await batch.commit();
        }

        toast({
            title: 'Success!',
            description: `${votesInSelectedWeek.length} vote(s) for the selected week have been deleted.`,
        });
    } catch (error) {
        console.error("Error deleting votes for week:", error);
        const permissionError = new FirestorePermissionError({
            path: '/votes',
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setIsDeleting(false);
    }
  };

  const handleDeletePastEvents = async () => {
    if (!firestore || pastEvents.length === 0) {
        toast({ description: "No past events to delete." });
        return;
    }
    setIsDeletingEvents(true);
    const batch = writeBatch(firestore);
    pastEvents.forEach(event => {
        const eventRef = doc(firestore, 'scheduledEvents', event.id);
        batch.delete(eventRef);
    });

    try {
        await batch.commit();
        toast({
            title: "Past Events Cleared",
            description: `Successfully deleted ${pastEvents.length} past event(s).`
        });
    } catch(error) {
        const permissionError = new FirestorePermissionError({
            path: 'scheduledEvents',
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setIsDeletingEvents(false);
    }
  };


  const goToPreviousWeek = () => {
    setSelectedDate(prev => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setSelectedDate(prev => addDays(prev, 7));
  };

  const handleCopyRoster = () => {
    if (!selectedRosterDate || !selectedRosterTime || !allVotesData || !allProfiles) return;

    const profileMap = new Map(allProfiles.map(p => [p.id, p.username]));
    
    const availableUserIds = allVotesData
        .filter(v => v.timeslot === `${selectedRosterDate}_${selectedRosterTime}`)
        .map(v => v.userId);

    const availablePlayers = availableUserIds
        .map(id => profileMap.get(id))
        .filter((name): name is string => !!name && allPlayerNames.includes(name));

    const unavailablePlayers = allPlayerNames.filter(p => !availablePlayers.includes(p));
    const neededPlayers = Math.max(0, MINIMUM_PLAYERS - availablePlayers.length);
    
    const parsedDate = parseISO(selectedRosterDate);
    const header = `Roster for ${format(parsedDate, 'EEEE, d MMM')} at ${selectedRosterTime}:`;
    
    const availableHeader = `✅ Available Players (${availablePlayers.length}):`;
    const availableList = availablePlayers.length > 0 ? availablePlayers.map(p => `- ${p}`).join('\n') : '- None';
    
    const neededText = `🔥 Players Needed: ${neededPlayers}`;
    
    const unavailableHeader = `❌ Unavailable Players (${unavailablePlayers.length}):`;
    const unavailableList = unavailablePlayers.length > 0 ? unavailablePlayers.map(p => `- ${p}`).join('\n') : '- None';

    const footer = `\n---\nGenerated by TeamSync\nhttps://scrimsync.vercel.app/`;

    const fullText = [
        header, '',
        availableHeader, availableList, '',
        neededText, '',
        unavailableHeader, unavailableList,
        footer
    ].join('\n');
    
    navigator.clipboard.writeText(fullText).then(() => {
        toast({
            title: 'Copied to Clipboard',
            description: 'The roster summary has been copied.',
        });
    }, (err) => {
        console.error('Could not copy text: ', err);
        toast({
            variant: 'destructive',
            title: 'Copy Failed',
            description: 'Could not copy the list to your clipboard.',
        });
    });
  };

  const handleCopyAllPlayers = () => {
    if (!allPlayerNames || allPlayerNames.length === 0) {
      toast({ description: 'No players to copy.' });
      return;
    }
    const header = 'All Players:';
    const playerList = allPlayerNames
      .map(p => `- ${p}`)
      .join('\n');
    
    const footer = `\n---\nGenerated by TeamSync\nhttps://scrimsync.vercel.app/`;
    
    const fullText = [header, '', playerList, footer].join('\n');

    navigator.clipboard.writeText(fullText).then(() => {
      toast({
        title: 'Copied All Players',
        description: 'A list of all players has been copied.',
      });
    }, (err) => {
      console.error('Could not copy text: ', err);
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Could not copy the player list to your clipboard.',
      });
    });
  };

  React.useEffect(() => {
      setSelectedRosterDate('');
      setSelectedRosterTime('');
  }, [selectedDate]);

  const isPanelLoading = isLoading || areVotesLoading;

  if (isPanelLoading) {
    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                    <div className='space-y-2'>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-10 w-48" />
                </CardFooter>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-24 w-full" />
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-10 w-32" />
                </CardFooter>
            </Card>
        </div>
    );
  }

  return (
    <div className='space-y-8'>
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-gold" />
                <CardTitle>Admin Panel</CardTitle>
                </div>
                <CardDescription>
                Manage users and perform administrative actions.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {allProfiles && allProfiles.length > 0 ? (
                <ScrollArea className="border rounded-lg h-[40vh]">
                    <Table>
                    <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                        <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Favorite Tank</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className='text-right'>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allProfiles.map(profile => (
                        <TableRow key={profile.id}>
                            <TableCell className="font-medium">{profile.username || '(Not set)'}</TableCell>
                            <TableCell>{profile.favoriteTank || '(Not set)'}</TableCell>
                            <TableCell>{profile.role || '(Not set)'}</TableCell>
                            <TableCell className="text-right">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={deletingUserId === profile.id}>
                                            {deletingUserId === profile.id ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the user '{profile.username}' and all of their voting data. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteUser(profile.id)} className="bg-destructive hover:bg-destructive/90">
                                                Delete User
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </ScrollArea>
                ) : (
                <div className="flex flex-col items-center justify-center text-center py-12 border rounded-lg">
                    <Users className="w-12 h-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">No users have created a profile yet.</p>
                </div>
                )}
            </CardContent>
            <CardFooter className="flex-col items-start gap-4">
                 <div className="w-full space-y-2">
                    <h4 className='text-sm font-medium'>Generate Roster Summary</h4>
                    <div className='flex flex-col sm:flex-row items-center gap-2 p-2 border rounded-lg'>
                        <div className='grid grid-cols-2 gap-2 w-full'>
                            <Select value={selectedRosterDate} onValueChange={setSelectedRosterDate}>
                                <SelectTrigger><SelectValue placeholder="Select Date" /></SelectTrigger>
                                <SelectContent>
                                    {weekDates.map(date => (
                                        <SelectItem key={date.toISOString()} value={format(date, 'yyyy-MM-dd')}>
                                            {format(date, 'EEE, d MMM')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={selectedRosterTime} onValueChange={setSelectedRosterTime}>
                                <SelectTrigger><SelectValue placeholder="Select Time" /></SelectTrigger>
                                <SelectContent>
                                    {timeSlots.map(time => (
                                        <SelectItem key={time} value={time}>
                                            {time}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleCopyRoster} disabled={!selectedRosterDate || !selectedRosterTime} className='w-full sm:w-auto shrink-0'>
                            <Copy className='w-4 h-4 mr-2' />
                            Copy Roster
                        </Button>
                    </div>
                </div>

                <Separator />
                
                <div className="w-full space-y-2">
                    <h4 className='text-sm font-medium'>Copy All Player Names</h4>
                    <div className='flex items-center justify-between gap-2 p-2 border rounded-lg'>
                        <p className='text-sm text-muted-foreground'>Copy a simple list of all players.</p>
                        <Button onClick={handleCopyAllPlayers} disabled={!allPlayerNames || allPlayerNames.length === 0}>
                            <ClipboardList className='w-4 h-4 mr-2' />
                            Copy Players
                        </Button>
                    </div>
                </div>

                <Separator />

                <div className="w-full space-y-2">
                    <h4 className='text-sm font-medium'>Delete Weekly Votes</h4>
                    <div className='flex items-center justify-between gap-2 p-2 border rounded-lg'>
                        <div className='flex items-center gap-1'>
                            <Button variant="outline" size="icon" onClick={goToPreviousWeek} className="h-8 w-8">
                                <ChevronLeft className="h-4 h-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={goToNextWeek} className="h-8 w-8">
                                <ChevronRight className="h-4 h-4" />
                            </Button>
                        </div>
                        <div className="text-center text-sm font-medium text-foreground">
                            {format(weekStart, 'd MMM')} - {format(weekEnd, 'd MMM, yyyy')}
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" disabled={isDeleting || votesInSelectedWeek.length === 0}>
                                {isDeleting ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will delete all {votesInSelectedWeek.length} vote(s) for the week of {format(weekStart, 'd MMM')} - {format(weekEnd, 'd MMM')}. This action cannot be undone.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteWeeksVotes} className="bg-destructive hover:bg-destructive/90">
                                    Yes, Delete Votes
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </CardFooter>
        </Card>

        <ReminderGenerator 
            events={events} 
            allVotes={areVotesLoading ? {} : (allVotesData || []).reduce((acc: any, vote: Vote) => {
                const [dateKey, slot] = vote.timeslot.split('_');
                const voteKey = `${dateKey}-${slot}`;
                const username = allProfiles?.find(p => p.id === vote.userId)?.username;
                if(username) {
                    if(!acc[voteKey]) acc[voteKey] = [];
                    acc[voteKey].push(username);
                }
                return acc;
            }, {})} 
            allProfiles={allProfiles || []} 
        />
        
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <CalendarX2 className="w-6 h-6 text-gold" />
                    <CardTitle>Manage Scheduled Events</CardTitle>
                </div>
                <CardDescription>Delete individual events or clear all past events from the calendar.</CardDescription>
            </CardHeader>
            <CardContent>
                {sortedEvents && sortedEvents.length > 0 ? (
                    <ScrollArea className="border rounded-lg h-[40vh]">
                        <div className='p-2 space-y-2'>
                        {sortedEvents.map(event => (
                            <div key={event.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={event.type === 'Tournament' ? 'default' : 'secondary'}>{event.type}</Badge>
                                        <span className="font-semibold">{format(new Date(event.date), 'MMM d, yyyy')}</span>
                                        <span className="text-sm text-muted-foreground">{event.time}</span>
                                    </div>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8 shrink-0">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the {event.type.toLowerCase()} on {format(new Date(event.date), 'MMM d')}. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => onRemoveEvent(event.id)} className="bg-destructive hover:bg-destructive/90">
                                                Delete Event
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center py-12 border rounded-lg">
                        <CalendarX2 className="w-12 h-12 text-muted-foreground" />
                        <p className="mt-4 text-muted-foreground">No scheduled events found.</p>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isDeletingEvents || pastEvents.length === 0}>
                            {isDeletingEvents ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            Delete {pastEvents.length} Past Event(s)
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete all past events?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete {pastEvents.length} event(s) that occurred before today. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeletePastEvents} className="bg-destructive hover:bg-destructive/90">
                                Yes, Delete Events
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
        </Card>
    </div>
  );
}
