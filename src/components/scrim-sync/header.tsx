'use client';

import { LogOut, Trophy } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useToast } from '@/hooks/use-toast';

export function Header() {
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const copyToClipboard = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid).then(() => {
        toast({
          title: "UID Copied",
          description: "Your User ID has been copied to the clipboard.",
        });
      }, (err) => {
        console.error('Could not copy text: ', err);
      });
    }
  }

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">
            ScrimSync
          </h1>
        </div>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.photoURL ?? `https://api.dicebear.com/8.x/pixel-art/svg?seed=${user.uid}`} alt={user.displayName ?? 'User'} />
                  <AvatarFallback>{user.displayName?.charAt(0).toUpperCase() ?? 'U'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="font-normal">
                <div 
                  className="flex flex-col space-y-2 cursor-pointer"
                  onClick={copyToClipboard}
                  title="Click to copy your UID"
                >
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Your Admin UID</p>
                  <p className="text-xs leading-none text-foreground break-all">
                    {user.uid}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
