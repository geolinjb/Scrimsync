'use client';

import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type WelcomeInstructionsProps = {
    username: string;
};

export function WelcomeInstructions({ username }: WelcomeInstructionsProps) {
    return (
        <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Welcome, {username}!</AlertTitle>
            <AlertDescription>
                <p>Choose the "Daily" or "Weekly" tab to mark your availability. Use the bulk-selection features in each view to save time!</p>
                <p className='text-muted-foreground text-xs mt-1'>
                    This helps admins schedule practices and scrims effectively. Players who do not submit availability may not be included in the roster.
                </p>
            </AlertDescription>
        </Alert>
    );
}
