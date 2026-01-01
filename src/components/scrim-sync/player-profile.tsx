'use client';

import * as React from 'react';
import { PlayerProfileData } from '@/lib/types';
import { gameRoles } from '@/lib/types';
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
import { User, Loader, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

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
          Set your name, favorite tank, and preferred role.
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
