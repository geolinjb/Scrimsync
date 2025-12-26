'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, Vote } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';

import type { UserVotes } from '@/lib/types';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"


type IndividualVotingGridProps = {
  userVotes: UserVotes;
  onVote: (date: Date, timeSlot: string) => void;
  currentDate: Date;
};

export function IndividualVotingGrid({
  userVotes,
  onVote,
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
          Click on a time slot to mark yourself as available. Selected slots are highlighted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-auto max-h-[60vh]">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px] font-bold sticky left-0 bg-card z-20">Time</TableHead>
                        {weekDates.map(date => (
                            <TableHead key={date.toISOString()} className="text-center font-bold">
                              <div>{format(date, 'EEE')}</div>
                              <div>{format(date, 'M/d')}</div>
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
                    ))}
                </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
}
