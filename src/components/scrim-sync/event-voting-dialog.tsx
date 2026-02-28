'use client';

import * as React from 'react';
import { format, isToday } from 'date-fns';
import { CalendarCheck, Trophy, Swords, Vote, Check, Ban, HelpCircle } from 'lucide-react';
import type { ScheduleEvent, AvailabilityOverride } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

type EventVotingDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  events: ScheduleEvent[];
  userEventVotes: Set<string>;
  onEventVoteTrigger: (event: ScheduleEvent) => void;
};

export function EventVotingDialog({
  isOpen,
  onOpenChange,
  events,
  userEventVotes,
  onEventVoteTrigger,
}: EventVotingDialogProps) {
  const firestore = useFirestore();
  
  const overridesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'availabilityOverrides');
  }, [firestore]);
  const { data: availabilityOverrides } = useCollection<AvailabilityOverride>(overridesQuery);

  const upcomingEvents = React.useMemo(() => {
    return events
      .filter(event => new Date(event.date) >= new Date(new Date().toDateString()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <CalendarCheck className="w-6 h-6 text-gold" />
            <DialogTitle>Vote for Upcoming Events</DialogTitle>
          </div>
          <DialogDescription>
            Quickly mark your availability for each scheduled event.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2 sm:pr-4">
          <div className="space-y-4">
            {upcomingEvents.length > 0 ? (
              <TooltipProvider>
                {upcomingEvents.map(event => {
                  const isVoted = userEventVotes.has(event.id);
                  const isCancelled = event.status === 'Cancelled';
                  const eventOverrides = availabilityOverrides?.filter(o => o.eventId === event.id) || [];

                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg border p-4",
                        isCancelled ? 'bg-muted/50' : 'bg-transparent',
                        isVoted && !isCancelled && 'bg-primary/10 border-primary/50'
                      )}
                    >
                      <div className="flex flex-1 items-start gap-4 min-w-0 w-full">
                        {event.type === 'Tournament' ? (
                          <Trophy className="h-6 w-6 text-gold shrink-0 mt-0.5" />
                        ) : (
                          <Swords className="h-6 w-6 text-blue-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className={cn("font-semibold flex items-center flex-wrap gap-2", isCancelled && 'line-through text-muted-foreground')}>
                            {event.type}
                            {isToday(new Date(event.date)) && <Badge variant="outline" className='h-4 text-[10px]'>Today</Badge>}
                            {eventOverrides.length > 0 && !isCancelled && (
                                <Badge variant="outline" className="h-4 text-[10px] border-dashed text-muted-foreground">
                                    <HelpCircle className="w-2.5 h-2.5 mr-1" />
                                    {eventOverrides.length} Possible
                                </Badge>
                            )}
                          </div>
                          <p className={cn("text-sm text-muted-foreground", isCancelled && 'line-through')}>
                            {format(new Date(event.date), 'EEEE, d MMM')} at {event.time}
                          </p>
                          {event.description && (
                              <Tooltip>
                                  <TooltipTrigger asChild>
                                      <p className={cn("text-xs text-muted-foreground mt-1 truncate", isCancelled && 'line-through')}>
                                          {event.description}
                                      </p>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" align="start">
                                      <p className='max-w-xs whitespace-pre-wrap'>{event.description}</p>
                                  </TooltipContent>
                              </Tooltip>
                          )}
                        </div>
                      </div>
                      <div className="w-full sm:w-auto flex justify-end">
                        {isCancelled ? (
                           <Badge variant="destructive" className='shrink-0'><Ban className="w-3 h-3 mr-1.5"/>Cancelled</Badge>
                        ) : (
                          <Button
                            variant={isVoted ? 'secondary' : 'default'}
                            size="sm"
                            onClick={() => onEventVoteTrigger(event)}
                            className="w-full sm:w-auto"
                          >
                            {isVoted ? (
                              <Check className="mr-2 h-4 w-4" />
                            ) : (
                              <Vote className="mr-2 h-4 w-4" />
                            )}
                            {isVoted ? 'Attending' : 'Vote'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </TooltipProvider>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <CalendarCheck className="w-12 h-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">No upcoming events scheduled.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
