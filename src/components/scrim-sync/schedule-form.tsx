'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, isSameDay, startOfWeek, addDays } from 'date-fns';
import { Calendar as CalendarIcon, CalendarPlus } from 'lucide-react';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  type: z.enum(['Training', 'Tournament']),
  date: z.date({
    required_error: 'A date is required.',
  }),
  time: z.string().min(1, 'A time is required.'),
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
    },
  });

  const selectedDate = useWatch({ control: form.control, name: 'date' });

  const weekDates = React.useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    onAddEvent(values);
    form.reset({
        type: 'Training',
        time: '',
        date: undefined,
    });
  }

  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2);
    const minutes = i % 2 === 0 ? '00' : '30';
    const period = hours < 12 ? 'AM' : 'PM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${minutes} ${period}`;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CalendarPlus className="w-6 h-6" />
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
                <FormItem className="flex flex-col">
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
                        className='flex-col h-auto'
                      >
                        <span>{format(date, 'EEE')}</span>
                        <span className='text-xs'>{format(date, 'd/M')}</span>
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
                      {timeOptions.map((time) => (
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
            <Button type="submit" className="w-full">
              Add Event
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
