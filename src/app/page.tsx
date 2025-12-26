'use client';

import { ScrimSyncDashboard } from '@/components/scrim-sync/scrim-sync-dashboard';
import { useAuth, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Loader, Chrome } from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup, type FirebaseError } from 'firebase/auth';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();

  const handleLogin = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      const firebaseError = error as FirebaseError;
      // This error occurs when the user closes the popup.
      // It's a normal user action, so we can safely ignore it.
      if (firebaseError.code !== 'auth/popup-closed-by-user') {
        console.error("Error during sign-in:", error);
      }
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader className="w-12 h-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading ScrimSync...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center p-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground font-headline mb-4">Welcome to ScrimSync</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl">The easiest way to coordinate your team's practice schedules and availability.</p>
          <Button onClick={handleLogin} size="lg">
            <Chrome className="mr-2 h-5 w-5" />
            Sign in with Google
          </Button>
      </div>
    )
  }

  return <ScrimSyncDashboard user={user} />;
}
