'use client';

import * as React from 'react';
import { PlayerProfileData, gameRoles, rosterStatuses, playstyleTags } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Loader, Save, Shield, Star, Swords } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

type PlayerProfileProps = {
  initialProfile: PlayerProfileData;
  onSave: (profile: PlayerProfileData) => void;
  isSaving: boolean;
  isLoading: boolean;
};

export function PlayerProfile({ initialProfile, onSave, isSaving, isLoading }: PlayerProfileProps) {
  const [profile, setProfile] = React.useState<PlayerProfileData>(initialProfile);
  const [hasChanges, setHasChanges] = React.useState(false);

  React.useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);
  
  const handleInputChange = (field: keyof PlayerProfileData, value: string) => {
    setProfile({ ...profile, [field]: value });
    if (!hasChanges) setHasChanges(true);
  };

  const handleSave = () => {
    onSave(profile);
    setHasChanges(false);
  }

  if (isLoading) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </CardContent>
            <CardFooter>
                <Skeleton className="h-10 w-full" />
            </CardFooter>
        </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-gold" />
            <CardTitle>Player Profile</CardTitle>
        </div>
        <CardDescription>
          Set your name, favorite tank, and preferred role. Your assigned tags are managed by admins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            placeholder="e.g., TankCommander"
            value={profile.username}
            onChange={(e) =>
              handleInputChange('username', e.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="favorite-tank">Favorite Tank</Label>
          <Input
            id="favorite-tank"
            placeholder="e.g., Tiger II"
            value={profile.favoriteTank}
            onChange={(e) =>
              handleInputChange('favoriteTank', e.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Favorite Role</Label>
          <Select
            value={profile.role}
            onValueChange={(value) =>
              handleInputChange('role', value)
            }
          >
            <SelectTrigger id="role">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {gameRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
         <div className="space-y-2">
            <Label>Your Tags</Label>
            <div className="flex flex-wrap gap-2 rounded-md border bg-muted min-h-[40px] p-2 items-center">
              {profile.rosterStatus ? (
                <Badge variant={profile.rosterStatus === 'Main Roster' ? 'default' : 'secondary'} className={cn('text-sm', profile.rosterStatus === 'Main Roster' && 'bg-gold text-black hover:bg-gold/90')}>
                  <Shield className="w-3 h-3 mr-1.5" />
                  {profile.rosterStatus}
                </Badge>
              ) : (
                 <span className="text-sm text-muted-foreground px-1">No roster status assigned.</span>
              )}

              {profile.playstyleTags && profile.playstyleTags.map(tag => (
                <Badge key={tag} variant="outline" className='text-sm'>
                  <Swords className="w-3 h-3 mr-1.5" />
                  {tag}
                </Badge>
              ))}
              {(!profile.playstyleTags || profile.playstyleTags.length === 0) && (
                 <span className="text-sm text-muted-foreground px-1">No playstyle tags assigned.</span>
              )}
            </div>
          </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving || !hasChanges} className='w-full'>
            {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isSaving ? 'Saving...' : 'Save Profile'}
        </Button>
      </CardFooter>
    </Card>
  );
}
