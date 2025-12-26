'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, Vote, CheckCircle, Circle } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';

import type { UserVotes } from '@/lib/types';
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
};

export function IndividualVotingGrid({
  userVotes,
  onVote,
  onVoteAllDay,
  onVoteAllTime,
  currentDate,
}: IndividualVotingGridProps) {
  const weekDates = React.useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  return (
    <Card className="flex-1">
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
        <div className="border rounded-lg overflow-auto max-h-[60vh]">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px] font-bold sticky left-0 bg-card z-20">Time</TableHead>
                        {weekDates.map(date => {
                            const dateKey = format(date, 'yyyy-MM-dd');
                            const allDayVoted = timeSlots.every(slot => userVotes[dateKey]?.has(slot));

                            return (
                                <TableHead key={date.toISOString()} className="text-center font-bold">
                                  <div className='flex flex-col items-center gap-1'>
                                      <span>{format(date, 'EEE')}</span>
                                      <span>{format(date, 'd/M')}</span>
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
                                <TableCell className="font-medium sticky left-0 bg-card z-10 flex items-center justify-between">
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
                                    return (
                                        <TableCell key={date.toISOString()} className="text-center p-0">
                                             <motion.div
                                                onClick={() => onVote(date, slot)}
                                                className={cn(
                                                    'h-12 w-full cursor-pointer flex justify-center items-center transition-colors border-l border-t',
                                                    isVoted ? 'bg-primary/20 hover:bg-primary/30' : 'hover:bg-accent'
                                                )}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                {isVoted && <Check className="w-5 h-5 text-primary" />}
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
