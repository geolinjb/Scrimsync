
'use client';

import * as React from 'react';
import { format, startOfToday, isSameDay } from 'date-fns';
import { Send, Megaphone, Check, Loader, UploadCloud, Image as ImageIcon, CalendarDays, Sparkles, BellRing, LayoutGrid, Trash2 } from 'lucide-react';
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
import { getDiscordTimestamp } from '@/lib/utils';
import { generateEventBanner } from '@/ai/flows/generate-event-banner-flow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const EMBED_COLORS = {
  BLUE: 3892342,
  GOLD: 16766720,
  RED: 15680580,
  GREEN: 2278750
};

export function ReminderGenerator({ events, allVotes, allProfiles, availabilityOverrides, isAdmin, currentUser }: ReminderGeneratorProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [mounted, setMounted] = React.useState(false);
  const [selectedEventId, setSelectedEventId] = React.useState<string>('');
  const [reminderMessage, setReminderMessage] = React.useState<string>('');
  const [imageToSend, setImageToSend] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [isSendingSummary, setIsSendingSummary] = React.useState(false);
  const [sendSuccess, setSendSuccess] = React.useState(false);

  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = React.useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = React.useState(false);
  const [saveToGallery, setSaveToGallery] = React.useState(true);

  const isUploading = uploadProgress !== null;

  const galleryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'eventBanners'), orderBy('timestamp', 'desc'), limit(50));
  }, [firestore]);

  const { data: teamGallery } = useCollection<EventBanner>(galleryQuery);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const profileMap = React.useMemo(() => {
      return new Map(allProfiles.map(p => [p.username, p]));
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

    const canManageEvent = React.useMemo(() => isAdmin || (selectedEvent && currentUser && currentUser.uid === selectedEvent.creatorId), [selectedEvent, currentUser, isAdmin]);

  const buildReminderMessage = (eventId: string, includeNudges: boolean = false) => {
    const event = upcomingEvents.find(e => e.id === eventId);
    if (!event) return '';

    const isCancelled = event.status === 'Cancelled';
    const dsTimestamp = getDiscordTimestamp(event.date, event.time, 'F');
    const dsRelative = getDiscordTimestamp(event.date, event.time, 'R');

    if (isCancelled) {
        return `🚫 **EVENT CANCELLED** 🚫\n> The **${event.type}** at ${dsTimestamp} has been cancelled.`;
    }

    const voteKey = `${format(new Date(event.date), 'yyyy-MM-dd')}-${event.time}`;
    const availablePlayerNames = allVotes[voteKey] || [];
    const totalAvailable = availablePlayerNames.length;

    const availablePlayerTags = availablePlayerNames.map(name => {
        const prof = profileMap.get(name);
        return prof?.discordUsername || name;
    });

    let msg = `**When:** ${dsTimestamp} (${dsRelative})\n\n✅ **Available (${availablePlayerNames.length}):**\n${availablePlayerTags.length > 0 ? availablePlayerTags.map(p => `- ${p}`).join('\n') : '- No one yet'}\n\n🔥 **Needed: ${Math.max(0, MINIMUM_PLAYERS - totalAvailable)}**`;

    if (includeNudges) {
        const mainRosterPlayers = allProfiles.filter(p => p.rosterStatus === 'Main Roster');
        const missingMainRoster = mainRosterPlayers.filter(p => !availablePlayerNames.includes(p.username));
        if (missingMainRoster.length > 0) {
            msg += `\n\n⏰ **Awaiting Response (Main Roster):**\n${missingMainRoster.map(p => `- ${p.discordUsername || p.username}`).join('\n')}`;
        }
    }
    return msg;
  };

  const generateReminder = (eventId: string) => {
    const event = upcomingEvents.find(e => e.id === eventId);
    if (!event) { setReminderMessage(''); setImageToSend(null); return; }
    setImageToSend(event.imageURL || null);
    setReminderMessage(buildReminderMessage(eventId));
  };
  
  React.useEffect(() => { if (selectedEventId) generateReminder(selectedEventId); }, [events, selectedEventId]);

  const handleNudge = () => {
      if (!selectedEventId) return;
      setReminderMessage(buildReminderMessage(selectedEventId, true));
      toast({ description: "Added 'Main Roster' nudges to the message." });
  };

  const handleSendToDiscord = async () => {
    if (!selectedEvent) return;
    setIsSending(true);
    try {
      const isCancelled = selectedEvent.status === 'Cancelled';
      const roleMention = selectedEvent.discordRoleId ? `<@&${selectedEvent.discordRoleId}>` : '';
      const color = isCancelled ? EMBED_COLORS.RED : (selectedEvent.type === 'Tournament' ? EMBED_COLORS.GOLD : EMBED_COLORS.BLUE);
      const payload = {
        content: roleMention,
        embeds: [{
          title: `${isCancelled ? '🚫' : '🔔'} ${selectedEvent.type.toUpperCase()} REMINDER`,
          description: reminderMessage,
          color: color,
          image: imageToSend ? { url: imageToSend } : undefined,
          timestamp: new Date().toISOString(),
          footer: { text: "TeamSync • Coordination made easy" }
        }]
      };
      const res = await fetch(DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { setSendSuccess(true); toast({ title: 'Reminder Sent!' }); setTimeout(() => setSendSuccess(false), 3000); }
    } catch (error) { toast({ variant: 'destructive', title: 'Send Failed' }); }
    finally { setIsSending(false); }
  };

  const handleSendTodaySummary = async () => {
    if (!events) return;
    setIsSendingSummary(true);
    const today = startOfToday();
    const todayEvents = events.filter(e => isSameDay(new Date(e.date), today)).sort((a, b) => a.time.localeCompare(b.time));
    if (todayEvents.length === 0) { toast({ description: "No events scheduled for today." }); setIsSendingSummary(false); return; }
    const eventSummaries = todayEvents.map(event => {
      const voteKey = `${format(new Date(event.date), 'yyyy-MM-dd')}-${event.time}`;
      const availableCount = (allVotes[voteKey] || []).length;
      const isReady = availableCount >= MINIMUM_PLAYERS;
      const statusIcon = event.status === 'Cancelled' ? '🚫' : (isReady ? '✅' : '⏳');
      const dsTime = getDiscordTimestamp(event.date, event.time, 't');
      return `- **${dsTime}**: ${event.type} (${availableCount}/${MINIMUM_PLAYERS} Players) ${statusIcon}`;
    });
    const payload = {
      embeds: [{
        title: `📅 TEAM SCHEDULE: ${format(today, 'EEEE, d MMM')}`,
        description: eventSummaries.join('\n'),
        color: EMBED_COLORS.BLUE,
        timestamp: new Date().toISOString(),
        footer: { text: "Update your availability at scrimsync.vercel.app" }
      }]
    };
    try {
      const res = await fetch(DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) toast({ title: 'Daily Summary Sent!' });
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
      if (saveToGallery) {
          addDocumentNonBlocking(collection(firestore, 'eventBanners'), { id: `ai-${Date.now()}`, url: permanentUrl, description: `AI Banner for ${selectedEvent.type}`, uploadedBy: currentUser?.displayName || 'AI', timestamp: new Date().toISOString() });
      }
      toast({ title: 'AI Banner Generated!' });
      setImageToSend(permanentUrl);
    } catch (error: any) { toast({ variant: 'destructive', title: 'AI Generation Failed' }); }
    finally { setIsGeneratingAI(false); }
  };

  const handleSelectGalleryImage = async (url: string) => {
    if (!selectedEvent || !firestore) return;
    try {
      await setDoc(doc(firestore, 'scheduledEvents', selectedEvent.id), { imageURL: url }, { merge: true });
      setImageToSend(url);
      setIsGalleryOpen(false);
      toast({ title: 'Banner Updated from Gallery' });
    } catch (error) { toast({ variant: 'destructive', title: 'Update Failed' }); }
  };

  const handleRemoveFromGallery = (bannerId: string) => {
    if (!firestore || !isAdmin) return;
    deleteDocumentNonBlocking(doc(firestore, 'eventBanners', bannerId));
    toast({ title: 'Removed from Gallery' });
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firebaseApp || !selectedEventId || !firestore) return;
    setUploadProgress(0);
    try {
        const storage = getStorage(firebaseApp);
        const fileRef = storageRef(storage, `event-images/${selectedEventId}/${file.name}`);
        const uploadTask = uploadBytesResumable(fileRef, file);
        uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100));
        await uploadTask;
        const imageURL = await getDownloadURL(uploadTask.snapshot.ref);
        await setDoc(doc(firestore, 'scheduledEvents', selectedEventId), { imageURL }, { merge: true });
        if (saveToGallery) {
            addDocumentNonBlocking(collection(firestore, 'eventBanners'), { id: `upload-${Date.now()}`, url: imageURL, description: file.name, uploadedBy: currentUser?.displayName || 'User', timestamp: new Date().toISOString() });
        }
        setImageToSend(imageURL);
        toast({ title: 'Image Uploaded!' });
    } catch (error) { toast({ variant: 'destructive', title: 'Upload Failed' }); }
    finally { setUploadProgress(null); }
  };

  if (!mounted) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-gold" />
          <CardTitle>Discord Integrations</CardTitle>
        </div>
        <CardDescription>Post event reminders and schedules. Pick from your team gallery or upload new banners.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Daily Summary
          </h3>
          <Button onClick={handleSendTodaySummary} variant="outline" className="w-full" disabled={isSendingSummary || !events}>
            {isSendingSummary ? <Loader className="animate-spin mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
            Post Today's Summary
          </Button>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            Event Reminder
          </h3>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger><SelectValue placeholder="Select an event..." /></SelectTrigger>
            <SelectContent>{upcomingEvents.map(e => <SelectItem key={e.id} value={e.id}>{e.type} - {format(new Date(e.date), 'EEE, d MMM')} @ {e.time}</SelectItem>)}</SelectContent>
          </Select>
          
          {selectedEventId && (
              <div className="space-y-3">
                  {imageToSend ? (
                    <div className="relative aspect-video rounded-md overflow-hidden border bg-muted">
                      <Image src={imageToSend} alt="Event" fill style={{ objectFit: 'cover' }} unoptimized />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg h-32 flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
                      <ImageIcon className="mb-2 w-6 h-6 opacity-50" />
                      <span className="text-xs">No banner image</span>
                    </div>
                  )}
                  {canManageEvent && (
                    <div className='space-y-3'>
                        <div className='grid grid-cols-1 sm:grid-cols-3 gap-2'>
                            <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
                              <DialogTrigger asChild>
                                <Button variant="secondary" size="sm" className="text-xs">
                                  <LayoutGrid className="mr-2 h-3 w-3" />
                                  Team Gallery
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Team Banner Gallery</DialogTitle>
                                  <DialogDescription>Images your team has uploaded. Select one to use it as the banner for this event.</DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="h-[60vh]">
                                  {teamGallery && teamGallery.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-1">
                                      {teamGallery.map((img) => (
                                        <div key={img.id} className="group relative rounded-lg overflow-hidden border bg-muted">
                                            <div className="relative aspect-video w-full cursor-pointer" onClick={() => handleSelectGalleryImage(img.url)}>
                                                <Image src={img.url} alt={img.description} fill className="object-cover" unoptimized />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="text-white text-xs font-bold uppercase tracking-widest">Select Banner</span>
                                                </div>
                                            </div>
                                            <div className="p-2 bg-card text-[10px] flex items-center justify-between border-t">
                                                <div className="truncate flex-1">
                                                    <p className="font-semibold truncate">{img.description}</p>
                                                    <p className="text-muted-foreground">by {img.uploadedBy}</p>
                                                </div>
                                                {isAdmin && (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveFromGallery(img.id)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-center py-20 text-muted-foreground">
                                        <ImageIcon className="mx-auto h-10 w-10 opacity-20 mb-4" />
                                        <p>Gallery is empty. Upload an image and check "Save to Gallery".</p>
                                    </div>
                                  )}
                                </ScrollArea>
                              </DialogContent>
                            </Dialog>

                            <Button onClick={handleUploadClick} disabled={isUploading || isGeneratingAI} variant="outline" size="sm" className="text-xs">
                              {isUploading ? <Loader className='animate-spin mr-2 h-4 w-4' /> : <UploadCloud className='mr-2 h-3 w-3'/>}
                              {imageToSend ? 'Replace' : 'Upload'}
                            </Button>
                            <Button onClick={handleGenerateAIBanner} disabled={isUploading || isGeneratingAI} variant="outline" size="sm" className="text-xs">
                              {isGeneratingAI ? <Loader className='animate-spin mr-2 h-4 w-4' /> : <Sparkles className='mr-2 h-3 w-3'/>}
                              AI Banner
                            </Button>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="save-gallery" checked={saveToGallery} onCheckedChange={(v) => setSaveToGallery(!!v)} />
                            <Label htmlFor="save-gallery" className="text-xs font-normal cursor-pointer">Save new uploads to Team Gallery</Label>
                        </div>
                        {isUploading && <Progress value={uploadProgress} className="h-1" />}
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              </div>
          )}
          
          {selectedEventId && reminderMessage && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</span>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={handleNudge}>
                      <BellRing className="w-3 h-3 mr-1" />
                      Add Nudges
                  </Button>
              </div>
              <Textarea value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)} className="min-h-[150px] text-[10px] font-mono leading-tight bg-muted/30" />
              <Button onClick={handleSendToDiscord} className="w-full" disabled={isSending || sendSuccess}>
                {isSending ? <Loader className="animate-spin mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                {sendSuccess ? 'Sent!' : 'Post Reminder to Discord'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
