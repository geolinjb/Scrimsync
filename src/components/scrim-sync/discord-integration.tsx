'use client';

import * as React from 'react';
import { Bot, Loader, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable, FunctionsError } from 'firebase/functions';
import { useFunctions, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export function DiscordIntegration() {
  const { toast } = useToast();
  const functions = useFunctions();
  const firestore = useFirestore();

  const configRef = useMemoFirebase(() => doc(firestore, 'app-config/discord'), [firestore]);
  const { data: configData, isLoading: isConfigLoading } = useDoc<{discordWebhookUrl: string}>(configRef);
  
  const [webhookUrl, setWebhookUrl] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);

  React.useEffect(() => {
    if (configData?.discordWebhookUrl) {
      setWebhookUrl(configData.discordWebhookUrl);
    }
  }, [configData]);

  const handleSetWebhook = async () => {
    if (!webhookUrl) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please enter a valid Discord webhook URL.',
      });
      return;
    }
    if (!functions) return;
    setIsSaving(true);

    const setWebhookUrlCallable = httpsCallable(functions, 'setDiscordWebhookUrl');
    try {
      const result = await setWebhookUrlCallable({ url: webhookUrl });
      const data = result.data as { success: boolean; message: string };
      if (data.success) {
        toast({
          title: 'Success!',
          description: data.message,
        });
      }
    } catch (error) {
      const e = error as FunctionsError;
      console.error('Error setting webhook URL:', e);
      toast({
        variant: 'destructive',
        title: 'An error occurred',
        description: e.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!functions) return;
    setIsTesting(true);

    const testWebhookCallable = httpsCallable(functions, 'testDiscordWebhook');
    try {
      const result = await testWebhookCallable();
      const data = result.data as { success: boolean; message: string };
      if (data.success) {
        toast({
          title: 'Success!',
          description: data.message,
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
          Connect a Discord webhook to send event reminders and roster updates automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
            <label htmlFor="webhook-url" className='text-sm font-medium'>Discord Webhook URL</label>
            <div className="flex items-center gap-2">
              <Input
                  id="webhook-url"
                  type="password"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  disabled={isConfigLoading}
              />
               {configData?.discordWebhookUrl && (
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
               )}
            </div>
             <p className='text-xs text-muted-foreground'>Your URL is stored securely in Firestore and is only accessible by backend functions.</p>
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <Button onClick={handleSetWebhook} disabled={isSaving || isConfigLoading || !webhookUrl}>
          {isSaving ? (
            <Loader className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Save URL
        </Button>
        <Button variant="outline" onClick={handleTestWebhook} disabled={isTesting || isConfigLoading || !configData?.discordWebhookUrl}>
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
