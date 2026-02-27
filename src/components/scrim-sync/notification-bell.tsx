
'use client';

import * as React from 'react';
import { Bell, Circle, Check, CalendarPlus, CalendarX2, Trash2, Pencil } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { collection, doc, query, orderBy, limit } from 'firebase/firestore';

import { useCollection, useDoc, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import type { AppNotification, PlayerProfileData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';


const iconMap: { [key: string]: React.ElementType } = {
    CalendarPlus,
    CalendarX2,
    Trash2,
    Pencil,
    Default: Circle,
};


export function NotificationBell() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [isOpen, setIsOpen] = React.useState(false);

    const profileRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user, firestore]);
    const { data: profile } = useDoc<PlayerProfileData>(profileRef);

    const notificationsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'appNotifications'), orderBy('timestamp', 'desc'), limit(20));
    }, [firestore]);

    const { data: notifications, isLoading } = useCollection<AppNotification>(notificationsQuery);
    
    const hasUnread = React.useMemo(() => {
        if (!notifications || notifications.length === 0) {
            return false;
        }
        const lastReadTimestamp = profile?.lastNotificationReadTimestamp;
        if (!lastReadTimestamp) {
            return true; // If they've never read, all are unread.
        }
        const latestNotificationTimestamp = notifications[0].timestamp;
        return new Date(latestNotificationTimestamp) > new Date(lastReadTimestamp);
    }, [notifications, profile]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open && user && notifications && notifications.length > 0) {
            // Mark as read by updating the user's profile
            const latestTimestamp = notifications[0].timestamp;
            const profileDocRef = doc(firestore, 'users', user.uid);
            setDocumentNonBlocking(profileDocRef, { lastNotificationReadTimestamp: latestTimestamp }, { merge: true });
        }
    };
    
    const handleMarkAllRead = () => {
        if (user && notifications && notifications.length > 0) {
            const latestTimestamp = new Date().toISOString();
            const profileDocRef = doc(firestore, 'users', user.uid);
            setDocumentNonBlocking(profileDocRef, { lastNotificationReadTimestamp: latestTimestamp }, { merge: true });
        }
    }

    const renderNotificationItem = (notification: AppNotification) => {
        const Icon = iconMap[notification.icon] || iconMap.Default;
        return (
            <div key={notification.id} className="flex items-start gap-4 p-3 hover:bg-accent">
                 <Icon className="w-4 h-4 mt-1 text-muted-foreground" />
                <div className="flex-1">
                    <p className="text-sm">{notification.message}</p>
                    <p className="text-xs text-muted-foreground">
                        {notification.createdBy} &bull; {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {hasUnread && (
                        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary/80"></span>
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className='flex items-center justify-between p-3 border-b'>
                    <h3 className='font-semibold text-sm'>Notifications</h3>
                    <Button variant="link" size="sm" className='h-auto p-0 text-xs' onClick={handleMarkAllRead} disabled={!hasUnread}>
                        <Check className='w-3 h-3 mr-1'/>
                        Mark all as read
                    </Button>
                </div>
                <ScrollArea className="h-[400px]">
                    {isLoading && (
                        <div className='p-4 space-y-4'>
                            <Skeleton className='h-12 w-full'/>
                            <Skeleton className='h-12 w-full'/>
                            <Skeleton className='h-12 w-full'/>
                        </div>
                    )}
                    {(!notifications || notifications.length === 0) && !isLoading && (
                        <div className="text-center text-muted-foreground text-sm py-16 px-4">
                            You have no notifications.
                        </div>
                    )}
                    {notifications && notifications.length > 0 && (
                        <div className='divide-y'>
                            {notifications.map(renderNotificationItem)}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}
