'use client';

import * as React from 'react';
import { ShieldCheck, User, Users, Trash2, Loader, ChevronLeft, ChevronRight, Copy, ClipboardList, Settings, Send } from 'lucide-react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { format, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';

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
import type { PlayerProfileData, Vote } from '@/lib/types';
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
import { Input } from '../ui/input';

type UserDataPanelProps = {
  allProfiles: PlayerProfileData[] | null;
  isLoading: boolean;
};

export function UserDataPanel({ allProfiles, isLoading }: UserDataPanelProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(() => new Date());
  const [selectedRosterDate, setSelectedRosterDate] = React.useState<string>('');
  const [selectedRosterTime, setSelectedRosterTime] = React.useState<string>('');
  const [webhookUrl, setWebhookUrl] = React.useState('');
  const [isSavingWebhook, setIsSavingWebhook] = React.useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = React.useState(false);

  const functions = React.useMemo(() => firestore ? getFunctions(undefined, 'us-central1') : null, [firestore]);

  const votesCollectionRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'votes') : null),
    [firestore]
  );

  const { data: allVotes, isLoading: areVotesLoading } = useCollection<Vote>(votesCollectionRef);

  const weekStart = React.useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);
  const weekEnd = React.useMemo(() => endOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);

  const weekDates = React.useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const votesInSelectedWeek = React.useMemo(() => {
    if (!allVotes) return [];
    return allVotes.filter(vote => {
      const voteDate = parseISO(vote.timeslot.split('_')[0]);
      return voteDate >= weekStart && voteDate <= weekEnd;
    });
  }, [allVotes, weekStart, weekEnd]);

  const allPlayerNames = React.useMemo(() => {
      if (!allProfiles) return [];
      return allProfiles.map(p => p.username).filter(Boolean);
  }, [allProfiles]);

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

  const goToPreviousWeek = () => {
    setSelectedDate(prev => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setSelectedDate(prev => addDays(prev, 7));
  };

  const handleCopyRoster = () => {
    if (!selectedRosterDate || !selectedRosterTime || !allVotes || !allProfiles) return;

    const profileMap = new Map(allProfiles.map(p => [p.id, p.username]));
    const timeslotId = `${selectedRosterDate}_${selectedRosterTime}`;
    
    const availableUserIds = allVotes
        .filter(v => v.timeslot === timeslotId)
        .map(v => v.userId);

    const availablePlayers = availableUserIds
        .map(id => profileMap.get(id))
        .filter((name): name is string => !!name);

    const unavailablePlayers = allPlayerNames.filter(p => !availablePlayers.includes(p));
    const neededPlayers = Math.max(0, MINIMUM_PLAYERS - availablePlayers.length);
    
    const parsedDate = parseISO(selectedRosterDate);
    const header = `Roster for ${format(parsedDate, 'EEEE, d MMM')} at ${selectedRosterTime}:`;
    
    const availableHeader = `✅ Available Players (${availablePlayers.length}):`;
    const availableList = availablePlayers.length > 0 ? availablePlayers.map(p => `- ${p}`).join('\n') : '- None';
    
    const neededText = `🔥 Players Needed: ${neededPlayers}`;
    
    const unavailableHeader = `❌ Unavailable Players (${unavailablePlayers.length}):`;
    const unavailableList = unavailablePlayers.length > 0 ? unavailablePlayers.map(p => `- ${p}`).join('\n') : '- None';

    const fullText = [
        header, '',
        availableHeader, availableList, '',
        neededText, '',
        unavailableHeader, unavailableList
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
    if (!allProfiles || allProfiles.length === 0) {
      toast({ description: 'No players to copy.' });
      return;
    }
    const header = 'All Registered Players:';
    const playerList = allProfiles
      .map(p => `- ${p.username || '(No username)'}: Favorite Tank - ${p.favoriteTank || '(Not set)'}`)
      .join('\n');
    
    const fullText = [header, '', playerList].join('\n');

    navigator.clipboard.writeText(fullText).then(() => {
      toast({
        title: 'Copied All Players',
        description: 'A list of all registered players has been copied.',
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

  const handleSaveWebhook = async () => {
    if (!functions) return;
    if (!webhookUrl) {
      toast({ variant: 'destructive', title: 'Error', description: 'Webhook URL cannot be empty.' });
      return;
    }
    setIsSavingWebhook(true);
    try {
      const setWebhookUrl = httpsCallable(functions, 'setWebhookUrl');
      await setWebhookUrl({ url: webhookUrl });

      toast({
        title: 'This is a manual step!',
        description: "The webhook URL needs to be set in your function's environment configuration. See the terminal for the command.",
      });

    } catch (error: any) {
      console.error("Error saving webhook URL:", error);
       toast({
        variant: 'destructive',
        title: 'Action Required',
        description: error.message || 'An unknown error occurred.',
        duration: 9000,
      });
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!functions) return;
    setIsTestingWebhook(true);
    try {
      const testWebhook = httpsCallable(functions, 'testDiscordWebhook');
      const result = await testWebhook();
      toast({
        title: 'Success!',
        description: (result.data as any).message,
      });
    } catch (error: any) {
      console.error("Error testing webhook:", error);
      toast({
        variant: 'destructive',
        title: 'Test Failed',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsTestingWebhook(false);
    }
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
                <ShieldCheck className="w-6 h-6 text-primary" />
                <CardTitle>User Data Panel</CardTitle>
                </div>
                <CardDescription>
                View all registered users and perform administrative actions.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {allProfiles && allProfiles.length > 0 ? (
                <div className="border rounded-lg overflow-auto max-h-[60vh]">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Favorite Tank</TableHead>
                        <TableHead>Role</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allProfiles.map(profile => (
                        <TableRow key={profile.id}>
                            <TableCell className="font-medium">{profile.username || '(Not set)'}</TableCell>
                            <TableCell>{profile.favoriteTank || '(Not set)'}</TableCell>
                            <TableCell>{profile.role || '(Not set)'}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </div>
                ) : (
                <div className="flex flex-col items-center justify-center text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">No users have created a profile yet.</p>
                </div>
                )}
            </CardContent>
            <CardFooter className="flex-col items-start gap-6">
                <div className='w-full space-y-2'>
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
                    <h4 className='text-sm font-medium'>Copy All Player Data</h4>
                    <div className='flex items-center justify-between gap-2 p-2 border rounded-lg'>
                        <p className='text-sm text-muted-foreground'>Copy all players and their favorite tanks.</p>
                        <Button onClick={handleCopyAllPlayers} disabled={!allProfiles || allProfiles.length === 0}>
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
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={goToNextWeek} className="h-8 w-8">
                                <ChevronRight className="h-4 w-4" />
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

        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                <Settings className="w-6 h-6 text-primary" />
                <CardTitle>Discord Integration</CardTitle>
                </div>
                <CardDescription>
                Configure automated reminders to a Discord channel. After saving, you must deploy the functions for changes to take effect.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label htmlFor="webhook-url" className="text-sm font-medium">Discord Webhook URL</label>
                    <Input 
                        id="webhook-url" 
                        type="password" 
                        placeholder="Paste your webhook URL here"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                    />
                     <p className='text-xs text-muted-foreground pt-1'>
                        This is stored as an environment variable in your Cloud Functions, not in the database.
                    </p>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between">
                 <Button 
                    onClick={handleTestWebhook} 
                    variant="outline"
                    disabled={isTestingWebhook}
                >
                    {isTestingWebhook ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Test
                </Button>
                <Button 
                    onClick={handleSaveWebhook}
                    disabled={isSavingWebhook || !webhookUrl}
                >
                    {isSavingWebhook ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save URL
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}
