'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Vote, CheckCircle, Circle, Swords, Trophy, Trash2, ClipboardCopy, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isToday } from 'date-fns';

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
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

type DailyVotingGridProps = {
  userVotes: UserVotes;
  onVote: (date: Date, timeSlot: string) => void;
  onVoteAllDay: (date: Date) => void;
  onClearAllVotes: (date: Date) => void;
  onCopyLastWeeksVotes: () => void;
  hasLastWeekVotes: boolean;
  currentDate: Date;
  scheduledEvents: ScheduleEvent[];
};

export function DailyVotingGrid({
  userVotes,
  onVote,
  onVoteAllDay,
  onClearAllVotes,
  onCopyLastWeeksVotes,
  hasLastWeekVotes,
  currentDate,
  scheduledEvents,
}: DailyVotingGridProps) {
    
  const [dayOffset, setDayOffset] = React.useState(() => {
    // Find today's index in the week (Mon=0, Sun=6)
    const todayIndex = (new Date().getDay() + 6) % 7;
    return todayIndex;
  });

  const weekDates = React.useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [currentDate]);

  const selectedDate = weekDates[dayOffset];

  const hasAnyVotesForDay = React.useMemo(() => {
    if (!selectedDate) return false;
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return userVotes[dateKey] && userVotes[dateKey].size > 0;
  }, [userVotes, selectedDate]);

  const getEventForSlot = (day: Date, slot: string) => {
    if (!day) return null;
    return scheduledEvents.find(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === day.toDateString() && event.time === slot;
    });
  };

  const handlePreviousDay = () => setDayOffset(prev => (prev > 0 ? prev - 1 : 6));
  const handleNextDay = () => setDayOffset(prev => (prev < 6 ? prev + 1 : 0));
  
  if (!selectedDate) {
      return (
        <Card>
            <CardHeader>
                <CardTitle>Loading...</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Please wait...</p>
            </CardContent>
        </Card>
      )
  }

  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const allDayVoted = timeSlots.every(slot => userVotes[dateKey]?.has(slot));

  return (
    <Card>
      <TooltipProvider>
        <CardHeader>
          <div className='flex items-start justify-between'>
              <div className="flex items-center gap-3">
              <Vote className="w-6 h-6 text-gold" />
              <CardTitle>Set Your Availability (Daily)</CardTitle>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onCopyLastWeeksVotes} disabled={!hasLastWeekVotes}>
                            <ClipboardCopy className="w-5 h-5" />
                            <span className="sr-only">Copy last week's votes</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Copy last week's votes to this week</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => onClearAllVotes(selectedDate)} disabled={!hasAnyVotesForDay}>
                            <Trash2 className="w-5 h-5" />
                            <span className="sr-only">Clear all votes for this day</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Clear all your votes for this day</p>
                    </TooltipContent>
                </Tooltip>
              </div>
          </div>
          <CardDescription>
            Focus on one day at a time. Use the arrows to navigate the week, and click the circle button at the top to select all times for the chosen day. There's also a "Weekly View" tab for a broader look.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className={cn('flex items-center justify-between p-4 border-b rounded-t-lg bg-muted', isToday(selectedDate) && 'bg-gold-10 border-gold-50')}>
                <Button variant="outline" size="icon" onClick={handlePreviousDay}>
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className='text-center'>
                    <h3 className='text-lg font-semibold'>{format(selectedDate, 'EEEE')}</h3>
                    <p className='text-sm text-muted-foreground'>{format(selectedDate, 'MMMM d, yyyy')}</p>
                </div>
                <Button variant="outline" size="icon" onClick={handleNextDay}>
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
            <div className="border-l border-r border-b rounded-b-lg overflow-hidden max-h-[60vh] overflow-y-auto">
                <div className='flex items-center justify-between p-3 border-b bg-muted/50'>
                    <p className='text-sm font-medium'>Select all times for {format(selectedDate, 'EEEE')}</p>
                    <Tooltip>
                        <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onVoteAllDay(selectedDate)}>
                            {allDayVoted ? <CheckCircle className="w-5 h-5 text-primary" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                        </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{allDayVoted ? 'Deselect' : 'Select'} all times for {format(selectedDate, 'EEEE')}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
                <div className='divide-y'>
                {timeSlots.map(slot => {
                    const isVoted = userVotes[dateKey]?.has(slot);
                    const event = getEventForSlot(selectedDate, slot);

                    return (
                        <motion.div
                            key={slot}
                            onClick={() => onVote(selectedDate, slot)}
                            className={cn(
                                'flex items-center justify-between p-3 cursor-pointer transition-colors hover:bg-accent',
                                isVoted ? "bg-primary/20" : "bg-transparent"
                            )}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className='flex items-center gap-3'>
                                {isVoted ? (
                                    <CheckCircle className="w-5 h-5 text-primary" />
                                ) : (
                                    <Circle className="w-5 h-5 text-muted-foreground/30" />
                                )}
                                <span className='font-medium'>{slot}</span>
                            </div>
                             {event && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="p-1">
                                        {event.type === 'Training' ? (
                                            <Swords className="w-5 h-5 text-blue-400" />
                                        ) : (
                                            <Trophy className="w-5 h-5 text-gold" />
                                        )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{event.type} at {event.time}</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </motion.div>
                    )
                })}
                </div>
            </div>
        </CardContent>
      </TooltipProvider>
    </Card>
  );
}
