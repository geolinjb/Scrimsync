'use client';

import * as React from 'react';
import { format, startOfToday } from 'date-fns';
import { CalendarCheck, Users, Trash2 } from 'lucide-react';

import type { AllVotes, ScheduleEvent } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type ScheduledEventsProps = {
  events: ScheduleEvent[];
  votes: AllVotes;
  currentDate: Date;
  onRemoveEvent: (eventId: string) => void;
};

export function ScheduledEvents({ events, votes, onRemoveEvent }: ScheduledEventsProps) {
    const upcomingEvents = React.useMemo(() => {
        return events
            .filter(event => event.date >= startOfToday())
            .sort((a,b) => a.date.getTime() - b.date.getTime());
    }, [events]);

  const getAvailablePlayers = (event: ScheduleEvent): string[] => {
    const dateKey = format(event.date, 'yyyy-MM-dd');
    const voteKey = `${dateKey}-${event.time}`;
    return votes[voteKey] || [];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CalendarCheck className="w-6 h-6" />
          <CardTitle>Upcoming Events</CardTitle>
        </div>
        <CardDescription>
          Here are your team's scheduled sessions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {upcomingEvents.length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
            {upcomingEvents.map((event) => {
              const availablePlayers = getAvailablePlayers(event);
              return (
                <AccordionItem key={event.id} value={event.id}>
                  <AccordionTrigger>
                    <div className="flex justify-between items-center w-full">
                        <div className='flex flex-col items-start text-left'>
                            <div className='flex items-center gap-2'>
                                <Badge variant={event.type === 'Tournament' ? 'default' : 'secondary'}>{event.type}</Badge>
                                <span className='font-semibold'>{format(event.date, 'EEEE, d MMM')}</span>
                            </div>
                            <span className='text-sm text-muted-foreground'>{event.time}</span>
                        </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className='flex justify-between items-start'>
                        <div>
                            <h4 className="font-semibold mb-3">
                            {availablePlayers.length} Available Players:
                            </h4>
                            {availablePlayers.length > 0 ? (
                            <ul className="space-y-3">
                                {availablePlayers.map((player) => (
                                <li key={player} className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                    <AvatarImage
                                        src={`https://api.dicebear.com/8.x/pixel-art/svg?seed=${player}`}
                                    />
                                    <AvatarFallback>
                                        {player.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{player}</span>
                                </li>
                                ))}
                            </ul>
                            ) : (
                            <div className="flex flex-col items-center justify-center text-center py-6">
                                <Users className="w-10 h-10 text-muted-foreground" />
                                <p className="mt-3 text-muted-foreground">
                                No players have marked themselves as available yet.
                                </p>
                            </div>
                            )}
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive shrink-0">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the scheduled {event.type.toLowerCase()}.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onRemoveEvent(event.id)} className="bg-destructive hover:bg-destructive/90">
                                    Delete
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-10">
            <CalendarCheck className="w-12 h-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              No upcoming events scheduled.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
