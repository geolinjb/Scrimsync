'use client';
import * as React from 'react';
import { ShieldCheck, User, Trash2 } from 'lucide-react';
import type { PlayerProfileData, Vote } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
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

type AdminPanelProps = {
  allUsers: PlayerProfileData[];
  allVotes: Vote[];
  onResetUserVotes: (userId: string) => void;
};

export function AdminPanel({ allUsers, allVotes, onResetUserVotes }: AdminPanelProps) {

    const votesByUser = React.useMemo(() => {
        return allVotes.reduce((acc, vote) => {
            if (!acc[vote.userId]) {
                acc[vote.userId] = 0;
            }
            acc[vote.userId]++;
            return acc;
        }, {} as Record<string, number>);
    }, [allVotes]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6" />
          <CardTitle>Admin Panel</CardTitle>
        </div>
        <CardDescription>
          Manage users and their data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {allUsers.length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
            {allUsers.map((user) => (
              <AccordionItem key={user.id} value={user.id}>
                <AccordionTrigger>
                  <div className="flex justify-between items-center w-full pr-2">
                    <div className='flex items-center gap-3'>
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={`https://api.dicebear.com/8.x/pixel-art/svg?seed=${user.id}`} alt={user.username} />
                            <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold">{user.username}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                        {votesByUser[user.id] || 0} votes
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="rounded-lg bg-muted/50 p-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h4 className="font-semibold">User Details</h4>
                                <p className="text-sm text-muted-foreground">ID: {user.id}</p>
                                <p className="text-sm text-muted-foreground">Favorite Tank: {user.favoriteTank || 'Not set'}</p>
                                <p className="text-sm text-muted-foreground">Favorite Role: {user.role || 'Not set'}</p>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Reset Votes
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete all votes for <span className='font-bold'>{user.username}</span>. This action cannot be undone.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onResetUserVotes(user.id)} className="bg-destructive hover:bg-destructive/90">
                                        Confirm Reset
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-10">
            <User className="w-12 h-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">No users found in the system.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
