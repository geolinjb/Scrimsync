'use client';

import * as React from 'react';
import { format, isToday } from 'date-fns';
import { CalendarCheck, Trophy, Swords, Vote, Check, Ban } from 'lucide-react';
import type { ScheduleEvent } from '@/lib/types';
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

  const upcomingEvents = React.useMemo(() => {
    return events
      .filter(event => new Date(event.date) >= new Date(new Date().toDateString()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] md:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <CalendarCheck className="w-6 h-6 text-gold" />
            <DialogTitle>Vote for Upcoming Events</DialogTitle>
          </div>
          <DialogDescription>
            Quickly mark your availability for each scheduled event.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map(event => {
                const isVoted = userEventVotes.has(event.id);
                const isCancelled = event.status === 'Cancelled';
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-lg border p-4",
                      isCancelled ? 'bg-muted/50' : 'bg-transparent',
                      isVoted && !isCancelled && 'bg-primary/10 border-primary/50'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      {event.type === 'Tournament' ? (
                        <Trophy className="h-6 w-6 text-gold" />
                      ) : (
                        <Swords className="h-6 w-6 text-blue-400" />
                      )}
                      <div className="flex flex-col">
                        <div className={cn("font-semibold", isCancelled && 'line-through text-muted-foreground')}>
                          {event.type}
                          {isToday(new Date(event.date)) && <Badge variant="outline" className='ml-2'>Today</Badge>}
                        </div>
                        <p className={cn("text-sm text-muted-foreground", isCancelled && 'line-through')}>
                          {format(new Date(event.date), 'EEEE, d MMM')} at {event.time}
                        </p>
                      </div>
                    </div>
                    {isCancelled ? (
                       <Badge variant="destructive"><Ban className="w-3 h-3 mr-1.5"/>Cancelled</Badge>
                    ) : (
                      <Button
                        variant={isVoted ? 'secondary' : 'default'}
                        size="sm"
                        onClick={() => onEventVoteTrigger(event)}
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
                );
              })
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
