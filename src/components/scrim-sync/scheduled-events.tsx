'use client';

import * as React from 'react';
import { format, startOfToday, differenceInMinutes, isToday } from 'date-fns';
import { CalendarCheck, Users, Trash2, Copy, Trophy, UploadCloud, Loader } from 'lucide-react';
import type { User } from 'firebase/auth';
import { collection, doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, type UploadTask } from "firebase/storage";
import Image from 'next/image';


import type { AllVotes, ScheduleEvent, PlayerProfileData } from '@/lib/types';
import { MINIMUM_PLAYERS } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { useCollection, useFirestore, useMemoFirebase, useFirebaseApp, errorEmitter, FirestorePermissionError } from '@/firebase';
import { Progress } from '../ui/progress';

type ScheduledEventsProps = {
  events: ScheduleEvent[];
  votes: AllVotes;
  allPlayerNames: string[];
  onRemoveEvent: (eventId: string) => void;
  currentUser: User | null;
  isAdmin: boolean;
};

type UploadState = {
    [eventId: string]: {
        isUploading: boolean;
        progress: number;
    }
}

export function ScheduledEvents({ events, votes, allPlayerNames, onRemoveEvent, currentUser, isAdmin }: ScheduledEventsProps) {
    const { toast } = useToast();
    const [now, setNow] = React.useState(new Date());
    const [uploadState, setUploadState] = React.useState<UploadState>({});
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [selectedEventIdForUpload, setSelectedEventIdForUpload] = React.useState<string | null>(null);

    const firestore = useFirestore();
    const firebaseApp = useFirebaseApp();

    const profilesRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);

    const { data: profiles } = useCollection<PlayerProfileData>(profilesRef);

    const profileMap = React.useMemo(() => {
        if (!profiles) return new Map();
        return new Map(profiles.map(p => [p.username, p]));
    }, [profiles]);

    React.useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);
    
    const upcomingEvents = React.useMemo(() => {
        if (!events) return [];
        const today = startOfToday();
        return events
            .filter(event => new Date(event.date) >= today)
            .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [events]);

    const getAvailablePlayers = (event: ScheduleEvent): string[] => {
        const dateKey = format(new Date(event.date), 'yyyy-MM-dd');
        const voteKey = `${dateKey}-${event.time}`;
        return votes[voteKey] || [];
    };

    const handleUploadClick = (eventId: string) => {
        if (!currentUser) {
            toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to upload an image.' });
            return;
        }
        setSelectedEventIdForUpload(eventId);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !firebaseApp || !currentUser || !selectedEventIdForUpload || !firestore) {
            toast({ variant: 'destructive', title: 'Upload Error', description: 'Could not start upload.' });
            return;
        }
        
        const eventId = selectedEventIdForUpload;

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast({ variant: 'destructive', title: 'File Too Large', description: 'Please select an image smaller than 5MB.' });
            return;
        }

        setUploadState(prev => ({ ...prev, [eventId]: { isUploading: true, progress: 0 } }));

        try {
            const storage = getStorage(firebaseApp);
            const filePath = `event-images/${eventId}/${file.name}`;
            const fileRef = storageRef(storage, filePath);
            const uploadTask: UploadTask = uploadBytesResumable(fileRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadState(prev => ({ ...prev, [eventId]: { isUploading: true, progress: progress } }));
                }
            );
            
            await uploadTask;

            const imageURL = await getDownloadURL(uploadTask.snapshot.ref);
            const eventDocRef = doc(firestore, 'scheduledEvents', eventId);
            
            updateDoc(eventDocRef, { imageURL }).catch(error => {
                 const permissionError = new FirestorePermissionError({
                    path: eventDocRef.path,
                    operation: 'update',
                    requestResourceData: { imageURL }
                });
                errorEmitter.emit('permission-error', permissionError);
                 toast({
                    variant: 'destructive',
                    title: 'Update Failed',
                    description: 'Could not save the image URL. You may not have permission.',
                });
            });

            toast({ title: 'Image Uploaded!', description: 'The event image has been updated.' });
            
        } catch (error) {
            console.error("Error uploading file for event:", error);
             toast({
                variant: 'destructive',
                title: 'Upload Failed',
                description: 'Could not upload the image. You may not have permission.',
            });
            const permissionError = new FirestorePermissionError({
                path: `event-images/${eventId}/${file.name}`,
                operation: 'write',
            });
            errorEmitter.emit('permission-error', permissionError);
        } finally {
            setUploadState(prev => ({ ...prev, [eventId]: { isUploading: false, progress: 0 } }));
            setSelectedEventIdForUpload(null);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    };


    const formatTimeRemaining = (eventDate: Date, eventTime: string) => {
        const [time, modifier] = eventTime.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
    
        if (modifier === 'PM' && hours !== 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
    
        const eventDateTime = new Date(eventDate);
        eventDateTime.setHours(hours, minutes, 0, 0);

        const totalMinutes = differenceInMinutes(eventDateTime, now);

        if (totalMinutes <= 0) return 'Started';

        const daysLeft = Math.floor(totalMinutes / (60 * 24));
        const hoursLeft = Math.floor((totalMinutes % (60*24)) / 60);
        const minutesLeft = totalMinutes % 60;
        
        let result = 'in';
        if (daysLeft > 0) result += ` ${daysLeft}d`;
        if (hoursLeft > 0) result += ` ${hoursLeft}h`;
        if (daysLeft === 0 && minutesLeft > 0) result += ` ${minutesLeft}m`;
        
        return result === 'in' ? 'Starting now' : result;
    };
    
    const handleCopyList = (event: ScheduleEvent, availablePlayers: string[]) => {
        const unavailablePlayers = allPlayerNames.filter(p => !availablePlayers.includes(p));
        const neededPlayers = Math.max(0, MINIMUM_PLAYERS - availablePlayers.length);

        const timeRemaining = formatTimeRemaining(new Date(event.date), event.time);
        const header = `Roster for ${event.type} on ${format(new Date(event.date), 'EEEE, d MMM')} at ${event.time} (starts ${timeRemaining}):`;
        
        const availableHeader = `✅ Available Players (${availablePlayers.length}):`;
        const availableList = availablePlayers.length > 0 ? availablePlayers.map(p => `- ${p}`).join('\n') : '- None';
        
        const neededText = `🔥 Players Needed: ${neededPlayers}`;
        
        const unavailableHeader = `❌ Unavailable Players (${unavailablePlayers.length}):`;
        const unavailableList = unavailablePlayers.length > 0 ? unavailablePlayers.map(p => `- ${p}`).join('\n') : '- None';

        const footer = `\n---\nGenerated by TeamSync\nhttps://scrimsync.vercel.app/`;

        const fullText = [
            header, '', availableHeader, availableList, '',
            neededText, '', unavailableHeader, unavailableList, footer
        ].join('\n');
        
        navigator.clipboard.writeText(fullText).then(() => {
            toast({ title: 'Copied to Clipboard', description: 'The roster summary has been copied.' });
        }, (err) => {
            console.error('Could not copy text: ', err);
            toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not copy the list to your clipboard.' });
        });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <CalendarCheck className="w-6 h-6 text-gold" />
                    <CardTitle>Upcoming Events</CardTitle>
                </div>
                <CardDescription>
                    Here are your team's scheduled sessions. You can upload a relevant screenshot for each event (max 5MB).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" className="hidden" />
                {upcomingEvents.length > 0 ? (
                    <ScrollArea className='h-[400px]'>
                        <Accordion type="single" collapsible className="w-full">
                            {upcomingEvents.map((event) => {
                                const availablePlayers = getAvailablePlayers(event);
                                const canManage = isAdmin || (currentUser && currentUser.uid === event.creatorId);
                                const currentUpload = uploadState[event.id];
                                return (
                                    <AccordionItem key={event.id} value={event.id}>
                                        <AccordionTrigger>
                                            <div className="flex justify-between items-center w-full pr-2">
                                                <div className='flex flex-col items-start text-left'>
                                                    <div className='flex items-center gap-2'>
                                                        <Badge variant={event.type === 'Tournament' ? 'default' : 'secondary'} className={cn(event.type === 'Tournament' && 'bg-gold text-black hover:bg-gold/90')}>
                                                            {event.type === 'Tournament' && <Trophy className='w-3 h-3 mr-1'/>}
                                                            {event.type}
                                                        </Badge>
                                                        <span className={cn('font-semibold', isToday(new Date(event.date)) && 'text-gold')}>{format(new Date(event.date), 'EEEE, d MMM')}</span>
                                                        {isToday(new Date(event.date)) && <Badge variant="outline">Today</Badge>}
                                                    </div>
                                                    <div className='flex items-baseline gap-2'>
                                                        <span className='text-sm text-muted-foreground'>{event.time}</span>
                                                        <span className='text-xs text-primary/80 font-medium'>{formatTimeRemaining(new Date(event.date), event.time)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className='space-y-4'>
                                                {event.imageURL && (
                                                    <div className="relative aspect-video w-full rounded-md overflow-hidden border">
                                                        <Image src={event.imageURL} alt={`Screenshot for ${event.type}`} fill objectFit='cover' />
                                                    </div>
                                                )}

                                                {currentUpload?.isUploading && (
                                                    <div className='space-y-1'>
                                                        <Progress value={currentUpload.progress} className="w-full h-2" />
                                                        <p className='text-xs text-muted-foreground text-center'>{`Uploading... ${Math.round(currentUpload.progress)}%`}</p>
                                                    </div>
                                                )}

                                                <div className='flex justify-between items-start gap-4'>
                                                    <div className='flex-grow'>
                                                        <div className='mb-2'>
                                                            <span className='font-semibold'>{availablePlayers.length}</span> players available. <span className='text-muted-foreground'>{Math.max(0, MINIMUM_PLAYERS - availablePlayers.length)} more needed.</span>
                                                        </div>
                                                        {availablePlayers.length > 0 ? (
                                                            <ul className="space-y-3">
                                                                {availablePlayers.map((player) => {
                                                                    const profile = profileMap.get(player);
                                                                    return (
                                                                        <li key={player} className="flex items-center gap-3">
                                                                            <Avatar className="h-8 w-8"><AvatarImage src={profile?.photoURL ?? `https://api.dicebear.com/8.x/pixel-art/svg?seed=${profile?.id || player}`} /><AvatarFallback>{player.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                                                                            <span className="font-medium">{player}</span>
                                                                        </li>
                                                                    )
                                                                })}
                                                            </ul>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center text-center py-6"><Users className="w-10 h-10 text-muted-foreground" /><p className="mt-3 text-muted-foreground">No players have marked themselves as available yet.</p></div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-center gap-2 shrink-0">
                                                        {canManage && (
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                                                                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the scheduled {event.type.toLowerCase()}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onRemoveEvent(event.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                                            </AlertDialog>
                                                        )}
                                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleCopyList(event, availablePlayers)}><Copy className="w-4 h-4" /></Button>
                                                        {canManage && (
                                                             <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleUploadClick(event.id)} disabled={currentUpload?.isUploading}>
                                                                {currentUpload?.isUploading ? <Loader className='w-4 h-4 animate-spin' /> : <UploadCloud className="w-4 h-4" />}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    </ScrollArea>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
                        <CalendarCheck className="w-12 h-12 text-muted-foreground" />
                        <p className="mt-4 text-muted-foreground">No upcoming events scheduled.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
