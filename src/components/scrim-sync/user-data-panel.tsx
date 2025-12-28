'use client';

import * as React from 'react';
import { ShieldCheck, User, Users, Trash2, Loader } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';

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
import type { PlayerProfileData } from '@/lib/types';
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

type UserDataPanelProps = {
  allProfiles: PlayerProfileData[] | null;
  isLoading: boolean;
};

export function UserDataPanel({ allProfiles, isLoading }: UserDataPanelProps) {
  const { toast } = useToast();
  const [isResetting, setIsResetting] = React.useState(false);

  const handleResetAllVotes = async () => {
    setIsResetting(true);
    try {
      const functions = getFunctions();
      const resetAllVotes = httpsCallable(functions, 'resetAllVotes');
      const result = await resetAllVotes();
      toast({
        title: 'Success!',
        description: (result.data as any).message || 'All user votes have been reset.',
      });
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: error.message || 'You are not authorized to perform this action.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
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
            <Button variant="destructive" disabled={isResetting}>
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
