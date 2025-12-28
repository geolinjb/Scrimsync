'use client';

import * as React from 'react';
import { ShieldCheck, User, Users, Trash2, Loader } from 'lucide-react';
import { collection, doc, writeBatch } from 'firebase/firestore';

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
import { useCollection, useFirestore } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

type UserDataPanelProps = {
  allProfiles: PlayerProfileData[] | null;
  isLoading: boolean;
};

export function UserDataPanel({ allProfiles, isLoading }: UserDataPanelProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isResetting, setIsResetting] = React.useState(false);
  
  const { data: allVotes, isLoading: areVotesLoading } = useCollection<Vote>(
    firestore ? collection(firestore, 'votes') : null
  );

  const handleResetAllVotes = async () => {
    if (!firestore || !allVotes) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not connect to the database.'
        });
        return;
    }

    if (allVotes.length === 0) {
        toast({
            description: 'There are no votes to reset.'
        });
        return;
    }

    setIsResetting(true);

    try {
        // Firestore allows a maximum of 500 operations in a single batch.
        // We will process the deletions in chunks of 500.
        const BATCH_SIZE = 500;
        for (let i = 0; i < allVotes.length; i += BATCH_SIZE) {
            const batch = writeBatch(firestore);
            const chunk = allVotes.slice(i, i + BATCH_SIZE);
            
            chunk.forEach(vote => {
                const voteRef = doc(firestore, 'votes', vote.id);
                batch.delete(voteRef);
            });

            await batch.commit();
        }

        toast({
            title: 'Success!',
            description: `${allVotes.length} vote(s) have been successfully reset.`,
        });
    } catch (error) {
        console.error(error);
        const permissionError = new FirestorePermissionError({
            path: '/votes',
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);

        toast({
            variant: 'destructive',
            title: 'Permission Denied',
            description: 'You are not authorized to perform this action. Check Firestore rules.',
        });
    } finally {
        setIsResetting(false);
    }
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
      <CardFooter>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isResetting || !allVotes || allVotes.length === 0}>
              {isResetting ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {isResetting ? 'Resetting Votes...' : 'Reset All Individual Votes'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete all individual votes for all users. It will not affect scheduled events.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetAllVotes} className="bg-destructive hover:bg-destructive/90">
                Yes, Reset All Votes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
