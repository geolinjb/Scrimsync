
'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, isSameDay, startOfWeek, addDays, isToday } from 'date-fns';
import { Calendar as CalendarIcon, CalendarPlus, Info } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { timeSlots } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const formSchema = z.object({
  type: z.enum(['Training', 'Tournament']),
  date: z.date({
    required_error: 'A date is required.',
  }),
  time: z.string().min(1, 'A time is required.'),
  description: z.string().max(500, "Description must be 500 characters or less.").optional(),
  discordRoleId: z.string().optional(),
});

type ScheduleFormProps = {
  onAddEvent: (data: z.infer<typeof formSchema>) => void;
  currentDate: Date;
};

export function ScheduleForm({ onAddEvent, currentDate }: ScheduleFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'Training',
      time: '',
      description: '',
      discordRoleId: '',
    },
  });

  const selectedDate = useWatch({ control: form.control, name: 'date' });

  const weekDates = React.useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    onAddEvent(values);
    form.reset({
        type: 'Training',
        time: '',
        date: undefined,
        description: '',
        discordRoleId: '',
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CalendarPlus className="w-6 h-6 text-gold" />
          <CardTitle>Schedule Event</CardTitle>
        </div>
        <CardDescription>
          Add a training session or tournament to the calendar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an event type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Training">Training</SelectItem>
                      <SelectItem value="Tournament">Tournament</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel>Date</FormLabel>
                  <div className="grid grid-cols-4 gap-2">
                    {weekDates.map((date) => (
                      <Button
                        key={date.toISOString()}
                        variant={isSameDay(date, selectedDate) ? 'default' : 'outline'}
                        onClick={(e) => {
                            e.preventDefault();
                            form.setValue('date', date, { shouldValidate: true });
                        }}
                        className={cn('flex-col h-auto p-2', isToday(date) && !isSameDay(date, selectedDate) && 'border-primary/50')}
                      >
                        <span className="text-xs">{format(date, 'EEE')}</span>
                        <span className='text-sm font-bold'>{format(date, 'd/M')}</span>
                      </Button>
                    ))}
                  </div>

                  <Separator />

                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'd MMM, yyyy')
                          ) : (
                            <span>Pick a date from calendar</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date(new Date().toDateString())}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a time" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="discordRoleId"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Discord Role ID (Optional)</FormLabel>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Enter the numeric ID of the role to mention (e.g. 123456789). Enable Developer Mode in Discord to right-click a role and copy its ID.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <FormControl>
                    <Input placeholder="e.g. 1073088734335039865" {...field} />
                  </FormControl>
                  <FormDescription>Mention a specific role when posting to Discord.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any notes, links, or details about the event..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              Add Event
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
