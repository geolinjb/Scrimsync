'use client';

import * as React from 'react';
import { ScrimSyncDashboard } from '@/components/scrim-sync/scrim-sync-dashboard';
import { useAuth, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Loader, Chrome } from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup, type FirebaseError } from 'firebase/auth';
import { AnimatePresence, motion } from 'framer-motion';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  const handleLogin = async () => {
    if (!auth || isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      const firebaseError = error as FirebaseError;
      // This error occurs when the user closes the popup or cancels the request.
      // It's a normal user action, so we can safely ignore it.
      if (firebaseError.code !== 'auth/popup-closed-by-user' && firebaseError.code !== 'auth/cancelled-popup-request') {
        console.error("Error during sign-in:", error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center text-center"
          >
            <div className="relative mb-4">
              <Loader className="w-16 h-16 text-primary animate-spin" />
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1, transition: { delay: 0.2 } }}
              >
                <svg
                  className="w-8 h-8 text-yellow-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M18.829 5.303a11.034 11.034 0 00-13.658 0L4 6.46l5.732 5.733-4.508 4.508 1.157 1.157 4.508-4.508L16.62 19.18l1.157-1.157-4.508-4.508L19.999 7.62l-1.17-2.317z" />
                </svg>
              </motion.div>
            </div>
            <h2 className="text-2xl font-semibold text-foreground">
              Connecting to Firebase...
            </h2>
            <p className="text-muted-foreground mt-2">
              Syncing your data, just a moment.
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center p-4">
        <AnimatePresence>
          <motion.div
            className="flex flex-col items-center justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold tracking-tight text-foreground font-headline mb-4">Welcome to ScrimSync</h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl">The easiest way to coordinate your team's practice schedules and availability.</p>
            <Button onClick={handleLogin} size="lg" disabled={!auth || isLoggingIn}>
              {isLoggingIn ? (
                <Loader className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Chrome className="mr-2 h-5 w-5" />
              )}
              {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
            </Button>
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  return <ScrimSyncDashboard user={user} />;
}
