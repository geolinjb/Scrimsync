'use client';

import * as React from 'react';
import { format, startOfToday, isSameDay } from 'date-fns';
import { Send, Megaphone, Check, Loader, UploadCloud, Image as ImageIcon, CalendarDays } from 'lucide-react';
import Image from 'next/image';
import type { User as AuthUser } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
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

type ReminderGeneratorProps = {
  events: ScheduleEvent[] | null;
  allVotes: AllVotes;
  allProfiles: PlayerProfileData[];
  availabilityOverrides: AvailabilityOverride[];
  isAdmin: boolean;
  currentUser: AuthUser | null;
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

  const generateReminder = (eventId: string) => {
    const event = upcomingEvents.find(e => e.id === eventId);
    if (!event) { setReminderMessage(''); setImageToSend(null); return; }

    setImageToSend(event.imageURL || null);
    const isCancelled = event.status === 'Cancelled';
    const formattedDate = format(new Date(event.date), 'EEEE, d MMMM');

    const mention = event.discordRoleId ? `<@&${event.discordRoleId}> ` : '';

    if (isCancelled) {
        setReminderMessage(`${mention}🚫 **EVENT CANCELLED** 🚫\n> The **${event.type}** on ${formattedDate} at **${event.time}** has been cancelled.`);
        return;
    }

    const voteKey = `${format(new Date(event.date), 'yyyy-MM-dd')}-${event.time}`;
    const availablePlayerNames = allVotes[voteKey] || [];
    const totalAvailable = availablePlayerNames.length;

    const availablePlayerTags = availablePlayerNames.map(name => {
        const prof = profileMap.get(name);
        return prof?.discordUsername || name;
    });

    const msg = `${mention}**🔔 REMINDER: ${event.type.toUpperCase()}! 🔔**\n> **When:** ${formattedDate} at **${event.time}**\n\n✅ **Available (${availablePlayerNames.length}):**\n${availablePlayerTags.map(p => `- ${p}`).join('\n')}\n\n🔥 **Needed: ${Math.max(0, MINIMUM_PLAYERS - totalAvailable)}**\n\n---\nhttps://scrimsync.vercel.app/`;
    setReminderMessage(msg);
  };
  
    React.useEffect(() => { if (selectedEventId) generateReminder(selectedEventId); }, [events, selectedEventId]);

  const handleSendToDiscord = async () => {
    setIsSending(true);
    try {
      const payload: any = { content: reminderMessage };
      if (imageToSend) payload.embeds = [{ image: { url: imageToSend } }];
      const res = await fetch(DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
      const mention = event.discordRoleId ? `<@&${event.discordRoleId}> ` : '';
      const statusIcon = event.status === 'Cancelled' ? '🚫' : (isReady ? '✅' : '⏳');
      
      return `- **${event.time}**: ${mention}${event.type} (${availableCount}/${MINIMUM_PLAYERS} Players) ${statusIcon}`;
    });

    const summaryMessage = `📅 **TODAY'S TEAM SCHEDULE (${format(today, 'EEEE, d MMM')})** 📅\n---\n${eventSummaries.join('\n')}\n---\nManage availability: https://scrimsync.vercel.app/`;

    try {
      const res = await fetch(DISCORD_WEBHOOK_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ content: summaryMessage }) 
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
            Post Today's Summary to Discord
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
              <div className="space-y-2">
                  {imageToSend ? (
                    <div className="relative aspect-video rounded-md overflow-hidden border">
                      <Image src={imageToSend} alt="Event" fill style={{ objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg h-32 flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="mr-2" />
                      No image
                    </div>
                  )}
                  {canManageEvent && (
                    <Button onClick={handleUploadClick} disabled={isUploading} variant="outline" size="sm" className="w-full">
                      {isUploading ? <Loader className='animate-spin mr-2 h-4 w-4' /> : <UploadCloud className='mr-2 h-4 w-4'/>}
                      {imageToSend ? 'Change Image' : 'Upload Image'}
                    </Button>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              </div>
          )}
          
          {reminderMessage && (
            <div className="space-y-2">
              <Textarea 
                value={reminderMessage} 
                readOnly 
                className="min-h-[150px] text-[10px] font-mono leading-tight bg-muted/50" 
              />
              <Button 
                onClick={handleSendToDiscord} 
                className="w-full" 
                disabled={isSending || sendSuccess}
              >
                {isSending ? <Loader className="animate-spin mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                {sendSuccess ? 'Sent!' : 'Send Reminder to Discord'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
