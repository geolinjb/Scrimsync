'use client';

import * as React from 'react';
import { format, startOfToday, isSameDay } from 'date-fns';
import { Send, Megaphone, Check, Loader, UploadCloud, Image as ImageIcon, CalendarDays, Sparkles, BellRing, LayoutGrid, Trash2, PlusCircle } from 'lucide-react';
import Image from 'next/image';
import type { User as AuthUser } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, uploadString } from "firebase/storage";
import { doc, setDoc, collection, query, orderBy, limit } from 'firebase/firestore';

import type { AllVotes, PlayerProfileData, ScheduleEvent, AvailabilityOverride, EventBanner } from '@/lib/types';
import { MINIMUM_PLAYERS } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseApp, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Separator } from '../ui/separator';
import { DISCORD_WEBHOOK_URL } from '@/lib/config';
import { getDiscordTimestamp, formatBytes, formatDiscordMention } from '@/lib/utils';
import { generateEventBanner } from '@/ai/flows/generate-event-banner-flow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Progress } from '../ui/progress';

type ReminderGeneratorProps = {
  events: ScheduleEvent[] | null;
  allVotes: AllVotes;
  allProfiles: PlayerProfileData[];
  availabilityOverrides: AvailabilityOverride[];
  isAdmin: boolean;
  currentUser: AuthUser | null;
};

type UploadStatus = {
  progress: number;
  transferred: number;
  total: number;
  fileName: string;
} | null;

const EMBED_COLORS = {
  BLUE: 3892342,
  GOLD: 16766720,
  RED: 15680580,
  GREEN: 2278750
};

const WEBSITE_URL = "https://scrimsync.vercel.app/";

