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
import { User, Loader, Save, Shield, Swords, UploadCloud, Image as ImageIcon, Copy, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useFirebaseApp, useAuth, useFirestore } from '@/firebase';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, type UploadTask } from 'firebase/storage';
import { doc, updateDoc, writeBatch, query, where, getDocs, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Progress } from '../ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { signOut } from 'firebase/auth';


type PlayerProfileProps = {
  initialProfile: PlayerProfileData & { email?: string | null };
  onSave: (profile: PlayerProfileData) => void;
  isSaving: boolean;
  isLoading: boolean;
};

const preMadeAvatars = Array.from({ length: 20 }, (_, i) => `https://api.dicebear.com/8.x/pixel-art/svg?seed=${i+1}`);


export function PlayerProfile({ initialProfile, onSave, isSaving, isLoading }: PlayerProfileProps) {
  const [profile, setProfile] = React.useState(initialProfile);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const firebaseApp = useFirebaseApp();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const isUploading = uploadProgress !== null;

  React.useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);
  
  const handleInputChange = (field: keyof PlayerProfileData, value: string | string[]) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    if (!hasChanges) setHasChanges(true);
  };

  const handleAvatarSelect = (url: string) => {
    setProfile(prev => ({ ...prev, photoURL: url }));
    if (!hasChanges) setHasChanges(true);
    setIsAvatarDialogOpen(false);
  }

  const handleSave = () => {
    onSave(profile);
    setHasChanges(false);
  }

  const handleAvatarUploadClick = () => {
    fileInputRef.current?.click();
  };

  const copyUid = () => {
    navigator.clipboard.writeText(profile.id);
    toast({
      title: 'UID Copied!',
      description: 'Your User ID has been copied to the clipboard.',
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firebaseApp || !firestore || !profile.id) {
      toast({
        variant: 'destructive',
        title: 'Upload Error',
        description: 'No file selected or user/backend service unavailable.',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        variant: 'destructive',
        title: 'File Too Large',
        description: 'Please select an image smaller than 5MB.',
      });
      return;
    }

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
            }
        );
        
        await uploadTask;

        const newPhotoURL = await getDownloadURL(uploadTask.snapshot.ref);

        handleAvatarSelect(newPhotoURL);
        
        toast({
          title: 'Avatar Ready!',
          description: 'Your new avatar is ready. Click "Save Profile" to apply all changes.',
        });
        setIsAvatarDialogOpen(false);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: 'There was an error uploading your avatar. You may not have permission.',
      });
    } finally {
        setUploadProgress(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAccount = async () => {
    if (!firestore || !profile.id) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(firestore);
      
      // 1. Delete user profile
      const userRef = doc(firestore, 'users', profile.id);
      batch.delete(userRef);
  
      // 2. Find and delete all votes by that user
      const votesQueryInstance = query(collection(firestore, 'votes'), where('userId', '==', profile.id));
      const votesSnapshot = await getDocs(votesQueryInstance);
      votesSnapshot.forEach(voteDoc => {
          batch.delete(voteDoc.ref);
      });
  
      // 3. Find and delete all availability overrides for that user
      const overridesQueryInstance = query(collection(firestore, 'availabilityOverrides'), where('userId', '==', profile.id));
      const overridesSnapshot = await getDocs(overridesQueryInstance);
      overridesSnapshot.forEach(overrideDoc => {
          batch.delete(overrideDoc.ref);
      });
  
      await batch.commit();

      toast({
          title: 'Account Deleted',
          description: `Your account and all associated data have been removed. You will now be signed out.`,
      });

      // Sign out after a short delay to allow toast to be seen
      setTimeout(async () => {
        if (auth) {
            await signOut(auth);
        }
      }, 2000);

    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: 'Could not delete your account. You may not have permission or there was a network issue.',
      });
    } finally {
      setIsDeleting(false);
    }
  }

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
        <Avatar className="w-24 h-24 border-2 border-primary/50">
          <AvatarImage src={profile.photoURL ?? `https://api.dicebear.com/8.x/pixel-art/svg?seed=${profile.id}`} alt={profile.username} />
          <AvatarFallback>{profile.username?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        
        <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="link" className="text-sm">Change Avatar</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Choose Your Avatar</DialogTitle>
              <DialogDescription>
                Select a pre-made avatar or upload your own picture (max 5MB).
              </DialogDescription>
            </DialogHeader>
            <div className='space-y-4'>
                <Button onClick={handleAvatarUploadClick} disabled={isUploading} className='w-full'>
                    {isUploading ? <Loader className='w-4 h-4 animate-spin mr-2' /> : <UploadCloud className='w-4 h-4 mr-2'/>}
                    {isUploading ? `Uploading... ${Math.round(uploadProgress!)}%` : 'Upload Your Own'}
                </Button>
                {isUploading && <Progress value={uploadProgress} className="h-2" />}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" className="hidden" />

                <div className='flex items-center gap-2'>
                    <Separator className='flex-1'/>
                    <span className='text-xs text-muted-foreground'>OR</span>
                    <Separator className='flex-1'/>
                </div>

                <ScrollArea className='h-64'>
                    <div className='grid grid-cols-4 gap-4 p-1'>
                        {preMadeAvatars.map((url) => (
                            <button key={url} onClick={() => handleAvatarSelect(url)} className={cn('rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', profile.photoURL === url && 'ring-2 ring-primary')}>
                                <Avatar className='w-full h-auto'>
                                    <AvatarImage src={url} alt="Pre-made avatar" />
                                    <AvatarFallback>AV</AvatarFallback>
                                </Avatar>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
        
        <div className='text-center'>
            <CardTitle className='mt-2'>{profile.username}</CardTitle>
            <CardDescription>{profile.email}</CardDescription>
            <div className='flex items-center justify-center gap-2 mt-2'>
                <Badge variant="outline" className="text-xs truncate max-w-[200px]">{profile.id}</Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyUid}>
                    <Copy className="h-3 w-3" />
                </Button>
            </div>
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
      <CardFooter className="flex flex-col gap-2">
        <Button onClick={handleSave} disabled={isSaving || !hasChanges || isUploading || isDeleting} className='w-full'>
            {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isSaving ? 'Saving...' : 'Save Profile'}
        </Button>
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={isDeleting}>
                    {isDeleting ? <Loader className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    {isDeleting ? 'Deleting...' : 'Delete Account'}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account
                        and remove all your voting and availability data from our servers.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive hover:bg-destructive/90">
                        Yes, Delete My Account
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
