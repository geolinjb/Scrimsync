'use client';

import * as React from 'react';
import { format, startOfToday, isSameDay } from 'date-fns';
import { Send, Megaphone, Check, Loader, UploadCloud, Image as ImageIcon, CalendarDays, Sparkles, BellRing } from 'lucide-react';
import Image from 'next/image';
import type { User as AuthUser } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, uploadString } from "firebase/storage";
import { doc, setDoc } from 'firebase/firestore';

import type { AllVotes, PlayerProfileData, ScheduleEvent, AvailabilityOverride } from '@/lib/types';
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
import { useFirebaseApp, useFirestore } from '@/firebase';
import { Separator } from '../ui/separator';
import { DISCORD_WEBHOOK_URL } from '@/lib/config';
import { getDiscordTimestamp } from '@/lib/utils';
import { generateEventBanner } from '@/ai/flows/generate-event-banner-flow';

type ReminderGeneratorProps = {
  events: ScheduleEvent[] | null;
  allVotes: AllVotes;
  allProfiles: PlayerProfileData[];
  availabilityOverrides: AvailabilityOverride[];
  isAdmin: boolean;
  currentUser: AuthUser | null;
};

// Discord Embed Colors (Decimal)
const EMBED_COLORS = {
  BLUE: 3892342,      // Training
  GOLD: 16766720,     // Tournament
  RED: 15680580,      // Cancelled
  GREEN: 2278750      // Success/Ready
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

  const isUploading = uploadProgress !== null;

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

    let msg = `**When:** ${dsTimestamp} (${dsRelative})\n\n✅ **Available (${availablePlayerNames.length}):**\n${availablePlayerTags.map(p => `- ${p}`).join('\n')}\n\n🔥 **Needed: ${Math.max(0, MINIMUM_PLAYERS - totalAvailable)}**`;

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
      
      const color = isCancelled 
        ? EMBED_COLORS.RED 
        : (selectedEvent.type === 'Tournament' ? EMBED_COLORS.GOLD : EMBED_COLORS.BLUE);

      const payload = {
        content: roleMention, // Pings must be in content
        embeds: [{
          title: `${isCancelled ? '🚫' : '🔔'} ${selectedEvent.type.toUpperCase()} REMINDER`,
          description: reminderMessage,
          color: color,
          image: imageToSend ? { url: imageToSend } : undefined,
          timestamp: new Date().toISOString(),
          footer: {
            text: "TeamSync • Coordination made easy",
          }
        }]
      };

      const res = await fetch(DISCORD_WEBHOOK_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });

      if (res.ok) { 
        setSendSuccess(true); 
        toast({ title: 'Reminder Sent!' }); 
        setTimeout(() => setSendSuccess(false), 3000); 
      }
    } catch (error) { toast({ variant: 'destructive', title: 'Send Failed' }); }
    finally { setIsSending(false); }
  };

  const handleSendTodaySummary = async () => {
    if (!events) return;
    setIsSendingSummary(true);
    
    const today = startOfToday();
    const todayEvents = events.filter(e => isSameDay(new Date(e.date), today))
      .sort((a, b) => a.time.localeCompare(b.time));

    if (todayEvents.length === 0) {
      toast({ description: "No events scheduled for today." });
      setIsSendingSummary(false);
      return;
    }

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
        footer: {
          text: "Update your availability at scrimsync.vercel.app",
        }
      }]
    };

    try {
      const res = await fetch(DISCORD_WEBHOOK_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      if (res.ok) {
        toast({ title: 'Daily Summary Sent!' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Summary Failed' });
    } finally {
      setIsSendingSummary(false);
    }
  };

  const handleGenerateAIBanner = async () => {
    if (!selectedEvent || !firebaseApp || !firestore) return;
    setIsGeneratingAI(true);
    try {
      const { imageUrl: dataUri } = await generateEventBanner({
        type: selectedEvent.type,
        description: selectedEvent.description,
      });

      const storage = getStorage(firebaseApp);
      const fileRef = storageRef(storage, `event-images/${selectedEvent.id}/ai-banner-${Date.now()}.png`);
      const base64Data = dataUri.split(',')[1];
      
      await uploadString(fileRef, base64Data, 'base64', { contentType: 'image/png' });
      
      const permanentUrl = await getDownloadURL(fileRef);
      await setDoc(doc(firestore, 'scheduledEvents', selectedEvent.id), { imageURL: permanentUrl }, { merge: true });
      
      toast({ title: 'AI Banner Generated!', description: 'The event now has a custom AI-generated image.' });
      setImageToSend(permanentUrl);
    } catch (error) {
      console.error('AI Generation Error:', error);
      toast({ variant: 'destructive', title: 'AI Generation Failed' });
    } finally {
      setIsGeneratingAI(false);
    }
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
        <CardDescription>
          Send event reminders and daily summaries directly to your Discord server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Daily Summary
          </h3>
          <p className="text-xs text-muted-foreground">
            Post a summary of all events scheduled for today, including player availability counts.
          </p>
          <Button 
            onClick={handleSendTodaySummary} 
            variant="outline" 
            className="w-full" 
            disabled={isSendingSummary || !events}
          >
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
                      <Image src={imageToSend} alt="Event" fill style={{ objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg h-32 flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
                      <ImageIcon className="mb-2 w-6 h-6 opacity-50" />
                      <span className="text-xs">No banner image</span>
                    </div>
                  )}
                  {canManageEvent && (
                    <div className='grid grid-cols-2 gap-2'>
                        <Button onClick={handleUploadClick} disabled={isUploading || isGeneratingAI} variant="outline" size="sm" className="text-xs">
                          {isUploading ? <Loader className='animate-spin mr-2 h-4 w-4' /> : <UploadCloud className='mr-2 h-3 w-3'/>}
                          {imageToSend ? 'Replace' : 'Upload'}
                        </Button>
                        <Button onClick={handleGenerateAIBanner} disabled={isUploading || isGeneratingAI} variant="secondary" size="sm" className="text-xs">
                          {isGeneratingAI ? <Loader className='animate-spin mr-2 h-4 w-4' /> : <Sparkles className='mr-2 h-3 w-3'/>}
                          AI Banner
                        </Button>
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
              <Textarea 
                value={reminderMessage} 
                onChange={(e) => setReminderMessage(e.target.value)}
                className="min-h-[150px] text-[10px] font-mono leading-tight bg-muted/30" 
              />
              <Button 
                onClick={handleSendToDiscord} 
                className="w-full" 
                disabled={isSending || sendSuccess}
              >
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
