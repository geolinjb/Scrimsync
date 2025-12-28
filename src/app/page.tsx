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
      if (firebaseError.code !== 'auth/popup-closed-by-user' && firebaseError.code !== 'auth/cancelled-popup-request') {
        console.error("Error during sign-in:", error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const FADE_IN_VARIANTS = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring" } },
  };

  if (isUserLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
          <motion.div
            initial="hidden"
            animate="show"
            variants={FADE_IN_VARIANTS}
            className="flex flex-col items-center justify-center text-center"
          >
            <div className="relative mb-4">
              <Loader className="w-16 h-16 text-primary animate-spin" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground">
              Connecting to Firebase...
            </h2>
            <p className="text-muted-foreground mt-2">
              Syncing your data, just a moment.
            </p>
          </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen bg-background text-center p-4 overflow-hidden">
            <div 
              className="absolute inset-0 bg-repeat bg-center"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                maskImage: 'radial-gradient(ellipse at center, white 5%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, white 5%, transparent 70%)'
              }}
            />
            <AnimatePresence>
                <motion.div
                    className="flex flex-col items-center justify-center"
                    initial="hidden"
                    animate="show"
                    variants={{
                        show: {
                            transition: {
                                staggerChildren: 0.1,
                            },
                        },
                    }}
                >
                    <motion.h1 
                        className="text-5xl font-bold tracking-tight text-foreground font-headline mb-4"
                        variants={FADE_IN_VARIANTS}
                    >
                        Welcome to ScrimSync
                    </motion.h1>
                    <motion.p 
                        className="text-xl text-muted-foreground mb-8 max-w-2xl"
                        variants={FADE_IN_VARIANTS}
                    >
                        Coordinate your team's practice schedules and availability, effortlessly.
                    </motion.p>
                    <motion.div variants={FADE_IN_VARIANTS}>
                        <Button onClick={handleLogin} size="lg" disabled={!auth || isLoggingIn}>
                        {isLoggingIn ? (
                            <Loader className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                            <Chrome className="mr-2 h-5 w-5" />
                        )}
                        {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
                        </Button>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        </div>
    )
  }

  return <ScrimSyncDashboard user={user} />;
}
