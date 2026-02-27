
'use client';

import * as React from 'react';
import { ShieldCheck, Users, Trash2, Loader, ChevronLeft, ChevronRight, Copy, ClipboardList, CalendarX2, Save, Tags, Check } from 'lucide-react';
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
import { Input } from '../ui/input';
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
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { ReminderGenerator } from './reminder-generator';
import type { User as AuthUser } from 'firebase/auth';
import { MultiSelect } from '../ui/multi-select';

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
  
  const [selectedPlayerForTags, setSelectedPlayerForTags] = React.useState<string>('');
  const [currentPlaystyleTags, setCurrentPlaystyleTags] = React.useState<string[]>([]);
  const [isSavingTags, setIsSavingTags] = React.useState(false);

  // States for inline Discord editing
  const [editingDiscord, setEditingDiscord] = React.useState<{ [userId: string]: string }>({});
  const [savingDiscordId, setSavingDiscordId] = React.useState<string | null>(null);

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
      toast({ title: 'Player Updated', description: `Player's roster status has been updated.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Update Failed' });
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userDocRef.path, operation: 'update', requestResourceData: { rosterStatus: value } }));
    }
  };

  const handleDiscordChange = (userId: string, value: string) => {
    setEditingDiscord(prev => ({ ...prev, [userId]: value }));
  };

  const handleSaveDiscord = async (userId: string) => {
    if (!firestore || savingDiscordId) return;
    const value = editingDiscord[userId];
    if (value === undefined) return;

    setSavingDiscordId(userId);
    const userDocRef = doc(firestore, 'users', userId);
    try {
      await updateDoc(userDocRef, { discordUsername: value });
      toast({ title: 'Discord Updated', description: "The player's Discord handle has been updated." });
      setEditingDiscord(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Update Failed' });
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userDocRef.path, operation: 'update', requestResourceData: { discordUsername: value } }));
    } finally {
      setSavingDiscordId(null);
    }
  };

  const handleSavePlaystyleTags = async () => {
    if (!firestore || !selectedPlayerForTags) return;
    setIsSavingTags(true);
    const userDocRef = doc(firestore, 'users', selectedPlayerForTags);
    try {
        await updateDoc(userDocRef, { playstyleTags: currentPlaystyleTags });
        toast({ title: 'Tags Saved!' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Update Failed' });
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userDocRef.path, operation: 'update', requestResourceData: { playstyleTags: currentPlaystyleTags } }));
    } finally {
        setIsSavingTags(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!firestore) return;
    setDeletingUserId(userId);
    try {
        const batch = writeBatch(firestore);
        const userRef = doc(firestore, 'users', userId);
        batch.delete(userRef);

        const votesQueryInstance = query(collection(firestore, 'votes'), where('userId', '==', userId));
        const votesSnapshot = await getDocs(votesQueryInstance);
        votesSnapshot.forEach(voteDoc => batch.delete(voteDoc.ref));

        const overridesQueryInstance = query(collection(firestore, 'availabilityOverrides'), where('userId', '==', userId));
        const overridesSnapshot = await getDocs(overridesQueryInstance);
        overridesSnapshot.forEach(overrideDoc => batch.delete(overrideDoc.ref));

        await batch.commit();
        toast({ title: 'User Deleted' });
    } catch (error: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `/users/${userId}`, operation: 'delete' }));
    } finally {
        setDeletingUserId(null);
    }
  };

  const handleDeleteWeeksVotes = async () => {
    if (!firestore || votesInSelectedWeek.length === 0) return;
    setIsDeleting(true);
    try {
        const BATCH_SIZE = 500;
        for (let i = 0; i < votesInSelectedWeek.length; i += BATCH_SIZE) {
            const batch = writeBatch(firestore);
            const chunk = votesInSelectedWeek.slice(i, i + BATCH_SIZE);
            chunk.forEach(vote => batch.delete(doc(firestore, 'votes', vote.id)));
            await batch.commit();
        }
        toast({ title: 'Success!', description: `${votesInSelectedWeek.length} vote(s) deleted.` });
    } catch (error) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/votes', operation: 'delete' }));
    } finally {
        setIsDeleting(false);
    }
  };

  const handleDeletePastEvents = async () => {
    if (!firestore || pastEvents.length === 0) return;
    setIsDeletingEvents(true);
    const batch = writeBatch(firestore);
    pastEvents.forEach(event => batch.delete(doc(firestore, 'scheduledEvents', event.id)));
    try {
        await batch.commit();
        toast({ title: "Past Events Cleared" });
    } catch(error) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'scheduledEvents', operation: 'delete' }));
    } finally {
        setIsDeletingEvents(false);
    }
  };

  const goToPreviousWeek = () => setSelectedDate(prev => addDays(prev, -7));
  const goToNextWeek = () => setSelectedDate(prev => addDays(prev, 7));

  const handleRosterCopy = () => {
    if (!selectedRosterDate || !selectedRosterTime || !allVotesData || !allProfiles) return;
    
    const profileMap = new Map(allProfiles.map(p => [p.id, p]));
    const availablePlayerIds = allVotesData
        .filter(v => v.timeslot === `${selectedRosterDate}_${selectedRosterTime}`)
        .map(v => v.userId);

    const availableProfiles = availablePlayerIds
        .map(id => profileMap.get(id))
        .filter((p): p is PlayerProfileData => !!p);

    const unavailableProfiles = allProfiles.filter(p => !availablePlayerIds.includes(p.id));

    const formatPlayerList = (players: PlayerProfileData[]) => {
        if (players.length === 0) return '- None';
        return players
          .map(p => {
            const tag = p.discordUsername || p.username;
            let statusSuffix = "";
            if (p.rosterStatus === 'Main Roster') statusSuffix = " (Main)";
            else if (p.rosterStatus === 'Standby Player') statusSuffix = " (Standby)";
            return `- ${tag}${statusSuffix}`;
          })
          .join('\n');
    };

    const header = `Roster for ${format(parseISO(selectedRosterDate), 'EEEE, d MMM')} at ${selectedRosterTime}:`;
    
    const fullText = [
        header,
        '',
        `✅ Available Players (${availableProfiles.length}):`,
        formatPlayerList(availableProfiles),
        '',
        `🔥 Players Needed: ${Math.max(0, MINIMUM_PLAYERS - availableProfiles.length)}`,
        '',
        `❌ Unavailable Players (${unavailableProfiles.length}):`,
        formatPlayerList(unavailableProfiles),
        '',
        '---',
        'Generated by TeamSync',
        'https://scrimsync.vercel.app/'
    ].join('\n');
    
    navigator.clipboard.writeText(fullText).then(() => {
        toast({ title: 'Copied to Clipboard' });
    });
  };

  if (isLoading) {
    return <div className="space-y-8"><Skeleton className="h-[400px] w-full" /><Skeleton className="h-[200px] w-full" /></div>;
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
                <CardDescription>Update roles, Discord handles, or remove players from the team.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="border rounded-lg h-[60vh] w-full">
                    <div className="min-w-[900px]">
                        <Table>
                            <TableHeader className="sticky top-0 bg-muted/95 backdrop-blur-sm z-10">
                                <TableRow>
                                    <TableHead className="w-[200px]">Username</TableHead>
                                    <TableHead className="w-[250px]">Discord Handle</TableHead>
                                    <TableHead className="w-[200px]">Roster Status</TableHead>
                                    <TableHead className='text-right'>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allProfiles?.map(profile => (
                                <TableRow key={profile.id}>
                                    <TableCell>
                                        <div className='flex flex-col'>
                                            <span className='font-bold'>{profile.username || '(Not set)'}</span>
                                            <span className='text-[10px] text-muted-foreground'>{profile.id}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                          <Input 
                                            className="h-8 text-xs font-mono"
                                            placeholder="@username or <@ID>"
                                            value={editingDiscord[profile.id] ?? profile.discordUsername ?? ''}
                                            onChange={(e) => handleDiscordChange(profile.id, e.target.value)}
                                          />
                                          {editingDiscord[profile.id] !== undefined && (
                                            <Button 
                                              size="icon" 
                                              variant="ghost" 
                                              className="h-8 w-8 shrink-0 text-primary"
                                              disabled={savingDiscordId === profile.id}
                                              onClick={() => handleSaveDiscord(profile.id)}
                                            >
                                              {savingDiscordId === profile.id ? <Loader className="w-3 h-3 animate-spin" /> : <Check className="w-4 h-4" />}
                                            </Button>
                                          )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Select value={profile.rosterStatus} onValueChange={(v) => handleRosterStatusChange(profile.id, v)}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Assign Status" /></SelectTrigger>
                                            <SelectContent>{rosterStatuses.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className='text-right'>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={!!deletingUserId}>
                                                    {deletingUserId === profile.id ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete {profile.username || profile.id} and all their data. This cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteUser(profile.id, profile.username || 'user')} className="bg-destructive hover:bg-destructive/90">Delete User</AlertDialogAction>
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
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <div className="flex items-center gap-3"><Tags className="w-6 h-6 text-gold" /><CardTitle>Assign Playstyle Tags</CardTitle></div>
            </CardHeader>
            <CardContent className="space-y-4">
                <Select value={selectedPlayerForTags} onValueChange={setSelectedPlayerForTags}>
                    <SelectTrigger><SelectValue placeholder="Select a player" /></SelectTrigger>
                    <SelectContent>{allProfiles?.map(p => <SelectItem key={p.id} value={p.id}>{p.username}</SelectItem>)}</SelectContent>
                </Select>
                {selectedPlayerForTags && <MultiSelect options={playstyleOptions} onValueChange={setCurrentPlaystyleTags} defaultValue={currentPlaystyleTags} />}
            </CardContent>
            {selectedPlayerForTags && <CardFooter><Button onClick={handleSavePlaystyleTags} disabled={isSavingTags}>{isSavingTags ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save Tags</Button></CardFooter>}
        </Card>

        <Card>
            <CardHeader><CardTitle>Data Management</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <ScrollArea className="w-full">
                    <div className='flex items-center gap-2 min-w-[500px] p-2 border rounded-lg'>
                        <Select value={selectedRosterDate} onValueChange={setSelectedRosterDate}>
                            <SelectTrigger><SelectValue placeholder="Select Date" /></SelectTrigger>
                            <SelectContent>{weekDates.map(d => <SelectItem key={d.toISOString()} value={format(d, 'yyyy-MM-dd')}>{format(d, 'EEE, d MMM')}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={selectedRosterTime} onValueChange={setSelectedRosterTime}>
                            <SelectTrigger><SelectValue placeholder="Select Time" /></SelectTrigger>
                            <SelectContent>{timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button onClick={handleRosterCopy} disabled={!selectedRosterDate || !selectedRosterTime} className='shrink-0'><Copy className='w-4 h-4 mr-2' />Copy Roster</Button>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
                <Separator />
                <div className='flex items-center justify-between gap-4 p-4 border rounded-lg bg-destructive/5'>
                    <div className='flex items-center gap-2'>
                        <Button variant="outline" size="icon" onClick={goToPreviousWeek} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="text-sm font-semibold min-w-[120px] text-center">{format(weekStart, 'd MMM')} - {format(weekEnd, 'd MMM')}</span>
                        <Button variant="outline" size="icon" onClick={goToNextWeek} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm" disabled={isDeleting || votesInSelectedWeek.length === 0}>Delete {votesInSelectedWeek.length} Votes</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete votes for this week?</AlertDialogTitle></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteWeeksVotes} className="bg-destructive">Yes, Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>

        <ReminderGenerator events={events} allVotes={allVotes} allProfiles={allProfiles || []} availabilityOverrides={availabilityOverrides || []} isAdmin={isAdmin} currentUser={currentUser} />
        
        <Card>
            <CardHeader><div className="flex items-center gap-3"><CalendarX2 className="w-6 h-6 text-gold" /><CardTitle>Cleanup Past Events</CardTitle></div></CardHeader>
            <CardFooter>
                 <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive" className="w-full" disabled={isDeletingEvents || pastEvents.length === 0}>Delete {pastEvents.length} Past Event(s)</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Clear past events?</AlertDialogTitle></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeletePastEvents} className="bg-destructive">Clear Events</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
        </Card>
    </div>
  );
}
