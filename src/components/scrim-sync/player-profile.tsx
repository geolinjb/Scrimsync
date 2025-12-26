'use client';

import { PlayerProfileData } from '@/lib/types';
import { gameRoles } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
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
import { User, Loader } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

type PlayerProfileProps = {
  profile: PlayerProfileData;
  onProfileChange: (profile: PlayerProfileData) => void;
  isSaving: boolean;
};

export function PlayerProfile({ profile, onProfileChange, isSaving }: PlayerProfileProps) {
  
  const handleInputChange = (field: keyof PlayerProfileData, value: string) => {
    onProfileChange({ ...profile, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6" />
            <CardTitle>Player Profile</CardTitle>
          </div>
          <Loader className={cn("w-5 h-5 text-muted-foreground animate-spin", isSaving ? "opacity-100" : "opacity-0")} />
        </div>
        <CardDescription>
          Set your name, favorite tank, and preferred role. This is saved automatically.
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
            onValueChange={(value: (typeof gameRoles)[number]) =>
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
    </Card>
  );
}
