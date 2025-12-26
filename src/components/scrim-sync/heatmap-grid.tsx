'use client';

import * as React from 'react';
import { Swords, Trophy, Vote, Users } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

import type { ScheduleEvent, AllVotes } from '@/lib/types';
import { timeSlots, mockPlayers } from '@/lib/types';
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';

type HeatmapGridProps = {
  allVotes: AllVotes;
  scheduledEvents: ScheduleEvent[];
  currentDate: Date;
};

type SelectedSlot = {
    date: Date;
    slot: string;
    players: string[];
} | null;

const heatmapColors = [
    'bg-primary/10',
    'bg-primary/20',
    'bg-primary/40',
    'bg-primary/60',
    'bg-primary/80',
    'bg-primary',
];

export function HeatmapGrid({
  allVotes,
  scheduledEvents,
  currentDate,
}: HeatmapGridProps) {
  const [selectedSlot, setSelectedSlot] = React.useState<SelectedSlot>(null);

  const weekDates = React.useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const maxVotes = React.useMemo(() => {
    return mockPlayers.length;
  }, []);

  const getHeatmapColor = (voteCount: number) => {
    if (voteCount === 0) return 'bg-transparent';
    const percentage = voteCount / maxVotes;
    const colorIndex = Math.min(
        Math.floor(percentage * (heatmapColors.length -1)),
        heatmapColors.length - 1
    );
    return heatmapColors[colorIndex];
  };
  
  const getEventForSlot = (day: Date, slot: string) => {
    return scheduledEvents.find(event => {
      return isSameDay(event.date, day) && event.time === slot;
    });
  };

  const handleSlotClick = (date: Date, slot: string, players: string[]) => {
    setSelectedSlot({date, slot, players});
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
          Darker slots indicate higher player availability. Click a slot to see who is available.
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
                                    const availablePlayers = allVotes[voteKey] || [];
                                    const voteCount = availablePlayers.length;
                                    const event = getEventForSlot(date, slot);
                                    return (
                                        <TableCell key={date.toISOString()} className="text-center p-0">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        onClick={() => handleSlotClick(date, slot, availablePlayers)}
                                                        className={cn(
                                                            'relative h-12 w-full flex flex-col justify-center items-center text-center p-1 transition-all duration-300 cursor-pointer',
                                                            getHeatmapColor(voteCount)
                                                        )}
                                                    >
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

        <Dialog open={!!selectedSlot} onOpenChange={(isOpen) => !isOpen && setSelectedSlot(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Available Players</DialogTitle>
                    {selectedSlot && (
                        <DialogDescription>
                            {format(selectedSlot.date, 'EEEE, d MMM')} at {selectedSlot.slot}
                        </DialogDescription>
                    )}
                </DialogHeader>
                <div className='max-h-[60vh] overflow-y-auto'>
                    {selectedSlot?.players && selectedSlot.players.length > 0 ? (
                        <ul className='space-y-3 py-2'>
                           {selectedSlot.players.map(player => (
                               <li key={player} className='flex items-center gap-3'>
                                   <Avatar>
                                       <AvatarImage src={`https://api.dicebear.com/8.x/pixel-art/svg?seed=${player}`} />
                                       <AvatarFallback>{player.charAt(0).toUpperCase()}</AvatarFallback>
                                   </Avatar>
                                   <span className='font-medium'>{player}</span>
                               </li>
                           ))}
                        </ul>
                    ): (
                        <div className='flex flex-col items-center justify-center text-center py-12'>
                            <Users className='w-12 h-12 text-muted-foreground' />
                            <p className='mt-4 text-muted-foreground'>No players available for this time slot.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
