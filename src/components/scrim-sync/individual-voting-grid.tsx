'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, Vote } from 'lucide-react';

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
} from "@/components/ui/table"


type IndividualVotingGridProps = {
  userVotes: UserVotes;
  onVote: (day: string, timeSlot: string) => void;
};

export function IndividualVotingGrid({
  userVotes,
  onVote,
}: IndividualVotingGridProps) {
  return (
    <Card className="flex-1">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Vote className="w-6 h-6" />
          <CardTitle>Set Your Weekly Availability</CardTitle>
        </div>
        <CardDescription>
          Click on a time slot to mark yourself as available.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Time</TableHead>
                        {daysOfWeek.map(day => (
                            <TableHead key={day} className="text-center">{day}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {timeSlots.map(slot => (
                        <TableRow key={slot}>
                            <TableCell className="font-medium">{slot}</TableCell>
                            {daysOfWeek.map(day => {
                                const isVoted = userVotes[day]?.has(slot);
                                return (
                                    <TableCell key={day} className="text-center p-0">
                                         <motion.div
                                            onClick={() => onVote(day, slot)}
                                            className={cn(
                                                'h-12 w-full cursor-pointer flex justify-center items-center transition-colors',
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
