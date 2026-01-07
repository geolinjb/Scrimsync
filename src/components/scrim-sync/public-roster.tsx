'use client';

import * as React from 'react';
import { collection } from 'firebase/firestore';
import { Shield, Swords, Users, Loader } from 'lucide-react';
import { motion } from 'framer-motion';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { PlayerProfileData } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '../ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

export function PublicRoster() {
  const firestore = useFirestore();

  const profilesRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const { data: profiles, isLoading } = useCollection<PlayerProfileData>(profilesRef);

  const sortedProfiles = React.useMemo(() => {
    if (!profiles) return [];
    
    const statusOrder = ['Main Roster', 'Standby Player'];

    return profiles
        .filter(p => p.username) // Only show profiles with a username
        .sort((a, b) => {
            const statusA = a.rosterStatus || 'z';
            const statusB = b.rosterStatus || 'z';
            const indexA = statusOrder.indexOf(statusA);
            const indexB = statusOrder.indexOf(statusB);

            if (indexA !== -1 && indexB !== -1) {
                if (indexA !== indexB) return indexA - indexB;
            } else if (indexA !== -1) {
                return -1; // a has status, b does not
            } else if (indexB !== -1) {
                return 1; // b has status, a does not
            }

            return a.username.localeCompare(b.username); // Fallback to alphabetical sort
        });
  }, [profiles]);
  
  if (isLoading) {
    return (
        <div>
            <CardHeader className='px-0'>
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className='items-center text-center'>
                            <Skeleton className="h-20 w-20 rounded-full" />
                             <Skeleton className="h-6 w-3/4 mt-4" />
                        </CardHeader>
                        <CardContent className='space-y-4'>
                            <Skeleton className="h-6 w-full" />
                             <Skeleton className="h-10 w-full" />
                        </CardContent>
                    </Card>
                ))}
            </div>
      </div>
    );
  }

  if (!sortedProfiles || sortedProfiles.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-16">
            <Users className="w-16 h-16 text-muted-foreground" />
            <h2 className="mt-6 text-2xl font-semibold">No Players Found</h2>
            <p className="mt-2 text-muted-foreground">The roster is currently empty. Check back later!</p>
        </div>
    )
  }

  return (
    <div>
        <CardHeader className='px-0'>
            <CardTitle className='text-3xl'>Team Roster</CardTitle>
            <CardDescription>Meet the members of the team.</CardDescription>
        </CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {sortedProfiles.map((profile, index) => (
                 <motion.div
                    key={profile.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                 >
                    <Card className='h-full flex flex-col'>
                        <CardHeader className='items-center text-center'>
                            <Avatar className='w-20 h-20 border-2 border-primary/50'>
                                <AvatarImage src={`https://api.dicebear.com/8.x/pixel-art/svg?seed=${profile.id}`} />
                                <AvatarFallback>{profile.username.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <CardTitle className='pt-4'>{profile.username}</CardTitle>
                        </CardHeader>
                        <CardContent className='flex-grow flex flex-col justify-center'>
                            <div className='space-y-4'>
                                <div className='space-y-2 text-center'>
                                     <h4 className='text-sm font-semibold text-muted-foreground'>Status</h4>
                                    {profile.rosterStatus ? (
                                        <Badge variant={profile.rosterStatus === 'Main Roster' ? 'default' : 'secondary'} className={cn('text-sm', profile.rosterStatus === 'Main Roster' && 'bg-gold text-black hover:bg-gold/90')}>
                                        <Shield className="w-3 h-3 mr-1.5" />
                                        {profile.rosterStatus}
                                        </Badge>
                                    ) : (
                                        <span className="text-sm text-muted-foreground/80 italic">Not Assigned</span>
                                    )}
                                </div>
                                <Separator />
                                <div className='space-y-2 text-center'>
                                    <h4 className='text-sm font-semibold text-muted-foreground'>Playstyle</h4>
                                    <div className="flex flex-wrap gap-2 justify-center min-h-[26px]">
                                        {profile.playstyleTags && profile.playstyleTags.length > 0 ? (
                                            profile.playstyleTags.map(tag => (
                                                <Badge key={tag} variant="outline" className="text-sm">
                                                <Swords className="w-3 h-3 mr-1.5" />
                                                {tag}
                                                </Badge>
                                            ))
                                        ) : (
                                            <span className="text-sm text-muted-foreground/80 italic">Not Assigned</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            ))}
        </div>
    </div>
  );
}