export function ReminderGenerator({ events, allVotes, allProfiles, availabilityOverrides, isAdmin, currentUser }: ReminderGeneratorProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const galleryUploadRef = React.useRef<HTMLInputElement>(null);

  const [mounted, setMounted] = React.useState(false);
  const [selectedEventId, setSelectedEventId] = React.useState<string>('');
  const [reminderMessage, setReminderMessage] = React.useState<string>('');
  const [imageToSend, setImageToSend] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [isSendingSummary, setIsSendingSummary] = React.useState(false);
  const [sendSuccess, setSendSuccess] = React.useState(false);

  const [uploadStatus, setUploadStatus] = React.useState<UploadStatus>(null);
  const [isGeneratingAI, setIsGeneratingAI] = React.useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = React.useState(false);
  const [saveToGallery, setSaveToGallery] = React.useState(true);
  const [includeNudges, setIncludeNudges] = React.useState(false);

  const isUploading = uploadStatus !== null;

  const galleryQuery = useMemoFirebase(() => {
    if (!firestore || !currentUser) return null;
    return query(collection(firestore, 'eventBanners'), orderBy('timestamp', 'desc'), limit(50));
  }, [firestore, currentUser]);

  const { data: teamGallery, isLoading: isGalleryLoading } = useCollection<EventBanner>(galleryQuery);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const profileMap = React.useMemo(() => {
      return new Map(allProfiles.map(p => [p.username, p]));
  }, [allProfiles]);

  const profileIdMap = React.useMemo(() => {
      return new Map(allProfiles.map(p => [p.id, p]));
  }, [allProfiles]);

  const upcomingEvents = React.useMemo(() => {
    if (!events) return [];
    return events
      .filter(event => new Date(event.date) >= startOfToday())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

    const selectedEvent = React.useMemo(() => {
        if (!selectedEventId || !events) return null;
        return events.find(e => e.id === selectedEventId);
    }, [selectedEventId, events]);

  const buildReminderMessage = (eventId: string, nudges: boolean = false) => {
    const event = upcomingEvents.find(e => e.id === eventId);
    if (!event) return '';

    const dsTimestamp = getDiscordTimestamp(event.date, event.time, 'F');
    const voteKey = `${format(new Date(event.date), 'yyyy-MM-dd')}-${event.time}`;
    const availablePlayerNames = allVotes[voteKey] || [];
    
    const availablePlayerTags = availablePlayerNames.map(name => {
        const prof = profileMap.get(name);
        return formatDiscordMention(prof?.discordUsername || name);
    });

    const eventOverrides = availabilityOverrides.filter(o => o.eventId === eventId);
    const possiblePlayerTags = eventOverrides.map(o => {
        const prof = profileIdMap.get(o.userId);
        return formatDiscordMention(prof?.discordUsername || prof?.username || 'Unknown');
    });

    let msg = `**When:** ${dsTimestamp}\n\n✅ **Available (${availablePlayerNames.length}):**\n${availablePlayerTags.length > 0 ? availablePlayerTags.join('\n') : '- None'}`;

    if (possiblePlayerTags.length > 0) {
        msg += `\n\n❓ **Possibly Available (${possiblePlayerTags.length}):**\n${possiblePlayerTags.join('\n')}`;
    }

    if (nudges) {
        const mainRoster = allProfiles.filter(p => p.rosterStatus === 'Main Roster');
        const missing = mainRoster.filter(p => !availablePlayerNames.includes(p.username) && !eventOverrides.some(o => o.userId === p.id));
        if (missing.length > 0) {
            msg += `\n\n⏰ **Awaiting Response (Main):**\n${missing.map(p => formatDiscordMention(p.discordUsername || p.username)).join('\n')}`;
        }
    }

    msg += `\n\n🔗 **Vote here:** ${WEBSITE_URL}`;

    return msg;
  };

  const generateReminder = (eventId: string, nudges: boolean) => {
    const event = upcomingEvents.find(e => e.id === eventId);
    if (!event) return;
    setImageToSend(event.imageURL || null);
    setReminderMessage(buildReminderMessage(eventId, nudges));
  };
  
  React.useEffect(() => { if (selectedEventId) generateReminder(selectedEventId, includeNudges); }, [events, selectedEventId, includeNudges]);

  const handleSendToDiscord = async () => {
    if (!selectedEvent) return;
    setIsSending(true);
    try {
      const isCancelled = selectedEvent.status === 'Cancelled';
      const roleMention = selectedEvent.discordRoleId ? `<@&${selectedEvent.discordRoleId}>` : '';
      const payload = {
        content: roleMention,
        embeds: [{
          title: `${isCancelled ? '🚫' : '🔔'} ${selectedEvent.type.toUpperCase()} REMINDER`,
          description: reminderMessage,
          color: isCancelled ? EMBED_COLORS.RED : EMBED_COLORS.BLUE,
          image: imageToSend ? { url: imageToSend } : undefined,
          timestamp: new Date().toISOString(),
          footer: { text: `TeamSync • ${WEBSITE_URL}` }
        }]
      };
      const res = await fetch(DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) toast({ title: 'Reminder Sent!' });
    } catch (error) { toast({ variant: 'destructive', title: 'Send Failed' }); }
    finally { setIsSending(false); }
  };

  const handleSendTodaySummary = async () => {
    if (!events) return;
    setIsSendingSummary(true);
    const today = startOfToday();
    const todayEvents = events.filter(e => isSameDay(new Date(e.date), today));
    const summaries = todayEvents.map(e => `- ${e.time}: ${e.type} (${(allVotes[`${format(new Date(e.date), 'yyyy-MM-dd')}-${e.time}`] || []).length}/${MINIMUM_PLAYERS})`);
    
    const payload = {
      embeds: [{
        title: `📅 SCHEDULE FOR ${format(today, 'EEEE, d MMM')}`,
        description: summaries.length > 0 ? `${summaries.join('\n')}\n\n🔗 **Full Dashboard:** ${WEBSITE_URL}` : `No events scheduled for today.\n\n🔗 **Full Dashboard:** ${WEBSITE_URL}`,
        color: EMBED_COLORS.BLUE,
        timestamp: new Date().toISOString(),
        footer: { text: `TeamSync • ${WEBSITE_URL}` }
      }]
    };
    try {
      const res = await fetch(DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) toast({ title: 'Summary Sent!' });
    } catch (error) { toast({ variant: 'destructive', title: 'Summary Failed' }); }
    finally { setIsSendingSummary(false); }
  };

  const handleGenerateAIBanner = async () => {
    if (!selectedEvent || !firebaseApp || !firestore) return;
    setIsGeneratingAI(true);
    try {
      const { imageUrl: dataUri } = await generateEventBanner({ type: selectedEvent.type, description: selectedEvent.description });
      const storage = getStorage(firebaseApp);
      const fileRef = storageRef(storage, `event-images/${selectedEvent.id}/ai-banner-${Date.now()}.png`);
      const base64Data = dataUri.split(',')[1];
      await uploadString(fileRef, base64Data, 'base64', { contentType: 'image/png' });
      const permanentUrl = await getDownloadURL(fileRef);
      await setDoc(doc(firestore, 'scheduledEvents', selectedEvent.id), { imageURL: permanentUrl }, { merge: true });
      setImageToSend(permanentUrl);
      toast({ title: 'AI Banner Generated!' });
    } catch (error) { toast({ variant: 'destructive', title: 'AI Generation Failed' }); }
    finally { setIsGeneratingAI(false); }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, isDirectToGallery = false) => {
    const file = event.target.files?.[0];
    if (!file || !firebaseApp || !firestore) return;

    setUploadStatus({ progress: 0, transferred: 0, total: file.size, fileName: file.name });
    try {
        const storage = getStorage(firebaseApp);
        const path = isDirectToGallery ? `team-gallery/${Date.now()}-${file.name}` : `event-images/${selectedEventId}/${file.name}`;
        const fileRef = storageRef(storage, path);
        const task = uploadBytesResumable(fileRef, file);
        
        task.on('state_changed', (s) => {
            setUploadStatus({ progress: (s.bytesTransferred / s.totalBytes) * 100, transferred: s.bytesTransferred, total: s.totalBytes, fileName: file.name });
        });
        
        await task;
        const imageURL = await getDownloadURL(task.snapshot.ref);
        
        if (!isDirectToGallery && selectedEventId) {
            await setDoc(doc(firestore, 'scheduledEvents', selectedEventId), { imageURL }, { merge: true });
            setImageToSend(imageURL);
        }

        if (isDirectToGallery || saveToGallery) {
            addDocumentNonBlocking(collection(firestore, 'eventBanners'), { id: `upload-${Date.now()}`, url: imageURL, description: file.name, uploadedBy: currentUser?.displayName || 'User', timestamp: new Date().toISOString() });
        }
        toast({ title: 'Upload Complete!' });
    } catch (error) { toast({ variant: 'destructive', title: 'Upload Failed' }); }
    finally { setUploadStatus(null); }
  };

  if (!mounted) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-gold" />
          <CardTitle>Discord Integrations</CardTitle>
        </div>
        <CardDescription>Post reminders and summaries to your server.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button onClick={handleSendTodaySummary} variant="outline" className="w-full">
            <Send className="mr-2 h-4 w-4" /> Post Today's Summary
        </Button>

        <Separator />

        <div className="space-y-4">
          <div className='flex items-center justify-between'>
            <h3 className="text-sm font-semibold">Team Gallery</h3>
            <Button onClick={() => galleryUploadRef.current?.click()} size="sm" variant="ghost">Quick Upload</Button>
            <input type="file" ref={galleryUploadRef} onChange={(e) => handleFileChange(e, true)} className="hidden" />
          </div>
          <Button variant="secondary" className="w-full" onClick={() => setIsGalleryOpen(true)}>Open Gallery</Button>
          
          {isUploading && uploadStatus && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30 text-xs">
                  <div className='flex justify-between'><span>{uploadStatus.fileName}</span><span>{formatBytes(uploadStatus.transferred)} / {formatBytes(uploadStatus.total)}</span></div>
                  <Progress value={uploadStatus.progress} className="h-1.5" />
              </div>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger><SelectValue placeholder="Select event..." /></SelectTrigger>
            <SelectContent>{upcomingEvents.map(e => <SelectItem key={e.id} value={e.id}>{e.type} - {format(new Date(e.date), 'EEE, d MMM')} @ {e.time}</SelectItem>)}</SelectContent>
          </Select>
          
          {selectedEventId && (
              <div className="space-y-3">
                  {imageToSend && <div className="relative aspect-video rounded-md overflow-hidden border"><Image src={imageToSend} alt="Event" fill style={{ objectFit: 'cover' }} unoptimized /></div>}
                  <div className='grid grid-cols-2 gap-2'>
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">Upload</Button>
                    <Button onClick={handleGenerateAIBanner} variant="outline" size="sm">AI Generate</Button>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, false)} className="hidden" />
                  
                  <div className="flex items-center space-x-2 py-1">
                    <Checkbox id="nudge" checked={includeNudges} onCheckedChange={(v) => setIncludeNudges(v === true)} />
                    <Label htmlFor="nudge" className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Nudge missing Main Roster players
                    </Label>
                  </div>

                  <Textarea value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)} className="min-h-[120px] text-xs font-mono" />
                  <Button onClick={handleSendToDiscord} className="w-full"><Send className="mr-2 h-4 w-4" /> Post Reminder</Button>
              </div>
          )}
        </div>
      </CardContent>

      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
                <DialogTitle>Team Banner Gallery</DialogTitle>
                <DialogDescription>Select an image to use as the banner for the selected event.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[50vh]">
                <div className="grid grid-cols-2 gap-4 p-1">
                    {teamGallery?.map(img => (
                        <div key={img.id} className="cursor-pointer border rounded p-1 hover:border-primary transition-colors" onClick={() => { if(selectedEventId) { setDoc(doc(firestore!, 'scheduledEvents', selectedEventId), { imageURL: img.url }, { merge: true }); setImageToSend(img.url); setIsGalleryOpen(false); } }}>
                            <div className="relative aspect-video"><Image src={img.url} alt="Gallery" fill className="object-cover" unoptimized /></div>
                            <p className="text-[10px] text-muted-foreground mt-1 truncate">{img.description}</p>
                        </div>
                    ))}
                    {(!teamGallery || teamGallery.length === 0) && (
                        <div className="col-span-2 text-center py-12 text-muted-foreground">
                            No images in the gallery yet.
                        </div>
                    )}
                </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
    </Card>
  );
}
