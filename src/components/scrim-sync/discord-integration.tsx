'use client';

import * as React from 'react';
import { Bot, Loader } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable, FunctionsError } from 'firebase/functions';
import { useFirebaseApp } from '@/firebase';

export function DiscordIntegration() {
  const { toast } = useToast();
  const app = useFirebaseApp();
  const [isTesting, setIsTesting] = React.useState(false);

  const handleTestWebhook = async () => {
    if (!app) return;
    setIsTesting(true);

    const functions = getFunctions(app, 'us-central1');
    const testWebhookCallable = httpsCallable(functions, 'testDiscordWebhook');
    try {
      const result = await testWebhookCallable();
      const data = result.data as { success: boolean; message: string };
      if (data.success) {
        toast({
          title: 'Success!',
          description: data.message,
        });
      } else {
         toast({
            variant: 'destructive',
            title: 'Test Failed',
            description: data.message || 'An unknown error occurred.',
        });
      }
    } catch (error) {
      const e = error as FunctionsError;
      console.error('Error testing webhook:', e);
      toast({
        variant: 'destructive',
        title: 'Test Failed',
        description: e.message,
      });
    } finally {
      setIsTesting(false);
    }
  };


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-gold" />
          <CardTitle>Discord Integration</CardTitle>
        </div>
        <CardDescription>
          The Discord webhook is configured on the backend. Click the button below to send a test message to the channel.
        </CardDescription>
      </CardHeader>
      <CardContent>
          <div className='flex items-center gap-2 p-4 bg-muted rounded-lg'>
              <p className='text-sm text-muted-foreground'>The webhook URL is hardcoded in the backend. No need to set it here.</p>
          </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button variant="outline" onClick={handleTestWebhook} disabled={isTesting || !app}>
           {isTesting ? (
            <Loader className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Bot className="mr-2 h-4 w-4" />
          )}
          Send Test Message
        </Button>
      </CardFooter>
    </Card>
  );
}
