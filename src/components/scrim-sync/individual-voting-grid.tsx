'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, Vote, CheckCircle, Circle, Swords, Trophy } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

import type { UserVotes, ScheduleEvent } from '@/lib/types';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';


type IndividualVotingGridProps = {
  userVotes: UserVotes;
  onVote: (date: Date, timeSlot: string) => void;
  onVoteAllDay: (date: Date) => void;
  onVoteAllTime: (timeSlot: string) => void;
  currentDate: Date;
  scheduledEvents: ScheduleEvent[];
};

export function IndividualVotingGrid({
  userVotes,
  onVote,
  onVoteAllDay,
  onVoteAllTime,
  currentDate,
  scheduledEvents,
}: IndividualVotingGridProps) {
  const weekDates = React.useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const getEventForSlot = (day: Date, slot: string) => {
    return scheduledEvents.find(event => {
      return isSameDay(event.date, day) && event.time === slot;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Vote className="w-6 h-6" />
          <CardTitle>Set Your Weekly Availability</CardTitle>
        </div>
        <CardDescription>
          Click on a time slot to mark yourself as available. Use the header buttons to select entire days or time blocks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
        <div className="border rounded-lg overflow-auto max-h-[65vh] relative">
            <Table className="w-full border-collapse">
                <TableHeader className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm">
                    <TableRow>
                        <TableHead className="w-[120px] font-bold sticky left-0 bg-card/95 backdrop-blur-sm z-40">Time</TableHead>
                        {weekDates.map(date => {
                            const dateKey = format(date, 'yyyy-MM-dd');
                            const allDayVoted = timeSlots.every(slot => userVotes[dateKey]?.has(slot));

                            return (
                                <TableHead key={date.toISOString()} className="text-center font-bold p-2">
                                  <div className='flex flex-col items-center gap-1 min-w-[6rem]'>
                                      <span>{format(date, 'EEE')}</span>
                                      <span className="font-normal">{format(date, 'd/M')}</span>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onVoteAllDay(date)}>
                                            {allDayVoted ? <CheckCircle className="w-4 h-4 text-primary" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{allDayVoted ? 'Deselect' : 'Select'} all times for {format(date, 'EEEE')}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                  </div>
                                </TableHead>
                            )
                        })}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {timeSlots.map(slot => {
                        const allTimeVoted = weekDates.every(date => {
                            const dateKey = format(date, 'yyyy-MM-dd');
                            return userVotes[dateKey]?.has(slot);
                        });

                        return (
                            <TableRow key={slot}>
                                <TableCell className="font-medium sticky left-0 bg-card/95 backdrop-blur-sm z-20 flex items-center justify-between p-2">
                                    <span>{slot}</span>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onVoteAllTime(slot)}>
                                                {allTimeVoted ? <CheckCircle className="w-4 h-4 text-primary" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{allTimeVoted ? 'Deselect' : 'Select'} {slot} for all days</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TableCell>
                                {weekDates.map(date => {
                                    const dateKey = format(date, 'yyyy-MM-dd');
                                    const isVoted = userVotes[dateKey]?.has(slot);
                                    const event = getEventForSlot(date, slot);
                                    return (
                                        <TableCell key={date.toISOString()} className="text-center p-0 align-middle">
                                             <motion.div
                                                onClick={() => onVote(date, slot)}
                                                className={cn(
                                                    'h-14 w-full cursor-pointer flex justify-center items-center transition-colors border-l border-t relative',
                                                    isVoted ? 'bg-primary/20 hover:bg-primary/30' : 'hover:bg-accent'
                                                )}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                {isVoted && <Check className="w-5 h-5 text-primary" />}
                                                {event && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="absolute top-1 right-1 z-20 p-1">
                                                            {event.type === 'Training' ? (
                                                                <Swords className="w-4 h-4 text-foreground/80" />
                                                            ) : (
                                                                <Trophy className="w-4 h-4 text-yellow-500" />
                                                            )}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{event.type} at {event.time}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </motion.div>
                                        </TableCell>
                                    )
                                })}
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
