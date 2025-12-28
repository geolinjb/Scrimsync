'use client';

import * as React from 'react';
import { ShieldCheck, User, Users, Trash2, Loader, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, doc, writeBatch } from 'firebase/firestore';
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

type UserDataPanelProps = {
  allProfiles: PlayerProfileData[] | null;
  isLoading: boolean;
};

export function UserDataPanel({ allProfiles, isLoading }: UserDataPanelProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(() => new Date());

  const votesCollectionRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'votes') : null),
    [firestore]
  );

  const { data: allVotes, isLoading: areVotesLoading } = useCollection<Vote>(votesCollectionRef);

  const weekStart = React.useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);
  const weekEnd = React.useMemo(() => endOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);

  const votesInSelectedWeek = React.useMemo(() => {
    if (!allVotes) return [];
    return allVotes.filter(vote => {
      const voteDate = parseISO(vote.timeslot.split('_')[0]);
      return voteDate >= weekStart && voteDate <= weekEnd;
    });
  }, [allVotes, weekStart, weekEnd]);

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

  const isPanelLoading = isLoading || areVotesLoading;

  if (isPanelLoading) {
    return (
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
    );
  }

  return (
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
      <CardFooter className="flex-col items-start gap-4">
        <div className="w-full">
            <h4 className='text-sm font-medium mb-2'>Delete Weekly Votes</h4>
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
                            This will delete all {votesInSelectedWeek.length} votes for the week of {format(weekStart, 'd MMM')} - {format(weekEnd, 'd MMM')}. This action cannot be undone.
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
  );
}
