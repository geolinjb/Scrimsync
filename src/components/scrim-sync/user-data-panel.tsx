'use client';

import * as React from 'react';
import { ShieldCheck, User, Users, Trash2, Loader, ChevronLeft, ChevronRight, Copy, ClipboardList, CalendarX2, Save, Tags } from 'lucide-react';
import { collection, doc, writeBatch, query, where, getDocs, updateDoc } from 'firebase/firestore';
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
import type { PlayerProfileData, Vote, ScheduleEvent, AllVotes, AvailabilityOverride } from '@/lib/types';
import { timeSlots, MINIMUM_PLAYERS, rosterStatuses, playstyleTags } from '@/lib/types';
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
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { ReminderGenerator } from './reminder-generator';
import type { User as AuthUser } from 'firebase/auth';
import { MultiSelect } from '../ui/multi-select';
import { Label } from '../ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';


type UserDataPanelProps = {
  allProfiles: PlayerProfileData[] | null;
  isLoading: boolean;
  events: ScheduleEvent[] | null;
  onRemoveEvent: (eventId: string) => void;
  allVotesData: Vote[] | null;
  currentUser: AuthUser | null;
  isAdmin: boolean;
};

export function UserDataPanel({ allProfiles, isLoading, events, onRemoveEvent, allVotesData, currentUser, isAdmin }: UserDataPanelProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeletingEvents, setIsDeletingEvents] = React.useState(false);
  const [deletingUserId, setDeletingUserId] = React.useState<string | null>(null);
  const [selectedDate, setSelectedDate] = React.useState(() => new Date());
  const [selectedRosterDate, setSelectedRosterDate] = React.useState<string>('');
  const [selectedRosterTime, setSelectedRosterTime] = React.useState<string>('');
  
  // State for the new playstyle tag section
  const [selectedPlayerForTags, setSelectedPlayerForTags] = React.useState<string>('');
  const [currentPlaystyleTags, setCurrentPlaystyleTags] = React.useState<string[]>([]);
  const [isSavingTags, setIsSavingTags] = React.useState(false);

  const weekStart = React.useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);
  const weekEnd = React.useMemo(() => endOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);

  const weekDates = React.useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);
  
  const overridesRef = useMemoFirebase(() => {
      if (!firestore) return null;
      return collection(firestore, 'availabilityOverrides');
  }, [firestore]);
  const { data: availabilityOverrides } = useCollection<AvailabilityOverride>(overridesRef);

  React.useEffect(() => {
    if (selectedPlayerForTags && allProfiles) {
      const player = allProfiles.find(p => p.id === selectedPlayerForTags);
      setCurrentPlaystyleTags(player?.playstyleTags || []);
    } else {
      setCurrentPlaystyleTags([]);
    }
  }, [selectedPlayerForTags, allProfiles]);


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

  const handleRosterStatusChange = async (userId: string, value: any) => {
    if (!firestore) return;
    const userDocRef = doc(firestore, 'users', userId);
    try {
      await updateDoc(userDocRef, { rosterStatus: value });
      toast({
        title: 'Player Updated',
        description: `Player's roster status has been updated.`,
      });
    } catch (error) {
      console.error('Error updating player status:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update the player status.',
      });
      const permissionError = new FirestorePermissionError({
        path: userDocRef.path,
        operation: 'update',
        requestResourceData: { rosterStatus: value }
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  };

  const handleSavePlaystyleTags = async () => {
    if (!firestore || !selectedPlayerForTags) {
        toast({ variant: 'destructive', title: 'Error', description: 'No player selected.' });
        return;
    };
    setIsSavingTags(true);
    const userDocRef = doc(firestore, 'users', selectedPlayerForTags);
    try {
        await updateDoc(userDocRef, { playstyleTags: currentPlaystyleTags });
        toast({
            title: 'Tags Saved!',
            description: "The player's playstyle tags have been updated."
        });
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Update Failed',
            description: 'Could not update the playstyle tags.',
        });
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: { playstyleTags: currentPlaystyleTags }
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setIsSavingTags(false);
    }
  };


  const handleDeleteUser = async (userId: string, username: string) => {
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

        // 3. Find and delete all availability overrides for that user
        const overridesQueryInstance = query(collection(firestore, 'availabilityOverrides'), where('userId', '==', userId));
        const overridesSnapshot = await getDocs(overridesQueryInstance);
        overridesSnapshot.forEach(overrideDoc => {
            batch.delete(overrideDoc.ref);
        });

        await batch.commit();
        toast({
            title: 'User Deleted',
            description: `User '${username}', their ${votesSnapshot.size} vote(s), and ${overridesSnapshot.size} override(s) have been removed.`,
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

  const handleRosterCopy = () => {
    if (!selectedRosterDate || !selectedRosterTime || !allVotesData || !allProfiles) return;

    const formatPlayerList = (players: string[], profileMap: Map<string, PlayerProfileData>) => {
        if (players.length === 0) return '- None';
        return players
          .map(p => {
            const profile = profileMap.get(p);
            if (profile?.rosterStatus === 'Main Roster') return `- ${p} (Main)`;
            if (profile?.rosterStatus === 'Standby Player') return `- ${p} (Standby)`;
            return `- ${p}`;
          })
          .join('\n');
    };

    const profileIdMap = new Map(allProfiles.map(p => [p.id, p.username]));
    const profileUsernameMap = new Map(allProfiles.map(p => [p.username, p]));
    
    const availableUserIds = allVotesData
        .filter(v => v.timeslot === `${selectedRosterDate}_${selectedRosterTime}`)
        .map(v => v.userId);

    const availablePlayers = availableUserIds
        .map(id => profileIdMap.get(id))
        .filter((name): name is string => !!name && allPlayerNames.includes(name));

    const unavailablePlayers = allPlayerNames.filter(p => !availablePlayers.includes(p));
    const neededPlayers = Math.max(0, MINIMUM_PLAYERS - availablePlayers.length);
    
    const parsedDate = parseISO(selectedRosterDate);
    const header = `Roster for ${format(parsedDate, 'EEEE, d MMM')} at ${selectedRosterTime}:`;
    
    const availableHeader = `✅ Available Players (${availablePlayers.length}):`;
    const availableList = formatPlayerList(availablePlayers, profileUsernameMap);
    
    const neededText = `🔥 Players Needed: ${neededPlayers}`;
    
    const unavailableHeader = `❌ Unavailable Players (${unavailablePlayers.length}):`;
    const unavailableList = formatPlayerList(unavailablePlayers, profileUsernameMap);

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

  if (isLoading) {
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

  const playstyleOptions = playstyleTags.map(tag => ({ label: tag, value: tag }));

  return (
    <div className='space-y-8'>
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-gold" />
                <CardTitle>Manage Player Roster</CardTitle>
                </div>
                <CardDescription>
                Manage user roles and roster status. The <b>Delete User</b> option is located in the Actions column for each player.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {allProfiles && allProfiles.length > 0 ? (
                <ScrollArea className="border rounded-lg h-[60vh] w-full">
                    <div className="min-w-[600px]">
                        <Table>
                            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                                <TableRow>
                                    <TableHead className='min-w-[200px]'>Username & UID</TableHead>
                                    <TableHead className='min-w-[200px]'>Roster Status</TableHead>
                                    <TableHead className='text-right w-[100px]'>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allProfiles.map(profile => (
                                <TableRow key={profile.id}>
                                    <TableCell className="font-medium">
                                        <div className='flex flex-col'>
                                            <span className='font-bold'>{profile.username || '(Not set)'}</span>
                                            <span className='text-[10px] text-muted-foreground truncate max-w-[150px]'>{profile.id}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={profile.rosterStatus}
                                            onValueChange={(value) => handleRosterStatusChange(profile.id, value)}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Assign Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {rosterStatuses.map(tag => (
                                                    <SelectItem key={tag} value={tag}>
                                                        {tag}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className='text-right'>
                                        <AlertDialog>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <AlertDialogTrigger asChild>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                disabled={!!deletingUserId}
                                                            >
                                                                {deletingUserId === profile.id ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Permanently delete user and data</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete the user <span className='font-bold text-foreground'>{profile.username || profile.id}</span> and all of their voting and availability data. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteUser(profile.id, profile.username || 'user')} className="bg-destructive hover:bg-destructive/90">
                                                        Yes, Delete User
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
                ) : (
                <div className="flex flex-col items-center justify-center text-center py-12 border rounded-lg">
                    <Users className="w-12 h-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">No users have created a profile yet.</p>
                </div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Tags className="w-6 h-6 text-gold" />
                    <CardTitle>Assign Playstyle Tags</CardTitle>
                </div>
                <CardDescription>
                    Select a player and assign them multiple playstyle tags.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className='space-y-2'>
                    <Label htmlFor="player-select">Player</Label>
                    <Select value={selectedPlayerForTags} onValueChange={setSelectedPlayerForTags}>
                        <SelectTrigger id="player-select">
                            <SelectValue placeholder="Select a player to assign tags" />
                        </SelectTrigger>
                        <SelectContent>
                            {allProfiles?.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.username}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {selectedPlayerForTags && (
                    <div className='space-y-2'>
                        <Label>Playstyle Tags</Label>
                        <MultiSelect
                            options={playstyleOptions}
                            onValueChange={setCurrentPlaystyleTags}
                            defaultValue={currentPlaystyleTags}
                            placeholder="Select tags..."
                        />
                    </div>
                )}
            </CardContent>
            {selectedPlayerForTags && (
                <CardFooter>
                    <Button onClick={handleSavePlaystyleTags} disabled={isSavingTags}>
                        {isSavingTags ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Tags
                    </Button>
                </CardFooter>
            )}
        </Card>

        <Card>
            <CardHeader>
                 <CardTitle>Data Management</CardTitle>
                 <CardDescription>Generate rosters and perform data cleanup. Scroll right on mobile to see all options.</CardDescription>
            </CardHeader>
             <CardContent className="space-y-6">
                 <div className="w-full space-y-2">
                    <h4 className='text-sm font-medium'>Generate Roster Summary</h4>
                    <div className='overflow-x-auto pb-2'>
                        <div className='flex flex-col sm:flex-row items-center gap-2 min-w-[500px] p-2 border rounded-lg'>
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
                            <Button onClick={handleRosterCopy} disabled={!selectedRosterDate || !selectedRosterTime} className='w-full sm:w-auto shrink-0'>
                                <Copy className='w-4 h-4 mr-2' />
                                Copy Roster
                            </Button>
                        </div>
                    </div>
                </div>

                <Separator />
                
                <div className="w-full space-y-2">
                    <h4 className='text-sm font-medium'>Copy All Player Names</h4>
                    <div className='flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-lg bg-muted/30'>
                        <p className='text-xs text-muted-foreground'>Copy a simple list of all players currently registered in TeamSync.</p>
                        <Button onClick={handleCopyAllPlayers} disabled={!allPlayerNames || allPlayerNames.length === 0} variant="outline">
                            <ClipboardList className='w-4 h-4 mr-2' />
                            Copy Players
                        </Button>
                    </div>
                </div>

                <Separator />

                <div className="w-full space-y-2">
                    <h4 className='text-sm font-medium'>Delete Weekly Votes</h4>
                    <div className='flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-lg bg-destructive/5'>
                        <div className='flex items-center gap-2'>
                            <Button variant="outline" size="icon" onClick={goToPreviousWeek} className="h-8 w-8">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="text-center text-sm font-semibold min-w-[150px]">
                                {format(weekStart, 'd MMM')} - {format(weekEnd, 'd MMM')}
                            </div>
                            <Button variant="outline" size="icon" onClick={goToNextWeek} className="h-8 w-8">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" disabled={isDeleting || votesInSelectedWeek.length === 0}>
                                {isDeleting ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                Delete {votesInSelectedWeek.length} Votes
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Delete all votes for this week?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently remove all {votesInSelectedWeek.length} availability vote(s) recorded for the week of {format(weekStart, 'd MMM')} to {format(weekEnd, 'd MMM')}.
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
            </CardContent>
        </Card>

        <ReminderGenerator 
            events={events}
            allVotes={allVotes}
            allProfiles={allProfiles || []} 
            availabilityOverrides={availabilityOverrides || []}
            isAdmin={isAdmin}
            currentUser={currentUser}
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
                            <div key={event.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted group">
                                <div className="flex flex-col">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={event.type === 'Tournament' ? 'default' : 'secondary'} className="text-[10px] h-4">{event.type}</Badge>
                                        <span className="font-semibold text-sm">{format(new Date(event.date), 'MMM d, yyyy')}</span>
                                        <span className="text-xs text-muted-foreground">{event.time}</span>
                                    </div>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 shrink-0">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete scheduled event?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the {event.type.toLowerCase()} scheduled for {format(new Date(event.date), 'MMMM d')}.
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
                        <Button variant="destructive" className="w-full" disabled={isDeletingEvents || pastEvents.length === 0}>
                            {isDeletingEvents ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            Delete {pastEvents.length} Past Event(s)
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Clear all past events?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will remove all {pastEvents.length} event(s) that occurred before today. This action helps keep the calendar clean.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeletePastEvents} className="bg-destructive hover:bg-destructive/90">
                                Yes, Clear Events
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
        </Card>
    </div>
  );
}
