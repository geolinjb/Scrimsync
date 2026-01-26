'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, Vote, CheckCircle, Circle, Swords, Trophy, Trash2, ClipboardCopy, CalendarX2 } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';

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
import { Badge } from '../ui/badge';


type IndividualVotingGridProps = {
  userVotes: UserVotes;
  onVote: (date: Date, timeSlot: string) => void;
  onVoteAllDay: (date: Date) => void;
  onVoteAllTime: (timeSlot: string) => void;
  onClearAllVotes: () => void;
  onCopyLastWeeksVotes: () => void;
  hasLastWeekVotes: boolean;
  currentDate: Date;
  scheduledEvents: ScheduleEvent[];
};

export function IndividualVotingGrid({
  userVotes,
  onVote,
  onVoteAllDay,
  onVoteAllTime,
  onClearAllVotes,
  onCopyLastWeeksVotes,
  hasLastWeekVotes,
  currentDate,
  scheduledEvents,
}: IndividualVotingGridProps) {
  const weekDates = React.useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const hasAnyVotes = React.useMemo(() => {
    return weekDates.some(date => {
        const dateKey = format(date, 'yyyy-MM-dd');
        return userVotes[dateKey] && userVotes[dateKey].size > 0;
    });
  }, [userVotes, weekDates]);

  const getEventForSlot = (day: Date, slot: string) => {
    return scheduledEvents.find(event => {
      return isSameDay(event.date, day) && event.time === slot;
    });
  };

  return (
    <Card>
      <TooltipProvider>
        <CardHeader>
          <div className='flex items-start justify-between'>
              <div className="flex items-center gap-3">
              <Vote className="w-6 h-6 text-gold" />
              <CardTitle>Set Your Availability (Weekly)</CardTitle>
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
                        <Button variant="ghost" size="icon" onClick={onClearAllVotes} disabled={!hasAnyVotes}>
                            <Trash2 className="w-5 h-5" />
                            <span className="sr-only">Clear all votes for this week</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Clear all your votes for this week</p>
                    </TooltipContent>
                </Tooltip>
              </div>
          </div>
          <CardDescription>
            Click a day's header button to select all times for that day. Click a time slot's button in the first column to select that time for the entire week. Check the "Daily View" for a more focused experience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto max-h-[65vh] relative">
              <Table className="w-full border-collapse">
                  <TableHeader className="sticky top-0 z-30 bg-muted/80 backdrop-blur-sm">
                      <TableRow className="border-b-2 border-border">
                          <TableHead className="w-[120px] font-bold sticky left-0 bg-muted/80 backdrop-blur-sm z-40 p-2 text-center">Time</TableHead>
                          {weekDates.map(date => {
                              const dateKey = format(date, 'yyyy-MM-dd');
                              const allDayVoted = timeSlots.every(slot => userVotes[dateKey]?.has(slot));

                              return (
                                  <TableHead key={date.toISOString()} className={cn("text-center p-2", isToday(date) && "bg-gold-10")}>
                                    <div className='flex flex-col items-center gap-1 min-w-[6rem]'>
                                        <span className='font-semibold'>{format(date, 'EEE')}</span>
                                        <span className="font-normal text-muted-foreground">{format(date, 'd/M')}</span>
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
                                      const isCancelled = event?.status === 'Cancelled';
                                      return (
                                          <TableCell key={date.toISOString()} className="text-center p-0 align-middle">
                                              <motion.div
                                                  onClick={() => onVote(date, slot)}
                                                  className={cn(
                                                      'h-14 w-full cursor-pointer flex justify-center items-center transition-colors duration-200 border-l border-t relative group',
                                                      'hover:bg-accent',
                                                      isVoted ? 'bg-primary/20' : 'bg-transparent',
                                                      isToday(date) && 'bg-gold-10',
                                                      isCancelled && 'bg-destructive/10 line-through'
                                                  )}
                                                  whileTap={{ scale: 0.95 }}
                                              >
                                                  {isVoted && <Check className={cn("relative z-10 w-5 h-5 text-primary", isCancelled && "opacity-50")} />}
                                                  
                                                  {event && !isVoted && !isCancelled && (
                                                      <Vote className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                  )}

                                                  {event && (
                                                      <Tooltip>
                                                          <TooltipTrigger asChild>
                                                              <div className="absolute top-1 right-1 z-20 p-1 flex items-center gap-1">
                                                                  {isCancelled && <Badge variant="destructive" className="text-xs py-0 px-1 h-auto">C</Badge>}
                                                                  {isCancelled ? (
                                                                    <CalendarX2 className="w-4 h-4 text-destructive" />
                                                                  ) : event.type === 'Training' ? (
                                                                      <Swords className="w-4 h-4 text-blue-400" />
                                                                  ) : (
                                                                      <Trophy className="w-4 h-4 text-gold" />
                                                                  )}
                                                              </div>
                                                          </TooltipTrigger>
                                                          <TooltipContent>
                                                              <p>
                                                                  {isVoted ? "You are attending this " : "There is a "}
                                                                  {event.type} at {event.time}
                                                              </p>
                                                              {!isVoted && !isCancelled && <p className="font-semibold text-center">Click cell to vote</p>}
                                                              {isCancelled && <p className="font-bold text-destructive">This event has been cancelled.</p>}
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
        </CardContent>
      </TooltipProvider>
    </Card>
  );
}
