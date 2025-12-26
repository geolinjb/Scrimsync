'use client';

import * as React from 'react';
import { Swords, Trophy, Vote, Users } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

import type { ScheduleEvent, AllVotes } from '@/lib/types';
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

type HeatmapGridProps = {
  allVotes: AllVotes;
  scheduledEvents: ScheduleEvent[];
  currentDate: Date;
  allPlayerNames: string[];
};

type SelectedSlot = {
    date: Date;
    slot: string;
    players: string[];
} | null;

const heatmapColors = [
    'bg-green-500/10',
    'bg-green-500/20',
    'bg-green-500/40',
    'bg-green-500/60',
    'bg-green-500/80',
    'bg-green-500/100',
];

export function HeatmapGrid({
  allVotes,
  scheduledEvents,
  currentDate,
  allPlayerNames
}: HeatmapGridProps) {
  const [selectedSlot, setSelectedSlot] = React.useState<SelectedSlot>(null);

  const weekDates = React.useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const maxVotes = React.useMemo(() => {
    return allPlayerNames.length || 1;
  }, [allPlayerNames]);

  const getHeatmapColor = (voteCount: number) => {
    if (voteCount === 0) return 'bg-transparent';
    const percentage = voteCount / maxVotes;
    const colorIndex = Math.min(
        Math.floor(percentage * (heatmapColors.length)),
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
    <Card>
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
            <div className="border rounded-lg overflow-auto max-h-[65vh] relative">
                <Table className="w-full border-collapse">
                    <TableHeader className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm">
                        <TableRow>
                            <TableHead className="w-[100px] sticky left-0 bg-card/95 backdrop-blur-sm z-40">Time</TableHead>
                            {weekDates.map(date => (
                                <TableHead key={date.toISOString()} className="text-center p-2">
                                  <div className='min-w-[6rem]'>{format(date, 'EEE')}</div>
                                  <div className="font-normal">{format(date, 'd/M')}</div>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {timeSlots.map(slot => (
                            <TableRow key={slot}>
                                <TableCell className="font-medium sticky left-0 bg-card/95 backdrop-blur-sm z-20 p-2">{slot}</TableCell>
                                {weekDates.map(date => {
                                    const dateKey = format(date, 'yyyy-MM-dd');
                                    const voteKey = `${dateKey}-${slot}`;
                                    const availablePlayers = allVotes[voteKey] || [];
                                    const voteCount = availablePlayers.length;
                                    const event = getEventForSlot(date, slot);
                                    return (
                                        <TableCell key={date.toISOString()} className="text-center p-0 align-middle">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        onClick={() => handleSlotClick(date, slot, availablePlayers)}
                                                        className={cn(
                                                            'relative h-14 w-full flex flex-col justify-center items-center text-center p-1 transition-all duration-300 cursor-pointer border-l border-t',
                                                            getHeatmapColor(voteCount)
                                                        )}
                                                    >
                                                        <div className="relative z-10 text-sm font-bold text-foreground">
                                                            {voteCount > 0 ? voteCount : ''}
                                                        </div>
                                                        {event && (
                                                            <div className="absolute top-1 right-1 z-20">
                                                            {event.type === 'Training' ? (
                                                                <Swords className="w-4 h-4 text-foreground/80" />
                                                            ) : (
                                                                <Trophy className="w-4 h-4 text-yellow-500" />
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
