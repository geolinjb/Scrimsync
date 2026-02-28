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
import { Loader, Save, Shield, Swords, UploadCloud, Copy, Trash2, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useFirebaseApp, useAuth, useFirestore } from '@/firebase';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, type UploadTask } from 'firebase/storage';
import { doc, writeBatch, query, where, getDocs, collection } from 'firebase/firestore';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

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
    setHasChanges(true);
  };

  const handleAvatarSelect = (url: string) => {
    setProfile(prev => ({ ...prev, photoURL: url }));
    setHasChanges(true);
    setIsAvatarDialogOpen(false);
  }

  const handleSave = () => {
    onSave(profile);
    setHasChanges(false);
  }

  const handleAvatarUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firebaseApp || !profile.id) return;
    setUploadProgress(0);
    try {
        const storage = getStorage(firebaseApp);
        const fileRef = storageRef(storage, `avatars/${profile.id}/${file.name}`);
        const uploadTask: UploadTask = uploadBytesResumable(fileRef, file);
        uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100));
        await uploadTask;
        const newPhotoURL = await getDownloadURL(uploadTask.snapshot.ref);
        handleAvatarSelect(newPhotoURL);
        toast({ title: 'Avatar Ready!', description: 'Click "Save Profile" to apply.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Upload Failed' });
    } finally {
        setUploadProgress(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!firestore || !profile.id) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(firestore);
      batch.delete(doc(firestore, 'users', profile.id));
      const vSnap = await getDocs(query(collection(firestore, 'votes'), where('userId', '==', profile.id)));
      vSnap.forEach(v => batch.delete(v.ref));
      const oSnap = await getDocs(query(collection(firestore, 'availabilityOverrides'), where('userId', '==', profile.id)));
      oSnap.forEach(o => batch.delete(o.ref));
      await batch.commit();
      toast({ title: 'Account Deleted' });
      setTimeout(async () => { if (auth) await signOut(auth); }, 2000);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Deletion Failed' });
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) return <Card className="p-6"><Skeleton className="h-24 w-24 rounded-full mx-auto" /><Skeleton className="h-10 w-full mt-4" /></Card>;

  return (
    <Card>
      <CardHeader className="items-center">
        <Avatar className="w-24 h-24 border-2 border-primary/50">
          <AvatarImage src={profile.photoURL ?? `https://api.dicebear.com/8.x/pixel-art/svg?seed=${profile.id}`} />
          <AvatarFallback>{profile.username?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
          <DialogTrigger asChild><Button variant="link" className="text-sm">Change Avatar</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader><DialogTitle>Choose Your Avatar</DialogTitle></DialogHeader>
            <div className='space-y-4'>
                <Button onClick={handleAvatarUploadClick} disabled={isUploading} className='w-full'>
                    {isUploading ? <Loader className='w-4 h-4 animate-spin mr-2' /> : <UploadCloud className='w-4 h-4 mr-2'/>}
                    {isUploading ? `Uploading... ${Math.round(uploadProgress!)}%` : 'Upload Your Own'}
                </Button>
                {isUploading && <Progress value={uploadProgress} className="h-2" />}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                <ScrollArea className='h-64'><div className='grid grid-cols-4 gap-4 p-1'>{preMadeAvatars.map((url) => (
                    <button key={url} onClick={() => handleAvatarSelect(url)} className={cn('rounded-full', profile.photoURL === url && 'ring-2 ring-primary')}><Avatar className='w-full h-auto'><AvatarImage src={url} /></Avatar></button>
                ))}</div></ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
        <div className='text-center'>
            <CardTitle>{profile.username}</CardTitle>
            <CardDescription>{profile.email}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2"><Label>Username</Label><Input value={profile.username} onChange={(e) => handleInputChange('username', e.target.value)} /></div>
        <div className="space-y-2">
            <div className='flex items-center gap-2'>
                <Label>Discord User ID</Label>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="max-w-xs text-xs">Enter your numeric Discord User ID (e.g., 1234567890) to enable automatic tagging in notifications. You can get this by right-clicking your name in Discord with "Developer Mode" enabled.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            <Input 
                value={profile.discordUsername ?? ''} 
                placeholder="Numeric ID (e.g. 118428425023442057)"
                onChange={(e) => handleInputChange('discordUsername', e.target.value)} 
            />
        </div>
        <div className="space-y-2"><Label>Favorite Tank</Label><Input value={profile.favoriteTank} onChange={(e) => handleInputChange('favoriteTank', e.target.value)} /></div>
        <div className="space-y-2"><Label>Favorite Role</Label><Select value={profile.role} onValueChange={(v) => handleInputChange('role', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{gameRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex flex-wrap gap-2 pt-2">
            {profile.rosterStatus && <Badge className="bg-gold text-black">{profile.rosterStatus}</Badge>}
            {profile.playstyleTags?.map(t => <Badge key={t} variant="outline">{t}</Badge>)}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button onClick={handleSave} disabled={isSaving || !hasChanges || isUploading} className='w-full'>{isSaving ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save Profile</Button>
        <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive" className="w-full" disabled={isDeleting}>{isDeleting ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}Delete Account</Button></AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete your account?</AlertDialogTitle><AlertDialogDescription>This will permanently remove all your data. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive">Delete My Account</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
