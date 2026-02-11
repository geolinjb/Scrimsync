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

  const [selectedEventId, setSelectedEventId] = React.useState<string>('');
  const [reminderMessage, setReminderMessage] = React.useState<string>('');
  const [imageToSend, setImageToSend] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [sendSuccess, setSendSuccess] = React.useState(false);
  const [now, setNow] = React.useState(new Date());

  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const isUploading = uploadProgress !== null;

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const upcomingEvents = React.useMemo(() => {
    if (!events) return [];
    const today = startOfToday();
    // Include cancelled events so they can be selected for cancellation notices.
    return events
      .filter(event => new Date(event.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

    const selectedEvent = React.useMemo(() => {
        if (!selectedEventId || !events) return null;
        return events.find(e => e.id === selectedEventId);
    }, [selectedEventId, events]);

    const canManageEvent = React.useMemo(() => {
        if (!selectedEvent || !currentUser) return false;
        return isAdmin || currentUser.uid === selectedEvent.creatorId;
    }, [selectedEvent, currentUser, isAdmin]);

  const generateReminder = (eventId: string) => {
    if (!eventId) {
      setReminderMessage('');
      setImageToSend(null);
      return;
    }
    const event = upcomingEvents.find(e => e.id === eventId);
    if (!event) return;

    setImageToSend(event.imageURL || null);
    
    const isCancelled = event.status === 'Cancelled';
    const formattedDate = format(new Date(event.date), 'EEEE, d MMMM');

    if (isCancelled) {
        const header = `🚫 **EVENT CANCELLED** 🚫`;
        const eventInfo = `> The **${event.type}** on ${formattedDate} at **${event.time}** has been cancelled.`;
        const descriptionLine = event.description ? `> **Original Notes:** ${event.description}` : null;
        const footer = `\n---\nhttps://scrimsync.vercel.app/`;

        const messageParts = [
            header,
            eventInfo,
            descriptionLine,
            footer
        ];

        const fullMessage = messageParts.filter(line => line !== null).join('\n');
        setReminderMessage(fullMessage);
        setSendSuccess(false);
        return;
    }

    const profileIdMap = new Map(allProfiles.map(p => [p.id, p]));
    const profileUsernameMap = new Map(allProfiles.map(p => [p.username, p]));
    const allPlayerNames = allProfiles.map(p => p.username).filter(Boolean) as string[];

    // Logic to get players
    const dateKey = format(new Date(event.date), 'yyyy-MM-dd');
    const voteKey = `${dateKey}-${event.time}`;
    const availablePlayers = allVotes[voteKey] || [];

    const eventOverrides = availabilityOverrides.filter(o => o.eventId === eventId);
    const possiblyAvailablePlayerUsernames = eventOverrides
        .map(o => profileIdMap.get(o.userId)?.username)
        .filter((name): name is string => !!name);

    const unavailablePlayers = allPlayerNames.filter(p => !availablePlayers.includes(p) && !possiblyAvailablePlayerUsernames.includes(p));
    const totalAvailable = availablePlayers.length + possiblyAvailablePlayerUsernames.length;
    const neededPlayers = Math.max(0, MINIMUM_PLAYERS - totalAvailable);
    
    // Time formatting
    const timeRemaining = formatTimeRemaining(new Date(event.date), event.time);

    const formatPlayerList = (players: string[]) => {
      if (players.length === 0) return '> - *None*';
      return players
        .map(p => {
          const profile = profileUsernameMap.get(p);
          if (profile?.rosterStatus === 'Main Roster') return `- ${p} (Main)`;
          if (profile?.rosterStatus === 'Standby Player') return `- ${p} (Standby)`;
          return `- ${p}`;
        })
        .join('\n');
    };

    // Message construction (Discord Markdown)
    const header = `**🔔 REMINDER: ${event.type.toUpperCase()} @Spartan [Tour chad]! 🔔**`;
    const eventInfo = `> **When:** ${formattedDate} at **${event.time}** (Starts in ~${timeRemaining})`;
    const descriptionLine = event.description ? `> **Notes:** ${event.description}` : null;
    const rosterHeader = `--- \n**ROSTER (${totalAvailable}/${MINIMUM_PLAYERS})**`;
    
    const availableHeader = `✅ **Available Players (${availablePlayers.length}):**`;
    const availableList = availablePlayers.length > 0 ? formatPlayerList(availablePlayers) : '> - *None yet*';
    
    const possiblyAvailableHeader = `🤔 **Possibly Available (${possiblyAvailablePlayerUsernames.length}):**`;
    const possiblyAvailableList = formatPlayerList(possiblyAvailablePlayerUsernames);

    const unavailableHeader = `❌ **Unavailable Players (${unavailablePlayers.length}):**`;
    const unavailableList = unavailablePlayers.length > 0 ? formatPlayerList(unavailablePlayers) : '> - *Everyone is available!*';
    
    const neededText = `🔥 **Players Needed: ${neededPlayers}**`;
    const footer = `\n---\nVote or update your availability:\nhttps://scrimsync.vercel.app/`;

    const messageParts = [
      header,
      eventInfo,
      descriptionLine,
      rosterHeader,
      neededText,
      '',
      availableHeader,
      availableList,
      '',
      possiblyAvailableHeader,
      possiblyAvailableList,
      '',
      unavailableHeader,
      unavailableList,
      footer,
    ];
    
    const fullMessage = messageParts.filter(line => line !== null).join('\n');
    
    setReminderMessage(fullMessage);
    setSendSuccess(false);
  };
  
    React.useEffect(() => {
        // This effect will re-generate the reminder when the event data (like imageURL) changes.
        if (selectedEventId) {
            generateReminder(selectedEventId);
        }
    }, [events, selectedEventId]); // Rerun when events list changes

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    generateReminder(eventId);
  };

  const handleSendToDiscord = async () => {
    if (!reminderMessage) return;

    setIsSending(true);
    setSendSuccess(false);

    try {
      const payload: { content: string; embeds?: { image: { url: string } }[] } = {
        content: reminderMessage,
      };
      
      if (imageToSend) {
        payload.embeds = [{
          image: { url: imageToSend }
        }];
      }

      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSendSuccess(true);
        toast({
          title: 'Reminder Sent!',
          description: 'The message was successfully sent to Discord.',
        });
        setTimeout(() => setSendSuccess(false), 3000);
      } else {
        throw new Error(`Discord API responded with ${response.status}`);
      }
    } catch (error) {
      console.error("Error sending to Discord:", error);
      toast({
        variant: 'destructive',
        title: 'Send Failed',
        description: 'Could not send the reminder. Check the console for details.',
      });
    } finally {
      setIsSending(false);
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
    if (totalMinutes <= 0) return 'Already Started';

    const days = Math.floor(totalMinutes / 1440);
    const hoursLeft = Math.floor((totalMinutes % 1440) / 60);
    const minutesLeft = totalMinutes % 60;
    
    let result = [];
    if (days > 0) result.push(`${days}d`);
    if (hoursLeft > 0) result.push(`${hoursLeft}h`);
    if (days === 0 && minutesLeft > 0) result.push(`${minutesLeft}m`);
    
    return result.join(' ') || 'Now';
  };

  const handleUploadClick = () => {
    if (!currentUser) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to upload an image.' });
        return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firebaseApp || !currentUser || !selectedEventId || !firestore) {
        toast({ variant: 'destructive', title: 'Upload Error', description: 'Could not start upload. Select an event first.' });
        return;
    }
    
    const eventId = selectedEventId;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ variant: 'destructive', title: 'File Too Large', description: 'Please select an image smaller than 5MB.' });
        return;
    }

    setUploadProgress(0);

    try {
        const storage = getStorage(firebaseApp);
        const filePath = `event-images/${eventId}/${file.name}`;
        const fileRef = storageRef(storage, filePath);
        const uploadTask: UploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            }
        );
        
        await uploadTask;

        const imageURL = await getDownloadURL(uploadTask.snapshot.ref);
        const eventDocRef = doc(firestore, 'scheduledEvents', eventId);
        
        await setDoc(eventDocRef, { imageURL }, { merge: true });

        toast({ title: 'Image Uploaded!', description: 'The event image has been updated and will appear in the preview shortly.' });
        
    } catch (error) {
        console.error("Error uploading file or updating doc:", error);
         toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'Could not upload the image or save the link. You may not have permission.',
        });
    } finally {
        setUploadProgress(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-gold" />
          <CardTitle>Reminder Generator</CardTitle>
        </div>
        <CardDescription>
          Select an event to generate a reminder. You can upload an image which will be embedded in the Discord message.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedEventId} onValueChange={handleEventChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select an upcoming event..." />
          </SelectTrigger>
          <SelectContent>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map(event => (
                <SelectItem key={event.id} value={event.id}>
                  {event.type} - {format(new Date(event.date), 'EEE, d MMM')} @ {event.time}
                  {event.status === 'Cancelled' && ' (Cancelled)'}
                </SelectItem>
              ))
            ) : (
              <div className='p-4 text-center text-sm text-muted-foreground'>No upcoming events.</div>
            )}
          </SelectContent>
        </Select>

        {selectedEventId && (
            <>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" className="hidden" />
                <Separator />
                <div className="space-y-2">
                    <h4 className='text-sm font-medium'>Event Image</h4>
                    {imageToSend ? (
                        <div className="relative aspect-video w-full rounded-md overflow-hidden border">
                            <Image src={imageToSend} alt="Event image" fill objectFit="cover" />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center text-sm text-muted-foreground border-2 border-dashed rounded-lg h-32">
                            <ImageIcon className="w-6 h-6 mr-2" />
                            No image attached to this event.
                        </div>
                    )}
                    {canManageEvent && (
                        <div className="pt-2 space-y-2">
                            <Button onClick={handleUploadClick} disabled={isUploading} variant="outline" className="w-full">
                                {isUploading ? <Loader className='w-4 h-4 animate-spin mr-2' /> : <UploadCloud className='w-4 h-4 mr-2'/>}
                                {isUploading ? `Uploading... ${Math.round(uploadProgress!)}%` : (imageToSend ? 'Change Image' : 'Upload Image')}
                            </Button>
                            {isUploading && <Progress value={uploadProgress} className="h-2" />}
                        </div>
                    )}
                </div>
            </>
        )}
        
        {reminderMessage && (
            <div className='space-y-2'>
                 <Separator />
                 <h4 className='text-sm font-medium pt-2'>Generated Message:</h4>
                <Textarea
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    className="min-h-[250px] font-mono text-xs bg-muted/50"
                />
            </div>
        )}

      </CardContent>
      {reminderMessage && (
        <CardFooter>
          <Button onClick={handleSendToDiscord} className="w-full" disabled={isSending || sendSuccess}>
            {isSending ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : (sendSuccess ? <Check className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />)}
            {isSending ? 'Sending...' : (sendSuccess ? 'Sent!' : 'Send to Discord')}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
