'use client';

import * as React from 'react';
import { format, startOfToday, isToday } from 'date-fns';
import { CalendarCheck, Trash2, UploadCloud, Loader, CalendarX2, Undo2, Ban, Vote, Check, Send, Sparkles, UserPlus, UserMinus, HelpCircle, Info } from 'lucide-react';
import type { User } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import Image from 'next/image';

import type { ScheduleEvent, PlayerProfileData, AvailabilityOverride } from '@/lib/types';
import { MINIMUM_PLAYERS } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { cn, getDiscordTimestamp, formatBytes, formatDiscordMention } from '@/lib/utils';
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
  availabilityOverrides: AvailabilityOverride[];
};

type UploadStatus = {
    progress: number;
    transferred: number;
    total: number;
    fileName: string;
} | null;

const WEBSITE_URL = "https://scrimsync.vercel.app/";

export function ScheduledEvents({ 
    events, 
    allEventVotes, 
    userEventVotes, 
    onEventVoteTrigger, 
    onRemoveEvent, 
    currentUser, 
    isAdmin,
    availabilityOverrides
}: ScheduledEventsProps) {
    const { toast } = useToast();
    const [mounted, setMounted] = React.useState(false);
    const [uploadingEventId, setUploadingEventId] = React.useState<string | null>(null);
    const [uploadStatus, setUploadStatus] = React.useState<UploadStatus>(null);
    const [isSendingReady, setIsSendingReady] = React.useState<string | null>(null);
    const [selectedOverrideUser, setSelectedOverrideUser] = React.useState<string>('');
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const firestore = useFirestore();
    const firebaseApp = useFirebaseApp();

    const profilesRef = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const { data: profiles } = useCollection<PlayerProfileData>(profilesRef);
    const profileMap = React.useMemo(() => new Map(profiles?.map(p => [p.id, p]) || []), [profiles]);
    const usernameToProfileMap = React.useMemo(() => new Map(profiles?.map(p => [p.username, p]) || []), [profiles]);

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
        
        setUploadStatus({ progress: 0, transferred: 0, total: file.size, fileName: file.name });
        try {
            const storage = getStorage(firebaseApp);
            const fileRef = storageRef(storage, `event-images/${uploadingEventId}/${file.name}`);
            const task = uploadBytesResumable(fileRef, file);
            
            task.on('state_changed', (s) => {
                setUploadStatus({
                    progress: (s.bytesTransferred / s.totalBytes) * 100,
                    transferred: s.bytesTransferred,
                    total: s.totalBytes,
                    fileName: file.name
                });
            });
            
            await task;
            const imageURL = await getDownloadURL(task.snapshot.ref);
            await setDoc(doc(firestore, 'scheduledEvents', uploadingEventId), { imageURL }, { merge: true });
            toast({ title: 'Image Uploaded!' });
        } catch (e) { toast({ variant: 'destructive', title: 'Upload Failed' }); }
        finally { 
            setUploadingEventId(null);
            setUploadStatus(null);
        }
    };

    const handleToggleCancel = (event: ScheduleEvent) => {
        if (!firestore) return;
        const newStatus = event.status === 'Cancelled' ? 'Active' : 'Cancelled';
        setDoc(doc(firestore, 'scheduledEvents', event.id), { status: newStatus }, { merge: true });
    };

    const handleAddOverride = async (eventId: string) => {
        if (!firestore || !selectedOverrideUser) return;
        const overrideId = `${eventId}_${selectedOverrideUser}`;
        const overrideRef = doc(firestore, 'availabilityOverrides', overrideId);
        
        try {
            await setDoc(overrideRef, {
                id: overrideId,
                eventId,
                userId: selectedOverrideUser,
                status: 'Possibly Available'
            });
            toast({ title: 'Override Added' });
            setSelectedOverrideUser('');
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to add override' });
        }
    };

    const handleRemoveOverride = async (overrideId: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'availabilityOverrides', overrideId));
            toast({ title: 'Override Removed' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to remove' });
        }
    };

    const handleSendRosterReady = async (event: ScheduleEvent, players: string[], possiblePlayers: string[]) => {
        setIsSendingReady(event.id);
        const dsTimestamp = getDiscordTimestamp(event.date, event.time, 'F');
        const mention = event.discordRoleId ? `<@&${event.discordRoleId}>` : '';
        
        const playerTags = players.map(name => {
            const prof = usernameToProfileMap.get(name);
            return formatDiscordMention(prof?.discordUsername || name);
        });

        const possibleTags = possiblePlayers.map(id => {
            const prof = profileMap.get(id);
            return formatDiscordMention(prof?.discordUsername || prof?.username || id);
        });

        const payload = {
            content: mention,
            embeds: [{
                title: "✅ ROSTER READY!",
                description: `The **${event.type}** at ${dsTimestamp} is officially ready!\n\n**Confirmed Squad:**\n${playerTags.length > 0 ? playerTags.join('\n') : '- None'}${possibleTags.length > 0 ? `\n\n**Possible:**\n${possibleTags.join('\n')}` : ''}\n\n🔗 **Vote:** ${WEBSITE_URL}`,
                color: 2278750,
                timestamp: new Date().toISOString(),
                footer: { text: `TeamSync • ${WEBSITE_URL}` }
            }]
        };

        try {
            const res = await fetch(DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) toast({ title: 'Discord Alert Sent!' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to send alert' });
        } finally {
            setIsSendingReady(null);
        }
    };

    if (!mounted) return <Skeleton className="h-[200px] w-full" />;

    return (
        <Card>
            <CardHeader><div className="flex items-center gap-3"><CalendarCheck className="w-6 h-6 text-gold" /><CardTitle>Upcoming Events</CardTitle></div></CardHeader>
            <CardContent>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                {upcomingEvents.length > 0 ? (
                    <ScrollArea className="border rounded-lg h-[450px]">
                        <Accordion type="single" collapsible className="w-full">
                            {upcomingEvents.map((event) => {
                                const isVoted = userEventVotes.has(event.id);
                                const availablePlayers = allEventVotes[event.id] || [];
                                const isCancelled = event.status === 'Cancelled';
                                const isRosterFull = availablePlayers.length >= MINIMUM_PLAYERS;
                                const eventOverrides = availabilityOverrides.filter(o => o.eventId === event.id);

                                return (
                                    <AccordionItem key={event.id} value={event.id}>
                                        <AccordionTrigger className="px-4">
                                            <div className="flex justify-between items-center w-full pr-4">
                                                <div className={cn("text-left", isCancelled && "opacity-50")}>
                                                    <div className="flex items-center gap-2">
                                                        <Badge>{event.type}</Badge>
                                                        <span className="font-bold">{format(new Date(event.date), 'EEE, d MMM')}</span>
                                                        {isToday(new Date(event.date)) && <Badge variant="outline" className="text-[10px] h-4">Today</Badge>}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">{event.time}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isRosterFull && !isCancelled && <Badge variant="secondary" className="bg-primary/20 text-primary">Ready</Badge>}
                                                    {isCancelled && <Badge variant="destructive">Cancelled</Badge>}
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 space-y-4">
                                            {isRosterFull && !isCancelled && (
                                                <Alert className="bg-primary/5 border-primary/20">
                                                    <Sparkles className="h-4 w-4 text-primary" />
                                                    <AlertTitle className="text-primary font-bold">Roster Ready!</AlertTitle>
                                                    <div className="mt-2 flex items-center justify-between">
                                                        <p className="text-xs text-muted-foreground">The squad has reached {MINIMUM_PLAYERS} players.</p>
                                                        {isAdmin && (
                                                            <Button size="sm" onClick={() => handleSendRosterReady(event, availablePlayers, eventOverrides.map(o => o.userId))} disabled={isSendingReady === event.id}>
                                                                {isSendingReady === event.id ? <Loader className="animate-spin w-3 h-3 mr-2" /> : <Send className="w-3 h-3 mr-2" />}
                                                                Post Roster
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
                                            {event.imageURL && <div className="relative aspect-video rounded-md overflow-hidden border"><Image src={event.imageURL} alt="Event" fill style={{ objectFit: 'cover' }} unoptimized /></div>}
                                            {event.description && <p className="text-sm italic text-muted-foreground">{event.description}</p>}
                                            
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="text-sm font-bold mb-2">Available Players ({availablePlayers.length})</h4>
                                                    <div className="flex flex-wrap gap-2">{availablePlayers.map(p => (
                                                        <Badge key={p} variant="secondary" className="text-xs"><Avatar className="w-4 h-4 mr-1"><AvatarImage src={usernameToProfileMap.get(p)?.photoURL} /></Avatar>{p}</Badge>
                                                    ))}</div>
                                                </div>

                                                {eventOverrides.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-bold mb-2">Possibly Available ({eventOverrides.length})</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {eventOverrides.map(o => {
                                                                const prof = profileMap.get(o.userId);
                                                                return (
                                                                    <Badge key={o.id} variant="outline" className="border-dashed flex items-center gap-1">
                                                                        <Avatar className="w-4 h-4"><AvatarImage src={prof?.photoURL} /></Avatar>
                                                                        {prof?.username || 'Unknown'}
                                                                        {isAdmin && <Button variant="ghost" size="icon" className="h-4 w-4 ml-1" onClick={() => handleRemoveOverride(o.id)}><UserMinus className="w-3 h-3" /></Button>}
                                                                    </Badge>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {isAdmin && (
                                                    <div className="flex items-center gap-2 pt-2 border-t">
                                                        <Select value={selectedOverrideUser} onValueChange={setSelectedOverrideUser}>
                                                            <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue placeholder="Add possible player..." /></SelectTrigger>
                                                            <SelectContent>{profiles?.map(p => <SelectItem key={p.id} value={p.id}>{p.username}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleAddOverride(event.id)} disabled={!selectedOverrideUser}>
                                                            <UserPlus className="w-3 h-3 mr-2" /> Add
                                                        </Button>
                                                    </div>
                                                )}
                                                
                                                <div className="flex justify-end">
                                                    {!isCancelled && (
                                                        <Button variant={isVoted ? 'secondary' : 'default'} size="sm" onClick={() => onEventVoteTrigger(event)}>
                                                            {isVoted ? <Check className="h-4 w-4 mr-2" /> : <Vote className="h-4 w-4 mr-2" />}
                                                            {isVoted ? 'Attending' : 'Vote'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    </ScrollArea>
                ) : <div className="text-center py-10 opacity-50">No upcoming events.</div>}
            </CardContent>
        </Card>
    );
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
