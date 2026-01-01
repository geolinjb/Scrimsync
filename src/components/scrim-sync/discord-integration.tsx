'use client';

import * as React from 'react';
import { AlertTriangle, Bot, Loader, Send } from 'lucide-react';
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
import { getFunctions, httpsCallable, FunctionsError } from 'firebase/functions';
import { useFunctions } from '@/firebase';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function DiscordIntegration() {
  const { toast } = useToast();
  const functions = useFunctions();
  const [webhookUrl, setWebhookUrl] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [instruction, setInstruction] = React.useState<string | null>(null);

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
    setInstruction(null);

    const setWebhookUrl = httpsCallable(functions, 'setWebhookUrl');
    try {
      const result = await setWebhookUrl({ url: webhookUrl });
      const data = result.data as { success: boolean; message: string };
      if (data.success) {
        setInstruction(data.message);
        toast({
          title: 'Action Required',
          description: 'Please follow the command-line instructions shown below.',
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

    const testDiscordWebhook = httpsCallable(functions, 'testDiscordWebhook');
    try {
      const result = await testDiscordWebhook();
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
            <Input
                id="webhook-url"
                type="password"
                placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
            />
             <p className='text-xs text-muted-foreground'>Your URL is kept secret and is only used by secure backend functions.</p>
        </div>

        {instruction && (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Follow These Steps</AlertTitle>
                <AlertDescription>
                    <p>To securely save your webhook, run the following command in your local terminal:</p>
                    <pre className="mt-2 p-2 bg-muted rounded-md text-xs whitespace-pre-wrap">
                        <code>{instruction}</code>
                    </pre>
                </AlertDescription>
            </Alert>
        )}

      </CardContent>
      <CardFooter className="justify-between">
        <Button onClick={handleSetWebhook} disabled={isSaving || !webhookUrl}>
          {isSaving ? (
            <Loader className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Set Webhook URL
        </Button>
        <Button variant="outline" onClick={handleTestWebhook} disabled={isTesting}>
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
