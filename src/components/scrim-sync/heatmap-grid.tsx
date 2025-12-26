'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Swords, Trophy, Vote } from 'lucide-react';

import type { ScheduleEvent } from '@/lib/types';
import { timeSlots, daysOfWeek } from '@/lib/types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type HeatmapGridProps = {
  votes: Record<string, number>;
  scheduledEvents: ScheduleEvent[];
};

export function HeatmapGrid({
  votes,
  scheduledEvents,
}: HeatmapGridProps) {
  const [selectedDay, setSelectedDay] = React.useState(daysOfWeek[0]);

  const maxVotes = React.useMemo(() => {
    const voteCounts = daysOfWeek.flatMap(day => timeSlots.map(slot => votes[`${day}-${slot}`] || 0));
    return Math.max(...voteCounts, 1);
  }, [votes]);

  const getHeatmapOpacity = (voteCount: number) => {
    if (voteCount === 0) return 0;
    return Math.max(0.1, voteCount / maxVotes);
  };
  
  const getEventForSlot = (slot: string) => {
    // This logic needs to be aware of the selected day of the week
    return scheduledEvents.find(event => {
      const eventDate = new Date(event.date);
      const dayName = daysOfWeek[eventDate.getDay()];
      return dayName === selectedDay && event.time === slot;
    });
  };

  return (
    <Card className="flex-1">
      <CardHeader>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
            <Vote className="w-6 h-6" />
            <CardTitle>Team Availability</CardTitle>
            </div>
            <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select a day" />
                </SelectTrigger>
                <SelectContent>
                    {daysOfWeek.map(day => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <CardDescription>
          Darker slots are more popular for the selected day.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2">
            {timeSlots.map((slot) => {
              const voteKey = `${selectedDay}-${slot}`;
              const voteCount = votes[voteKey] || 0;
              const event = getEventForSlot(slot);

              return (
                <Tooltip key={slot}>
                  <TooltipTrigger asChild>
                    <motion.div
                      className={cn(
                        'relative aspect-square rounded-lg flex flex-col justify-center items-center text-center p-1 transition-all duration-300',
                        'border-2 border-transparent'
                      )}
                      style={{
                        backgroundColor: `hsl(var(--card))`,
                      }}
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
                    <p>{voteCount} players available on {selectedDay}</p>
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
