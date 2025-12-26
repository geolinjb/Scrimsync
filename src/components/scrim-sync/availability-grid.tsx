'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Swords, Trophy, Vote } from 'lucide-react';

import type { ScheduleEvent } from '@/lib/types';
import { timeSlots } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type AvailabilityGridProps = {
  votes: Record<string, number>;
  userVotes: Set<string>;
  scheduledEvents: ScheduleEvent[];
  onVote: (timeSlot: string) => void;
};

export function AvailabilityGrid({
  votes,
  userVotes,
  scheduledEvents,
  onVote,
}: AvailabilityGridProps) {
  const maxVotes = React.useMemo(() => {
    const voteCounts = Object.values(votes);
    return Math.max(...voteCounts, 1);
  }, [votes]);

  const getHeatmapOpacity = (voteCount: number) => {
    if (voteCount === 0) return 0;
    return Math.max(0.1, voteCount / maxVotes);
  };
  
  const getEventForSlot = (slot: string) => {
    return scheduledEvents.find(event => {
      const eventDate = new Date(event.date);
      const today = new Date();
      // Only show events for today for simplicity
      if (eventDate.toDateString() !== today.toDateString()) return false;
      return event.time === slot;
    });
  };

  return (
    <Card className="flex-1">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Vote className="w-6 h-6" />
          <CardTitle>Availability Voting</CardTitle>
        </div>
        <CardDescription>
          Vote for your available times. Darker slots are more popular.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2">
            {timeSlots.map((slot) => {
              const voteCount = votes[slot] || 0;
              const isVoted = userVotes.has(slot);
              const event = getEventForSlot(slot);

              return (
                <Tooltip key={slot}>
                  <TooltipTrigger asChild>
                    <motion.div
                      onClick={() => onVote(slot)}
                      className={cn(
                        'relative aspect-square rounded-lg cursor-pointer flex flex-col justify-center items-center text-center p-1 transition-all duration-300 transform hover:scale-105',
                        'border-2',
                        isVoted
                          ? 'border-accent ring-2 ring-accent'
                          : 'border-transparent'
                      )}
                      style={{
                        backgroundColor: `hsl(var(--card))`,
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div
                        className="absolute inset-0 bg-primary rounded-md transition-opacity duration-300"
                        style={{
                          opacity: getHeatmapOpacity(voteCount),
                        }}
                      />
                      <div className="relative z-10 text-xs sm:text-sm font-medium">
                        {slot.replace(' PM', '').replace(' AM', '')}
                      </div>
                      <div className="relative z-10 text-[10px] sm:text-xs text-muted-foreground">
                        {voteCount} votes
                      </div>
                      {event && (
                        <div className="absolute top-1 right-1 z-20">
                          {event.type === 'Training' ? (
                            <Swords className="w-3 h-3 text-foreground" />
                          ) : (
                            <Trophy className="w-3 h-3 text-foreground" />
                          )}
                        </div>
                      )}
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{slot}</p>
                    <p>{voteCount} players available</p>
                    {event && (
                      <p className="mt-1 font-bold">
                        {event.type} scheduled
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
