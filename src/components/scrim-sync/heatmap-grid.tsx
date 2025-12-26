'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Swords, Trophy, Vote } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";

type HeatmapGridProps = {
  votes: Record<string, number>;
  scheduledEvents: ScheduleEvent[];
  currentDate: Date;
};

export function HeatmapGrid({
  votes,
  scheduledEvents,
  currentDate,
}: HeatmapGridProps) {
  const weekDates = React.useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const maxVotes = React.useMemo(() => {
    const voteCounts = weekDates.flatMap(date => {
        const dateKey = format(date, 'yyyy-MM-dd');
        return timeSlots.map(slot => votes[`${dateKey}-${slot}`] || 0)
    });
    return Math.max(...voteCounts, 1);
  }, [votes, weekDates]);

  const getHeatmapOpacity = (voteCount: number) => {
    if (voteCount === 0) return 0;
    return Math.max(0.1, voteCount / maxVotes);
  };
  
  const getEventForSlot = (day: Date, slot: string) => {
    return scheduledEvents.find(event => {
      return isSameDay(event.date, day) && event.time === slot;
    });
  };

  return (
    <Card className="flex-1">
      <CardHeader>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
            <Vote className="w-6 h-6" />
            <CardTitle>Team Availability Heatmap</CardTitle>
            </div>
        </div>
        <CardDescription>
          Darker slots indicate higher player availability across the week.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
            <div className="border rounded-lg overflow-auto max-h-[60vh]">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px] sticky left-0 bg-card z-20">Time</TableHead>
                            {weekDates.map(date => (
                                <TableHead key={date.toISOString()} className="text-center">
                                  <div>{format(date, 'EEE')}</div>
                                  <div>{format(date, 'd/M')}</div>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {timeSlots.map(slot => (
                            <TableRow key={slot}>
                                <TableCell className="font-medium sticky left-0 bg-card z-10">{slot}</TableCell>
                                {weekDates.map(date => {
                                    const dateKey = format(date, 'yyyy-MM-dd');
                                    const voteKey = `${dateKey}-${slot}`;
                                    const voteCount = votes[voteKey] || 0;
                                    const event = getEventForSlot(date, slot);
                                    return (
                                        <TableCell key={date.toISOString()} className="text-center p-0">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        className={cn(
                                                            'relative h-12 w-full flex flex-col justify-center items-center text-center p-1 transition-all duration-300'
                                                        )}
                                                    >
                                                        <div
                                                            className="absolute inset-0 bg-primary transition-opacity duration-300"
                                                            style={{
                                                            opacity: getHeatmapOpacity(voteCount),
                                                            }}
                                                        />
                                                        <div className="relative z-10 text-xs sm:text-sm font-medium">
                                                            {voteCount}
                                                        </div>
                                                        <div className="relative z-10 text-[10px] sm:text-xs text-muted-foreground">
                                                            votes
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
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{format(date, 'EEEE, d MMM')} at {slot}</p>
                                                    <p>{voteCount} players available</p>
                                                    {event && (
                                                    <p className="mt-1 font-bold">
                                                        {event.type} scheduled
                                                    </p>
                                                    )}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TableCell>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
