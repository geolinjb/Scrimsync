'use client';

import * as React from 'react';
import { format, startOfToday, differenceInMinutes } from 'date-fns';
import { Send, Megaphone, Check, Loader, UploadCloud, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import type { User as AuthUser } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, type UploadTask } from "firebase/storage";
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
import { Separator } from '../ui/separator';
import { useFirebaseApp, useFirestore } from '@/firebase';
import { Progress } from '../ui/progress';

type ReminderGeneratorProps = {
  events: ScheduleEvent[] | null;
  allVotes: AllVotes;
  allProfiles: PlayerProfileData[];
  availabilityOverrides: AvailabilityOverride[];
  isAdmin: boolean;
  currentUser: AuthUser | null;
};

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1454808762475872358/vzp7fiSxE7THIR5sc6npnuAG2TVl_B3fikdS_WgZFnzxQmejMJylsYafopfEkzU035Yt";

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
  const [sendSuccess, setSendSuccess] = React.useState(false);
  const [now, setNow] = React.useState(new Date());

  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const isUploading = uploadProgress !== null;

  React.useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

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

    if (isCancelled) {
        setReminderMessage(`🚫 **EVENT CANCELLED** 🚫\n> The **${event.type}** on ${formattedDate} at **${event.time}** has been cancelled.`);
        return;
    }

    const voteKey = `${format(new Date(event.date), 'yyyy-MM-dd')}-${event.time}`;
    const availablePlayers = allVotes[voteKey] || [];
    const totalAvailable = availablePlayers.length;

    const msg = `**🔔 REMINDER: ${event.type.toUpperCase()}! 🔔**\n> **When:** ${formattedDate} at **${event.time}**\n\n✅ **Available (${availablePlayers.length}):**\n${availablePlayers.map(p => `- ${p}`).join('\n')}\n\n🔥 **Needed: ${Math.max(0, MINIMUM_PLAYERS - totalAvailable)}**\n\n---\nhttps://scrimsync.vercel.app/`;
    setReminderMessage(msg);
  };
  
    React.useEffect(() => { if (selectedEventId) generateReminder(selectedEventId); }, [events, selectedEventId]);

  const handleSendToDiscord = async () => {
    setIsSending(true);
    try {
      const payload: any = { content: reminderMessage };
      if (imageToSend) payload.embeds = [{ image: { url: imageToSend } }];
      const res = await fetch(DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { setSendSuccess(true); toast({ title: 'Reminder Sent!' }); setTimeout(() => setSendSuccess(false), 3000); }
    } catch (error) { toast({ variant: 'destructive', title: 'Send Failed' }); }
    finally { setIsSending(false); }
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
      <CardHeader><div className="flex items-center gap-3"><Megaphone className="w-6 h-6 text-gold" /><CardTitle>Reminder Generator</CardTitle></div></CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedEventId} onValueChange={setSelectedEventId}>
          <SelectTrigger><SelectValue placeholder="Select an event..." /></SelectTrigger>
          <SelectContent>{upcomingEvents.map(e => <SelectItem key={e.id} value={e.id}>{e.type} - {format(new Date(e.date), 'EEE, d MMM')} @ {e.time}</SelectItem>)}</SelectContent>
        </Select>
        {selectedEventId && (
            <div className="space-y-2">
                {imageToSend ? <div className="relative aspect-video rounded-md overflow-hidden border"><Image src={imageToSend} alt="Event" fill style={{ objectFit: 'cover' }} /></div> : <div className="border-2 border-dashed rounded-lg h-32 flex items-center justify-center text-muted-foreground"><ImageIcon className="mr-2" />No image</div>}
                {canManageEvent && <Button onClick={handleUploadClick} disabled={isUploading} variant="outline" className="w-full">{isUploading ? <Loader className='animate-spin mr-2' /> : <UploadCloud className='mr-2'/>} {imageToSend ? 'Change Image' : 'Upload Image'}</Button>}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            </div>
        )}
        {reminderMessage && <Textarea value={reminderMessage} readOnly className="min-h-[200px] text-xs font-mono" />}
      </CardContent>
      {reminderMessage && <CardFooter><Button onClick={handleSendToDiscord} className="w-full" disabled={isSending || sendSuccess}>{isSending ? <Loader className="animate-spin" /> : 'Send to Discord'}</Button></CardFooter>}
    </Card>
  );
}