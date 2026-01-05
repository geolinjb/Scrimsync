'use client';

import * as React from 'react';
import { Shield, Loader, UserPlus, Info } from 'lucide-react';
import { useFunctions } from '@/firebase';
import { httpsCallable } from 'firebase/functions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function AdminManagementPanel() {
  const functions = useFunctions();
  const { toast } = useToast();
  const [targetUid, setTargetUid] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleMakeAdmin = async () => {
    if (!functions || !targetUid) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Function service not available or UID is missing.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const setAdminClaim = httpsCallable(functions, 'setAdminClaim');
      const result = await setAdminClaim({ uid: targetUid });
      toast({
        title: 'Success',
        description: (result.data as { message: string }).message,
      });
      setTargetUid('');
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Operation Failed',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-gold" />
          <CardTitle>Admin Management</CardTitle>
        </div>
        <CardDescription>Grant administrative privileges to a user by providing their User ID (UID).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
            <Info className='w-4 h-4'/>
            <AlertTitle>How to grant admin rights</AlertTitle>
            <AlertDescription>
                To grant admin rights, obtain the user's UID (they can get it from their profile dropdown) and enter it below. The user will need to sign out and sign back in for the changes to take effect.
            </AlertDescription>
        </Alert>
        <div className="space-y-2">
          <Label htmlFor="uid-input">User ID (UID)</Label>
          <Input
            id="uid-input"
            placeholder="Paste the user's UID here"
            value={targetUid}
            onChange={(e) => setTargetUid(e.target.value)}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleMakeAdmin} disabled={isSubmitting || !targetUid}>
          {isSubmitting ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
          {isSubmitting ? 'Granting...' : 'Make Admin'}
        </Button>
      </CardFooter>
    </Card>
  );
}
