'use client';

import * as React from 'react';
import { PlayerProfileData, gameRoles } from '@/lib/types';
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
import { User, Loader, Save, Shield, Swords, UploadCloud } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, UploadTask } from "firebase/storage";
import { useFirebaseApp } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { updateProfile } from 'firebase/auth';
import { Progress } from '../ui/progress';

type PlayerProfileProps = {
  initialProfile: PlayerProfileData & { photoURL?: string | null, email?: string | null };
  onSave: (profile: PlayerProfileData) => void;
  isSaving: boolean;
  isLoading: boolean;
};

export function PlayerProfile({ initialProfile, onSave, isSaving, isLoading }: PlayerProfileProps) {
  const [profile, setProfile] = React.useState(initialProfile);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const firebaseApp = useFirebaseApp();
  const { toast } = useToast();


  React.useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);
  
  const handleInputChange = (field: keyof PlayerProfileData, value: string | string[]) => {
    setProfile({ ...profile, [field]: value });
    if (!hasChanges) setHasChanges(true);
  };

  const handleSave = () => {
    onSave(profile);
    setHasChanges(false);
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firebaseApp) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        variant: 'destructive',
        title: 'File Too Large',
        description: 'Please select an image smaller than 5MB.',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const storage = getStorage(firebaseApp);
      const filePath = `avatars/${profile.id}/${file.name}`;
      const fileRef = storageRef(storage, filePath);
      
      const uploadTask: UploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Error uploading file:", error);
          toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'There was an error uploading your avatar. Please try again.',
          });
          setIsUploading(false);
          setUploadProgress(0);
        },
        async () => {
          const photoURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Also update the auth user profile if possible
          const auth = (await import('firebase/auth')).getAuth(firebaseApp);
          if (auth.currentUser) {
            await updateProfile(auth.currentUser, { photoURL });
          }

          handleInputChange('photoURL', photoURL);
          // Automatically save the profile after successful upload
          onSave({ ...profile, photoURL });
          setHasChanges(false);

          toast({
            title: 'Avatar Updated!',
            description: 'Your new profile picture has been saved.',
          });

          setIsUploading(false);
          setUploadProgress(0);
        }
      );
    } catch (error) {
      console.error("Error setting up upload:", error);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: 'Could not start the upload process. Please try again.',
      });
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (isLoading) {
    return (
        <Card>
            <CardHeader className="items-center">
                <Skeleton className="h-24 w-24 rounded-full" />
                <Skeleton className="h-6 w-3/4 mt-4" />
                <Skeleton className="h-4 w-1/2" />
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
      <CardHeader className="items-center">
        <div className="relative group">
          <Avatar className="w-24 h-24 border-2 border-primary/50 cursor-pointer" onClick={handleAvatarClick}>
            <AvatarImage src={profile.photoURL ?? `https://api.dicebear.com/8.x/pixel-art/svg?seed=${profile.id}`} alt={profile.username} />
            <AvatarFallback>{profile.username?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={handleAvatarClick}>
            {isUploading ? <Loader className="w-8 h-8 text-white animate-spin" /> : <UploadCloud className="w-8 h-8 text-white" />}
          </div>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" className="hidden" />
        {isUploading && (
          <div className="w-full px-8 pt-2">
             <Progress value={uploadProgress} className="h-2" />
          </div>
        )}
        <div className='text-center'>
            <CardTitle className='mt-4'>{profile.username}</CardTitle>
            <CardDescription>{profile.email}</CardDescription>
        </div>
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
            <Label>Your Status & Tags</Label>
            <div className="flex flex-wrap gap-2 rounded-md border bg-muted min-h-[40px] p-2 items-center">
              {profile.rosterStatus ? (
                <Badge variant={profile.rosterStatus === 'Main Roster' ? 'default' : 'secondary'} className={cn('text-sm', profile.rosterStatus === 'Main Roster' && 'bg-gold text-black hover:bg-gold/90')}>
                  <Shield className="w-3 h-3 mr-1.5" />
                  {profile.rosterStatus}
                </Badge>
              ) : null}
               {profile.playstyleTags && profile.playstyleTags.map(tag => (
                <Badge key={tag} variant="outline" className="text-sm">
                  <Swords className="w-3 h-3 mr-1.5" />
                  {tag}
                </Badge>
              ))}
              {(!profile.playstyleTags || profile.playstyleTags.length === 0) && !profile.rosterStatus && (
                 <span className="text-sm text-muted-foreground px-1">No status or tags assigned.</span>
              )}
            </div>
          </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving || !hasChanges || isUploading} className='w-full'>
            {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isSaving ? 'Saving...' : 'Save Profile'}
        </Button>
      </CardFooter>
    </Card>
  );
}
