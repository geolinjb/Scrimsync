
'use client';

import * as React from 'react';
import { format, startOfToday, isToday } from 'date-fns';
import { CalendarCheck, Trash2, UploadCloud, Loader, CalendarX2, Undo2, Ban, Vote, Check, Send, Sparkles } from 'lucide-react';
import type { User } from 'firebase/auth';
import { collection, doc, setDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import Image from 'next/image';

import type { ScheduleEvent, PlayerProfileData } from '@/lib/types';
import { MINIMUM_PLAYERS } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { cn, getDiscordTimestamp } from '@/lib/utils';
import { useCollection, useFirestore, useMemoFirebase, useFirebaseApp } from '@/firebase';
import { Progress } from '../ui/progress';
import { Alert, AlertTitle } from '../ui/alert';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from '../ui/skeleton';
import { DISCORD_WEBHOOK_URL } from '@/lib/config';

type ScheduledEventsProps = {
  events: ScheduleEvent[];
  allEventVotes: { [eventId: string]: string[] };
  userEventVotes: Set<string>;
  onEventVoteTrigger: (event: ScheduleEvent) => void;
  onRemoveEvent: (eventId: string) => void;
  currentUser: User | null;
  isAdmin: boolean;
};

export function ScheduledEvents({ events, allEventVotes, userEventVotes, onEventVoteTrigger, onRemoveEvent, currentUser, isAdmin }: ScheduledEventsProps) {
    const { toast } = useToast();
    const [mounted, setMounted] = React.useState(false);
    const [uploadingEventId, setUploadingEventId] = React.useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = React.useState(0);
    const [isSendingReady, setIsSendingReady] = React.useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const firestore = useFirestore();
    const firebaseApp = useFirebaseApp();

    const profilesRef = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const { data: profiles } = useCollection<PlayerProfileData>(profilesRef);
    const profileMap = React.useMemo(() => new Map(profiles?.map(p => [p.username, p]) || []), [profiles]);

    React.useEffect(() => {
        setMounted(true);
    }, []);
    
    const upcomingEvents = React.useMemo(() => events
        .filter(event => new Date(event.date) >= startOfToday())
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [events]);

    const handleUploadClick = (eventId: string) => {
        setUploadingEventId(eventId);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !firebaseApp || !uploadingEventId || !firestore) return;
        setUploadProgress(0);
        try {
            const storage = getStorage(firebaseApp);
            const fileRef = storageRef(storage, `event-images/${uploadingEventId}/${file.name}`);
            const task = uploadBytesResumable(fileRef, file);
            task.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100));
            await task;
            const imageURL = await getDownloadURL(task.snapshot.ref);
            await setDoc(doc(firestore, 'scheduledEvents', uploadingEventId), { imageURL }, { merge: true });
            toast({ title: 'Image Uploaded!' });
        } catch (e) { toast({ variant: 'destructive', title: 'Upload Failed' }); }
        finally { setUploadingEventId(null); }
    };

    const handleToggleCancel = (event: ScheduleEvent) => {
        if (!firestore) return;
        const newStatus = event.status === 'Cancelled' ? 'Active' : 'Cancelled';
        setDoc(doc(firestore, 'scheduledEvents', event.id), { status: newStatus }, { merge: true });
        addDocumentNonBlocking(collection(firestore, 'appNotifications'), {
            message: `Event ${newStatus.toLowerCase()}: ${event.type} on ${format(new Date(event.date), 'd MMM')}`,
            icon: newStatus === 'Cancelled' ? 'CalendarX2' : 'CalendarPlus',
            createdBy: currentUser?.displayName || 'Admin',
            timestamp: new Date().toISOString()
        });
    };

    const handleSendRosterReady = async (event: ScheduleEvent, players: string[]) => {
        setIsSendingReady(event.id);
        const dsTimestamp = getDiscordTimestamp(event.date, event.time, 'F');
        const dsRelative = getDiscordTimestamp(event.date, event.time, 'R');
        const mention = event.discordRoleId ? `<@&${event.discordRoleId}>` : '';
        
        const playerTags = players.map(name => {
            const prof = profileMap.get(name);
            return prof?.discordUsername || name;
        });

        const payload = {
            content: mention,
            embeds: [{
                title: "✅ ROSTER READY!",
                description: `The **${event.type}** at ${dsTimestamp} (${dsRelative}) is officially ready with **${players.length} players**!\n\n**Squad:**\n${playerTags.map(p => `- ${p}`).join('\n')}`,
                color: 2278750, // Green
                timestamp: new Date().toISOString(),
                footer: { text: "TeamSync • Coordination made easy" },
                image: event.imageURL ? { url: event.imageURL } : undefined
            }]
        };

        try {
            const res = await fetch(DISCORD_WEBHOOK_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload) 
            });
            if (res.ok) {
                toast({ title: 'Roster Ready Alert Sent!' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to send alert' });
        } finally {
            setIsSendingReady(null);
        }
    };

    if (!mounted) return (
        <Card>
            <CardHeader><div className="flex items-center gap-3"><CalendarCheck className="w-6 h-6 text-gold" /><CardTitle>Upcoming Events</CardTitle></div></CardHeader>
            <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
        </Card>
    );

    return (
        <Card>
            <CardHeader><div className="flex items-center gap-3"><CalendarCheck className="w-6 h-6 text-gold" /><CardTitle>Upcoming Events</CardTitle></div></CardHeader>
            <CardContent>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                {upcomingEvents.length > 0 ? (
                    <ScrollArea className="border rounded-lg h-[450px]">
                        <Accordion type="single" collapsible className="w-full min-w-[320px]">
                            {upcomingEvents.map((event) => {
                                const isVoted = userEventVotes.has(event.id);
                                const availablePlayers = allEventVotes[event.id] || [];
                                const isCancelled = event.status === 'Cancelled';
                                const isRosterFull = availablePlayers.length >= MINIMUM_PLAYERS;

                                return (
                                    <AccordionItem key={event.id} value={event.id}>
                                        <AccordionTrigger className="px-4">
                                            <div className="flex justify-between items-center w-full">
                                                <div className={cn("text-left", isCancelled && "opacity-50")}>
                                                    <div className="flex items-center gap-2">
                                                        <Badge className={cn(event.type === 'Tournament' && 'bg-gold text-black')}>{event.type}</Badge>
                                                        <span className="font-bold">{format(new Date(event.date), 'EEE, d MMM')}</span>
                                                        {isToday(new Date(event.date)) && <Badge variant="outline">Today</Badge>}
                                                        {isRosterFull && !isCancelled && (
                                                            <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 flex items-center gap-1">
                                                                <Check className="w-3 h-3" /> Ready
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <span className="text-sm text-muted-foreground">{event.time}</span>
                                                </div>
                                                {isCancelled && <Badge variant="destructive" className="mr-2">Cancelled</Badge>}
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 space-y-4">
                                            {isCancelled && <Alert variant="destructive"><Ban className="h-4 w-4" /><AlertTitle>Cancelled</AlertTitle></Alert>}
                                            {isRosterFull && !isCancelled && (
                                                <Alert className="bg-primary/5 border-primary/20">
                                                    <Sparkles className="h-4 w-4 text-primary" />
                                                    <AlertTitle className="text-primary font-bold">Roster is Ready!</AlertTitle>
                                                    <div className="mt-2 flex items-center justify-between gap-4">
                                                        <p className="text-xs text-muted-foreground">This event has reached the minimum of {MINIMUM_PLAYERS} players.</p>
                                                        {isAdmin && (
                                                            <Button 
                                                                size="sm" 
                                                                onClick={() => handleSendRosterReady(event, availablePlayers)}
                                                                disabled={isSendingReady === event.id}
                                                            >
                                                                {isSendingReady === event.id ? <Loader className="animate-spin w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                                                Notify Discord
                                                            </Button>
                                                        )}
                                                    </div>
                                                </Alert>
                                            )}
                                            {isAdmin && (
                                                <div className="flex justify-end gap-2 p-2 bg-muted rounded">
                                                    <Button variant="outline" size="sm" onClick={() => handleToggleCancel(event)}>{isCancelled ? <Undo2 className="h-4 w-4" /> : <CalendarX2 className="h-4 w-4" />}</Button>
                                                    <Button variant="outline" size="sm" onClick={() => handleUploadClick(event.id)}><UploadCloud className="h-4 w-4" /></Button>
                                                    <Button variant="destructive" size="sm" onClick={() => onRemoveEvent(event.id)}><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            )}
                                            {event.imageURL && <div className="relative aspect-video rounded-md overflow-hidden border"><Image src={event.imageURL} alt="Event" fill style={{ objectFit: 'cover' }} /></div>}
                                            {event.description && <p className="text-sm border-l-2 border-primary pl-3 py-1 bg-muted/50">{event.description}</p>}
                                            {uploadingEventId === event.id && <Progress value={uploadProgress} className="h-2" />}
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-grow">
                                                    <h4 className="text-sm font-bold mb-2">Available Players ({availablePlayers.length})</h4>
                                                    <div className="flex flex-wrap gap-2">{availablePlayers.map(p => {
                                                        const prof = profileMap.get(p);
                                                        return <Badge key={p} variant="secondary"><Avatar className="w-4 h-4 mr-2"><AvatarImage src={prof?.photoURL} /></Avatar>{p}</Badge>
                                                    })}</div>
                                                </div>
                                                {!isCancelled && <Button variant={isVoted ? 'secondary' : 'default'} size="sm" onClick={() => onEventVoteTrigger(event)}>{isVoted ? <Check className="h-4 w-4 mr-2" /> : <Vote className="h-4 w-4 mr-2" />}{isVoted ? 'Attending' : 'Vote'}</Button>}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                ) : <div className="text-center py-10 opacity-50">No upcoming events.</div>}
            </CardContent>
        </Card>
    );
}
