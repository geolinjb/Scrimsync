'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PublicRoster } from '@/components/scrim-sync/public-roster';
import { FirebaseClientProvider } from '@/firebase/client-provider';

export default function RosterPage() {
  return (
    <FirebaseClientProvider>
      <div className="flex flex-col min-h-screen bg-background">
        <header className="border-b">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Trophy className="w-8 h-8 text-gold" />
                    <h1 className="text-2xl font-bold tracking-tight text-gold font-headline">
                        TeamSync
                    </h1>
                </div>
                 <Button asChild variant="outline">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Home
                    </Link>
                 </Button>
            </div>
        </header>
        <main className="flex-1 container mx-auto px-4 py-8">
          <PublicRoster />
        </main>
      </div>
    </FirebaseClientProvider>
  );
}
